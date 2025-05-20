import { EnduranceRouter, EnduranceAuthMiddleware, type SecurityOptions } from 'endurance-core';
import User from '../models/user.model.js';
import Role from '../models/role.model.js';
import Group from '../../groups/models/group.model.js';
import office365Service from '../services/office365.service.js';

class UserAdminRouter extends EnduranceRouter {
    constructor() {
        super(EnduranceAuthMiddleware.getInstance());
    }

    setupRoutes(): void {
        const securityOptions: SecurityOptions = {
            requireAuth: true,
            permissions: []
        };

        // Lister tous les utilisateurs
        this.get('/', securityOptions, async (req: any, res: any) => {
            try {
                const page = parseInt(req.query.page as string) || 1;
                const limit = parseInt(req.query.limit as string) || 10;
                const skip = (page - 1) * limit;
                const search = req.query.search as string || '';
                const sortBy = req.query.sortBy as string || 'lastname';
                const sortOrder = req.query.sortOrder as string || 'asc';

                // Construction de la requête de recherche
                const query: any = {};

                // Recherche sur nom, prénom et email
                if (search) {
                    query.$or = [
                        { firstname: { $regex: search, $options: 'i' } },
                        { lastname: { $regex: search, $options: 'i' } },
                        { email: { $regex: search, $options: 'i' } }
                    ];
                }

                // Construction du tri
                const sortOptions: Record<string, 1 | -1> = {
                    [sortBy]: sortOrder === 'asc' ? 1 : -1
                };

                const [users, total] = await Promise.all([
                    User.find(query)
                        .sort(sortOptions)
                        .skip(skip)
                        .limit(limit),
                    User.countDocuments(query)
                ]);

                // Récupérer les rôles pour chaque utilisateur
                const usersWithRoles = await Promise.all(users.map(async (user) => {
                    const roles = user.roles ? await Role.find({ _id: { $in: user.roles } }) : [];
                    return {
                        ...user.toObject(),
                        roles: roles
                    };
                }));

                const totalPages = Math.ceil(total / limit);

                return res.json({
                    data: usersWithRoles,
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
                console.error('Error fetching users:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        // Créer un nouvel utilisateur
        this.post('/', securityOptions, async (req: any, res: any) => {
            try {
                // Créer l'utilisateur dans la base de données
                const user = new User(req.body);
                const savedUser = await user.save();
                // Créer le compte Microsoft 365
                const m365User = await office365Service.createUser({
                    firstname: req.body.firstname,
                    lastname: req.body.lastname,
                    email: req.body.email
                });

                return res.status(201).json({
                    user: savedUser,
                    m365Account: m365User
                });
            } catch (error) {
                console.error('Error creating user:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        // Modifier un utilisateur existant
        this.put('/:id', securityOptions, async (req: any, res: any) => {
            try {
                const user = await User.findByIdAndUpdate(
                    req.params.id,
                    req.body,
                    { new: true }
                );

                if (!user) {
                    return res.status(404).send('User not found');
                }

                // Récupérer les rôles de l'utilisateur
                const roles = user.roles ? await Role.find({ _id: { $in: user.roles } }) : [];
                const userWithRoles = {
                    ...user.toObject(),
                    roles: roles
                };

                return res.json(userWithRoles);
            } catch (error) {
                console.error('Error updating user:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        // Supprimer un utilisateur
        this.delete('/:id', securityOptions, async (req: any, res: any) => {
            try {
                const user = await User.findByIdAndDelete(req.params.id);
                if (!user) {
                    return res.status(404).send('User not found');
                }
                return res.status(204).send();
            } catch (error) {
                console.error('Error deleting user:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        // Activer/Désactiver un utilisateur
        this.patch('/:id/toggle-active', securityOptions, async (req: any, res: any) => {
            try {
                const user = await User.findById(req.params.id);
                if (!user) {
                    return res.status(404).send('User not found');
                }

                user.isActive = !user.isActive;
                await user.save();

                // Récupérer les rôles de l'utilisateur
                const roles = user.roles ? await Role.find({ _id: { $in: user.roles } }) : [];
                const userWithRoles = {
                    ...user.toObject(),
                    roles: roles
                };

                return res.json(userWithRoles);
            } catch (error) {
                console.error('Error toggling user active status:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        // Assigner des rôles à un utilisateur
        this.post('/:id/roles', securityOptions, async (req: any, res: any) => {
            try {
                const { roleIds } = req.body;

                if (!roleIds || !Array.isArray(roleIds) || roleIds.length === 0) {
                    return res.status(400).json({ error: 'Role IDs array is required and must not be empty' });
                }

                const user = await User.findById(req.params.id);
                if (!user) {
                    return res.status(404).send('User not found');
                }

                // Vérifier les doublons
                const existingRoles = roleIds.filter(id => user.roles?.includes(id));
                if (existingRoles.length > 0) {
                    return res.status(400).json({
                        error: 'Some roles are already assigned to this user',
                        existingRoles
                    });
                }

                // Ajouter les rôles à l'utilisateur
                user.roles = [...(user.roles || []), ...roleIds];
                await user.save();

                // Récupérer les rôles de l'utilisateur
                const roles = await Role.find({ _id: { $in: user.roles } });
                const userWithRoles = {
                    ...user.toObject(),
                    roles: roles
                };

                return res.status(200).json(userWithRoles);
            } catch (error) {
                console.error('Error assigning roles to user:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        // Supprimer des rôles d'un utilisateur
        this.delete('/:id/roles', securityOptions, async (req: any, res: any) => {
            try {
                const { roleIds } = req.body;

                if (!roleIds || !Array.isArray(roleIds) || roleIds.length === 0) {
                    return res.status(400).json({ error: 'Role IDs array is required and must not be empty' });
                }

                const user = await User.findById(req.params.id);
                if (!user) {
                    return res.status(404).send('User not found');
                }

                // Vérifier si tous les rôles sont bien assignés à l'utilisateur
                const nonUserRoles = roleIds.filter(id => !user.roles?.includes(id));
                if (nonUserRoles.length > 0) {
                    return res.status(400).json({
                        error: 'Some roles are not assigned to this user',
                        nonUserRoles
                    });
                }

                // Supprimer les rôles de l'utilisateur
                user.roles = user.roles?.filter(id => !roleIds.includes(id));
                await user.save();

                // Récupérer les rôles de l'utilisateur
                const roles = user.roles ? await Role.find({ _id: { $in: user.roles } }) : [];
                const userWithRoles = {
                    ...user.toObject(),
                    roles: roles
                };

                return res.status(200).json(userWithRoles);
            } catch (error) {
                console.error('Error removing roles from user:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        // Récupérer les groupes d'un utilisateur
        this.get('/:id/groups', securityOptions, async (req: any, res: any) => {
            try {
                const userId = req.params.id;

                // Vérifier si l'utilisateur existe
                const user = await User.findById(userId);
                if (!user) {
                    return res.status(404).send('User not found');
                }

                // Trouver tous les groupes qui contiennent cet utilisateur
                const groups = await Group.find({ users: userId });

                return res.json(groups);
            } catch (error) {
                console.error('Error fetching user groups:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        // Assigner un utilisateur à des groupes
        this.post('/:id/groups', securityOptions, async (req: any, res: any) => {
            try {
                const { groupIds } = req.body;
                const userId = req.params.id;

                if (!groupIds || !Array.isArray(groupIds) || groupIds.length === 0) {
                    return res.status(400).json({ error: 'Group IDs array is required and must not be empty' });
                }

                // Vérifier si l'utilisateur existe
                const user = await User.findById(userId);
                if (!user) {
                    return res.status(404).send('User not found');
                }

                // Vérifier si tous les groupes existent
                const groups = await Group.find({ _id: { $in: groupIds } });
                if (groups.length !== groupIds.length) {
                    return res.status(400).json({ error: 'Some groups were not found' });
                }

                // Ajouter l'utilisateur à chaque groupe s'il n'y est pas déjà
                const updatePromises = groups.map(group => {
                    if (!group.users.includes(userId)) {
                        group.users.push(userId);
                        return group.save();
                    }
                    return Promise.resolve(group);
                });

                await Promise.all(updatePromises);

                // Récupérer les groupes mis à jour
                const updatedGroups = await Group.find({ users: userId });
                return res.json(updatedGroups);
            } catch (error) {
                console.error('Error assigning user to groups:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        // Désassigner un utilisateur de groupes
        this.delete('/:id/groups', securityOptions, async (req: any, res: any) => {
            try {
                const { groupIds } = req.body;
                const userId = req.params.id;

                if (!groupIds || !Array.isArray(groupIds) || groupIds.length === 0) {
                    return res.status(400).json({ error: 'Group IDs array is required and must not be empty' });
                }

                // Vérifier si l'utilisateur existe
                const user = await User.findById(userId);
                if (!user) {
                    return res.status(404).send('User not found');
                }

                // Retirer l'utilisateur de chaque groupe
                await Group.updateMany(
                    { _id: { $in: groupIds } },
                    { $pull: { users: userId } }
                );

                // Récupérer les groupes restants de l'utilisateur
                const remainingGroups = await Group.find({ users: userId });
                return res.json(remainingGroups);
            } catch (error) {
                console.error('Error removing user from groups:', error);
                res.status(500).send('Internal Server Error');
            }
        });
    }
}

const router = new UserAdminRouter();
export default router;