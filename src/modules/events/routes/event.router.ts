import Event from '../models/event.model.js';
import { EnduranceRouter, EnduranceAuthMiddleware, type SecurityOptions } from 'endurance-core';
import User from '../models/user.model.js';

class EventRouter extends EnduranceRouter {
    constructor() {
        super(EnduranceAuthMiddleware.getInstance());
    }

    setupRoutes(): void {
        const securityOptions: SecurityOptions = {
            requireAuth: true,
            permissions: []
        };

        // Lister les prochains événements
        this.get('/upcoming', securityOptions, async (req: any, res: any) => {
            try {
                const page = parseInt(req.query.page as string) || 1;
                const limit = parseInt(req.query.limit as string) || 10;
                const skip = (page - 1) * limit;
                const type = req.query.type as string;

                // Construction de la requête
                const query: any = {
                    date: { $gte: new Date().setHours(0, 0, 0, 0) } // Événements du jour et futurs
                };

                // Filtre par type
                if (type) {
                    query.type = type;
                }

                const [events, total] = await Promise.all([
                    Event.find(query)
                        .sort({ date: 1 }) // Tri par date croissante
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
                console.error('Error fetching upcoming events:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        // Afficher les détails d'un événement
        this.get('/:id', securityOptions, async (req: any, res: any) => {
            try {
                const event = await Event.findById(req.params.id);
                if (!event) {
                    return res.status(404).send('Event not found');
                }

                // Récupérer les informations des participants
                const participants = await User.find({
                    _id: { $in: event.registeredUsers }
                }).select('firstname lastname email');

                return res.json({
                    ...event.toObject(),
                    participants
                });
            } catch (error) {
                console.error('Error fetching event details:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        // S'inscrire à un événement
        this.post('/:id/register', securityOptions, async (req: any, res: any) => {
            try {
                const event = await Event.findById(req.params.id);
                if (!event) {
                    return res.status(404).send('Event not found');
                }

                const userId = req.user._id; // Récupération de l'ID de l'utilisateur connecté

                // Vérifier si l'utilisateur est déjà inscrit
                if (event.registeredUsers.includes(userId)) {
                    return res.status(400).json({ error: 'You are already registered for this event' });
                }

                // Vérifier si l'événement a atteint sa capacité maximale
                if (event.maxParticipants && event.registeredUsers.length >= event.maxParticipants) {
                    return res.status(400).json({ error: 'Event is full' });
                }

                // Ajouter l'utilisateur à la liste des inscrits
                event.registeredUsers.push(userId);
                await event.save();

                return res.status(200).json({
                    message: 'Successfully registered for the event',
                    event
                });
            } catch (error) {
                console.error('Error registering for event:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        // Se désinscrire d'un événement
        this.delete('/:id/unregister', securityOptions, async (req: any, res: any) => {
            try {
                const event = await Event.findById(req.params.id);
                if (!event) {
                    return res.status(404).send('Event not found');
                }

                const userId = req.user._id.toString(); // Conversion en string pour la comparaison

                // Vérifier si l'utilisateur est bien inscrit
                if (!event.registeredUsers.includes(userId)) {
                    return res.status(400).json({ error: 'You are not registered for this event' });
                }

                // Supprimer l'utilisateur de la liste des inscrits
                event.registeredUsers = event.registeredUsers.filter(id => id.toString() !== userId);
                await event.save();

                return res.status(200).json({
                    message: 'Successfully unregistered from the event',
                    event
                });
            } catch (error) {
                console.error('Error unregistering from event:', error);
                res.status(500).send('Internal Server Error');
            }
        });
    }
}

const router = new EventRouter();
export default router;