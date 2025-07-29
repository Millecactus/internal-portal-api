import { EnduranceRouter, enduranceEmitter, enduranceEventTypes, EnduranceAuthMiddleware, SecurityOptions } from '@programisto/endurance-core';
import Cooptation from '../models/cooptation.model.js';
import User from '../models/user.model.js';

class CooptationAdminRouter extends EnduranceRouter {
    constructor() {
        super(EnduranceAuthMiddleware.getInstance());
    }

    setupRoutes(): void {
        const authenticatedOptions: SecurityOptions = {
            requireAuth: true,
            permissions: []
        };

        // Lister toutes les cooptations
        this.get('/', authenticatedOptions, async (req: any, res: any) => {
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

                // Recherche sur nom, prénom, email, téléphone et note
                if (search) {
                    query.$or = [
                        { lastname: { $regex: search, $options: 'i' } },
                        { firstname: { $regex: search, $options: 'i' } },
                        { email: { $regex: search, $options: 'i' } },
                        { phone: { $regex: search, $options: 'i' } },
                        { note: { $regex: search, $options: 'i' } }
                    ];
                }

                // Construction du tri
                const sortOptions: Record<string, 1 | -1> = {
                    [sortBy]: sortOrder === 'asc' ? 1 : -1
                };

                const [cooptations, total] = await Promise.all([
                    Cooptation.find(query)
                        .sort(sortOptions)
                        .skip(skip)
                        .limit(limit)
                        .exec(),
                    Cooptation.countDocuments(query)
                ]);

                const totalPages = Math.ceil(total / limit);

                return res.json({
                    data: cooptations,
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
                console.error('Erreur lors de la récupération des cooptations:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        this.get('/autocomplete-users', authenticatedOptions, async (req: any, res: any) => {
            try {
                const users = await User.find({}).sort({ firstname: -1, lastname: -1 });
                return res.json(users);
            } catch (error) {
                console.error('Error fetching users:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        // Modifier une cooptation existante
        this.put('/:id', authenticatedOptions, async (req: any, res: any) => {
            try {
                const oldCooptation = await Cooptation.findById(req.params.id);
                if (!oldCooptation) {
                    return res.status(404).send('Cooptation not found');
                }

                const cooptation = await Cooptation.findByIdAndUpdate(
                    req.params.id,
                    req.body,
                    { new: true }
                );

                if (!cooptation) {
                    return res.status(404).send('Cooptation not found');
                }

                enduranceEmitter.emit(enduranceEventTypes.COOPTATION_UPDATED, {
                    userId: req.user._id,
                    cooptationId: cooptation._id,
                    cooptationData: {
                        lastname: cooptation.lastname,
                        firstname: cooptation.firstname,
                        email: cooptation.email,
                        status: cooptation.status
                    }
                });

                // Vérifier si le statut a changé
                if (oldCooptation.status !== cooptation.status) {
                    // Récupérer l'utilisateur qui a fait la cooptation
                    const cooptationUser = await User.findById(cooptation.cooptationUserId);

                    if (cooptationUser) {
                        enduranceEmitter.emit(enduranceEventTypes.SEND_EMAIL, {
                            template: 'cooptation-status-update',
                            to: cooptationUser.email,
                            subject: 'Mise à jour du statut de votre cooptation - My Programisto',
                            data: {
                                user_name: cooptationUser.firstname + ' ' + cooptationUser.lastname,
                                cooptation_name: cooptation.firstname + ' ' + cooptation.lastname,
                                old_status: oldCooptation.status,
                                new_status: cooptation.status
                            }
                        });
                    }
                }

                return res.json(cooptation);
            } catch (error) {
                console.error('Error updating cooptation:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        // Supprimer une cooptation
        this.delete('/:id', authenticatedOptions, async (req: any, res: any) => {
            try {
                const cooptation = await Cooptation.findByIdAndDelete(req.params.id);
                if (!cooptation) {
                    return res.status(404).send('Cooptation not found');
                }
                return res.status(204).send();
            } catch (error) {
                console.error('Error deleting Cooptation:', error);
                res.status(500).send('Internal Server Error');
            }
        });
    }
}

const router = new CooptationAdminRouter();
export default router;
