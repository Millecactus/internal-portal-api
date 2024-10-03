import listener from 'endurance-core/lib/listener.js';
import { emitter, eventTypes } from 'endurance-core/lib/emitter.js';

import dotenv from 'dotenv';
dotenv.config();
import axios from 'axios';
import fetch from 'node-fetch';
import User from '../models/user.model.js';

import { Client, GatewayIntentBits } from 'discord.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
client.login(process.env.DISCORD_APP_TOKEN);

const guildId = process.env.LEVELLING_GUILD_ID; // Discord server ID
const channelId = process.env.LEVELLING_ANNOUNCEMENT_CHANNEL_ID; // Channel ID for announcements

const guild = await client.guilds.fetch(guildId);
const channel = await guild.channels.fetch(channelId);

async function sendLevelUpMessage({ userId, newLevel }) {
    try {
        const user = await User.findById(userId).exec();

        if (user && channel) {
            const member = await guild.members.fetch(user.discordId).catch(error => {
                console.error(`Error fetching member with discordId ${user.discordId}:`, error);
                return null;
            });

            if (member && member.displayName !== undefined) {
                const message = `🚀 Congratulations **${user.firstname} ${user.lastname}**! You've reached **level ${newLevel}**! Keep up the great work! 🎉`;
                await channel.send(message);

                emitter.emit(eventTypes.LEVELLING_UPDATE_NICKNAME, user);

            }
        }
    } catch (error) {
        console.error('Error sending level up message:', error);
    }
}

listener.createListener(eventTypes.LEVELLING_LEVEL_UP, (userId, newLevel) => {
    sendLevelUpMessage(userId, newLevel);
});

async function updateNickname(user) {
    const level = user.getLevel(); // Retrieve the user's level
    try {
        // Fetch the member (user) on Discord
        const member = await guild.members.fetch(user.discordId);

        // Remove the old level from the nickname and add the new level
        const currentNickname = member.displayName.replace(/\s\[Lvl\s\d+\]$/, '');
        const newNickname = `${currentNickname} [Lvl ${level}]`;

        // Update the user's nickname
        await member.setNickname(newNickname);

        console.log(`Nickname updated for ${member.user.username}: ${newNickname}`);
    } catch (error) {
        console.error(`Error updating nickname for user with discordId ${user.discordId}:`, error);
    }
}

listener.createListener(eventTypes.LEVELLING_UPDATE_NICKNAME, (user) => {
    updateNickname(user);
});

async function sendQuestCompletedMessage({firstname, lastname, questName, badgeName}) {
    try {
        if (!guild || !channel) {
            throw new Error('Guild or channel not found.');
        }

        // Construct the message based on whether a badge was awarded
        let message;
        if (badgeName === undefined) {
            message = `🎉 Congratulations **${firstname} ${lastname}**! You have completed the quest **${questName}**! Keep it up! 🚀`;
        } else {
            message = `🏅 Well done **${firstname} ${lastname}**! You have completed the quest **${questName}** and received the badge **${badgeName}**! Impressive! 🌟`;
        }

        // Send the message to the Discord channel
        await channel.send(message);
    } catch (error) {
        console.error('Error sending quest completed message:', error);
    }
}

listener.createListener(eventTypes.LEVELLING_QUEST_COMPLETED, ({firstname, lastname, questName, badgeName}) => {
    sendQuestCompletedMessage({firstname, lastname, questName, badgeName});
});

export default listener;