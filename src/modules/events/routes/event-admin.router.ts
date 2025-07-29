import Event from '../models/event.model.js';
import { EnduranceRouter, EnduranceAuthMiddleware, type SecurityOptions } from '@programisto/endurance-core';
import User from '../models/user.model.js';

class EventAdminRouter extends EnduranceRouter {
    constructor() {
        super(EnduranceAuthMiddleware.getInstance());
    }

    setupRoutes(): void {
        const securityOptions: SecurityOptions = {
            requireAuth: true,
            permissions: []
        };

        // Lister tous les événements
        this.get('/', securityOptions, async (req: any, res: any) => {
            try {
                const page = parseInt(req.query.page as string) || 1;
                const limit = parseInt(req.query.limit as string) || 10;
                const skip = (page - 1) * limit;
                const search = req.query.search as string || '';
                const sortBy = req.query.sortBy as string || 'date';
                const sortOrder = req.query.sortOrder as string || 'desc';
                const type = req.query.type as string;

                // Construction de la requête de recherche
                const query: any = {};

                // Recherche sur nom et description
                if (search) {
                    query.$or = [
                        { name: { $regex: search, $options: 'i' } },
                        { description: { $regex: search, $options: 'i' } }
                    ];
                }

                // Filtre par type
                if (type) {
                    query.type = type;
                }

                // Construction du tri
                const sortOptions: Record<string, 1 | -1> = {
                    [sortBy]: sortOrder === 'asc' ? 1 : -1
                };

                const [events, total] = await Promise.all([
                    Event.find(query)
                        .sort(sortOptions)
                        .skip(skip)
                        .limit(limit),
                    Event.countDocuments(query)
                ]);

                const totalPages = Math.ceil(total / limit);

                return res.json({
                    data: events,
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
                console.error('Error fetching events:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        // Créer un nouvel événement
        this.post('/', securityOptions, async (req: any, res: any) => {
            try {
                const event = new Event(req.body);
                const savedEvent = await event.save();
                return res.status(201).json(savedEvent);
            } catch (error) {
                console.error('Error creating event:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        // Modifier un événement existant
        this.put('/:id', securityOptions, async (req: any, res: any) => {
            try {
                const event = await Event.findByIdAndUpdate(
                    req.params.id,
                    req.body,
                    { new: true }
                );
                if (!event) {
                    return res.status(404).send('Event not found');
                }
                return res.json(event);
            } catch (error) {
                console.error('Error updating event:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        // Supprimer un événement
        this.delete('/:id', securityOptions, async (req: any, res: any) => {
            try {
                const event = await Event.findByIdAndDelete(req.params.id);
                if (!event) {
                    return res.status(404).send('Event not found');
                }
                return res.status(204).send();
            } catch (error) {
                console.error('Error deleting event:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        this.get('/autocomplete-users', securityOptions, async (req: any, res: any) => {
            try {
                const users = await User.find({}).sort({ firstname: -1, lastname: -1 });
                return res.json(users);
            } catch (error) {
                console.error('Error fetching users:', error);
                res.status(500).send('Internal Server Error');
            }
        });


        // Ajouter des participants à un événement
        this.post('/:id/participants', securityOptions, async (req: any, res: any) => {
            try {
                const { userIds } = req.body;

                if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
                    return res.status(400).json({ error: 'User IDs array is required and must not be empty' });
                }

                const event = await Event.findById(req.params.id);
                if (!event) {
                    return res.status(404).send('Event not found');
                }

                // Vérifier si l'événement a atteint sa capacité maximale
                if (event.maxParticipants && (event.registeredUsers.length + userIds.length) > event.maxParticipants) {
                    return res.status(400).json({ error: 'Adding these participants would exceed the event capacity' });
                }

                // Vérifier les doublons
                const existingUsers = userIds.filter(id => event.registeredUsers.includes(id));
                if (existingUsers.length > 0) {
                    return res.status(400).json({
                        error: 'Some users are already registered for this event',
                        existingUsers
                    });
                }

                // Ajouter les utilisateurs à la liste des inscrits
                event.registeredUsers.push(...userIds);
                await event.save();

                return res.status(200).json(event);
            } catch (error) {
                console.error('Error adding participants:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        // Supprimer des participants d'un événement
        this.delete('/:id/participants', securityOptions, async (req: any, res: any) => {
            try {
                const { userIds } = req.body;

                if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
                    return res.status(400).json({ error: 'User IDs array is required and must not be empty' });
                }

                const event = await Event.findById(req.params.id);
                if (!event) {
                    return res.status(404).send('Event not found');
                }

                // Vérifier si tous les utilisateurs sont bien inscrits
                const nonRegisteredUsers = userIds.filter(id => !event.registeredUsers.includes(id));
                if (nonRegisteredUsers.length > 0) {
                    return res.status(400).json({
                        error: 'Some users are not registered for this event',
                        nonRegisteredUsers
                    });
                }

                // Supprimer les utilisateurs de la liste des inscrits
                event.registeredUsers = event.registeredUsers.filter(id => !userIds.includes(id));
                await event.save();

                return res.status(200).json(event);
            } catch (error) {
                console.error('Error removing participants:', error);
                res.status(500).send('Internal Server Error');
            }
        });
    }
}

const router = new EventAdminRouter();
export default router;