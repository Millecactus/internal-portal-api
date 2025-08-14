import { Client, GatewayIntentBits, AttachmentBuilder, Guild, TextChannel, CommandInteraction, GuildMember, ChatInputCommandInteraction } from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import User from '../models/user.model.js';
import Quest from '../models/quest.model.js';
import { enduranceEmitter, enduranceEventTypes, EnduranceModelType, EnduranceDocumentType } from '@programisto/endurance-core';
import dotenv from 'dotenv';

dotenv.config();

type UserInstance = EnduranceDocumentType<typeof User> & {
    badges: Array<{
        badge: {
            name: string;
        };
        awardedDate: Date;
    }>;
    completedQuests: Array<{
        quest: {
            name: string;
        };
        completionDate: Date;
    }>;
    getXP(): number;
    getLevel(): number;
    firstname: string;
    lastname: string;
    discordId?: string;
    save(): Promise<UserInstance>;
    completeQuest(questId: typeof Quest): Promise<void>;
    addXP(amount: number, note: string, questId?: typeof Quest): Promise<void>;
};

export type QuestInstance = EnduranceDocumentType<typeof Quest> & {
    name: string;
    description: string;
    xpReward: number;
    badgeReward?: {
        name: string;
    };
    status: string;
    id: string;
    lootboxHour?: number;
    save(): Promise<QuestInstance>;
};

interface MessageContent {
    content: string;
    files?: AttachmentBuilder[];
}

interface LevelUpPayload {
    userId: string;
    newLevel: number;
}

interface QuestCompletedPayload {
    firstname: string;
    lastname: string;
    questName: string;
    badgeName?: string;
}

