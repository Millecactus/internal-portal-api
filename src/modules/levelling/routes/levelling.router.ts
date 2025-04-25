import { EnduranceRouter, enduranceEmitter, enduranceEventTypes, EnduranceAuthMiddleware, SecurityOptions, EnduranceDocumentType } from 'endurance-core';
import UserModel, { UserDocument } from '../models/user.model.js';
import Quest from '../models/quest.model.js';
import fetch from 'node-fetch';
import crypto from 'crypto';
import Badge from '../models/badge.model.js';



class LevellingRouter extends EnduranceRouter {
    constructor() {
        super(EnduranceAuthMiddleware.getInstance());
    }

    setupRoutes(): void {
        const authenticatedOptions: SecurityOptions = {
            requireAuth: true,
            permissions: []
        };

        const publicOptions: SecurityOptions = {
            requireAuth: false,
            permissions: []
        };

        this.get('/', authenticatedOptions, async (req: any, res: any) => {
            try {
                const userEmail = req.user.email;
                const fullUser = await UserModel.findOne({ email: userEmail })
                    .populate({
                        path: 'completedQuests.quest',
                        model: Quest,
                        options: { strictPopulate: false }
                    })
                    .populate({
                        path: 'badges.badge',
                        model: Badge,
                        options: { strictPopulate: false }
                    })
                    .exec() as unknown as UserDocument;

                if (!fullUser) {
                    return res.status(404).send('Utilisateur non trouvé');
                }

                res.json({
                    email: fullUser.email,
                    xpHistory: fullUser.get('xpHistory'),
                    completedQuests: fullUser.get('completedQuests'),
                    badges: fullUser.get('badges'),
                    level: fullUser.getLevel(),
                    xpForNextLevel: fullUser.getXPforNextLevel()
                });
            } catch (error) {
                console.error('Error fetching user:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        this.get('/available-quests', authenticatedOptions, async (req: any, res: any) => {
            try {
                const userEmail = req.user.email;
                const user = await UserModel.findOne({ email: userEmail })
                    .populate({
                        path: 'completedQuests.quest',
                        model: Quest,
                        options: { strictPopulate: false }
                    })
                    .exec() as unknown as UserDocument;

                if (!user) {
                    return res.status(404).send('Utilisateur non trouvé');
                }

                const completedQuestIds = Array.isArray(user.completedQuests)
                    ? user.completedQuests.map(quest => quest.quest._id)
                    : [];
                const availableQuests = await Quest.find({ _id: { $nin: completedQuestIds }, status: 'open' }).exec();

                res.json(availableQuests);
            } catch (error) {
                console.error('Erreur lors de la récupération des quêtes disponibles:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        this.get('/complete-quest', publicOptions, async (req: any, res: any) => {
            try {
                const { discordId, questId } = req.query;

                if (!discordId || !questId) {
                    return res.status(400).send('Missing discordId or questId parameter');
                }

                const user = await UserModel.findOne({ discordId }).exec() as unknown as UserDocument;
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

        this.get('/complete-quest-for-all', publicOptions, async (req: any, res: any) => {
            try {
                const { questId, excludeDiscordIds } = req.query;

                if (!questId) {
                    return res.status(400).send('Missing questId parameter');
                }

                const quest = await Quest.findById(questId).exec();
                if (!quest) {
                    return res.status(404).send('Quest not found');
                }

                const excludeIdsArray = excludeDiscordIds ? excludeDiscordIds.split(',') : [];
                const users = await UserModel.find({ discordId: { $nin: excludeIdsArray } }).exec() as unknown as UserDocument[];

                for (const user of users) {
                    await user.completeQuest(quest._id);
                }

                res.send(`Quest ${quest.name} completed for all users except those with discordIds: ${excludeIdsArray.join(', ')}`);
            } catch (error) {
                console.error('Error completing quest for all users:', error);
                res.status(500).send('Error completing quest for all users');
            }
        });

        this.get('/update-nicknames', publicOptions, async (req: any, res: any) => {
            try {
                const users = await UserModel.find().exec() as unknown as UserDocument[];
                for (const user of users) {
                    enduranceEmitter.emit(enduranceEventTypes.LEVELLING_UPDATE_NICKNAME, { user });
                }
                res.send('Nicknames updated for all users');
            } catch (error) {
                console.error('Error updating nicknames:', error);
                res.status(500).send('Error updating nicknames');
            }
        });

        this.get('/init-quest', publicOptions, async (req: any, res: any) => {
            try {
                const users = await UserModel.find().exec() as unknown as UserDocument[];
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

        /*this.get('/timesheet', publicOptions, async (req: any, res: any) => {
            try {
                const boondManagerKey = process.env.BOONDMANAGER_CLIENT_KEY;
                const userToken = process.env.BOONDMANAGER_USER_TOKEN;
                const clientToken = process.env.BOONDMANAGER_CLIENT_TOKEN;

                if (!userToken || !boondManagerKey) {
                    return res.status(400).send('Required environment variables are missing.');
                }

                const header = {
                    alg: "HS256",
                    typ: "JWT"
                };

                const payload = {
                    userToken,
                    clientToken,
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
                const currentMonth = String(currentDate.getMonth() + 1).padStart(2, '0');

                const defaultStartMonth = `${currentYear}-${currentMonth}`;
                const defaultEndMonth = `${currentYear}-${currentMonth}`;

                const startMonth = req.query.startMonth || defaultStartMonth;
                const endMonth = req.query.endMonth || defaultEndMonth;

                const any = await fetch(`https://ui.boondmanager.com/api/times-reports?startMonth=${startMonth}&endMonth=${endMonth}`, {
                    method: 'GET',
                    headers: {
                        'X-Jwt-Client-Boondmanager': jwt,
                        'x-Debug-Boondmanager': 'true'
                    }
                });

                if (!any.ok) {
                    const xDebugBoondmanager = any.headers.get('x-Debug-Boondmanager');
                    console.log('x-Debug-Boondmanager header:', xDebugBoondmanager);
                    console.error(`Error fetching times reports: ${any.status} - ${any.statusText}`);
                    throw new Error('Error fetching times reports');
                }

                const data = await any.json();
                res.json(data);
            } catch (error) {
                console.error('Error fetching times reports:', error);
                res.status(500).send('Error fetching times reports');
            }
        });*/
    }
}

const router = new LevellingRouter();
export default router;
