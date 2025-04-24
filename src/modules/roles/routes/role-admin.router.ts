import Role from '../models/role.model.js';
import Permission from '../models/permission.model.js';
import { EnduranceRouter, EnduranceAuthMiddleware, type SecurityOptions, EnduranceRequest } from 'endurance-core';

class RoleAdminRouter extends EnduranceRouter {
    constructor() {
        super(EnduranceAuthMiddleware.getInstance());
    }

    setupRoutes(): void {
        const securityOptions: SecurityOptions = {
            requireAuth: true,
            permissions: []
        };

        // Lister tous les rôles
        this.get('/', securityOptions, async (req: any, res: any) => {
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

                const [roles, total] = await Promise.all([
                    Role.find(query)
                        .populate({
                            path: 'permissions',
                            model: Permission,
                            options: { strictPopulate: false }
                        })
                        .sort(sortOptions)
                        .skip(skip)
                        .limit(limit),
                    Role.countDocuments(query)
                ]);

                const totalPages = Math.ceil(total / limit);

                return res.json({
                    data: roles,
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
                console.error('Error fetching roles:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        // Créer un nouveau rôle
        this.post('/', securityOptions, async (req: any, res: any) => {
            try {
                const role = new Role(req.body);
                const savedRole = await role.save();
                return res.status(201).json(savedRole);
            } catch (error) {
                console.error('Error creating role:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        // Modifier un rôle existant
        this.put('/:id', securityOptions, async (req: any, res: any) => {
            try {
                const role = await Role.findByIdAndUpdate(
                    req.params.id,
                    req.body,
                    { new: true }
                );
                if (!role) {
                    return res.status(404).send('Role not found');
                }
                return res.json(role);
            } catch (error) {
                console.error('Error updating role:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        // Supprimer un rôle
        this.delete('/:id', securityOptions, async (req: any, res: any) => {
            try {
                const role = await Role.findByIdAndDelete(req.params.id);
                if (!role) {
                    return res.status(404).send('Role not found');
                }
                return res.status(204).send();
            } catch (error) {
                console.error('Error deleting role:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        // Lister toutes les permissions (pour autocomplete)
        this.get('/autocomplete-permissions', securityOptions, async (req: any, res: any) => {
            try {
                const search = req.query.search as string || '';
                const limit = parseInt(req.query.limit as string) || 10;

                const query: any = {};

                if (search) {
                    query.$or = [
                        { name: { $regex: search, $options: 'i' } },
                        { description: { $regex: search, $options: 'i' } }
                    ];
                }

                const permissions = await Permission.find(query)
                    .sort({ name: 1 })
                    .limit(limit);

                return res.json(permissions);
            } catch (error) {
                console.error('Error fetching permissions:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        // Créer une nouvelle permission
        this.post('/permissions', securityOptions, async (req: any, res: any) => {
            try {
                const { name, description } = req.body;

                if (!name) {
                    return res.status(400).json({ error: 'Name is required' });
                }

                const permission = new Permission({
                    name,
                    description
                });

                const savedPermission = await permission.save();
                return res.status(201).json(savedPermission);
            } catch (error: any) {
                console.error('Error creating permission:', error);
                if (error.code === 11000) { // Duplicate key error
                    return res.status(400).json({ error: 'Permission name already exists' });
                }
                res.status(500).send('Internal Server Error');
            }
        });
    }
}

const router = new RoleAdminRouter();
export default router;