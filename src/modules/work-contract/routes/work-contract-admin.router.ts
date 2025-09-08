import { EnduranceRouter, enduranceEmitter, enduranceEventTypes, EnduranceAuthMiddleware, SecurityOptions, FileUploadConfig } from '@programisto/endurance-core';
import UserModel from '../../users/models/user-admin.model.js';
import WorkContractModel, { ContractType, WorkTimeType } from '../models/work-contract.model.js';
import { Types } from 'mongoose';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Créer le dossier uploads s'il n'existe pas
const uploadDir = path.join(process.cwd(), 'uploads', 'contracts');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuration du stockage pour Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const nameWithoutExt = file.originalname.replace(/\.[^/.]+$/, '');
        const extension = file.originalname.split('.').pop()?.toLowerCase() || 'pdf';
        const finalName = `${nameWithoutExt} - ${uniqueSuffix}.${extension}`;
        cb(null, finalName);
    }
});

class WorkContractAdminRouter extends EnduranceRouter {
    constructor() {
        super(EnduranceAuthMiddleware.getInstance());
    }

    setupRoutes(): void {
        const authenticatedOptions: SecurityOptions = {
            requireAuth: true,
            permissions: []
        };

        // Lister tous les utilisateurs avec leurs contrats
        this.get('/users', authenticatedOptions, async (req: any, res: any) => {
            try {
                const page = parseInt(req.query.page as string) || 1;
                const limit = parseInt(req.query.limit as string) || 10;
                const skip = (page - 1) * limit;
                const search = req.query.search as string || '';
                const sortBy = req.query.sortBy as string || 'updatedAt';
                const sortOrder = req.query.sortOrder as string || 'desc';

                // Construction de la requête de recherche
                const query: any = {};

                // Recherche sur nom et prénom
                if (search) {
                    const keywords = search.split(/\s+/).filter(Boolean);
                    const regexPatterns = keywords.map(keyword =>
                        new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
                    );

                    query.$or = [
                        { firstname: { $in: regexPatterns } },
                        { lastname: { $in: regexPatterns } }
                    ];
                }

                // Construction du tri
                const sortOptions: Record<string, 1 | -1> = {
                    [sortBy]: sortOrder === 'asc' ? 1 : -1
                };

                // Récupérer les utilisateurs avec seulement les champs nécessaires
                const [users, total] = await Promise.all([
                    UserModel.find(query)
                        .select('_id firstname lastname email workContracts updatedAt')
                        .sort(sortOptions)
                        .skip(skip)
                        .limit(limit)
                        .exec(),
                    UserModel.countDocuments(query)
                ]);

                // Récupérer les contrats pour tous les utilisateurs en une seule requête
                const userIds = users.map(user => user._id);
                const contracts = await WorkContractModel.find({ user: { $in: userIds } })
                    .select('_id user contractType startDate endDate isActive annualSalary annualCost monthlyCost dailyCost')
                    .sort({ startDate: -1 });

                // Grouper les contrats par utilisateur
                const contractsByUser = contracts.reduce((acc, contract) => {
                    const userId = contract.user.toString();
                    if (!acc[userId]) {
                        acc[userId] = [];
                    }
                    acc[userId].push(contract);
                    return acc;
                }, {} as Record<string, any[]>);

                // Formater les données utilisateur avec leurs contrats
                const formattedUsers = users.map(user => {
                    const userContracts = contractsByUser[user._id.toString()] || [];
                    const userObj = user.toObject();
                    return {
                        _id: userObj._id,
                        firstname: userObj.firstname,
                        lastname: userObj.lastname,
                        email: userObj.email,
                        name: `${userObj.firstname} ${userObj.lastname}`,
                        updatedAt: (user as any).updatedAt,
                        workContracts: userContracts
                    };
                });

                const totalPages = Math.ceil(total / limit);

                return res.json({
                    data: formattedUsers,
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
                console.error('Erreur lors de la récupération des utilisateurs:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Récupérer le détail d'un utilisateur avec ses contrats
        this.get('/users/:id', authenticatedOptions, async (req: any, res: any) => {
            try {
                const user = await UserModel.findById(req.params.id)
                    .select('_id firstname lastname email workContracts updatedAt');

                if (!user) {
                    return res.status(404).json({ message: 'Utilisateur non trouvé' });
                }

                // Récupérer les contrats de l'utilisateur
                const contracts = await WorkContractModel.find({ user: req.params.id })
                    .select('_id contractType startDate endDate isActive annualSalary annualCost monthlyCost dailyCost')
                    .sort({ startDate: -1 });

                // Formater les données utilisateur avec ses contrats
                const userObj = user.toObject();
                const formattedUser = {
                    _id: userObj._id,
                    firstname: userObj.firstname,
                    lastname: userObj.lastname,
                    email: userObj.email,
                    name: `${userObj.firstname} ${userObj.lastname}`,
                    updatedAt: (user as any).updatedAt,
                    workContracts: contracts
                };

                return res.json(formattedUser);
            } catch (error) {
                console.error('Erreur lors de la récupération de l\'utilisateur:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });


        // Lister tous les contrats
        this.get('/contracts', authenticatedOptions, async (req: any, res: any) => {
            try {
                const page = parseInt(req.query.page as string) || 1;
                const limit = parseInt(req.query.limit as string) || 10;
                const skip = (page - 1) * limit;
                const contractType = req.query.contractType as string || 'all';
                const isActive = req.query.isActive as string || 'all';
                const sortBy = req.query.sortBy as string || 'startDate';
                const sortOrder = req.query.sortOrder as string || 'desc';

                // Construction de la requête de recherche
                const query: any = {};

                // Filtres
                if (contractType !== 'all') {
                    query.contractType = contractType;
                }

                if (isActive !== 'all') {
                    query.isActive = isActive === 'true';
                }

                // Construction du tri
                const sortOptions: Record<string, 1 | -1> = {
                    [sortBy]: sortOrder === 'asc' ? 1 : -1
                };

                const [contracts, total] = await Promise.all([
                    WorkContractModel.find(query)
                        .select('_id user contractType startDate endDate isActive annualSalary annualCost monthlyCost dailyCost weeklyHours hasRTT')
                        .sort(sortOptions)
                        .skip(skip)
                        .limit(limit)
                        .exec(),
                    WorkContractModel.countDocuments(query)
                ]);

                // Récupérer les informations des utilisateurs séparément
                const userIds = contracts.map(contract => contract.user);
                const users = await UserModel.find({ _id: { $in: userIds } })
                    .select('_id firstname lastname email');

                // Créer un map des utilisateurs pour un accès rapide
                const usersMap = users.reduce((acc, user) => {
                    acc[user._id.toString()] = user;
                    return acc;
                }, {} as Record<string, any>);

                // Formater les contrats avec les informations utilisateur
                const formattedContracts = contracts.map(contract => {
                    const contractObj = contract.toObject();
                    const user = usersMap[contract.user.toString()];
                    return {
                        ...contractObj,
                        user: user ? {
                            _id: user._id,
                            firstname: user.firstname,
                            lastname: user.lastname,
                            email: user.email,
                            name: `${user.firstname} ${user.lastname}`
                        } : null
                    };
                });

                const totalPages = Math.ceil(total / limit);

                return res.json({
                    data: formattedContracts,
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
                console.error('Erreur lors de la récupération des contrats:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Récupérer le détail d'un contrat
        this.get('/contracts/:id', authenticatedOptions, async (req: any, res: any) => {
            try {
                const contract = await WorkContractModel.findById(req.params.id)
                    .select('_id user contractType startDate endDate isActive annualSalary annualCost monthlyCost dailyCost weeklyHours hasRTT notes documents');

                if (!contract) {
                    return res.status(404).json({ message: 'Contrat non trouvé' });
                }

                // Récupérer les informations de l'utilisateur séparément
                const user = await UserModel.findById(contract.user)
                    .select('_id firstname lastname email');

                // Formater la réponse avec les informations utilisateur
                const contractObj = contract.toObject();
                const formattedContract = {
                    ...contractObj,
                    user: user ? {
                        _id: user._id,
                        firstname: user.firstname,
                        lastname: user.lastname,
                        email: user.email,
                        name: `${user.firstname} ${user.lastname}`
                    } : null
                };

                return res.json(formattedContract);
            } catch (error) {
                console.error('Erreur lors de la récupération du contrat:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Créer un nouveau contrat
        this.post('/contracts', authenticatedOptions, async (req: any, res: any) => {
            try {
                const contractData = req.body;
                const userId = contractData.user;

                // Vérifier s'il existe déjà un contrat actif pour cet utilisateur
                const existingActiveContract = await WorkContractModel.findOne({
                    user: userId,
                    isActive: true
                });

                // Si c'est le premier contrat ou s'il n'y a pas de contrat actif, le nouveau contrat sera actif
                if (!existingActiveContract) {
                    contractData.isActive = true;
                } else {
                    // S'il y a un contrat actif existant, le clôturer
                    const newContractStartDate = new Date(contractData.startDate);
                    const previousDay = new Date(newContractStartDate);
                    previousDay.setDate(previousDay.getDate() - 1);

                    // Clôturer l'ancien contrat
                    existingActiveContract.isActive = false;
                    existingActiveContract.endDate = previousDay;
                    await existingActiveContract.save();

                    // Le nouveau contrat sera actif
                    contractData.isActive = true;

                    console.log(`Contrat ${existingActiveContract._id} clôturé le ${previousDay.toISOString()}, nouveau contrat actif à partir du ${newContractStartDate.toISOString()}`);
                }

                // Créer le nouveau contrat
                const contract = new WorkContractModel(contractData);
                await contract.save();

                // Ajouter le contrat à l'utilisateur
                await UserModel.findByIdAndUpdate(
                    contract.user,
                    { $push: { workContracts: contract._id } }
                );

                enduranceEmitter.emit(enduranceEventTypes.CONTRACT_CREATED, {
                    userId: req.user._id,
                    contractId: contract._id,
                    contractData: {
                        contractType: contract.contractType,
                        startDate: contract.startDate,
                        user: contract.user,
                        isActive: contract.isActive
                    }
                });

                return res.status(201).json(contract);
            } catch (error) {
                console.error('Erreur lors de la création du contrat:', error);
                if (error instanceof Error && error.message.includes('Un utilisateur ne peut avoir qu\'un seul contrat actif')) {
                    return res.status(400).json({ message: error.message });
                }
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Clôturer un contrat (créer un avenant)
        this.post('/contracts/:id/close', authenticatedOptions, async (req: any, res: any) => {
            try {
                const oldContract = await WorkContractModel.findById(req.params.id);
                if (!oldContract) {
                    return res.status(404).json({ message: 'Contrat non trouvé' });
                }

                if (!oldContract.isActive) {
                    return res.status(400).json({ message: 'Ce contrat est déjà clôturé' });
                }

                // Clôturer l'ancien contrat
                oldContract.closeContract(req.body.endDate);
                await oldContract.save();

                // Créer le nouveau contrat
                const newContractData = {
                    ...req.body.newContract,
                    user: oldContract.user
                };

                const newContract = new WorkContractModel(newContractData);
                await newContract.save();

                // Ajouter le nouveau contrat à l'utilisateur
                await UserModel.findByIdAndUpdate(
                    oldContract.user,
                    { $push: { workContracts: newContract._id } }
                );

                enduranceEmitter.emit(enduranceEventTypes.CONTRACT_CLOSED, {
                    userId: req.user._id,
                    oldContractId: oldContract._id,
                    newContractId: newContract._id,
                    user: oldContract.user
                });

                return res.status(201).json({
                    oldContract,
                    newContract
                });
            } catch (error) {
                console.error('Erreur lors de la clôture du contrat:', error);
                if (error instanceof Error && error.message.includes('Un utilisateur ne peut avoir qu\'un seul contrat actif')) {
                    return res.status(400).json({ message: error.message });
                }
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Supprimer un contrat
        this.delete('/contracts/:id', authenticatedOptions, async (req: any, res: any) => {
            try {
                const contract = await WorkContractModel.findById(req.params.id);
                if (!contract) {
                    return res.status(404).json({ message: 'Contrat non trouvé' });
                }

                // Retirer le contrat de l'utilisateur
                await UserModel.findByIdAndUpdate(
                    contract.user,
                    { $pull: { workContracts: contract._id } }
                );

                // Supprimer le contrat
                await WorkContractModel.findByIdAndDelete(req.params.id);

                enduranceEmitter.emit(enduranceEventTypes.CONTRACT_DELETED, {
                    userId: req.user._id,
                    contractId: contract._id
                });

                return res.status(204).send();
            } catch (error) {
                console.error('Erreur lors de la suppression du contrat:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Récupérer les contrats d'un utilisateur
        this.get('/users/:id/contracts', authenticatedOptions, async (req: any, res: any) => {
            try {
                const user = await UserModel.findById(req.params.id);
                if (!user) {
                    return res.status(404).json({ message: 'Utilisateur non trouvé' });
                }

                const contracts = await WorkContractModel.find({ user: req.params.id })
                    .sort({ endDate: -1 });

                return res.json(contracts);
            } catch (error) {
                console.error('Erreur lors de la récupération des contrats de l\'utilisateur:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Récupérer les options disponibles (types de contrats, etc.)
        this.get('/options', authenticatedOptions, async (req: any, res: any) => {
            try {
                const options = {
                    contractTypes: Object.values(ContractType),
                    workTimeTypes: Object.values(WorkTimeType)
                };

                return res.json(options);
            } catch (error) {
                console.error('Erreur lors de la récupération des options:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Calculer le CJM à partir du salaire annuel
        this.post('/calculate-cjm', authenticatedOptions, async (req: any, res: any) => {
            try {
                const { annualSalary, annualSalaryToDailyCostCoefficient = 0.0078 } = req.body;

                if (!annualSalary || typeof annualSalary !== 'number') {
                    return res.status(400).json({ message: 'Salaire annuel requis et doit être un nombre' });
                }

                const cjm = annualSalary * annualSalaryToDailyCostCoefficient;
                const monthlyCost = annualSalary / 12;
                const dailyCost = annualSalary / 218; // 218 jours ouvrés par an
                const estimatedAnnualCost = annualSalary * 1.4; // Estimation avec charges

                return res.json({
                    annualSalary,
                    annualSalaryToDailyCostCoefficient,
                    cjm,
                    calculatedCosts: {
                        monthlyCost,
                        dailyCost,
                        estimatedAnnualCost
                    }
                });
            } catch (error) {
                console.error('Erreur lors du calcul du CJM:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

    }
}

const router = new WorkContractAdminRouter();
export default router;
