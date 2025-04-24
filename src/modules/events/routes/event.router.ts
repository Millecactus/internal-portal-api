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
    }
}

const router = new EventRouter();
export default router;