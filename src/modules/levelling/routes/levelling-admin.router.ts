import { EnduranceRouter, enduranceEmitter, enduranceEventTypes, EnduranceAuthMiddleware, SecurityOptions } from 'endurance-core';
import { ObjectId } from 'mongodb';
import UserModel from '../models/user.model.js';
import Quest from '../models/quest.model.js';
import Badge from '../models/badge.model.js';
import Group from '../models/group.model.js';

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
                const page = parseInt(req.query.page as string) || 1;
                const limit = parseInt(req.query.limit as string) || 10;
                const skip = (page - 1) * limit;
                const search = req.query.search as string || '';
                const sortBy = req.query.sortBy as string || 'updatedAt';
                const sortOrder = req.query.sortOrder as string || 'desc';

                // Construction de la requête de recherche
                const query: any = {};

                // Recherche sur nom et description
                if (search) {
                    query.$or = [
                        { name: { $regex: search, $options: 'i' } },
                        { description: { $regex: search, $options: 'i' } }
                    ];
                }

                // Construction du tri
                const sortOptions: Record<string, 1 | -1> = {
                    [sortBy]: sortOrder === 'asc' ? 1 : -1
                };

                const [badges, total] = await Promise.all([
                    Badge.find(query)
                        .sort(sortOptions)
                        .skip(skip)
                        .limit(limit),
                    Badge.countDocuments(query)
                ]);

                const totalPages = Math.ceil(total / limit);

                return res.json({
                    data: badges,
                    pagination: {
                        currentPage: page,
                        totalPages,
                        totalItems: total,
                        itemsPerPage: limit,
                        hasNextPage: page < totalPages,
                        hasPreviousPage: page > 1
                    }
                });
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
                const page = parseInt(req.query.page as string) || 1;
                const limit = parseInt(req.query.limit as string) || 10;
                const skip = (page - 1) * limit;
                const search = req.query.search as string || '';
                const status = req.query.status as string || 'all';
                const sortBy = req.query.sortBy as string || 'updatedAt';
                const sortOrder = req.query.sortOrder as string || 'desc';

                // Construction de la requête de recherche
                const query: any = {};

                // Filtre par statut
                if (status !== 'all') {
                    query.status = status;
                }

                // Recherche sur nom et description
                if (search) {
                    query.$or = [
                        { name: { $regex: search, $options: 'i' } },
                        { description: { $regex: search, $options: 'i' } }
                    ];
                }

                // Construction du tri
                const sortOptions: Record<string, 1 | -1> = {
                    [sortBy]: sortOrder === 'asc' ? 1 : -1
                };

                const [quests, total] = await Promise.all([
                    Quest.find(query)
                        .sort(sortOptions)
                        .skip(skip)
                        .limit(limit),
                    Quest.countDocuments(query)
                ]);

                const totalPages = Math.ceil(total / limit);

                return res.json({
                    data: quests,
                    pagination: {
                        currentPage: page,
                        totalPages,
                        totalItems: total,
                        itemsPerPage: limit,
                        hasNextPage: page < totalPages,
                        hasPreviousPage: page > 1
                    }
                });
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

        this.get('/autocomplete-groups', authenticatedOptions, async (req: any, res: any) => {
            try {
                const groups = await Group.find({}).sort({ name: 1 });
                return res.json(groups);
            } catch (error) {
                console.error('Error fetching groups:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        this.post('/quests/:id/assign-users', authenticatedOptions, async (req: any, res: any) => {
            try {
                const { userIds } = req.body;
                const questId = req.params.id;

                if (!userIds || !Array.isArray(userIds)) {
                    return res.status(400).json({ error: 'userIds must be an array' });
                }

                const quest = await Quest.findById(questId);
                if (!quest) {
                    return res.status(404).json({ error: 'Quest not found' });
                }

                const validUserIds = userIds.map(id => new ObjectId(id));
                quest.assignedUsers = [...new Set([...quest.assignedUsers || [], ...validUserIds])];
                await quest.save();

                return res.json(quest);
            } catch (error) {
                console.error('Error assigning users to quest:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        this.post('/quests/:id/assign-groups', authenticatedOptions, async (req: any, res: any) => {
            try {
                const { groupIds } = req.body;
                const questId = req.params.id;

                if (!groupIds || !Array.isArray(groupIds)) {
                    return res.status(400).json({ error: 'groupIds must be an array' });
                }

                const quest = await Quest.findById(questId);
                if (!quest) {
                    return res.status(404).json({ error: 'Quest not found' });
                }

                const validGroupIds = groupIds.map(id => new ObjectId(id));
                quest.assignedGroups = [...new Set([...quest.assignedGroups || [], ...validGroupIds])];
                await quest.save();

                return res.json(quest);
            } catch (error) {
                console.error('Error assigning groups to quest:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        this.delete('/quests/:id/assign-users', authenticatedOptions, async (req: any, res: any) => {
            try {
                const { userIds } = req.body;
                const questId = req.params.id;

                if (!userIds || !Array.isArray(userIds)) {
                    return res.status(400).json({ error: 'userIds must be an array' });
                }

                const quest = await Quest.findById(questId);
                if (!quest) {
                    return res.status(404).json({ error: 'Quest not found' });
                }

                const validUserIds = userIds.map(id => new ObjectId(id));
                quest.assignedUsers = (quest.assignedUsers || []).filter(id => !validUserIds.includes(id));
                await quest.save();

                return res.json(quest);
            } catch (error) {
                console.error('Error unassigning users from quest:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        this.delete('/quests/:id/assign-groups', authenticatedOptions, async (req: any, res: any) => {
            try {
                const { groupIds } = req.body;
                const questId = req.params.id;

                if (!groupIds || !Array.isArray(groupIds)) {
                    return res.status(400).json({ error: 'groupIds must be an array' });
                }

                const quest = await Quest.findById(questId);
                if (!quest) {
                    return res.status(404).json({ error: 'Quest not found' });
                }

                const validGroupIds = groupIds.map(id => new ObjectId(id));
                quest.assignedGroups = (quest.assignedGroups || []).filter(id => !validGroupIds.includes(id));
                await quest.save();

                return res.json(quest);
            } catch (error) {
                console.error('Error unassigning groups from quest:', error);
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
