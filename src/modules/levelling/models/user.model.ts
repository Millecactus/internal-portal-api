import { enduranceEmitter, enduranceEventTypes, EnduranceSchema, EnduranceModelType, EnduranceDocumentType, ObjectId } from '@programisto/endurance-core';
import Quest from './quest.model.js';
import Badge from './badge.model.js';
import { Types } from 'mongoose';

@EnduranceModelType.modelOptions({
    schemaOptions: {
        collection: 'users',
        timestamps: true,
        _id: true,
        validateBeforeSave: false
    }
})
class XPHistory extends EnduranceSchema {
    @EnduranceModelType.prop({ required: true })
    public amount!: number;

    @EnduranceModelType.prop({ required: true })
    public date!: Date;

    @EnduranceModelType.prop({ required: true })
    public note!: string;

    @EnduranceModelType.prop({ ref: 'Quest' })
    public questId?: ObjectId;
}

@EnduranceModelType.modelOptions({
    schemaOptions: {
        collection: 'users',
        timestamps: true,
        _id: true,
        validateBeforeSave: false
    }
})
class CompletedQuest extends EnduranceSchema {
    @EnduranceModelType.prop({ ref: 'Quest', required: true })
    public quest!: ObjectId;

    @EnduranceModelType.prop({ required: true })
    public completionDate!: Date;
}

@EnduranceModelType.modelOptions({
    schemaOptions: {
        collection: 'users',
        timestamps: true,
        _id: true,
        validateBeforeSave: false
    }
})
class UserBadge extends EnduranceSchema {
    @EnduranceModelType.prop({ ref: 'Badge', required: true })
    public badge!: ObjectId;

    @EnduranceModelType.prop({ required: true })
    public awardedDate!: Date;
}

@EnduranceModelType.modelOptions({
    schemaOptions: {
        collection: 'users',
        timestamps: true,
        toObject: { virtuals: true },
        toJSON: { virtuals: true },
        _id: true,
        validateBeforeSave: false
    }
})
class User extends EnduranceSchema {
    @EnduranceModelType.prop({ required: true, unique: true })
    public email!: string;

    @EnduranceModelType.prop({ required: true })
    public firstname!: string;

    @EnduranceModelType.prop({ required: true })
    public lastname!: string;

    @EnduranceModelType.prop({ type: () => [XPHistory] })
    public xpHistory!: XPHistory[];

    @EnduranceModelType.prop()
    public discordId?: string;

    @EnduranceModelType.prop({ type: () => [CompletedQuest] })
    public completedQuests!: CompletedQuest[];

    @EnduranceModelType.prop({ type: () => [UserBadge] })
    public badges!: UserBadge[];

    @EnduranceModelType.prop({ type: [Types.ObjectId], ref: 'Group', default: [] })
    public groups?: Types.ObjectId[];

    public getXP(): number {
        return this.xpHistory.reduce((total, entry) => total + entry.amount, 0);
    }

    public getLevel(this: EnduranceDocumentType<User>): number {
        let totalXP = this.getXP();
        let level = 1;
        const baseXP = process.env.LEVELLING_BASE_XP ? parseInt(process.env.LEVELLING_BASE_XP) : 500;
        const coefficient = process.env.LEVELLING_COEFFICIENT ? parseFloat(process.env.LEVELLING_COEFFICIENT) : 1.3;
        let xpForNextLevel = baseXP;

        while (totalXP >= xpForNextLevel) {
            totalXP -= xpForNextLevel;
            level++;
            xpForNextLevel = Math.floor(baseXP * Math.pow(coefficient, level - 1));
        }
        return level;
    }

    public getXPforNextLevel(this: EnduranceDocumentType<User>): number {
        const level = this.getLevel();
        const baseXP = process.env.LEVELLING_BASE_XP ? parseInt(process.env.LEVELLING_BASE_XP) : 500;
        const coefficient = process.env.LEVELLING_COEFFICIENT ? parseFloat(process.env.LEVELLING_COEFFICIENT) : 1.3;
        return Math.floor(baseXP * Math.pow(coefficient, level - 1));
    }

