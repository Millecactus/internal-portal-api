import { enduranceEmitter, enduranceEventTypes, EnduranceSchema, EnduranceModelType, EnduranceDocumentType } from 'endurance-core';
import Quest from './quest.model.js';
import Badge from './badge.model.js';
import { Types } from 'mongoose';

class XPHistory extends EnduranceSchema {
    @EnduranceModelType.prop({ required: true })
    public amount!: number;

    @EnduranceModelType.prop({ required: true })
    public date!: Date;

    @EnduranceModelType.prop({ required: true })
    public note!: string;

    @EnduranceModelType.prop({ ref: () => Quest })
    public questId?: Types.ObjectId;
}

class CompletedQuest extends EnduranceSchema {
    @EnduranceModelType.prop({ ref: () => Quest, required: true })
    public quest!: Types.ObjectId;

    @EnduranceModelType.prop({ required: true })
    public completionDate!: Date;
}

class UserBadge extends EnduranceSchema {
    @EnduranceModelType.prop({ ref: () => Badge, required: true })
    public badge!: Types.ObjectId;

    @EnduranceModelType.prop({ required: true })
    public awardedDate!: Date;
}

class User extends EnduranceSchema {
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

    public getXP(): number {
        return this.xpHistory.reduce((total, entry) => total + entry.amount, 0);
    }

    public getLevel(): number {
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

    public getXPforNextLevel(): number {
        const level = this.getLevel();
        const baseXP = process.env.LEVELLING_BASE_XP ? parseInt(process.env.LEVELLING_BASE_XP) : 500;
        const coefficient = process.env.LEVELLING_COEFFICIENT ? parseFloat(process.env.LEVELLING_COEFFICIENT) : 1.3;
        return Math.floor(baseXP * Math.pow(coefficient, level - 1));
    }

    public async addXP(this: EnduranceDocumentType<User>, amount: number, note: string, questId?: typeof Quest): Promise<void> {
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
            entry.questId = new Types.ObjectId(questId.toString());
        }
        this.xpHistory.push(entry);

        await this.save();
        const levelAfter = this.getLevel();
        if (levelAfter > levelBefore) {
            enduranceEmitter.emit(enduranceEventTypes.LEVELLING_LEVEL_UP, { userId: this.id, newLevel: levelAfter });
        }
    }

    public async completeQuest(this: EnduranceDocumentType<User>, questId: typeof Quest): Promise<void> {
        try {
            const quest = await Quest.findById(questId).populate('badgeReward').exec();
            if (!quest) {
                throw new Error('Quest not found.');
            }

            if (!Array.isArray(this.completedQuests)) {
                this.completedQuests = [];
            }

            if (this.completedQuests.some(completedQuest => completedQuest.quest.toString() === questId.toString())) {
                throw new Error('Quest has already been completed.');
            }

            const completedQuest = new CompletedQuest();
            completedQuest.quest = new Types.ObjectId(questId.toString());
            completedQuest.completionDate = new Date();
            this.completedQuests.push(completedQuest);

            await this.addXP(quest.xpReward, `Completed quest: ${quest.name}`, questId);

            if (quest.badgeReward) {
                if (!Array.isArray(this.badges)) {
                    this.badges = [];
                }
                const badgeExists = this.badges.some(badge => badge.badge.toString() === (quest.badgeReward as any)?.toString());
                if (!badgeExists && quest.badgeReward) {
                    const userBadge = new UserBadge();
                    userBadge.badge = new Types.ObjectId((quest.badgeReward as any).toString());
                    userBadge.awardedDate = new Date();
                    this.badges.push(userBadge);
                }
            }

            await this.save();
            enduranceEmitter.emit(enduranceEventTypes.LEVELLING_QUEST_COMPLETED, {
                firstname: this.firstname,
                lastname: this.lastname,
                questName: quest.name,
                badgeName: quest.badgeReward ? (quest.badgeReward as any).name : undefined
            });
            console.log(`Quest completed: ${quest.name} for user ${this.id}`);
        } catch (error) {
            console.error(`Error completing quest for user ${this.id}:`, error);
            throw error;
        }
    }
}

const UserModel = EnduranceModelType.getModelForClass(User);
export default UserModel;
