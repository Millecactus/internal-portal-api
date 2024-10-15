import mongoose from 'mongoose';

const questSchema = new mongoose.Schema({
    id: {
        type: Number,
        unique: true
    },
    name: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    startDate: {
        type: Date,
        required: false,
    },
    endDate: {
        type: Date,
        required: false,
    },
    xpReward: {
        type: Number,
        required: true,
    },
    badgeReward: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Badge', // Assumes a Badge model will be created separately
        required: false,
    },
    status: {
        type: String,
        enum: ['open', 'closed'],
        default: 'open',
        required: true,
    },
    lootboxHour: {
        type: Number,
        required: false,
        min: 7,
        max: 16,
        default: 12 // Default to noon if not specified
    }
});

questSchema.pre('save', async function(next) {
    if (this.isNew) { // Ne fait l'incrément que pour les nouveaux documents
        const lastQuest = await mongoose.model('Quest').findOne().sort({ id: -1 }).exec();
        this.id = lastQuest ? lastQuest.id + 1 : 1;
    }
    next();
});

questSchema.pre('remove', async function(next) {
    try {
        // Find all users who have completed this quest
        const users = await mongoose.model('UserLevelling').find({ 'completedQuests.quest': this._id }).exec();

        // Iterate over each user and remove the quest from their completedQuests
        for (const user of users) {
            user.completedQuests = user.completedQuests.filter(completedQuest => !completedQuest.quest.equals(this._id));
            await user.save();
        }

        next();
    } catch (error) {
        console.error('Error removing quest from users:', error);
        next(error);
    }
});

questSchema.statics.getTodayQuestWithLootboxHour = async function() {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Set to start of the day

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1); // Set to start of the next day

        // Find a quest that starts today and ends tomorrow with a lootbox hour
        const quest = await this.findOne({
            startDate: { $gte: today, $lt: tomorrow },
            lootboxHour: { $exists: true },
            status: 'open'
        }).exec();

        return quest;
    } catch (error) {
        console.error('Error fetching today\'s quest with lootbox hour:', error);
        throw error;
    }
};


const Quest = mongoose.model('Quest', questSchema, 'quests');

export default Quest;