    public async addXP(this: EnduranceDocumentType<User>, amount: number, note: string, questId?: ObjectId): Promise<void> {
        console.log("ADD XP");
        if (typeof amount !== 'number' || amount <= 0) {
            throw new Error('The amount must be a positive number.');
        }
        if (typeof note !== 'string' || note.trim() === '') {
            throw new Error('The note must be a non-empty string.');
        }

        const xpHistory = this.get('xpHistory') || [];
        const levelBefore = this.getLevel();

        const entry = new XPHistory();
        entry.amount = amount;
        entry.date = new Date();
        entry.note = note;
        if (questId) {
            entry.questId = questId;
        }
        xpHistory.push(entry);
        console.log("BEFORE SET XP HISTORY");
        this.set('xpHistory', xpHistory);

        await this.save();
        const levelAfter = this.getLevel();
        if (levelAfter > levelBefore) {
            enduranceEmitter.emit(enduranceEventTypes.LEVELLING_LEVEL_UP, { userId: this._id, newLevel: levelAfter });
        }
    }

    public async completeQuest(this: EnduranceDocumentType<User>, questId: ObjectId): Promise<void> {
        console.log("COMPLETE QUEST");
        try {
            console.log("BEFORE QUEST");
            const quest = await Quest.findById(questId).populate('badgeReward').exec();
            if (!quest) {
                throw new Error('Quest not found.');
            }
            console.log("BEFORE COMPLETED QUEST");
            const completedQuests = this.get('completedQuests') || [];
            if (completedQuests.some((completedQuest: any) => completedQuest.quest.toString() === questId.toString())) {
                throw new Error('Quest has already been completed.');
            }

            const completedQuest = new CompletedQuest();
            completedQuest.quest = questId;
            completedQuest.completionDate = new Date();
            completedQuests.push(completedQuest);
            this.set('completedQuests', completedQuests);

            await this.addXP(quest.xpReward, `Completed quest: ${quest.name}`, questId);

            if (quest.badgeReward) {
                const badges = this.get('badges') || [];

                // Rechercher le badge dans la base de données
                const badgeDoc = await Badge.findById(quest.badgeReward).exec();
                if (badgeDoc) {
                    // Vérifier si le badge existe déjà dans l'array badges
                    const badgeExists = badges.some((userBadge: any) =>
                        userBadge.badge.toString() === quest.badgeReward?.toString()
                    );

                    if (!badgeExists) {
                        const userBadge = new UserBadge();
                        userBadge.badge = quest.badgeReward;
                        userBadge.awardedDate = new Date();
                        badges.push(userBadge);
                        this.set('badges', badges);
                    }
                }
            }
            console.log("BEFORE SAVE");
            await this.save();

            // Récupérer le nom du badge si nécessaire
            let badgeName;
            if (quest.badgeReward) {
                const badgeDoc = await Badge.findById(quest.badgeReward).exec();
                badgeName = badgeDoc?.name;
            }

            enduranceEmitter.emit(enduranceEventTypes.LEVELLING_QUEST_COMPLETED, {
                firstname: this.get('firstname'),
                lastname: this.get('lastname'),
                questName: quest.name,
                badgeName: badgeName
            });
            console.log(`Quest completed: ${quest.name} for user ${this._id}`);
        } catch (error) {
            console.error(`Error completing quest for user ${this._id}:`, error);
            throw error;
        }
    }
}

const UserModel = EnduranceModelType.getModelForClass(User, {
    schemaOptions: {
        collection: 'users',
        timestamps: true,
        toObject: { virtuals: true },
        toJSON: { virtuals: true }
    }
});

// Ajout des méthodes en tant que méthodes d'instance du modèle Mongoose
UserModel.prototype.getXP = function (this: EnduranceDocumentType<User>): number {
    // Utiliser la méthode get() de Mongoose pour accéder à xpHistory
    const xpHistory = (this as any).get('xpHistory');

    const xpHistoryArray = xpHistory && Array.isArray(xpHistory) ? xpHistory : [];

    return xpHistoryArray.reduce((total: number, entry: any) => {
        if (entry && typeof entry.amount === 'number') {
            return total + entry.amount;
        }
        return total;
    }, 0);
};

