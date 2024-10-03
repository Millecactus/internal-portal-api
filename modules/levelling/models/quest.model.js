import mongoose from 'mongoose';

const questSchema = new mongoose.Schema({
    id: {
        type: Number,
        required: true,
        unique: true,
        default: async function() {
            const lastQuest = await mongoose.model('Quest').findOne().sort({ id: -1 }).exec();
            return lastQuest ? lastQuest.id + 1 : 1;
        }
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
    }
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


const Quest = mongoose.model('Quest', questSchema, 'quests');

export default Quest;
