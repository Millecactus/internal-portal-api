import { Client, GatewayIntentBits, AttachmentBuilder } from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import User from '../models/user.model.js';
import Quest from '../models/quest.model.js';

const DiscordService = () => {
    const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
    let guild, channel;

    const init = async () => {
        try {
            await client.login(process.env.DISCORD_APP_TOKEN);
            if (client && client.guilds) {
                guild = client.guilds.cache.get(process.env.LEVELLING_GUILD_ID);
                if (guild && guild.channels) {
                    channel = await guild.channels.fetch(process.env.LEVELLING_ANNOUNCEMENT_CHANNEL_ID);
                    await loadCommands();
                } else {
                    console.log(guild);
                    throw new Error("Discord guild is empty")
                }

            } else {
                console.log(client);
                throw new Error("Discord client is empty")
            }

        }
        catch (error) {
            console.log("Error loading Discord client");
            console.log(error);
        }
    };

    const loadCommands = async () => {
        const commands = [
            new SlashCommandBuilder()
                .setName('programisto')
                .setDescription('Get your XP, badges, quests, and lootbox')
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
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('lootbox')
                        .setDescription('Catch the lootbox that pops sometimes')
                )
        ].map(command => command.toJSON());

        const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_APP_TOKEN);

        try {
            console.log('Started refreshing application (/) commands.');

            await rest.put(
                Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.LEVELLING_GUILD_ID),
                { body: commands },
            );

            console.log('Successfully reloaded application (/) commands.');
        } catch (error) {
            console.error('Error reloading application commands:', error);
        }

        client.on('interactionCreate', async interaction => {
            if (!interaction.isCommand()) return;

            const { commandName } = interaction;

            if (commandName === 'programisto') {
                const subcommand = interaction.options.getSubcommand();
                try {
                    const user = await User.findOne({ discordId: interaction.user.id }).exec();
                    if (!user) {
                        await interaction.reply({ content: 'User not found in the database.', ephemeral: true });
                        return;
                    }

                    if (subcommand === 'xp') {
                        const xp = user.getXP();
                        const currentLevel = user.getLevel();
                        const baseXP = process.env.LEVELLING_XP_BASE ? parseInt(process.env.LEVELLING_XP_BASE) : 500;
                        const coefficient = process.env.LEVELLING_COEFFICIENT ? parseFloat(process.env.LEVELLING_COEFFICIENT) : 1.3;
                        const xpForNextLevel = Math.floor(baseXP * Math.pow(coefficient, currentLevel - 1));

                        await interaction.reply({
                            content: `You have ${xp} XP. You need ${xpForNextLevel - (xp - (baseXP * (Math.pow(coefficient, currentLevel - 1) - 1) / (coefficient - 1)))} more XP to reach the next level.`,
                            ephemeral: true
                        });
                    } else if (subcommand === 'testimage') {
                        const imageUrl = 'https://i.ibb.co/4nTzg34z/february-Cat.png'; // Replace with the actual image URL
                        await interaction.reply({
                            content: 'Here is your image:',
                            files: [imageUrl],
                            ephemeral: true
                        });
                    } else if (subcommand === 'badges') {
                        const userWithBadges = await User.findOne({ discordId: interaction.user.id }).populate('badges.badge').exec();
                        if (!userWithBadges.badges || userWithBadges.badges.length === 0) {
                            await interaction.reply({ content: 'You do not own any badges.', ephemeral: true });
                            return;
                        }

                        const badgeList = userWithBadges.badges.map(badgeEntry => badgeEntry.badge.name).join(', ');
                        await interaction.reply({ content: `You own the following badges: ${badgeList}.`, ephemeral: true });
                    } else if (subcommand === 'open-quests') {
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
                    } else if (subcommand === 'achieved-quests') {
                        const userWithCompletedQuests = await User.findOne({ discordId: interaction.user.id }).populate('completedQuests.quest').exec();
                        if (!userWithCompletedQuests.completedQuests || userWithCompletedQuests.completedQuests.length === 0) {
                            await interaction.reply({ content: 'You have not completed any quests.', ephemeral: true });
                            return;
                        }

                        const achievedQuestList = userWithCompletedQuests.completedQuests.map(completedQuest => completedQuest.quest.name).join(', ');
                        await interaction.reply({ content: `You have completed the following quests: ${achievedQuestList}.`, ephemeral: true });
                    } else if (subcommand === 'lootbox') {
                        const lootboxQuest = await Quest.getTodayQuestWithLootboxHour();
                        if (!lootboxQuest) {
                            await interaction.reply({ content: 'No lootbox quest available today.', ephemeral: true });
                            return;
                        }

                        const isQuestCompleted = user.completedQuests.some(completedQuest => completedQuest.quest.equals(lootboxQuest._id));
                        if (isQuestCompleted) {
                            await interaction.reply({ content: 'You have already completed today\'s lootbox quest.', ephemeral: true });
                            return;
                        }

                        const isQuestCompletedByOthers = await User.findOne({ 'completedQuests.quest': lootboxQuest._id }).exec();
                        if (isQuestCompletedByOthers) {
                            await interaction.reply({ content: 'Oh no, someone else opened the lootbox before you! Better luck tomorrow?', ephemeral: true });
                            return;
                        }

                        await user.completeQuest(lootboxQuest._id);
                        user.xp += lootboxQuest.xpReward;
                        await user.save();

                        await interaction.reply({ content: `Congratulations ${interaction.user.username}, you have won today's lootbox and earned ${lootboxQuest.xpReward} XP! 🎉`, ephemeral: false });

                        const questToClose = await Quest.findById(lootboxQuest._id).exec();
                        if (questToClose) {
                            questToClose.status = 'closed';
                            await questToClose.save();
                        }
                    }
                } catch (error) {
                    console.error(`Error processing ${subcommand} command:`, error);
                    await interaction.reply({ content: `Error processing ${subcommand} command.`, ephemeral: true });
                }
            }
        });
    };

    const sendMessage = async (message) => {
        try {
            if (process.env.NODE_ENV === 'localhost') {
                if (typeof message === 'string') {
                    console.log(message);
                } else if (typeof message === 'object' && message.content) {
                    console.log(message.content);
                }
            } else {
                if (!channel) {
                    throw new Error('Channel not found.');
                }
                if (typeof message === 'string') {
                    await channel.send(message);
                } else if (typeof message === 'object' && message.content) {
                    await channel.send(message);
                }
            }

        } catch (error) {
            console.error('Error sending message:', error);
        }
    };

    const sendLevelUpMessage = async ({ userId, newLevel }) => {
        try {
            const user = await User.findById(userId).exec();

            if (user && channel) {
                const member = await guild.members.fetch(user.discordId).catch(error => {
                    console.error(`Error fetching member with discordId ${user.discordId}:`, error);
                    return null;
                });

                if (member && member.displayName !== undefined) {
                    const message = `🚀 Congratulations **${user.firstname} ${user.lastname}**! You've reached **level ${newLevel}**! Keep up the great work! 🎉`;
                    await sendMessage(message);

                    emitter.emit(eventTypes.LEVELLING_UPDATE_NICKNAME, user);
                }
            }
        } catch (error) {
            console.error('Error sending level up message:', error);
        }
    };

    const updateNickname = async (user) => {
        const level = user.getLevel();
        try {
            const member = await guild.members.fetch(user.discordId);

            const currentNickname = member.displayName.replace(/\s\[Lvl\s\d+\]$/, '');
            const newNickname = `${currentNickname} [Lvl ${level}]`;

            await member.setNickname(newNickname);

            console.log(`Nickname updated for ${member.user.username}: ${newNickname}`);
        } catch (error) {
            console.error(`Error updating nickname for user with discordId ${user.discordId}:`, error);
        }
    };

    const sendQuestCompletedMessage = async ({ firstname, lastname, questName, badgeName }) => {
        try {
            if (!guild || !channel) {
                throw new Error('Guild or channel not found.');
            }

            let message;
            if (badgeName === undefined) {
                message = `🎉 Congratulations **${firstname} ${lastname}**! You have completed the quest **${questName}**! Keep it up! 🚀`;
            } else {
                message = `🏅 Well done **${firstname} ${lastname}**! You have completed the quest **${questName}** and received the badge **${badgeName}**! Impressive! 🌟`;
            }

            await sendMessage(message);

        } catch (error) {
            console.error('Error sending quest completed message:', error);
        }
    };

    const sendLootboxMessage = async (quest) => {
        const channelId = process.env.LEVELLING_ANNOUNCEMENT_CHANNEL_ID; // Assumes you have a channel ID in your .env
        const channel = await client.channels.fetch(channelId);
        if (!channel) {
            console.error('Channel not found');
            return;
        }

        const imageUrl = 'https://i.ibb.co/m6tY5kQ/lootbox-novembre.png'; // ou 'path/to/your/image.jpg'

        // Création de l'attachment
        const attachment = new AttachmentBuilder(imageUrl);

        const messageContent = {
            content: 'A wild lootbox appears! Type the command "/programisto lootbox" to catch it. Only the first user will win!',
            files: [attachment]
        };
        await sendMessage(messageContent); // Keep using sendMessage function

    };

    return {
        init,
        loadCommands,
        sendMessage,
        sendLevelUpMessage,
        updateNickname,
        sendQuestCompletedMessage,
        sendLootboxMessage
    };
};

const discordServiceInstance = DiscordService();
await discordServiceInstance.init();

export default discordServiceInstance;