UserModel.prototype.getLevel = function (this: EnduranceDocumentType<User>): number {
    let totalXP = this.getXP();
    let level = 1;
    const baseXP = process.env.LEVELLING_BASE_XP ? parseInt(process.env.LEVELLING_BASE_XP) : 500;
    const coefficient = process.env.LEVELLING_COEFFICIENT ? parseFloat(process.env.LEVELLING_COEFFICIENT) : 1.3;
    let xpForNextLevel = baseXP;

    while (totalXP >= xpForNextLevel) {
        totalXP -= xpForNextLevel;
        level++;
        xpForNextLevel = Math.floor(baseXP * Math.pow(coefficient, level - 1));
    }
    return level;
};

UserModel.prototype.getXPforNextLevel = function (): number {
    const level = this.getLevel();
    const baseXP = process.env.LEVELLING_BASE_XP ? parseInt(process.env.LEVELLING_BASE_XP) : 500;
    const coefficient = process.env.LEVELLING_COEFFICIENT ? parseFloat(process.env.LEVELLING_COEFFICIENT) : 1.3;
    return Math.floor(baseXP * Math.pow(coefficient, level - 1));
};

UserModel.prototype.addXP = async function (amount: number, note: string, questId?: ObjectId): Promise<void> {
    if (typeof amount !== 'number' || amount <= 0) {
        throw new Error('The amount must be a positive number.');
    }
    if (typeof note !== 'string' || note.trim() === '') {
        throw new Error('The note must be a non-empty string.');
    }

    if (!Array.isArray(this.xpHistory)) {
        this.xpHistory = [];
    }

    const levelBefore = this.getLevel();

    const entry = new XPHistory();
    entry.amount = amount;
    entry.date = new Date();
    entry.note = note;
    if (questId) {
        entry.questId = questId;
    }
    this.xpHistory.push(entry);
    await this.save();
    const levelAfter = this.getLevel();
    if (levelAfter > levelBefore) {
        enduranceEmitter.emit(enduranceEventTypes.LEVELLING_LEVEL_UP, { userId: this._id, newLevel: levelAfter });
    }
};

UserModel.prototype.completeQuest = async function (this: EnduranceDocumentType<User>, questId: ObjectId): Promise<void> {
    try {
        const quest = await Quest.findById(questId).populate('badgeReward').exec();
        if (!quest) {
            throw new Error('Quest not found.');
        }
        const completedQuests = this.get('completedQuests') || [];
        if (completedQuests.some((completedQuest: any) => completedQuest.quest.toString() === questId.toString())) {
            throw new Error('Quest has already been completed.');
        }

        const completedQuest = new CompletedQuest();
        completedQuest.quest = questId;
        completedQuest.completionDate = new Date();
        completedQuests.push(completedQuest);
        this.set('completedQuests', completedQuests);
        await this.addXP(quest.xpReward, `Completed quest: ${quest.name}`, questId);
        if (quest.badgeReward) {
            const badges = this.get('badges') || [];

            // Rechercher le badge dans la base de données
            const badgeDoc = await Badge.findById(quest.badgeReward).exec();
            if (badgeDoc) {
                // Vérifier si le badge existe déjà dans l'array badges
                const badgeExists = badges.some((userBadge: any) =>
                    userBadge.badge.toString() === quest.badgeReward?.toString()
                );

                if (!badgeExists) {
                    const userBadge = new UserBadge();
                    userBadge.badge = quest.badgeReward;
                    userBadge.awardedDate = new Date();
                    badges.push(userBadge);
                    this.set('badges', badges);
                }
            }
        }
        await this.save();

        // Récupérer le nom du badge si nécessaire
        let badgeName;
        if (quest.badgeReward) {
            const badgeDoc = await Badge.findById(quest.badgeReward).exec();
            badgeName = badgeDoc?.name;
        }

        enduranceEmitter.emit(enduranceEventTypes.LEVELLING_QUEST_COMPLETED, {
            firstname: this.get('firstname'),
            lastname: this.get('lastname'),
            questName: quest.name,
            badgeName: badgeName
        });
        console.log(`Quest completed: ${quest.name} for user ${this._id}`);
    } catch (error) {
        console.error(`Error completing quest for user ${this._id}:`, error);
        throw error;
    }
};

export default UserModel;
export type UserDocument = EnduranceDocumentType<User>;
