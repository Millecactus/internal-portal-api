import { EnduranceRouter, enduranceEmitter, enduranceEventTypes, EnduranceAuthMiddleware, SecurityOptions } from '@programisto/endurance-core';
import Presence from '../models/presence.model.js';
import moment from 'moment';

interface Presenceany {
    user: {
        firstname: string;
        lastname: string;
    };
    presences: any[];
}

class PresenceRouter extends EnduranceRouter {
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

        this.get('/weekly-presence', publicOptions, async (req: any, res: any) => {
            try {
                const { startDate } = req.query;
                const startMoment = startDate ? moment(startDate) : moment();
                const startOfWeek = startMoment.startOf('week').toDate();
                const endOfWeek = startMoment.endOf('week').toDate();

                const presences = await Presence.find({
                    date: {
                        $gte: startOfWeek,
                        $lte: endOfWeek
                    }
                }, null, { strictPopulate: false })
                    .populate('user', 'firstname lastname')
                    .exec();

                res.json(presences);
            } catch (error) {
                console.error('Error fetching presence items for the specified week:', error);
                res.status(500).send('Internal Server Error');
            }
        });

        this.get('/today/:type', publicOptions, async (req: any, res: any) => {
            try {
                const startOfDay = moment.utc().startOf('day').subtract(1, 'hours').toDate();
                const endOfDay = moment.utc().endOf('day').subtract(1, 'hours').toDate();

                const presences = await Presence.find({
                    date: {
                        $gte: startOfDay,
                        $lte: endOfDay
                    },
                    type: req.params.type
                }, null, { strictPopulate: false })
                    .populate('user', 'firstname lastname')
                    .exec();

                const presencesRegroupees: Presenceany[] = [];
                for (const presence of presences) {
                    const user = presence.user as unknown as { firstname: string; lastname: string };
                    if (!presencesRegroupees.find(p => p.user.firstname === user.firstname && p.user.lastname === user.lastname)) {
                        presencesRegroupees.push({
                            user: {
                                firstname: user.firstname,
                                lastname: user.lastname
                            },
                            presences: [presence]
                        });
                    }
                }

                res.json(presencesRegroupees);
            } catch (error) {
                console.error('Erreur lors de la récupération des présences pour aujourd\'hui:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        this.post('/presence', authenticatedOptions, async (req: any, res: any) => {
            try {

                const userId = req.user._id;
                const { date, type } = req.body;

                if (!date || !type) {
                    return res.status(400).send('La date et le type sont requis');
                }

                if (!['office', 'client', 'remote', 'school', 'away'].includes(type)) {
                    return res.status(400).send('Type de présence invalide');
                }

                const startOfDay = moment(date).startOf('day').toDate();
                const endOfDay = moment(date).endOf('day').toDate();

                const existingPresences = await Presence.find({
                    user: userId,
                    date: {
                        $gte: startOfDay,
                        $lte: endOfDay
                    }
                });

                if (existingPresences.length === 0) {
                    const morningPresence = new Presence({
                        user: userId,
                        date: moment(date).hour(1).minute(0).second(0).toDate(),
                        type: type
                    });

                    const afternoonPresence = new Presence({
                        user: userId,
                        date: moment(date).hour(14).minute(0).second(0).toDate(),
                        type: type
                    });

                    await morningPresence.save();
                    await afternoonPresence.save();

                    return res.status(201).json([morningPresence, afternoonPresence]);
                }

                const newPresence = new Presence({
                    user: userId,
                    date: moment(date).toDate(),
                    type: type
                });
                await newPresence.save();
                res.status(201).json(newPresence);
            } catch (error) {
                console.error('Erreur lors de la création d\'une nouvelle entrée de présence:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });
    }
}

const router = new PresenceRouter();
export default router;