const DiscordService = () => {
    const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
    let guild: Guild | undefined;
    let channel: TextChannel | undefined;

    const init = async () => {
        try {
            const token = process.env.DISCORD_APP_TOKEN;
            if (!token) throw new Error('DISCORD_APP_TOKEN is not defined');

            await client.login(token);
            console.log("Bot logged in");

            if (!client || !client.guilds) {
                throw new Error("Discord client or guilds are empty");
            }

            const guildId = process.env.LEVELLING_GUILD_ID;
            if (!guildId) throw new Error('LEVELLING_GUILD_ID is not defined');

            guild = await client.guilds.fetch(guildId);
            if (!guild || !guild.available) {
                throw new Error(`Guild with ID ${guildId} is unavailable or not found`);
            }

            console.log(`Guild fetched: ${guild.name}`);

            const channelId = process.env.LEVELLING_ANNOUNCEMENT_CHANNEL_ID;
            if (!channelId) throw new Error('LEVELLING_ANNOUNCEMENT_CHANNEL_ID is not defined');

            const fetchedChannel = await guild.channels.fetch(channelId);
            if (!fetchedChannel || !(fetchedChannel instanceof TextChannel)) {
                throw new Error(`Channel with ID ${channelId} not found in guild ${guild.name}`);
            }

            channel = fetchedChannel;
            console.log(`Channel fetched: ${channel.name}`);

            await loadCommands();
            console.log("Commands loaded successfully");

        } catch (error) {
            console.error("Error loading Discord client:", error);
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

        const token = process.env.DISCORD_APP_TOKEN;
        const clientId = process.env.DISCORD_CLIENT_ID;
        const guildId = process.env.LEVELLING_GUILD_ID;

        if (!token || !clientId || !guildId) {
            throw new Error('Required environment variables are missing');
        }

        const rest = new REST({ version: '9' }).setToken(token);

        try {
            console.log('Started refreshing application (/) commands.');

            await rest.put(
                Routes.applicationGuildCommands(clientId, guildId),
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
                const subcommand = (interaction as ChatInputCommandInteraction).options.getSubcommand();
                try {
                    const user = await User.findOne({ discordId: interaction.user.id }).exec() as unknown as UserInstance;
                    if (!user) {
                        await interaction.reply({ content: 'User not found in the database.', ephemeral: true });
                        return;
                    }

                    if (subcommand === 'xp') {
                        const xp = (user as any).getXP();
                        const currentLevel = (user as any).getLevel();
                        const baseXP = process.env.LEVELLING_XP_BASE ? parseInt(process.env.LEVELLING_XP_BASE) : 500;
                        const coefficient = process.env.LEVELLING_COEFFICIENT ? parseFloat(process.env.LEVELLING_COEFFICIENT) : 1.3;
                        const xpForNextLevel = Math.floor(baseXP * Math.pow(coefficient, currentLevel - 1));

                        await interaction.reply({
                            content: `You have ${xp} XP. You need ${xpForNextLevel - (xp - (baseXP * (Math.pow(coefficient, currentLevel - 1) - 1) / (coefficient - 1)))} more XP to reach the next level.`,
                            ephemeral: true
                        });
                    } else if (subcommand === 'badges') {
                        const userWithBadges = await User.findOne({ discordId: interaction.user.id }).populate('badges.badge').exec() as unknown as UserInstance;
                        if (!userWithBadges?.badges || userWithBadges.badges.length === 0) {
                            await interaction.reply({ content: 'You do not own any badges.', ephemeral: true });
                            return;
                        }

                        const badgeList = userWithBadges.badges.map(badgeEntry => {
                            const badge = badgeEntry.badge as any;
                            return badge?.name || 'Unknown Badge';
                        }).join(', ');
                        await interaction.reply({ content: `You own the following badges: ${badgeList}.`, ephemeral: true });
                    } else if (subcommand === 'open-quests') {
                        const completedQuestIds = user.completedQuests.map(completedQuest => completedQuest.quest.toString());
                        const openQuests = await Quest.find({ status: 'open', id: { $nin: completedQuestIds } }).populate('badgeReward').exec() as unknown as QuestInstance[];

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
                        const userWithCompletedQuests = await User.findOne({ discordId: interaction.user.id }).populate('completedQuests.quest', { strictPopulate: false }).exec() as unknown as UserInstance;
                        if (!userWithCompletedQuests?.completedQuests || userWithCompletedQuests.completedQuests.length === 0) {
                            await interaction.reply({ content: 'You have not completed any quests.', ephemeral: true });
                            return;
                        }

                        const achievedQuestList = userWithCompletedQuests.completedQuests.map(completedQuest => {
                            const quest = completedQuest.quest as any;
                            return quest?.name || 'Unknown Quest';
                        }).join(', ');
                        await interaction.reply({ content: `You have completed the following quests: ${achievedQuestList}.`, ephemeral: true });
                    } else if (subcommand === 'lootbox') {
                        const lootboxQuest = await Quest.getTodayQuestWithLootboxHour() as unknown as QuestInstance;
                        if (!lootboxQuest || lootboxQuest.status !== 'open') {
                            await interaction.reply({ content: 'No lootbox quest available today.', ephemeral: true });
                            return;
                        }

                        const isQuestCompleted = user.completedQuests.some(completedQuest => completedQuest.quest.toString() === lootboxQuest.id.toString());
                        if (isQuestCompleted) {
                            await interaction.reply({ content: 'You have already completed today\'s lootbox quest.', ephemeral: true });
                            return;
                        }

                        const isQuestCompletedByOthers = await User.findOne({ 'completedQuests.quest': lootboxQuest.id }).exec();
                        if (isQuestCompletedByOthers) {
                            await interaction.reply({ content: 'Oh no, someone else opened the lootbox before you! Better luck tomorrow?', ephemeral: true });
                            return;
                        }

                        await user.completeQuest(lootboxQuest as unknown as typeof Quest);
                        await user.addXP(lootboxQuest.xpReward, `Lootbox gain on: ${new Date().toLocaleDateString()}`, lootboxQuest as unknown as typeof Quest);
                        await user.save();

                        await interaction.reply({ content: `Congratulations ${interaction.user.username}, you have won today's lootbox and earned ${lootboxQuest.xpReward} XP! 🎉`, ephemeral: false });

                        const questToClose = await Quest.findById(lootboxQuest.id).exec() as unknown as QuestInstance;
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

    const sendMessage = async (message: string | MessageContent) => {
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

    const sendLevelUpMessage = async ({ userId, newLevel }: LevelUpPayload) => {
        try {
            const user = await User.findById(userId).exec() as unknown as UserInstance;

            if (user && channel && guild && user.discordId) {
                const member = await guild.members.fetch(user.discordId).catch(error => {
                    console.error(`Error fetching member with discordId ${user.discordId}:`, error);
                    return null;
                });

                if (member && member.displayName !== undefined) {
                    const message = `🚀 Congratulations **${user.firstname} ${user.lastname}**! You've reached **level ${newLevel}**! Keep up the great work! 🎉`;
                    await sendMessage(message);

                    enduranceEmitter.emit(enduranceEventTypes.LEVELLING_UPDATE_NICKNAME, user);
                }
            }
        } catch (error) {
            console.error('Error sending level up message:', error);
        }
    };

    const updateNickname = async (user: UserInstance) => {
        const level = user.getLevel();
        try {
            if (!guild) throw new Error('Guild not found');
            if (!user.discordId) throw new Error('User has no Discord ID');

            const member = await guild.members.fetch(user.discordId);

            const currentNickname = member.displayName.replace(/\s\[Lvl\s\d+\]$/, '');
            const newNickname = `${currentNickname} [Lvl ${level}]`;

            await member.setNickname(newNickname);

            console.log(`Nickname updated for ${member.user.username}: ${newNickname}`);
        } catch (error) {
            console.error(`Error updating nickname for user with discordId ${user.discordId}:`, error);
        }
    };

    const sendQuestCompletedMessage = async ({ firstname, lastname, questName, badgeName }: QuestCompletedPayload) => {
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

    const sendLootboxMessage = async (quest: QuestInstance) => {
        const channelId = process.env.LEVELLING_ANNOUNCEMENT_CHANNEL_ID;
        if (!channelId) throw new Error('LEVELLING_ANNOUNCEMENT_CHANNEL_ID is not defined');

        const channel = await client.channels.fetch(channelId);
        if (!channel) {
            console.error('Channel not found');
            return;
        }

        const imageUrl = 'https://i.ibb.co/gLwZzT5Z/image.png';
        const attachment = new AttachmentBuilder(imageUrl);

        const messageContent: MessageContent = {
            content: 'A wild lootbox appears! Type the command "/programisto lootbox" to catch it. Only the first user will win!',
            files: [attachment]
        };
        await sendMessage(messageContent);
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

