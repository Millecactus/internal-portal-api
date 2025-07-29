import { EnduranceSchema, EnduranceModelType, EnduranceDocumentType, ObjectId } from '@programisto/endurance-core';
import User from './user.model.js';
import Group from './group.model.js';
import { Types } from 'mongoose';

@EnduranceModelType.pre<Quest>('deleteOne', async function (this: EnduranceDocumentType<Quest>, next) {
    try {
        const users = await User.find({ 'completedQuests.quest': this.id }).exec();
        for (const user of users) {
            user.completedQuests = user.completedQuests.filter(completedQuest => completedQuest.quest.toString() !== this.id.toString());
            await user.save();
        }
        next();
    } catch (error) {
        console.error('Error removing quest from users:', error);
        next(undefined);
    }
})

class Quest extends EnduranceSchema {

    @EnduranceModelType.prop({ required: true })
    public name!: string;

    @EnduranceModelType.prop({ required: true })
    public description!: string;

    @EnduranceModelType.prop()
    public startDate?: Date;

    @EnduranceModelType.prop()
    public endDate?: Date;

    @EnduranceModelType.prop({ required: true })
    public xpReward!: number;

    @EnduranceModelType.prop({ ref: 'Badge' })
    public badgeReward?: ObjectId;

    @EnduranceModelType.prop({ required: true, enum: ['draft', 'open', 'closed'], default: 'open' })
    public status!: string;

    @EnduranceModelType.prop({ min: 7, max: 16, default: 12 })
    public lootboxHour?: number;

    @EnduranceModelType.prop({ type: [Types.ObjectId], ref: 'User', default: [], required: false })
    public assignedUsers?: Types.ObjectId[];

    @EnduranceModelType.prop({ type: [Types.ObjectId], ref: 'Group', default: [], required: false })
    public assignedGroups?: Types.ObjectId[];

    static async getTodayQuestWithLootboxHour(): Promise<Quest | null> {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            const quest = await QuestModel.findOne({
                startDate: { $gte: today, $lt: tomorrow },
                lootboxHour: { $exists: true }
            }).sort({ id: -1 }).exec();

            return quest;
        } catch (error) {
            console.error('Error fetching today\'s quest with lootbox hour:', error);
            throw error;
        }
    }

    public static getModel() {
        return QuestModel;
    }
}

const QuestModel = EnduranceModelType.getModelForClass(Quest);
export default QuestModel;
