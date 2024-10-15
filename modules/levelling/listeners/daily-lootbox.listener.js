import listener from 'endurance-core/lib/listener.js';
import { emitter, eventTypes } from 'endurance-core/lib/emitter.js';
import dotenv from 'dotenv';
dotenv.config();
import Quest from '../models/quest.model.js';
import { Client, GatewayIntentBits } from 'discord.js';

import { SlashCommandBuilder } from '@discordjs/builders';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
client.login(process.env.DISCORD_APP_TOKEN);

async function generateDailyLootbox() {

    var lootboxQuest = await Quest.getTodayQuestWithLootboxHour();
    console.log(lootboxQuest)
    if (!lootboxQuest) {
        try {
            const newQuest = new Quest({
                name: 'Daily Lootbox Quest',
                description: 'Complete this quest to earn your daily lootbox!',
                xpReward: 100, // Example reward, adjust as needed
                lootboxHour: Math.floor(Math.random() * (16 - 7 + 1)) + 7, // Random number between 7 and 16
                startDate: new Date(),
                endDate: new Date(new Date().setDate(new Date().getDate() + 1)), // Ends the next day
                status: 'open'
            });
            await newQuest.save();
            console.log('New daily lootbox quest created:', newQuest);
        } catch (error) {
            console.error('Error creating new daily lootbox quest:', error);
        }
    }
    const sendLootboxMessage = async (quest) => {
        const channelId = process.env.LEVELLING_ANNOUNCEMENT_CHANNEL_ID; // Assumes you have a channel ID in your .env
        const channel = await client.channels.fetch(channelId);
        if (!channel) {
            console.error('Channel not found');
            return;
        }

        const message = await channel.send('A new lootbox is available! Type /programisto lootbox to catch it. Only the first user will win!');

        const filter = (interaction) => interaction.commandName === 'programisto' && interaction.options.getSubcommand() === 'lootbox';
        const collector = channel.createMessageComponentCollector({ filter, max: 1, time: 3600000 }); // 1 hour

        collector.on('collect', async (interaction) => {
            try {
                // Award the XP to the user
                const user = interaction.user;
                // Assuming you have a User model and a method to add XP
                const User = mongoose.model('User');
                const userData = await User.findOne({ discordId: user.id });
                if (userData) {
                    userData.xp += quest.xpReward;
                    await userData.save();
                    await interaction.reply(`Congratulations ${user.username}, you have caught the lootbox and earned ${quest.xpReward} XP!`);
                } else {
                    await interaction.reply('User not found in the database.');
                }
            } catch (error) {
                console.error('Error awarding XP:', error);
                await interaction.reply('There was an error processing your request.');
            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                channel.send('The lootbox was not caught in time. Better luck next time!');
            }
        });
    };

    const currentHour = new Date().getHours();
    const force = true;
    if (lootboxQuest && (currentHour === lootboxQuest.lootboxHour || force)) {
        sendLootboxMessage(lootboxQuest);
    }


}


listener.createListener(eventTypes.GENERATE_DAILY_LOOTBOX, () => {
    generateDailyLootbox();
});

console.log("listener loaded")

export default listener;