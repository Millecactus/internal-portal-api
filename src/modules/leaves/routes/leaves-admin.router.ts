import LeaveModel from '../models/leaves.model.js';
import UserModel from '../models/user.model.js';
import { EnduranceRouter, EnduranceAuthMiddleware, type SecurityOptions, EnduranceRequest, enduranceEmitter, enduranceEventTypes } from '@programisto/endurance-core';

class LeavesAdminRouter extends EnduranceRouter {
    constructor() {
        super(EnduranceAuthMiddleware.getInstance());
    }

    setupRoutes(): void {
        const securityOptions: SecurityOptions = {
            requireAuth: true,
            permissions: []
        };

        // Lister tous les congés
        this.get('/', securityOptions, async (req: any, res: any) => {
            try {
                const page = parseInt(req.query.page as string) || 1;
                const limit = parseInt(req.query.limit as string) || 10;
                const skip = (page - 1) * limit;
                const search = req.query.search as string || '';
                const sortBy = req.query.sortBy as string || 'updatedAt';
                const sortOrder = req.query.sortOrder as string || 'desc';
                const status = req.query.status as string || '';
                const type = req.query.type as string || '';
                const userId = req.query.userId as string || '';

                // Construction de la requête de recherche
                const query: any = {};

                // Recherche sur commentaire
                if (search) {
                    query.$or = [
                        { comment: { $regex: search, $options: 'i' } },
                        { rejectionReason: { $regex: search, $options: 'i' } }
                    ];
                }

                // Filtres
                if (status) {
                    query.status = status;
                }

                if (type) {
                    query.type = type;
                }

                if (userId) {
                    query.userId = userId;
                }

                // Construction du tri
                const sortOptions: Record<string, 1 | -1> = {
                    [sortBy]: sortOrder === 'asc' ? 1 : -1
                };

                // Utiliser une agrégation pour inclure les informations utilisateur
                const pipeline: any[] = [
                    { $match: query },
                    {
                        $lookup: {
                            from: 'users',
                            localField: 'userId',
                            foreignField: '_id',
                            as: 'user'
                        }
                    },
                    {
                        $lookup: {
                            from: 'users',
                            localField: 'approvedBy',
                            foreignField: '_id',
                            as: 'approvedByUser'
                        }
                    },
                    {
                        $addFields: {
                            userInfo: { $arrayElemAt: ['$user', 0] },
                            approvedByInfo: { $arrayElemAt: ['$approvedByUser', 0] }
                        }
                    },
                    {
                        $project: {
                            userId: 1,
                            startDate: 1,
                            endDate: 1,
                            type: 1,
                            status: 1,
                            comment: 1,
                            approvedBy: 1,
                            approvedAt: 1,
                            rejectionReason: 1,
                            documents: 1,
                            createdAt: 1,
                            updatedAt: 1,
                            userFirstname: '$userInfo.firstname',
                            userLastname: '$userInfo.lastname',
                            userEmail: '$userInfo.email',
                            approvedByFirstname: '$approvedByInfo.firstname',
                            approvedByLastname: '$approvedByInfo.lastname',
                            approvedByEmail: '$approvedByInfo.email'
                        }
                    },
                    { $sort: sortOptions },
                    { $skip: skip },
                    { $limit: limit }
                ];

                const [leaves, total] = await Promise.all([
                    LeaveModel.aggregate(pipeline),
                    LeaveModel.countDocuments(query)
                ]);

                const totalPages = Math.ceil(total / limit);

                return res.json({
                    data: leaves,
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
                console.error('Erreur lors de la récupération des congés:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Créer un nouveau congé
        this.post('/', securityOptions, async (req: any, res: any) => {
            try {
                const leave = new LeaveModel(req.body);
                const savedLeave = await leave.save();

                // Récupérer les informations utilisateur via agrégation
                const pipeline: any[] = [
                    { $match: { _id: savedLeave._id } },
                    {
                        $lookup: {
                            from: 'users',
                            localField: 'userId',
                            foreignField: '_id',
                            as: 'user'
                        }
                    },
                    {
                        $lookup: {
                            from: 'users',
                            localField: 'approvedBy',
                            foreignField: '_id',
                            as: 'approvedByUser'
                        }
                    },
                    {
                        $addFields: {
                            userInfo: { $arrayElemAt: ['$user', 0] },
                            approvedByInfo: { $arrayElemAt: ['$approvedByUser', 0] }
                        }
                    },
                    {
                        $project: {
                            userId: 1,
                            startDate: 1,
                            endDate: 1,
                            type: 1,
                            status: 1,
                            comment: 1,
                            approvedBy: 1,
                            approvedAt: 1,
                            rejectionReason: 1,
                            documents: 1,
                            createdAt: 1,
                            updatedAt: 1,
                            userFirstname: '$userInfo.firstname',
                            userLastname: '$userInfo.lastname',
                            userEmail: '$userInfo.email',
                            approvedByFirstname: '$approvedByInfo.firstname',
                            approvedByLastname: '$approvedByInfo.lastname',
                            approvedByEmail: '$approvedByInfo.email'
                        }
                    }
                ];

                const [leaveWithUserInfo] = await LeaveModel.aggregate(pipeline);

                return res.status(201).json(leaveWithUserInfo);
            } catch (error) {
                console.error('Erreur lors de la création du congé:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Récupérer un congé par ID
        this.get('/:id', securityOptions, async (req: any, res: any) => {
            try {
                const pipeline: any[] = [
                    { $match: { _id: req.params.id } },
                    {
                        $lookup: {
                            from: 'users',
                            localField: 'userId',
                            foreignField: '_id',
                            as: 'user'
                        }
                    },
                    {
                        $lookup: {
                            from: 'users',
                            localField: 'approvedBy',
                            foreignField: '_id',
                            as: 'approvedByUser'
                        }
                    },
                    {
                        $addFields: {
                            userInfo: { $arrayElemAt: ['$user', 0] },
                            approvedByInfo: { $arrayElemAt: ['$approvedByUser', 0] }
                        }
                    },
                    {
                        $project: {
                            userId: 1,
                            startDate: 1,
                            endDate: 1,
                            type: 1,
                            status: 1,
                            comment: 1,
                            approvedBy: 1,
                            approvedAt: 1,
                            rejectionReason: 1,
                            documents: 1,
                            createdAt: 1,
                            updatedAt: 1,
                            userFirstname: '$userInfo.firstname',
                            userLastname: '$userInfo.lastname',
                            userEmail: '$userInfo.email',
                            approvedByFirstname: '$approvedByInfo.firstname',
                            approvedByLastname: '$approvedByInfo.lastname',
                            approvedByEmail: '$approvedByInfo.email'
                        }
                    }
                ];

                const [leave] = await LeaveModel.aggregate(pipeline);

                if (!leave) {
                    return res.status(404).send('Congé non trouvé');
                }

                return res.json(leave);
            } catch (error) {
                console.error('Erreur lors de la récupération du congé:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Modifier un congé existant
        this.put('/:id', securityOptions, async (req: any, res: any) => {
            try {
                const leave = await LeaveModel.findByIdAndUpdate(
                    req.params.id,
                    req.body,
                    { new: true }
                );

                if (!leave) {
                    return res.status(404).send('Congé non trouvé');
                }

                // Récupérer les informations utilisateur via agrégation
                const pipeline: any[] = [
                    { $match: { _id: leave._id } },
                    {
                        $lookup: {
                            from: 'users',
                            localField: 'userId',
                            foreignField: '_id',
                            as: 'user'
                        }
                    },
                    {
                        $lookup: {
                            from: 'users',
                            localField: 'approvedBy',
                            foreignField: '_id',
                            as: 'approvedByUser'
                        }
                    },
                    {
                        $addFields: {
                            userInfo: { $arrayElemAt: ['$user', 0] },
                            approvedByInfo: { $arrayElemAt: ['$approvedByUser', 0] }
                        }
                    },
                    {
                        $project: {
                            userId: 1,
                            startDate: 1,
                            endDate: 1,
                            type: 1,
                            status: 1,
                            comment: 1,
                            approvedBy: 1,
                            approvedAt: 1,
                            rejectionReason: 1,
                            documents: 1,
                            createdAt: 1,
                            updatedAt: 1,
                            userFirstname: '$userInfo.firstname',
                            userLastname: '$userInfo.lastname',
                            userEmail: '$userInfo.email',
                            approvedByFirstname: '$approvedByInfo.firstname',
                            approvedByLastname: '$approvedByInfo.lastname',
                            approvedByEmail: '$approvedByInfo.email'
                        }
                    }
                ];

                const [leaveWithUserInfo] = await LeaveModel.aggregate(pipeline);

                return res.json(leaveWithUserInfo);
            } catch (error) {
                console.error('Erreur lors de la modification du congé:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Supprimer un congé
        this.delete('/:id', securityOptions, async (req: any, res: any) => {
            try {
                const leave = await LeaveModel.findByIdAndDelete(req.params.id);
                if (!leave) {
                    return res.status(404).send('Congé non trouvé');
                }
                return res.status(204).send();
            } catch (error) {
                console.error('Erreur lors de la suppression du congé:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Approuver/Rejeter un congé
        this.post('/:id/review', securityOptions, async (req: any, res: any) => {
            try {
                const { status, rejectionReason } = req.body;

                if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
                    return res.status(400).json({ error: 'Statut invalide. Doit être APPROVED ou REJECTED' });
                }

                const updateData: any = {
                    status,
                    approvedBy: req.user._id,
                    approvedAt: new Date()
                };

                if (status === 'REJECTED' && rejectionReason) {
                    updateData.rejectionReason = rejectionReason;
                } else if (status === 'APPROVED') {
                    updateData.rejectionReason = undefined;
                }

                const leave = await LeaveModel.findByIdAndUpdate(
                    req.params.id,
                    updateData,
                    { new: true }
                );

                if (!leave) {
                    return res.status(404).send('Congé non trouvé');
                }

                // Récupérer les informations utilisateur via agrégation
                const pipeline: any[] = [
                    { $match: { _id: leave._id } },
                    {
                        $lookup: {
                            from: 'users',
                            localField: 'userId',
                            foreignField: '_id',
                            as: 'user'
                        }
                    },
                    {
                        $lookup: {
                            from: 'users',
                            localField: 'approvedBy',
                            foreignField: '_id',
                            as: 'approvedByUser'
                        }
                    },
                    {
                        $addFields: {
                            userInfo: { $arrayElemAt: ['$user', 0] },
                            approvedByInfo: { $arrayElemAt: ['$approvedByUser', 0] }
                        }
                    },
                    {
                        $project: {
                            userId: 1,
                            startDate: 1,
                            endDate: 1,
                            type: 1,
                            status: 1,
                            comment: 1,
                            approvedBy: 1,
                            approvedAt: 1,
                            rejectionReason: 1,
                            documents: 1,
                            createdAt: 1,
                            updatedAt: 1,
                            userFirstname: '$userInfo.firstname',
                            userLastname: '$userInfo.lastname',
                            userEmail: '$userInfo.email',
                            approvedByFirstname: '$approvedByInfo.firstname',
                            approvedByLastname: '$approvedByInfo.lastname',
                            approvedByEmail: '$approvedByInfo.email'
                        }
                    }
                ];

                const [leaveWithUserInfo] = await LeaveModel.aggregate(pipeline);

                return res.json(leaveWithUserInfo);
            } catch (error) {
                console.error('Erreur lors de la revue du congé:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Approuver/Rejeter des congés par lot
        this.post('/batch-review', securityOptions, async (req: any, res: any) => {
            try {
                const { leaveIds, status, rejectionReason } = req.body;

                // Validation des données d'entrée
                if (!leaveIds || !Array.isArray(leaveIds) || leaveIds.length === 0) {
                    return res.status(400).json({ error: 'Liste des IDs de congés requise et ne peut pas être vide' });
                }

                if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
                    return res.status(400).json({ error: 'Statut invalide. Doit être APPROVED ou REJECTED' });
                }

                if (status === 'REJECTED' && !rejectionReason) {
                    return res.status(400).json({ error: 'Raison de rejet requise pour le statut REJECTED' });
                }

                // Vérifier que tous les congés existent
                const existingLeaves = await LeaveModel.find({ _id: { $in: leaveIds } });
                if (existingLeaves.length !== leaveIds.length) {
                    return res.status(400).json({
                        error: 'Certains congés n\'existent pas',
                        found: existingLeaves.length,
                        requested: leaveIds.length
                    });
                }

                // Préparer les données de mise à jour
                const updateData: any = {
                    status,
                    approvedBy: req.user._id,
                    approvedAt: new Date()
                };

                if (status === 'REJECTED' && rejectionReason) {
                    updateData.rejectionReason = rejectionReason;
                } else if (status === 'APPROVED') {
                    updateData.rejectionReason = undefined;
                }

                // Mettre à jour tous les congés en lot
                const updateResult = await LeaveModel.updateMany(
                    { _id: { $in: leaveIds } },
                    updateData
                );

                // Récupérer les congés mis à jour avec les informations utilisateur
                const pipeline: any[] = [
                    { $match: { _id: { $in: leaveIds } } },
                    {
                        $lookup: {
                            from: 'users',
                            localField: 'userId',
                            foreignField: '_id',
                            as: 'user'
                        }
                    },
                    {
                        $lookup: {
                            from: 'users',
                            localField: 'approvedBy',
                            foreignField: '_id',
                            as: 'approvedByUser'
                        }
                    },
                    {
                        $addFields: {
                            userInfo: { $arrayElemAt: ['$user', 0] },
                            approvedByInfo: { $arrayElemAt: ['$approvedByUser', 0] }
                        }
                    },
                    {
                        $project: {
                            userId: 1,
                            startDate: 1,
                            endDate: 1,
                            type: 1,
                            status: 1,
                            comment: 1,
                            approvedBy: 1,
                            approvedAt: 1,
                            rejectionReason: 1,
                            documents: 1,
                            createdAt: 1,
                            updatedAt: 1,
                            userFirstname: '$userInfo.firstname',
                            userLastname: '$userInfo.lastname',
                            userEmail: '$userInfo.email',
                            approvedByFirstname: '$approvedByInfo.firstname',
                            approvedByLastname: '$approvedByInfo.lastname',
                            approvedByEmail: '$approvedByInfo.email'
                        }
                    }
                ];

                const updatedLeaves = await LeaveModel.aggregate(pipeline);
                console.log("updated leaves", updatedLeaves);
                // Émettre un événement pour chaque congé traité
                for (const leave of updatedLeaves) {
                    console.log('Émettant un événement pour la revue du congé...');
                    await enduranceEmitter.emit(enduranceEventTypes.LEAVE_REVIEWED, {
                        // Données principales pour l'événement
                        eventName: 'LEAVE_REVIEWED',
                        eventType: 'LEAVE_MANAGEMENT',
                        timestamp: new Date().toISOString(),

                        // Données de l'utilisateur concerné
                        targetUserId: leave.userId,
                        targetUser: {
                            id: leave.userId,
                            firstname: leave.userFirstname,
                            lastname: leave.userLastname,
                            email: leave.userEmail
                        },

                        // Données de l'action
                        actionBy: {
                            id: req.user._id,
                            firstname: req.user.firstname,
                            lastname: req.user.lastname,
                            email: req.user.email
                        },
                        actionType: status === 'APPROVED' ? 'APPROVE' : 'REJECT',
                        actionDate: new Date().toISOString(),

                        // Données du congé
                        entityId: leave._id,
                        entityType: 'LEAVE',
                        entityData: {
                            id: leave._id,
                            startDate: leave.startDate,
                            endDate: leave.endDate,
                            type: leave.type,
                            status: status,
                            comment: leave.comment,
                            rejectionReason: status === 'REJECTED' ? rejectionReason : undefined
                        },

                        // Métadonnées pour les notifications
                        notification: {
                            title: status === 'APPROVED'
                                ? 'Congé approuvé'
                                : 'Congé refusé',
                            message: status === 'APPROVED'
                                ? `Votre demande de congé du ${new Date(leave.startDate).toLocaleDateString('fr-FR')} au ${new Date(leave.endDate).toLocaleDateString('fr-FR')} a été approuvée.`
                                : `Votre demande de congé du ${new Date(leave.startDate).toLocaleDateString('fr-FR')} au ${new Date(leave.endDate).toLocaleDateString('fr-FR')} a été refusée.${rejectionReason ? ` Raison : ${rejectionReason}` : ''}`,
                            type: status === 'APPROVED' ? 'SUCCESS' : 'WARNING',
                            icon: status === 'APPROVED' ? '✅' : '❌',
                            color: status === 'APPROVED' ? '#10B981' : '#F59E0B',
                            priority: 2,
                            actionUrl: `/leaves/${leave._id}`,
                            scope: 'USER'
                        },

                        // Données brutes pour compatibilité
                        rawData: {
                            leaveId: leave._id,
                            userId: leave.userId,
                            status: status,
                            approvedBy: req.user._id,
                            approvedAt: new Date(),
                            rejectionReason: status === 'REJECTED' ? rejectionReason : undefined,
                            leaveData: {
                                startDate: leave.startDate,
                                endDate: leave.endDate,
                                type: leave.type,
                                userFirstname: leave.userFirstname,
                                userLastname: leave.userLastname,
                                userEmail: leave.userEmail
                            }
                        }
                    });
                }

                return res.json({
                    message: `${updateResult.modifiedCount} congé(s) mis à jour avec succès`,
                    updatedCount: updateResult.modifiedCount,
                    requestedCount: leaveIds.length,
                    status,
                    rejectionReason: status === 'REJECTED' ? rejectionReason : undefined,
                    leaves: updatedLeaves
                });
            } catch (error) {
                console.error('Erreur lors de la revue en lot des congés:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Annuler un congé
        this.post('/:id/cancel', securityOptions, async (req: any, res: any) => {
            try {
                const leave = await LeaveModel.findByIdAndUpdate(
                    req.params.id,
                    {
                        status: 'CANCELLED',
                        approvedBy: req.user._id,
                        approvedAt: new Date()
                    },
                    { new: true }
                );

                if (!leave) {
                    return res.status(404).send('Congé non trouvé');
                }

                // Récupérer les informations utilisateur via agrégation
                const pipeline: any[] = [
                    { $match: { _id: leave._id } },
                    {
                        $lookup: {
                            from: 'users',
                            localField: 'userId',
                            foreignField: '_id',
                            as: 'user'
                        }
                    },
                    {
                        $lookup: {
                            from: 'users',
                            localField: 'approvedBy',
                            foreignField: '_id',
                            as: 'approvedByUser'
                        }
                    },
                    {
                        $addFields: {
                            userInfo: { $arrayElemAt: ['$user', 0] },
                            approvedByInfo: { $arrayElemAt: ['$approvedByUser', 0] }
                        }
                    },
                    {
                        $project: {
                            userId: 1,
                            startDate: 1,
                            endDate: 1,
                            type: 1,
                            status: 1,
                            comment: 1,
                            approvedBy: 1,
                            approvedAt: 1,
                            rejectionReason: 1,
                            documents: 1,
                            createdAt: 1,
                            updatedAt: 1,
                            userFirstname: '$userInfo.firstname',
                            userLastname: '$userInfo.lastname',
                            userEmail: '$userInfo.email',
                            approvedByFirstname: '$approvedByInfo.firstname',
                            approvedByLastname: '$approvedByInfo.lastname',
                            approvedByEmail: '$approvedByInfo.email'
                        }
                    }
                ];

                const [leaveWithUserInfo] = await LeaveModel.aggregate(pipeline);

                return res.json(leaveWithUserInfo);
            } catch (error) {
                console.error('Erreur lors de l\'annulation du congé:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Statistiques des congés
        this.get('/stats/overview', securityOptions, async (req: any, res: any) => {
            try {
                const currentYear = new Date().getFullYear();
                const startOfYear = new Date(currentYear, 0, 1);
                const endOfYear = new Date(currentYear, 11, 31);

                const [
                    totalLeaves,
                    pendingLeaves,
                    approvedLeaves,
                    rejectedLeaves,
                    cancelledLeaves,
                    leavesByType,
                    leavesByMonth
                ] = await Promise.all([
                    LeaveModel.countDocuments({
                        startDate: { $gte: startOfYear, $lte: endOfYear }
                    }),
                    LeaveModel.countDocuments({
                        status: 'PENDING',
                        startDate: { $gte: startOfYear, $lte: endOfYear }
                    }),
                    LeaveModel.countDocuments({
                        status: 'APPROVED',
                        startDate: { $gte: startOfYear, $lte: endOfYear }
                    }),
                    LeaveModel.countDocuments({
                        status: 'REJECTED',
                        startDate: { $gte: startOfYear, $lte: endOfYear }
                    }),
                    LeaveModel.countDocuments({
                        status: 'CANCELLED',
                        startDate: { $gte: startOfYear, $lte: endOfYear }
                    }),
                    LeaveModel.aggregate([
                        {
                            $match: {
                                startDate: { $gte: startOfYear, $lte: endOfYear }
                            }
                        },
                        {
                            $group: {
                                _id: '$type',
                                count: { $sum: 1 }
                            }
                        }
                    ]),
                    LeaveModel.aggregate([
                        {
                            $match: {
                                startDate: { $gte: startOfYear, $lte: endOfYear }
                            }
                        },
                        {
                            $group: {
                                _id: { $month: '$startDate' },
                                count: { $sum: 1 }
                            }
                        },
                        {
                            $sort: { _id: 1 }
                        }
                    ])
                ]);

                return res.json({
                    total: totalLeaves,
                    pending: pendingLeaves,
                    approved: approvedLeaves,
                    rejected: rejectedLeaves,
                    cancelled: cancelledLeaves,
                    byType: leavesByType,
                    byMonth: leavesByMonth
                });
            } catch (error) {
                console.error('Erreur lors de la récupération des statistiques:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Route temporaire pour nettoyer la base de données (à supprimer après usage)
        this.post('/clean-database', securityOptions, async (req: any, res: any) => {
            try {
                console.log('🧹 Début du nettoyage de la base de données...');

                // 1. Corriger les documents qui ont 'user' au lieu de 'userId'
                const result1 = await LeaveModel.updateMany(
                    { user: { $exists: true }, userId: { $exists: false } },
                    [
                        {
                            $set: {
                                userId: '$user',
                                user: '$$REMOVE'
                            }
                        }
                    ]
                );
                console.log(`${result1.modifiedCount} documents corrigés (user -> userId)`);

                // 2. Supprimer les champs calculés qui ne devraient pas être en base
                const result2 = await LeaveModel.updateMany(
                    {},
                    {
                        $unset: {
                            approvedByEmail: '',
                            approvedByFirstname: '',
                            approvedByLastname: '',
                            userEmail: '',
                            userFirstname: '',
                            userLastname: ''
                        }
                    }
                );
                console.log(`${result2.modifiedCount} documents nettoyés des champs calculés`);

                // 3. Vérifier que tous les documents ont bien un userId
                const documentsWithoutUserId = await LeaveModel.countDocuments({
                    userId: { $exists: false }
                });

                // 4. Afficher un échantillon des documents corrigés
                const sample = await LeaveModel.find({}).limit(3).select('userId status type').exec();

                return res.json({
                    message: 'Base de données nettoyée avec succès',
                    corrections: {
                        userToUserId: result1.modifiedCount,
                        removedCalculatedFields: result2.modifiedCount,
                        documentsWithoutUserId
                    },
                    sample: sample.map(doc => ({
                        _id: doc._id,
                        userId: doc.userId,
                        status: doc.status,
                        type: doc.type
                    }))
                });
            } catch (error) {
                console.error('Erreur lors du nettoyage:', error);
                res.status(500).json({ error: 'Erreur lors du nettoyage de la base de données' });
            }
        });

        // Autocomplete pour les utilisateurs (pour les filtres)
        this.get('/autocomplete/users', securityOptions, async (req: any, res: any) => {
            try {
                const search = req.query.search as string || '';
                const limit = parseInt(req.query.limit as string) || 10;

                // Récupérer les utilisateurs qui ont des congés
                const pipeline: any[] = [
                    {
                        $lookup: {
                            from: 'users',
                            localField: 'userId',
                            foreignField: '_id',
                            as: 'user'
                        }
                    },
                    {
                        $unwind: '$user'
                    },
                    {
                        $group: {
                            _id: '$userId',
                            user: { $first: '$user' }
                        }
                    }
                ];

                if (search) {
                    pipeline.push({
                        $match: {
                            'user.firstName': { $regex: search, $options: 'i' },
                            $or: [
                                { 'user.lastName': { $regex: search, $options: 'i' } },
                                { 'user.email': { $regex: search, $options: 'i' } }
                            ]
                        }
                    });
                }

                pipeline.push(
                    {
                        $project: {
                            _id: '$user._id',
                            firstName: '$user.firstName',
                            lastName: '$user.lastName',
                            email: '$user.email'
                        }
                    },
                    {
                        $sort: { firstName: 1, lastName: 1 }
                    },
                    {
                        $limit: limit
                    }
                );

                const users = await LeaveModel.aggregate(pipeline);

                return res.json(users);
            } catch (error) {
                console.error('Erreur lors de la récupération des utilisateurs:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });
    }
}

const router = new LeavesAdminRouter();
export default router;
