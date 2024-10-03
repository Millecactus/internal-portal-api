import mongoose from 'mongoose';

const badgeSchema = new mongoose.Schema({
    id: {
        type: Number,
        required: true,
        unique: true,
        default: async function() {
            const lastBadge = await mongoose.model('Badge').findOne().sort({ id: -1 }).exec();
            return lastBadge ? lastBadge.id + 1 : 1;
        }
    },
    name: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    }
});
badgeSchema.pre('remove', async function(next) {
    try {
        // Remove badgeReward from all quests that have this badge as a reward
        await mongoose.model('Quest').updateMany(
            { badgeReward: this._id },
            { $unset: { badgeReward: "" } }
        ).exec();

        // Find all users who have this badge
        const users = await mongoose.model('UserLevelling').find({ 'badges.badge': this._id }).exec();

        // Iterate over each user and remove the badge from their badges
        for (const user of users) {
            user.badges = user.badges.filter(userBadge => !userBadge.badge.equals(this._id));
            await user.save();
        }

        next();
    } catch (error) {
        console.error('Error removing badge from quests and users:', error);
        next(error);
    }
});

const Badge = mongoose.model('Badge', badgeSchema, 'badges');

export default Badge;
