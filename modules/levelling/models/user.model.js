import mongoose from 'mongoose';
import { emitter, eventTypes } from 'endurance-core/lib/emitter.js';

import Quest from '../models/quest.model.js';

const userSchema = new mongoose.Schema({
    firstname: {
        type: String,
        required: true,
    },
    lastname: {
        type: String,
        required: true,
    },
    xpHistory: [{
        amount: {
            type: Number,
            required: true,
        },
        date: {
            type: Date,
            required: true,
        },
        note: {
            type: String,
            required: true,
        },
        questId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Quest', // Reference to the Quest model
            required: false,
        }
    }],
    discordId: {
        type: String,
        required: false,
    },
    completedQuests: [{
        quest: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Quest', // Reference to the Quest model
            required: true,
        },
        completionDate: {
            type: Date,
            required: true,
        }
    }],
    badges: [{
        badge: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Badge', // Reference to the Badge model
            required: true,
        },
        awardedDate: {
            type: Date,
            required: true,
        }
    }],
});


userSchema.methods.getXP = function () {
    return this.xpHistory.reduce((total, entry) => total + entry.amount, 0);
};


userSchema.methods.getLevel = function () {
    let totalXP = this.getXP();
    let level = 1;

    let baseXP = process.env.LEVELLING_BASE_XP ? process.env.LEVELLING_BASE_XP : 500;
    let xpForNextLevel = baseXP;
    let coefficient = process.env.LEVELLING_COEFFICIENT ? process.env.LEVELLING_COEFFICIENT : 1.3;

    while (totalXP >= xpForNextLevel) {
        totalXP -= xpForNextLevel;
        level++;
        xpForNextLevel = Math.floor(baseXP * Math.pow(coefficient, level - 1));
    }
    return level;
}


userSchema.methods.addXP = function (amount, note, questId = null) {
    if (typeof amount !== 'number' || amount <= 0) {
        throw new Error('The amount must be a positive number.');
    }
    if (typeof note !== 'string' || note.trim() === '') {
        throw new Error('The note must be a non-empty string.');
    }

    if (!Array.isArray(this.xpHistory)) {
        this.xpHistory = [];
    }

    const levelBefore = this.getLevel(); // Calculate the level before adding XP

    const entry = {
        amount: amount,
        date: new Date(),
        note: note,
        questId: questId // Add questId to the entry, if provided
    };
    this.xpHistory.push(entry);

    return this.save().then(() => {
        const levelAfter = this.getLevel(); // Calculate the level after adding XP
        if (levelAfter > levelBefore) {
            // Emit an event if the user has gained a level
            emitter.emit(eventTypes.LEVELLING_LEVEL_UP, { userId: this._id, newLevel: levelAfter });
        }
    });
};

userSchema.methods.completeQuest = async function (questId) {
    try {
        // Fetch the quest details
        const quest = await Quest.findById(questId).populate('badgeReward').exec();
        if (!quest) {
            throw new Error('Quest not found.');
        }

        if (!Array.isArray(this.completedQuests)) {
            this.completedQuests = [];
        }

        // Check if the quest has already been completed
        if (this.completedQuests.some(completedQuest => completedQuest.quest.equals(questId))) {
            throw new Error('Quest has already been completed.');
        }

        this.completedQuests.push({ quest: new mongoose.Types.ObjectId(questId), completionDate: new Date() });

        // Add XP reward to the user with questId
        await this.addXP(quest.xpReward, `Completed quest: ${quest.name}`, questId);
 
        // Optionally, handle badge rewards if applicable
        if (quest.badgeReward) {
            if (!Array.isArray(this.badges)) {
                this.badges = [];
            }
            // Check if the badge is already possessed
            const badgeExists = this.badges.some(badge => badge.badge.equals(quest.badgeReward));
            if (!badgeExists) {
                this.badges.push({
                    badge: quest.badgeReward._id,
                    awardedDate: new Date()
                });
            }
        }

        // Save the user document
        await this.save();
        // Emit an event for quest completion
        emitter.emit(eventTypes.LEVELLING_QUEST_COMPLETED, { 
            firstname: this.firstname, 
            lastname: this.lastname, 
            questName: quest.name, 
            badgeName: quest.badgeReward ? quest.badgeReward.name : undefined 
        });
        console.log(`Quest completed: ${quest.name} for user ${this._id}`);
    } catch (error) {
        console.error(`Error completing quest for user ${this._id}:`, error);
        throw error;
    }
};


const User = mongoose.model('UserLevelling', userSchema, 'users');

export default User;
