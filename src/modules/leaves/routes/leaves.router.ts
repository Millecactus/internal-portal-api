import { EnduranceRouter, enduranceEmitter, enduranceEventTypes, EnduranceAuthMiddleware, SecurityOptions } from '@programisto/endurance-core';
import LeaveModel from '../models/leaves.model.js';

class LeavesRouter extends EnduranceRouter {
    constructor() {
        super(EnduranceAuthMiddleware.getInstance());
    }

    setupRoutes(): void {
        const authenticatedOptions: SecurityOptions = {
            requireAuth: true,
            permissions: []
        };

        // Lister mes congés
        this.get('/', authenticatedOptions, async (req: any, res: any) => {
            try {
                const leaves = await LeaveModel.find({ userId: req.user._id })
                    .sort({ updatedAt: -1 })
                    .exec();
                res.json(leaves);
            } catch (error) {
                console.error('Erreur lors de la récupération des congés:', error);
                res.status(500).json({ error: 'Erreur interne du serveur' });
            }
        });

        // Récupérer les options de congés disponibles selon le contrat
        this.get('/options', authenticatedOptions, async (req: any, res: any) => {
            try {
                const availableTypes = await (LeaveModel as any).getAvailableLeaveTypes(req.user._id);
                res.json({ availableTypes });
            } catch (error) {
                console.error('Erreur lors de la récupération des options de congés:', error);
                res.status(500).json({ error: 'Erreur interne du serveur' });
            }
        });

        // Créer un congé
        this.post('/', authenticatedOptions, async (req: any, res: any) => {
            try {
                const leave = new LeaveModel({
                    ...req.body,
                    userId: req.user._id,
                    status: 'PENDING'
                });
                await leave.save();

                // Émettre un événement pour la création d'un congé
                enduranceEmitter.emit(enduranceEventTypes.LEAVE_CREATED, {
                    userId: req.user._id,
                    leaveId: leave._id,
                    leaveData: {
                        startDate: leave.startDate,
                        endDate: leave.endDate,
                        type: leave.type
                    }
                });

                res.status(201).json(leave);
            } catch (error) {
                console.error('Erreur lors de la création du congé:', error);
                res.status(500).json({ error: 'Erreur interne du serveur' });
            }
        });

        // Modifier un congé
        this.put('/:id', authenticatedOptions, async (req: any, res: any) => {
            try {
                const leave = await LeaveModel.findOne({
                    _id: req.params.id,
                    userId: req.user._id
                }).exec();

                if (!leave) {
                    return res.status(404).json({ error: 'Congé non trouvé' });
                }

                // Sauvegarder les données avant modification pour l'événement
                const previousData = {
                    startDate: leave.startDate,
                    endDate: leave.endDate,
                    type: leave.type,
                    status: leave.status
                };

                Object.assign(leave, req.body);
                await leave.save();

                // Émettre un événement pour la modification d'un congé
                enduranceEmitter.emit(enduranceEventTypes.LEAVE_UPDATED, {
                    userId: req.user._id,
                    leaveId: leave._id,
                    previousData,
                    newData: {
                        startDate: leave.startDate,
                        endDate: leave.endDate,
                        type: leave.type,
                        status: leave.status
                    }
                });

                res.json(leave);
            } catch (error) {
                console.error('Erreur lors de la modification du congé:', error);
                res.status(500).json({ error: 'Erreur interne du serveur' });
            }
        });

        // Supprimer un congé
        this.delete('/:id', authenticatedOptions, async (req: any, res: any) => {
            try {
                const leave = await LeaveModel.findOneAndDelete({
                    _id: req.params.id,
                    userId: req.user._id
                }).exec();

                if (!leave) {
                    return res.status(404).json({ error: 'Congé non trouvé' });
                }

                // Émettre un événement pour la suppression d'un congé
                enduranceEmitter.emit(enduranceEventTypes.LEAVE_DELETED, {
                    userId: req.user._id,
                    leaveId: leave._id
                });

                res.status(204).send();
            } catch (error) {
                console.error('Erreur lors de la suppression du congé:', error);
                res.status(500).json({ error: 'Erreur interne du serveur' });
            }
        });

        // Review un congé (admin seulement)
        this.post('/:id/review', authenticatedOptions, async (req: any, res: any) => {
            try {
                const { status, rejectionReason } = req.body;
                const leave = await LeaveModel.findOneAndUpdate(
                    { _id: req.params.id },
                    {
                        status,
                        rejectionReason,
                        approvedBy: req.user._id,
                        approvedAt: new Date()
                    },
                    { new: true }
                ).exec();

                if (!leave) {
                    return res.status(404).json({ error: 'Congé non trouvé' });
                }

                // Émettre un événement pour la revue d'un congé
                enduranceEmitter.emit(enduranceEventTypes.LEAVE_REVIEWED, {
                    userId: req.user._id,
                    leaveId: leave._id,
                    status,
                    rejectionReason
                });

                res.json(leave);
            } catch (error) {
                console.error('Erreur lors de la revue du congé:', error);
                res.status(500).json({ error: 'Erreur interne du serveur' });
            }
        });
    }
}

const router = new LeavesRouter();
export default router;
