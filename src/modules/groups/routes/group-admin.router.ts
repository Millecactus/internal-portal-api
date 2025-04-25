import Group from '../models/group.model.js';
import { EnduranceRouter, EnduranceAuthMiddleware, type SecurityOptions } from 'endurance-core';
import User from '../models/user.model.js';

class GroupAdminRouter extends EnduranceRouter {
    constructor() {
        super(EnduranceAuthMiddleware.getInstance());
    }

    setupRoutes(): void {
        const securityOptions: SecurityOptions = {
            requireAuth: true,
            permissions: []
        };

        // Lister tous les groupes
        this.get('/', securityOptions, async (req: any, res: any) => {
            try {
                const page = parseInt(req.query.page as string) || 1;
                const limit = parseInt(req.query.limit as string) || 10;
                const skip = (page - 1) * limit;
                const search = req.query.search as string || '';
                const sortBy = req.query.sortBy as string || 'name';
                const sortOrder = req.query.sortOrder as string || 'asc';

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

                const [groups, total] = await Promise.all([
                    Group.find(query)
                        .sort(sortOptions)
                        .skip(skip)
                        .limit(limit),
                    Group.countDocuments(query)
                ]);

                // Récupérer les détails des utilisateurs pour chaque groupe
                const groupsWithUsers = await Promise.all(groups.map(async (group) => {
                    const users = await User.find({ _id: { $in: group.users } })
                        .select('firstname lastname email');
                    return {
                        ...group.toObject(),
                        users: users
                    };
                }));

                const totalPages = Math.ceil(total / limit);

                return res.json({
                    data: groupsWithUsers,
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
                console.error('Error fetching groups:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        // Créer un nouveau groupe
        this.post('/', securityOptions, async (req: any, res: any) => {
            try {
                const group = new Group(req.body);
                const savedGroup = await group.save();
                return res.status(201).json(savedGroup);
            } catch (error) {
                console.error('Error creating group:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        // Modifier un groupe existant
        this.put('/:id', securityOptions, async (req: any, res: any) => {
            try {
                const group = await Group.findByIdAndUpdate(
                    req.params.id,
                    req.body,
                    { new: true }
                );
                if (!group) {
                    return res.status(404).send('Group not found');
                }

                // Récupérer les détails des utilisateurs
                const users = await User.find({ _id: { $in: group.users } })
                    .select('firstname lastname email');

                return res.json({
                    ...group.toObject(),
                    users: users
                });
            } catch (error) {
                console.error('Error updating group:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        // Supprimer un groupe
        this.delete('/:id', securityOptions, async (req: any, res: any) => {
            try {
                const group = await Group.findByIdAndDelete(req.params.id);
                if (!group) {
                    return res.status(404).send('Group not found');
                }
                return res.status(204).send();
            } catch (error) {
                console.error('Error deleting group:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        // Autocomplétion des utilisateurs
        this.get('/autocomplete-users', securityOptions, async (req: any, res: any) => {
            try {
                const users = await User.find({}).sort({ firstname: -1, lastname: -1 });
                return res.json(users);
            } catch (error) {
                console.error('Error fetching users:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        // Ajouter des utilisateurs à un groupe
        this.post('/:id/users', securityOptions, async (req: any, res: any) => {
            try {
                const { userIds } = req.body;

                if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
                    return res.status(400).json({ error: 'User IDs array is required and must not be empty' });
                }

                const group = await Group.findById(req.params.id);
                if (!group) {
                    return res.status(404).send('Group not found');
                }

                // Vérifier les doublons
                const existingUsers = userIds.filter(id => group.users.includes(id));
                if (existingUsers.length > 0) {
                    return res.status(400).json({
                        error: 'Some users are already in this group',
                        existingUsers
                    });
                }

                // Ajouter les utilisateurs au groupe
                group.users.push(...userIds);
                await group.save();

                return res.status(200).json(group);
            } catch (error) {
                console.error('Error adding users to group:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        // Supprimer des utilisateurs d'un groupe
        this.delete('/:id/users', securityOptions, async (req: any, res: any) => {
            try {
                const { userIds } = req.body;

                if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
                    return res.status(400).json({ error: 'User IDs array is required and must not be empty' });
                }

                const group = await Group.findById(req.params.id);
                if (!group) {
                    return res.status(404).send('Group not found');
                }

                // Vérifier si tous les utilisateurs sont bien dans le groupe
                const nonGroupUsers = userIds.filter(id => !group.users.includes(id));
                if (nonGroupUsers.length > 0) {
                    return res.status(400).json({
                        error: 'Some users are not in this group',
                        nonGroupUsers
                    });
                }

                // Supprimer les utilisateurs du groupe
                group.users = group.users.filter(id => !userIds.includes(id));
                await group.save();

                return res.status(200).json(group);
            } catch (error) {
                console.error('Error removing users from group:', error);
                res.status(500).send('Internal Server Error');
            }
        });
    }
}

const router = new GroupAdminRouter();
export default router;