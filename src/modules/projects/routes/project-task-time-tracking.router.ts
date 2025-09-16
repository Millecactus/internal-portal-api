import { EnduranceRouter, EnduranceAuthMiddleware, SecurityOptions } from '@programisto/endurance-core';
import ProjectTaskTimeTrackingModel from '../models/project-task-time-tracking.model.js';
import ProjectTaskModel from '../models/project-task.model.js';
import { ObjectId } from 'mongodb';

class ProjectTaskTimeTrackingRouter extends EnduranceRouter {
    constructor() {
        super(EnduranceAuthMiddleware.getInstance());
    }

    setupRoutes(): void {
        const authenticatedOptions: SecurityOptions = {
            requireAuth: true,
            permissions: []
        };

        // Lister le suivi du temps d'une tâche
        this.get('/task/:taskId', authenticatedOptions, async (req: any, res: any) => {
            try {
                const page = parseInt(req.query.page as string) || 1;
                const limit = parseInt(req.query.limit as string) || 20;
                const skip = (page - 1) * limit;
                const userId = req.query.userId as string || 'all';
                const startDate = req.query.startDate as string;
                const endDate = req.query.endDate as string;
                const workType = req.query.workType as string || 'all';
                const sortBy = req.query.sortBy as string || 'date';
                const sortOrder = req.query.sortOrder as string || 'desc';

                // Construction de la requête de recherche
                const query: any = { task: req.params.taskId };

                // Filtres
                if (userId !== 'all') {
                    query.user = new ObjectId(userId);
                }

                if (workType !== 'all') {
                    query.workType = workType;
                }

                if (startDate || endDate) {
                    query.date = {};
                    if (startDate) query.date.$gte = new Date(startDate);
                    if (endDate) query.date.$lte = new Date(endDate);
                }

                // Tri
                const sort: any = {};
                sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

                const timeEntries = await ProjectTaskTimeTrackingModel.find(query)
                    .sort(sort)
                    .skip(skip)
                    .limit(limit);

                // Convertir en objets simples
                const populatedTimeEntries = timeEntries.map(timeEntry => timeEntry.toObject());

                const total = await ProjectTaskTimeTrackingModel.countDocuments(query);

                // Calculer les totaux
                const totals = await ProjectTaskTimeTrackingModel.aggregate([
                    { $match: query },
                    {
                        $group: {
                            _id: null,
                            totalHours: { $sum: '$hours' },
                            totalBillableHours: {
                                $sum: {
                                    $cond: ['$isBillable', '$hours', 0]
                                }
                            },
                            totalEntries: { $sum: 1 }
                        }
                    }
                ]);

                res.json({
                    timeEntries: populatedTimeEntries,
                    totals: totals[0] || { totalHours: 0, totalBillableHours: 0, totalEntries: 0 },
                    pagination: {
                        currentPage: page,
                        totalPages: Math.ceil(total / limit),
                        totalItems: total,
                        itemsPerPage: limit
                    }
                });
            } catch (error) {
                console.error('Erreur lors de la récupération du suivi du temps:', error);
                res.status(500).json({ message: 'Erreur interne du serveur' });
            }
        });

        // Lister le suivi du temps d'un utilisateur sur un projet
        this.get('/project/:projectId/user/:userId', authenticatedOptions, async (req: any, res: any) => {
            try {
                const page = parseInt(req.query.page as string) || 1;
                const limit = parseInt(req.query.limit as string) || 20;
                const skip = (page - 1) * limit;
                const startDate = req.query.startDate as string;
                const endDate = req.query.endDate as string;
                const workType = req.query.workType as string || 'all';

                // Récupérer toutes les tâches du projet
                const projectTasks = await ProjectTaskModel.find({
                    project: req.params.projectId
                }).select('_id');

                const taskIds = projectTasks.map(task => task._id);

                // Construction de la requête de recherche
                const query: any = {
                    task: { $in: taskIds },
                    user: req.params.userId
                };

                // Filtres
                if (workType !== 'all') {
                    query.workType = workType;
                }

                if (startDate || endDate) {
                    query.date = {};
                    if (startDate) query.date.$gte = new Date(startDate);
                    if (endDate) query.date.$lte = new Date(endDate);
                }

                const timeEntries = await ProjectTaskTimeTrackingModel.find(query)
                    .sort({ date: -1 })
                    .skip(skip)
                    .limit(limit);

                // Convertir en objets simples
                const populatedTimeEntries = timeEntries.map(timeEntry => timeEntry.toObject());

                const total = await ProjectTaskTimeTrackingModel.countDocuments(query);

                // Calculer les totaux
                const totals = await ProjectTaskTimeTrackingModel.aggregate([
                    { $match: query },
                    {
                        $group: {
                            _id: null,
                            totalHours: { $sum: '$hours' },
                            totalBillableHours: {
                                $sum: {
                                    $cond: ['$isBillable', '$hours', 0]
                                }
                            },
                            totalEntries: { $sum: 1 }
                        }
                    }
                ]);

                res.json({
                    timeEntries: populatedTimeEntries,
                    totals: totals[0] || { totalHours: 0, totalBillableHours: 0, totalEntries: 0 },
                    pagination: {
                        currentPage: page,
                        totalPages: Math.ceil(total / limit),
                        totalItems: total,
                        itemsPerPage: limit
                    }
                });
            } catch (error) {
                console.error('Erreur lors de la récupération du suivi du temps:', error);
                res.status(500).json({ message: 'Erreur interne du serveur' });
            }
        });

        // Créer une nouvelle entrée de suivi du temps
        this.post('/', authenticatedOptions, async (req: any, res: any) => {
            try {
                const {
                    task,
                    user,
                    date,
                    hours,
                    description,
                    workType,
                    isBillable,
                    notes
                } = req.body;

                // Validation des champs requis
                if (!task || !user || !date || !hours) {
                    return res.status(400).json({
                        message: 'Les champs task, user, date et hours sont requis'
                    });
                }

                // Vérifier que la tâche existe
                const taskExists = await ProjectTaskModel.findById(task);
                if (!taskExists) {
                    return res.status(400).json({ message: 'Tâche non trouvée' });
                }

                // Validation de l'ObjectId utilisateur
                if (!ObjectId.isValid(user)) {
                    return res.status(400).json({ message: 'ID utilisateur invalide' });
                }

                // Vérifier que l'utilisateur est assigné à la tâche ou est un contributeur
                const isAssigned = taskExists.assignedTo?.toString() === user;
                const isContributor = taskExists.contributors.some(contributor =>
                    contributor.toString() === user
                );

                // Si l'utilisateur n'est ni assigné ni contributeur, l'ajouter automatiquement aux contributeurs
                if (!isAssigned && !isContributor) {
                    await ProjectTaskModel.findByIdAndUpdate(
                        task,
                        { $addToSet: { contributors: user } }
                    );
                }

                const timeEntry = new ProjectTaskTimeTrackingModel({
                    task,
                    user,
                    date: new Date(date),
                    hours,
                    description,
                    workType: workType || 'DEVELOPMENT',
                    isBillable: isBillable !== undefined ? isBillable : true,
                    notes
                });

                await timeEntry.save();

                // Mettre à jour le temps total de la tâche
                await this.updateTaskTotalHours(task);

                // Convertir en objet simple
                const populatedTimeEntry = timeEntry.toObject();

                res.status(201).json(populatedTimeEntry);
            } catch (error) {
                console.error('Erreur lors de la création de l\'entrée de temps:', error);
                res.status(500).json({ message: 'Erreur interne du serveur' });
            }
        });

        // Mettre à jour une entrée de suivi du temps
        this.put('/:id', authenticatedOptions, async (req: any, res: any) => {
            try {
                const timeEntry = await ProjectTaskTimeTrackingModel.findById(req.params.id);
                if (!timeEntry) {
                    return res.status(404).json({ message: 'Entrée de temps non trouvée' });
                }

                const {
                    date,
                    hours,
                    description,
                    workType,
                    isBillable,
                    notes
                } = req.body;

                // Mise à jour des champs
                if (date !== undefined) timeEntry.date = new Date(date);
                if (hours !== undefined) timeEntry.hours = hours;
                if (description !== undefined) timeEntry.description = description;
                if (workType !== undefined) timeEntry.workType = workType;
                if (isBillable !== undefined) timeEntry.isBillable = isBillable;
                if (notes !== undefined) timeEntry.notes = notes;

                await timeEntry.save();

                // Mettre à jour le temps total de la tâche
                await this.updateTaskTotalHours(timeEntry.task);

                // Convertir en objet simple
                const populatedTimeEntry = timeEntry.toObject();

                res.json(populatedTimeEntry);
            } catch (error) {
                console.error('Erreur lors de la mise à jour de l\'entrée de temps:', error);
                res.status(500).json({ message: 'Erreur interne du serveur' });
            }
        });

        // Supprimer une entrée de suivi du temps
        this.delete('/:id', authenticatedOptions, async (req: any, res: any) => {
            try {
                const timeEntry = await ProjectTaskTimeTrackingModel.findById(req.params.id);
                if (!timeEntry) {
                    return res.status(404).json({ message: 'Entrée de temps non trouvée' });
                }

                const taskId = timeEntry.task;

                // Supprimer l'entrée
                await ProjectTaskTimeTrackingModel.findByIdAndDelete(req.params.id);

                // Mettre à jour le temps total de la tâche
                await this.updateTaskTotalHours(taskId);

                res.json({ message: 'Entrée de temps supprimée avec succès' });
            } catch (error) {
                console.error('Erreur lors de la suppression de l\'entrée de temps:', error);
                res.status(500).json({ message: 'Erreur interne du serveur' });
            }
        });

        // Récupérer les statistiques de temps d'une tâche
        this.get('/task/:taskId/stats', authenticatedOptions, async (req: any, res: any) => {
            try {
                const taskId = req.params.taskId;

                // Vérifier que la tâche existe
                const task = await ProjectTaskModel.findById(taskId);
                if (!task) {
                    return res.status(404).json({ message: 'Tâche non trouvée' });
                }

                // Statistiques par utilisateur
                const userStats = await ProjectTaskTimeTrackingModel.aggregate([
                    { $match: { task: new ObjectId(taskId) } },
                    {
                        $group: {
                            _id: '$user',
                            totalHours: { $sum: '$hours' },
                            totalBillableHours: {
                                $sum: {
                                    $cond: ['$isBillable', '$hours', 0]
                                }
                            },
                            entriesCount: { $sum: 1 }
                        }
                    },
                    {
                        $lookup: {
                            from: 'users',
                            localField: '_id',
                            foreignField: '_id',
                            as: 'user'
                        }
                    },
                    {
                        $unwind: '$user'
                    },
                    {
                        $project: {
                            user: { firstname: 1, lastname: 1, email: 1 },
                            totalHours: 1,
                            totalBillableHours: 1,
                            entriesCount: 1
                        }
                    }
                ]);

                // Statistiques par type de travail
                const workTypeStats = await ProjectTaskTimeTrackingModel.aggregate([
                    { $match: { task: new ObjectId(taskId) } },
                    {
                        $group: {
                            _id: '$workType',
                            totalHours: { $sum: '$hours' },
                            entriesCount: { $sum: 1 }
                        }
                    }
                ]);

                // Statistiques par mois
                const monthlyStats = await ProjectTaskTimeTrackingModel.aggregate([
                    { $match: { task: new ObjectId(taskId) } },
                    {
                        $group: {
                            _id: {
                                year: { $year: '$date' },
                                month: { $month: '$date' }
                            },
                            totalHours: { $sum: '$hours' },
                            entriesCount: { $sum: 1 }
                        }
                    },
                    {
                        $sort: { '_id.year': -1, '_id.month': -1 }
                    }
                ]);

                res.json({
                    userStats,
                    workTypeStats,
                    monthlyStats,
                    estimatedHours: task.estimatedHours || 0,
                    actualHours: task.actualHours || 0
                });
            } catch (error) {
                console.error('Erreur lors de la récupération des statistiques:', error);
                res.status(500).json({ message: 'Erreur interne du serveur' });
            }
        });
    }

    // Méthode privée pour mettre à jour le temps total d'une tâche
    private async updateTaskTotalHours(taskId: any): Promise<void> {
        try {
            const totalHours = await ProjectTaskTimeTrackingModel.aggregate([
                { $match: { task: new ObjectId(taskId) } },
                {
                    $group: {
                        _id: null,
                        total: { $sum: '$hours' }
                    }
                }
            ]);

            const total = totalHours[0]?.total || 0;

            await ProjectTaskModel.findByIdAndUpdate(taskId, {
                actualHours: total
            });
        } catch (error) {
            console.error('Erreur lors de la mise à jour du temps total:', error);
        }
    }
}

const router = new ProjectTaskTimeTrackingRouter();
export default router;
