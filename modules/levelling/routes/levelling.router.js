import routerBase from 'endurance-core/lib/router.js';
import { emitter, eventTypes } from 'endurance-core/lib/emitter.js';
import User from '../models/user.model.js';
import Quest from '../models/quest.model.js';
import fetch from 'node-fetch';

import crypto from 'crypto';
import { Client, GatewayIntentBits } from 'discord.js';

import { SlashCommandBuilder } from '@discordjs/builders';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';

const router = routerBase();
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.login(process.env.DISCORD_APP_TOKEN);
router.get("/", async (req, res) => {
    try {
        const user = await User.findOne().exec();
        res.json(user);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).send('Internal Server Error');
    }
});


// Define the command
const commands = [
    new SlashCommandBuilder()
        .setName('programisto')
        .setDescription('Get your XP, badges, and quests')
        .addSubcommand(subcommand =>
            subcommand
                .setName('xp')
                .setDescription('Displays your current XP amount')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('badges')
                .setDescription('Displays your current badges')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('open-quests')
                .setDescription('Lists all open quests')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('achieved-quests')
                .setDescription('Lists all achieved quests')
        )
].map(command => command.toJSON());

// Register the command with Discord
const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_APP_TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.LEVELLING_GUILD_ID),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();

// Handle the command interaction
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'programisto') {
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === 'xp') {
            try {
                const user = await User.findOne({ discordId: interaction.user.id }).exec();
                if (!user) {
                    await interaction.reply({ content: 'User not found in the database.', ephemeral: true });
                    return;
                }

                const xp = user.getXP();
                const currentLevel = user.getLevel();
                const baseXP = process.env.LEVELLING_XP_BASE ? parseInt(process.env.LEVELLING_XP_BASE) : 500;
                const coefficient = process.env.LEVELLING_COEFFICIENT ? parseFloat(process.env.LEVELLING_COEFFICIENT) : 1.3;
                const xpForNextLevel = Math.floor(baseXP * Math.pow(coefficient, currentLevel - 1));

                await interaction.reply({ 
                    content: `You have ${xp} XP. You need ${xpForNextLevel - (xp - (baseXP * (Math.pow(coefficient, currentLevel - 1) - 1) / (coefficient - 1)))} more XP to reach the next level.`, 
                    ephemeral: true 
                });
            } catch (error) {
                console.error('Error fetching XP:', error);
                await interaction.reply({ content: 'Error fetching your XP.', ephemeral: true });
            }
        } else if (subcommand === 'badges') {
            try {
                const user = await User.findOne({ discordId: interaction.user.id }).populate('badges.badge').exec();
                if (!user) {
                    await interaction.reply({ content: 'User not found in the database.', ephemeral: true });
                    return;
                }

                if (!user.badges || user.badges.length === 0) {
                    await interaction.reply({ content: 'You do not own any badges.', ephemeral: true });
                    return;
                }

                const badgeList = user.badges.map(badgeEntry => badgeEntry.badge.name).join(', ');
                await interaction.reply({ content: `You own the following badges: ${badgeList}.`, ephemeral: true });
            } catch (error) {
                console.error('Error fetching badges:', error);
                await interaction.reply({ content: 'Error fetching your badges.', ephemeral: true });
            }
        } else if (subcommand === 'open-quests') {
            try {
                const user = await User.findOne({ discordId: interaction.user.id }).exec();
                if (!user) {
                    await interaction.reply({ content: 'User not found in the database.', ephemeral: true });
                    return;
                }

                const completedQuestIds = user.completedQuests.map(completedQuest => completedQuest.quest.toString());
                const openQuests = await Quest.find({ status: 'open', _id: { $nin: completedQuestIds } }).populate('badgeReward').exec();

                if (!openQuests || openQuests.length === 0) {
                    await interaction.reply({ content: 'There are no open quests at the moment.', ephemeral: true });
                    return;
                }

                const questDetails = openQuests.map(quest => {
                    const badgeReward = quest.badgeReward ? quest.badgeReward.name : 'No badge reward';
                    return `**${quest.name}**\nDescription: ${quest.description}\nXP Reward: ${quest.xpReward}\nBadge Reward: ${badgeReward}`;
                }).join('\n\n');
                
                await interaction.reply({ content: `The following quests are open:\n\n${questDetails}`, ephemeral: true });
            } catch (error) {
                console.error('Error fetching open quests:', error);
                await interaction.reply({ content: 'Error fetching open quests.', ephemeral: true });
            }
        } else if (subcommand === 'achieved-quests') {
            try {
                const user = await User.findOne({ discordId: interaction.user.id }).populate('completedQuests.quest').exec();
                if (!user) {
                    await interaction.reply({ content: 'User not found in the database.', ephemeral: true });
                    return;
                }

                if (!user.completedQuests || user.completedQuests.length === 0) {
                    await interaction.reply({ content: 'You have not completed any quests.', ephemeral: true });
                    return;
                }

                const achievedQuestList = user.completedQuests.map(completedQuest => completedQuest.quest.name).join(', ');
                await interaction.reply({ content: `You have completed the following quests: ${achievedQuestList}.`, ephemeral: true });
            } catch (error) {
                console.error('Error fetching achieved quests:', error);
                await interaction.reply({ content: 'Error fetching your achieved quests.', ephemeral: true });
            }
        }
    }
});

