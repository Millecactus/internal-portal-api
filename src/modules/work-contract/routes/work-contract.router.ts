import { EnduranceRouter, EnduranceAuthMiddleware, SecurityOptions } from '@programisto/endurance-core';
import UserModel from '../models/user.model.js';
import WorkContractModel from '../models/work-contract.model.js';

class WorkContractRouter extends EnduranceRouter {
    constructor() {
        super(EnduranceAuthMiddleware.getInstance());
    }

    setupRoutes(): void {
        const authenticatedOptions: SecurityOptions = {
            requireAuth: true,
            permissions: []
        };

        // Récupérer les informations de l'utilisateur connecté
        this.get('/me', authenticatedOptions, async (req: any, res: any) => {
            try {
                // Ici on pourrait récupérer l'utilisateur basé sur req.user._id
                // Pour l'instant, on retourne les informations de base
                const user = await UserModel.findOne({
                    // On pourrait faire un mapping avec l'utilisateur connecté
                    // Pour l'instant on retourne un exemple
                }).populate({
                    path: 'workContracts',
                    options: { strictPopulate: false }
                });

                if (!user) {
                    return res.status(404).json({ message: 'Utilisateur non trouvé' });
                }

                return res.json(user);
            } catch (error) {
                console.error('Erreur lors de la récupération des informations utilisateur:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Récupérer le contrat actuel de l'utilisateur connecté
        this.get('/me/current-contract', authenticatedOptions, async (req: any, res: any) => {
            try {
                // Ici on pourrait récupérer l'utilisateur basé sur req.user._id
                const user = await UserModel.findOne({
                    // Mapping avec l'utilisateur connecté
                }).populate({
                    path: 'workContracts',
                    match: { isActive: true },
                    options: { strictPopulate: false }
                });

                if (!user) {
                    return res.status(404).json({ message: 'Utilisateur non trouvé' });
                }

                const activeContract = user.workContracts.find((contract: any) => contract.isActive);

                if (!activeContract) {
                    return res.status(404).json({ message: 'Aucun contrat actif trouvé' });
                }

                return res.json(activeContract);
            } catch (error) {
                console.error('Erreur lors de la récupération du contrat actuel:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Récupérer l'historique des contrats de l'utilisateur connecté
        this.get('/me/contracts', authenticatedOptions, async (req: any, res: any) => {
            try {
                const user = await UserModel.findOne({
                    // Mapping avec l'utilisateur connecté
                }).populate({
                    path: 'workContracts',
                    options: { strictPopulate: false }
                });

                if (!user) {
                    return res.status(404).json({ message: 'Utilisateur non trouvé' });
                }

                // Trier les contrats par date de début (plus récent en premier)
                const sortedContracts = user.workContracts.sort((a: any, b: any) =>
                    new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
                );

                return res.json(sortedContracts);
            } catch (error) {
                console.error('Erreur lors de la récupération de l\'historique des contrats:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });


    }
}

const router = new WorkContractRouter();
export default router;
