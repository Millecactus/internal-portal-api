import { EnduranceRouter, enduranceEmitter, enduranceEventTypes, EnduranceAuthMiddleware, SecurityOptions, EnduranceDocumentType } from 'endurance-core';
import { ObjectId } from 'mongodb';
import UserModel, { UserDocument } from '../models/user.model.js';
import Quest from '../models/quest.model.js';
import Badge from '../models/badge.model.js';

class LevellingAdminRouter extends EnduranceRouter {
    constructor() {
        super(EnduranceAuthMiddleware.getInstance());
    }

    setupRoutes(): void {
        const authenticatedOptions: SecurityOptions = {
            requireAuth: true,
            permissions: []
        };

        this.get('/badges', authenticatedOptions, async (req: any, res: any) => {
            try {
                const badges = await Badge.find({}).sort({ createdAt: -1 });
                return res.json(badges);
            } catch (error) {
                console.error('Error fetching badges:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        this.post('/badges', authenticatedOptions, async (req: any, res: any) => {
            try {
                const badge = new Badge(req.body);
                const savedBadge = await badge.save();
                return res.status(201).json(savedBadge);
            } catch (error) {
                console.error('Error creating badge:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        this.put('/badges/:id', authenticatedOptions, async (req: any, res: any) => {
            try {
                const badge = await Badge.findByIdAndUpdate(
                    req.params.id,
                    req.body,
                    { new: true }
                );
                if (!badge) {
                    return res.status(404).send('Badge not found');
                }
                return res.json(badge);
            } catch (error) {
                console.error('Error updating badge:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        this.delete('/badges/:id', authenticatedOptions, async (req: any, res: any) => {
            try {
                const badge = await Badge.findByIdAndDelete(req.params.id);
                if (!badge) {
                    return res.status(404).send('Badge not found');
                }
                return res.status(204).send();
            } catch (error) {
                console.error('Error deleting badge:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        this.get('/quests', authenticatedOptions, async (req: any, res: any) => {
            try {
                const quests = await Quest.find({}).sort({ updatedAt: -1, startDate: -1 });
                console.log(quests.map(quest => quest["name"]));
                return res.json(quests);
            } catch (error) {
                console.error('Error fetching quests:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        this.post('/quests', authenticatedOptions, async (req: any, res: any) => {
            try {
                const quest = new Quest(req.body);
                const savedQuest = await quest.save();
                return res.status(201).json(savedQuest);
            } catch (error) {
                console.error('Error creating quest:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        this.put('/quests/:id', authenticatedOptions, async (req: any, res: any) => {
            try {
                const quest = await Quest.findByIdAndUpdate(
                    req.params.id,
                    req.body,
                    { new: true }
                );
                if (!quest) {
                    return res.status(404).send('Quest not found');
                }
                return res.json(quest);
            } catch (error) {
                console.error('Error updating quest:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        this.delete('/quests/:id', authenticatedOptions, async (req: any, res: any) => {
            try {
                const quest = await Quest.findByIdAndDelete(req.params.id);
                if (!quest) {
                    return res.status(404).send('Quest not found');
                }
                return res.status(204).send();
            } catch (error) {
                console.error('Error deleting quest:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        this.get('/autocomplete-users', authenticatedOptions, async (req: any, res: any) => {
            try {
                const users = await UserModel.find({}).sort({ firstname: -1, lastname: -1 });
                return res.json(users);
            } catch (error) {
                console.error('Error fetching users:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        this.post('/complete-quest', authenticatedOptions, async (req: any, res: any) => {
            try {
                const { userIds, questId } = req.body;

                if (!userIds || !Array.isArray(userIds) || userIds.length === 0 || !questId) {
                    return res.status(400).json({ error: 'userIds (array) and questId are required' });
                }

                const results = {
                    success: [] as any[],
                    errors: [] as any[]
                };

                const questObjectId = new ObjectId(questId);

                for (const userId of userIds) {
                    try {
                        const userObjectId = new ObjectId(userId);
                        const user = await UserModel.findById(userObjectId);
                        if (!user) {
                            results.errors.push({
                                userId,
                                error: 'User not found'
                            });
                            continue;
                        }
                        console.log(user.firstname, "completed quest");
                        await user.completeQuest(questObjectId);

                        results.success.push({
                            userId,
                            xp: user.getXP(),
                            level: user.getLevel(),
                            completedQuests: user.completedQuests.length
                        });
                    } catch (error) {
                        results.errors.push({
                            userId,
                            error: error instanceof Error ? error.message : 'Unknown error'
                        });
                    }
                }

                return res.json({
                    message: 'Quest completion processed',
                    results
                });

            } catch (error) {
                console.error('Error processing quest completion:', error);
                if (error instanceof Error) {
                    return res.status(400).json({ error: error.message });
                }
                res.status(500).send('Internal Server Error');
            }
        });
    }
}

const router = new LevellingAdminRouter();
export default router;