router.get("/complete-quest", async (req, res) => {
    try {
        const { discordId, questId } = req.query;

        if (!discordId || !questId) {
            return res.status(400).send('Missing discordId or questId parameter');
        }

        const user = await User.findOne({ discordId }).exec();
        if (!user) {
            return res.status(404).send('User not found');
        }

        const quest = await Quest.findById(questId).exec();
        if (!quest) {
            return res.status(404).send('Quest not found');
        }

        await user.completeQuest(quest._id);

        res.send(`Quest ${quest.name} completed for user with discordId ${discordId}`);
    } catch (error) {
        console.error('Error completing quest:', error);
        res.status(500).send('Error completing quest');
    }

});

router.get("/update-nicknames", async (req, res) => {
    try {
        const users = await User.find().exec();
        for (const user of users) {
            emitter.emit(eventTypes.LEVELLING_UPDATE_NICKNAME, user);
        }
        res.send('Nicknames updated for all users');
    } catch (error) {
        console.error('Error updating nicknames:', error);
        res.status(500).send('Error updating nicknames');
    }
});

router.get("/init-quest", async (req, res) => {
    try {
        const users = await User.find().exec();
        const quest = await Quest.findOne({ name: 'Welcome' }).exec();
        if (!quest) {
            throw new Error('Quest "Welcome" not found.');
        }
        for (const user of users) {
            await user.completeQuest(quest._id);
        }

        res.send('Quest initialized for all users');
    } catch (error) {
        console.error('Error initializing Quest:', error);
        res.status(500).send('Error initializing Quest');
    }
});

router.get("/clean-xp", async (req, res) => {
    try {
        const users = await User.find().exec();

        for (const userData of users) {

            let user = userData.toObject();
            user.xpHistory = [];
            user.completedQuests = [];
            user.badges = [];
            delete user.xp;
            delete user.level;

            await User.updateOne({ _id: user._id }, user);

            await User.updateOne(
                { _id: user._id },
                { $unset: { xp: "" } },
                { strict: false }
            );

            await User.updateOne(
                { _id: user._id },
                { $unset: { level: "" } },
                { strict: false }
            );

        }

        res.send('XP history cleaned for all users');
    } catch (error) {
        console.error('Error cleaning XP history:', error);
        res.status(500).send('Error cleaning XP history');
    }
});

router.get("/timesheet", async (req, res) => {
    try {
        const boondManagerKey = process.env.BOONDMANAGER_CLIENT_KEY;
        const userToken = process.env.BOONDMANAGER_USER_TOKEN; // Assuming the user token is passed in the request headers
        const clientToken = process.env.BOONDMANAGER_CLIENT_TOKEN;

        if (!userToken) {
            return res.status(400).send('User token is required.');
        }

        const header = {
            alg: "HS256",
            typ: "JWT"
        };

        const payload = {
            userToken: userToken,
            clientToken: clientToken,
            time: Math.floor(Date.now() / 1000),
            mode: "normal"
        };

        const base64Header = Buffer.from(JSON.stringify(header)).toString('base64');
        const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
        const signature = crypto
            .createHmac('sha256', boondManagerKey)
            .update(`${base64Header}.${base64Payload}`)
            .digest('base64');

        const jwt = `${base64Header}.${base64Payload}.${signature}`;

        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = String(currentDate.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed

        const defaultStartMonth = `${currentYear}-${currentMonth}`;
        const defaultEndMonth = `${currentYear}-${currentMonth}`;

        const startMonth = req.query.startMonth || defaultStartMonth;
        const endMonth = req.query.endMonth || defaultEndMonth;


        const response = await fetch(`https://ui.boondmanager.com/api/times-reports?startMonth=${startMonth}&endMonth=${endMonth}`, {
            method: 'GET',
            headers: {
                'X-Jwt-Client-Boondmanager': jwt,
                'x-Debug-Boondmanager': true
            }
        });



        if (!response.ok) {
            const xDebugBoondmanager = response.headers.get('x-Debug-Boondmanager');
            console.log('x-Debug-Boondmanager header:', xDebugBoondmanager);
            console.error(`Error fetching times reports: ${response.status} - ${response.statusText}`);
            throw new Error('Error fetching times reports');
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error fetching times reports:', error);
        res.status(500).send('Error fetching times reports');
    }
});



export default router;
