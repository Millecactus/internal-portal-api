import listener from 'endurance-core/dist/listener.js';
import { emitter, eventTypes } from 'endurance-core/dist/emitter.js';
import Quest from '../models/quest.model.js';
import DiscordService from '../services/discord.service.js';
import { registerCronJobs, unregisterCronJobs } from '../crons/daily-lootbox.cron.js';

async function generateDailyLootbox() {

    try {
        // Close any open lootbox quests from previous days
        await Quest.updateMany(
            { lootboxHour: { $exists: true }, endDate: { $lt: new Date() }, status: 'open' },
            { status: 'closed' }
        );

        // Check if today's lootbox quest exists
        var lootboxQuest = await Quest.getTodayQuestWithLootboxHour();
        console.log(lootboxQuest);

        if (!lootboxQuest) {
            // Create a new lootbox quest for today if it doesn't exist
            const newQuest = new Quest({
                name: 'Daily Lootbox Quest',
                description: 'Complete this quest to earn your daily lootbox!',
                xpReward: 20,
                lootboxHour: Math.floor(Math.random() * (16 - 7 + 1)) + 7, // Random number between 7 and 16
                startDate: new Date(),
                endDate: new Date(new Date().setDate(new Date().getDate() + 1)), // Ends the next day
                status: 'open'
            });
            await newQuest.save();
            console.log('New daily lootbox quest created:', newQuest);
            lootboxQuest = newQuest;
        }
        if (lootboxQuest && lootboxQuest.status === 'open') {
            // If the lootbox quest exists and is open, check if it's time to send the message
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


async function generateDailyLootboxV2() {

    try {
        // Close any open lootbox quests from previous days
        await Quest.updateMany(
            { lootboxHour: { $exists: true }, endDate: { $lt: new Date() }, status: 'open' },
            { status: 'closed' }
        );

        // Check if today's lootbox quest exists
        var lootboxQuest = await Quest.getTodayQuestWithLootboxHour();
        console.log(lootboxQuest);

        if (!lootboxQuest) {
            // Create a new lootbox quest for today if it doesn't exist
            const newQuest = new Quest({
                name: 'Daily Lootbox Quest',
                description: 'Complete this quest to earn your daily lootbox!',
                xpReward: 20,
                lootboxHour: Math.floor(Math.random() * (17 - 7 + 1)) + 7, // Random number between 7 and 17
                startDate: new Date(),
                endDate: new Date(new Date().setDate(new Date().getDate() + 1)), // Ends the next day
                status: 'draft'
            });
            await newQuest.save();
            console.log('New daily lootbox quest created:', newQuest);
            lootboxQuest = newQuest;

            // Generate a cron format with random minutes
            const randomMinute = Math.floor(Math.random() * 60);
            const date = new Date(lootboxQuest.startDate);
            const cronFormat = `${randomMinute} ${lootboxQuest.lootboxHour} ${date.getDate()} ${date.getMonth() + 1} *`;

            registerCronJobs(cronFormat);
        }

    } catch (error) {
        console.error('Error processing daily lootbox quest:', error);
    }

}

const startDailyLootbox = async () => {
    try {
        var lootboxQuest = await Quest.getTodayQuestWithLootboxHour();
        if (lootboxQuest) {
            if (lootboxQuest.status === 'draft') {
                lootboxQuest.status = 'open';
                await lootboxQuest.save();
            }
            await DiscordService.sendLootboxMessage(lootboxQuest);
            unregisterCronJobs();
        }
    } catch (error) {
        console.error('Error starting daily lootbox:', error);
    }
}


listener.createListener(eventTypes.START_DAILY_LOOTBOX, () => {
    startDailyLootbox();
});

/*listener.createListener(eventTypes.GENERATE_DAILY_LOOTBOX, () => {
    generateDailyLootbox();
});*/

listener.createListener(eventTypes.GENERATE_DAILY_LOOTBOX_V2, () => {
    generateDailyLootboxV2();
});

console.log("listener loaded")

export default listener;