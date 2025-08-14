import { enduranceListener, enduranceEventTypes } from '@programisto/endurance-core';
import Quest from '../models/quest.model.js';
import DiscordService, { QuestInstance } from '../services/discord.service.js';
import { registerCronJobs } from '../crons/daily-lootbox.cron.js';

async function generateDailyLootbox(): Promise<void> {
    try {
        await Quest.updateMany(
            { lootboxHour: { $exists: true }, endDate: { $lt: new Date() }, status: 'open' },
            { status: 'closed' }
        );

        let lootboxQuest = await Quest.getTodayQuestWithLootboxHour() as unknown as QuestInstance;
        console.log(lootboxQuest);

        if (!lootboxQuest) {
            const newQuest = new Quest({
                name: 'Daily Lootbox Quest',
                description: 'Complete this quest to earn your daily lootbox!',
                xpReward: 20,
                lootboxHour: Math.floor(Math.random() * (16 - 7 + 1)) + 7,
                startDate: new Date(),
                endDate: new Date(new Date().setDate(new Date().getDate() + 1)),
                status: 'open'
            });
            await newQuest.save();
            console.log('New daily lootbox quest created:', newQuest);
            lootboxQuest = newQuest as unknown as QuestInstance;
        }
        if (lootboxQuest && lootboxQuest.status === 'open') {
            const currentHour = new Date().getHours();
            console.log(currentHour);
            if (currentHour === lootboxQuest.lootboxHour) {
                await DiscordService.sendLootboxMessage(lootboxQuest);
            }
        }
    } catch (error) {
        console.error('Error processing daily lootbox quest:', error);
    }
}

async function generateDailyLootboxV2(): Promise<void> {
    try {
        await Quest.updateMany(
            { lootboxHour: { $exists: true }, endDate: { $lt: new Date() }, status: 'open' },
            { status: 'closed' }
        );

        let lootboxQuest = await Quest.getTodayQuestWithLootboxHour();
        console.log(lootboxQuest);

        if (!lootboxQuest) {
            const newQuest = new Quest({
                name: 'Daily Lootbox Quest',
                description: 'Complete this quest to earn your daily lootbox!',
                xpReward: 20,
                lootboxHour: Math.floor(Math.random() * (17 - 7 + 1)) + 7,
                startDate: new Date(),
                endDate: new Date(new Date().setDate(new Date().getDate() + 1)),
                status: 'draft'
            });
            await newQuest.save();
            console.log('New daily lootbox quest created:', newQuest);
            lootboxQuest = newQuest as any;

            if (lootboxQuest) {
                const randomMinute = Math.floor(Math.random() * 60);
                const date = new Date(lootboxQuest.startDate || new Date());
                const cronFormat = `${randomMinute} ${lootboxQuest.lootboxHour} ${date.getDate()} ${date.getMonth() + 1} *`;

                registerCronJobs(cronFormat);
            }
        }
    } catch (error) {
        console.error('Error processing daily lootbox quest:', error);
    }
}

const startDailyLootbox = async (): Promise<void> => {
    try {
        const lootboxQuest = await Quest.getTodayQuestWithLootboxHour() as any;
        if (lootboxQuest) {
            if (lootboxQuest.status === 'draft') {
                lootboxQuest.status = 'open';
                await lootboxQuest.save();
            }
            await DiscordService.sendLootboxMessage(lootboxQuest);
        }
    } catch (error) {
        console.error('Error starting daily lootbox:', error);
    }
}

enduranceListener.createListener(enduranceEventTypes.START_DAILY_LOOTBOX, () => {
    startDailyLootbox();
});

enduranceListener.createListener(enduranceEventTypes.GENERATE_DAILY_LOOTBOX_V2, () => {
    generateDailyLootboxV2();
});


export default enduranceListener;