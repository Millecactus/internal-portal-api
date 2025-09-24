import { EnduranceRouter, enduranceEmitter, enduranceEventTypes, EnduranceAuthMiddleware, SecurityOptions } from '@programisto/endurance-core';
import AssetModel, { AssetStatus } from '../models/asset.model.js';
import UserModel from '../models/user.model.js';
import ContactModel from '../models/contact.model.js';
import NoteModel from '../models/note.model.js';
import { ObjectId } from 'mongodb';

class AssetsRouter extends EnduranceRouter {
    constructor() {
        super(EnduranceAuthMiddleware.getInstance());
    }

    setupRoutes(): void {
        const authenticatedOptions: SecurityOptions = {
            requireAuth: true,
            permissions: []
        };

        // Lister tous les assets avec filtres, tri, recherche et pagination
        this.get('/', authenticatedOptions, async (req: any, res: any) => {
            try {
                const page = parseInt(req.query.page as string) || 1;
                const limit = parseInt(req.query.limit as string) || 10;
                const skip = (page - 1) * limit;
                const search = req.query.search as string || '';
                const status = req.query.status as string || 'all';
                const category = req.query.category as string || 'all';
                const assignedUser = req.query.assignedUser as string || 'all';
                const sortBy = req.query.sortBy as string || 'updatedAt';
                const sortOrder = req.query.sortOrder as string || 'desc';

                // Construction de la requête de recherche
                const query: any = {};

                // Filtres
                if (status !== 'all') {
                    // Gérer une liste de statuts séparés par des virgules (décoder l'URL si nécessaire)
                    const decodedStatus = decodeURIComponent(status);
                    const statusList = decodedStatus.split(',').map(s => s.trim()).filter(Boolean);
                    if (statusList.length === 1) {
                        query.status = statusList[0];
                    } else if (statusList.length > 1) {
                        query.status = { $in: statusList };
                    }
                }

                if (assignedUser !== 'all') {
                    if (assignedUser === 'unassigned') {
                        query.assignedUser = { $exists: false };
                    } else if (assignedUser === 'me') {
                        query.assignedUser = req.user._id;
                    } else {
                        query.assignedUser = new ObjectId(assignedUser);
                    }
                }

                if (category !== 'all') {
                    query.categories = category;
                }

                // Recherche sur nom, description, numéro de série
                if (search) {
                    const keywords = search.split(/\s+/).filter(Boolean);
                    const regexPatterns = keywords.map(keyword =>
                        new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
                    );

                    query.$or = [
                        { name: { $in: regexPatterns } },
                        { description: { $in: regexPatterns } },
                        { serialNumber: { $in: regexPatterns } }
                    ];
                }

                // Construction du tri
                const sortOptions: Record<string, 1 | -1> = {
                    [sortBy]: sortOrder === 'asc' ? 1 : -1
                };

                const [assets, total] = await Promise.all([
                    AssetModel.find(query)
                        .populate('assignedUser', 'firstname lastname email')
                        .sort(sortOptions)
                        .skip(skip)
                        .limit(limit)
                        .exec(),
                    AssetModel.countDocuments(query)
                ]);

                const totalPages = Math.ceil(total / limit);

                return res.json({
                    data: assets,
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
                console.error('Erreur lors de la récupération des assets:', error);
                res.status(500).json({ error: 'Erreur interne du serveur' });
            }
        });

        // Lister les catégories existantes
        this.get('/categories/list', authenticatedOptions, async (req: any, res: any) => {
            try {
                const categories = await AssetModel.distinct('categories');
                const sortedCategories = categories.sort();
                res.json({ categories: sortedCategories });
            } catch (error) {
                console.error('Erreur lors de la récupération des catégories:', error);
                res.status(500).json({ error: 'Erreur interne du serveur' });
            }
        });

        // Lister tous les utilisateurs
        this.get('/users', authenticatedOptions, async (req: any, res: any) => {
            try {
                const page = parseInt(req.query.page as string) || 1;
                const limit = parseInt(req.query.limit as string) || 10;
                const skip = (page - 1) * limit;
                const search = req.query.search as string || '';
                const isActive = req.query.isActive as string || 'all';
                const sortBy = req.query.sortBy as string || 'lastname';
                const sortOrder = req.query.sortOrder as string || 'asc';

                // Construction de la requête de recherche
                const query: any = {};

                // Filtres
                if (isActive !== 'all') {
                    query.isActive = isActive === 'true';
                }

                // Recherche sur nom, prénom, email
                if (search) {
                    const keywords = search.split(/\s+/).filter(Boolean);
                    const regexPatterns = keywords.map(keyword =>
                        new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
                    );

                    query.$or = [
                        { firstname: { $in: regexPatterns } },
                        { lastname: { $in: regexPatterns } },
                        { email: { $in: regexPatterns } }
                    ];
                }

                // Construction du tri
                const sortOptions: Record<string, 1 | -1> = {
                    [sortBy]: sortOrder === 'asc' ? 1 : -1
                };

                const [users, total] = await Promise.all([
                    UserModel.find(query)
                        .sort(sortOptions)
                        .skip(skip)
                        .limit(limit)
                        .exec(),
                    UserModel.countDocuments(query)
                ]);

                const totalPages = Math.ceil(total / limit);

                return res.json({
                    data: users,
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
                res.status(500).json({ error: 'Erreur interne du serveur' });
            }
        });

        // Récupérer le détail d'un utilisateur
        this.get('/users/:id', authenticatedOptions, async (req: any, res: any) => {
            try {
                const user = await UserModel.findById(req.params.id);

                if (!user) {
                    return res.status(404).json({ error: 'Utilisateur non trouvé' });
                }

                // Récupérer les assets affectés à cet utilisateur
                const assignedAssets = await AssetModel.find({ assignedUser: user._id })
                    .select('name description status categories createdAt updatedAt');

                const userWithAssets = {
                    ...user.toObject(),
                    assignedAssets
                };

                return res.json(userWithAssets);
            } catch (error) {
                console.error('Erreur lors de la récupération du détail de l\'utilisateur:', error);
                res.status(500).json({ error: 'Erreur interne du serveur' });
            }
        });

        // Récupérer le détail d'un asset
        this.get('/:id', authenticatedOptions, async (req: any, res: any) => {
            try {
                const asset = await AssetModel.findById(req.params.id)
                    .populate('assignedUser', 'firstname lastname email')
                    .populate('image')
                    .populate('documents')
                    .exec();

                if (!asset) {
                    return res.status(404).json({ error: 'Asset non trouvé' });
                }

                // Récupérer les notes avec les informations de l'auteur
                const notes = await NoteModel.find({ _id: { $in: asset.notes } })
                    .sort({ createdAt: -1 })
                    .populate({
                        path: 'createdBy',
                        select: 'firstname lastname',
                        options: { strictPopulate: false }
                    });

                const assetWithData = {
                    ...asset.toObject(),
                    notes: notes.map(note => {
                        const noteObject = note.toObject();
                        const createdBy = note.createdBy as any;
                        return {
                            ...noteObject,
                            createdBy: {
                                firstname: createdBy.firstname,
                                lastname: createdBy.lastname
                            }
                        };
                    })
                };

                return res.json(assetWithData);
            } catch (error) {
                console.error('Erreur lors de la récupération du détail de l\'asset:', error);
                res.status(500).json({ error: 'Erreur interne du serveur' });
            }
        });

        // Créer un nouvel asset
        this.post('/', authenticatedOptions, async (req: any, res: any) => {
            try {
                const asset = new AssetModel(req.body);
                await asset.save();

                // Émettre un événement pour la création d'un asset
                enduranceEmitter.emit(enduranceEventTypes.ASSET_CREATED, {
                    userId: req.user._id,
                    assetId: asset._id,
                    assetData: {
                        name: asset.name,
                        status: asset.status,
                        categories: asset.categories
                    }
                });

                res.status(201).json(asset);
            } catch (error) {
                console.error('Erreur lors de la création de l\'asset:', error);
                res.status(500).json({ error: 'Erreur interne du serveur' });
            }
        });

        // Modifier un asset
        this.put('/:id', authenticatedOptions, async (req: any, res: any) => {
            try {
                const oldAsset = await AssetModel.findById(req.params.id);
                if (!oldAsset) {
                    return res.status(404).json({ error: 'Asset non trouvé' });
                }

                const asset = await AssetModel.findByIdAndUpdate(
                    req.params.id,
                    req.body,
                    { new: true }
                ).populate('assignedUser', 'firstname lastname email');

                if (!asset) {
                    return res.status(404).json({ error: 'Asset non trouvé' });
                }

                // Émettre un événement pour la modification d'un asset
                enduranceEmitter.emit(enduranceEventTypes.ASSET_UPDATED, {
                    userId: req.user._id,
                    assetId: asset._id,
                    previousData: {
                        name: oldAsset.name,
                        status: oldAsset.status,
                        assignedUser: oldAsset.assignedUser
                    },
                    newData: {
                        name: asset.name,
                        status: asset.status,
                        assignedUser: asset.assignedUser
                    }
                });

                res.json(asset);
            } catch (error) {
                console.error('Erreur lors de la modification de l\'asset:', error);
                res.status(500).json({ error: 'Erreur interne du serveur' });
            }
        });

        // Supprimer un asset
        this.delete('/:id', authenticatedOptions, async (req: any, res: any) => {
            try {
                const asset = await AssetModel.findByIdAndDelete(req.params.id);
                if (!asset) {
                    return res.status(404).json({ error: 'Asset non trouvé' });
                }

                // Émettre un événement pour la suppression d'un asset
                enduranceEmitter.emit(enduranceEventTypes.ASSET_DELETED, {
                    userId: req.user._id,
                    assetId: asset._id
                });

                res.status(204).send();
            } catch (error) {
                console.error('Erreur lors de la suppression de l\'asset:', error);
                res.status(500).json({ error: 'Erreur interne du serveur' });
            }
        });

        // Affecter un asset à un utilisateur
        this.post('/:id/assign', authenticatedOptions, async (req: any, res: any) => {
            try {
                const { userId } = req.body;
                const asset = await AssetModel.findById(req.params.id);

                if (!asset) {
                    return res.status(404).json({ error: 'Asset non trouvé' });
                }

                // Vérifier que l'utilisateur existe
                const user = await UserModel.findById(userId);
                if (!user) {
                    return res.status(404).json({ error: 'Utilisateur non trouvé' });
                }

                // Mettre à jour l'asset
                asset.assignedUser = new ObjectId(userId);
                asset.status = AssetStatus.ACTIVE;
                await asset.save();

                // Créer une note d'historique
                const note = new NoteModel({
                    content: `Asset affecté à ${user.firstname} ${user.lastname}`,
                    createdBy: req.user._id
                });
                await note.save();

                // Ajouter la note à l'asset
                asset.notes.push(note._id);
                await asset.save();

                // Émettre un événement de notification
                enduranceEmitter.emit(enduranceEventTypes.ASSET_ASSIGNED, {
                    userId: userId,
                    assetId: asset._id,
                    assetName: asset.name,
                    assignedBy: req.user._id
                });

                const populatedAsset = await AssetModel.findById(asset._id)
                    .populate('assignedUser', 'firstname lastname email');

                res.json(populatedAsset);
            } catch (error) {
                console.error('Erreur lors de l\'affectation de l\'asset:', error);
                res.status(500).json({ error: 'Erreur interne du serveur' });
            }
        });

        // Enlever l'affectation d'un asset
        this.post('/:id/unassign', authenticatedOptions, async (req: any, res: any) => {
            try {
                const asset = await AssetModel.findById(req.params.id);

                if (!asset) {
                    return res.status(404).json({ error: 'Asset non trouvé' });
                }

                if (!asset.assignedUser) {
                    return res.status(400).json({ error: 'Cet asset n\'est pas affecté' });
                }

                const previousUser = asset.assignedUser;

                // Créer une note d'historique
                const note = new NoteModel({
                    content: `Affectation retirée de l'asset`,
                    createdBy: req.user._id
                });
                await note.save();

                // Mettre à jour l'asset
                asset.assignedUser = undefined;
                asset.notes.push(note._id);
                await asset.save();

                // Émettre un événement
                enduranceEmitter.emit(enduranceEventTypes.ASSET_UNASSIGNED, {
                    userId: previousUser,
                    assetId: asset._id,
                    assetName: asset.name,
                    unassignedBy: req.user._id
                });

                res.json(asset);
            } catch (error) {
                console.error('Erreur lors du retrait de l\'affectation:', error);
                res.status(500).json({ error: 'Erreur interne du serveur' });
            }
        });

        // Déclarer un incident sur un asset
        this.post('/:id/incident', authenticatedOptions, async (req: any, res: any) => {
            try {
                const { description } = req.body;
                const asset = await AssetModel.findById(req.params.id);

                if (!asset) {
                    return res.status(404).json({ error: 'Asset non trouvé' });
                }

                // Créer une note d'incident
                const note = new NoteModel({
                    content: `INCIDENT: ${description}`,
                    createdBy: req.user._id
                });
                await note.save();

                // Mettre à jour l'asset
                asset.status = AssetStatus.INCIDENT;
                asset.notes.push(note._id);
                await asset.save();

                // Émettre un événement d'incident
                enduranceEmitter.emit(enduranceEventTypes.ASSET_INCIDENT, {
                    assetId: asset._id,
                    assetName: asset.name,
                    incidentDescription: description,
                    reportedBy: req.user._id,
                    assignedUser: asset.assignedUser
                });

                const populatedAsset = await AssetModel.findById(asset._id)
                    .populate('assignedUser', 'firstname lastname email');

                res.json(populatedAsset);
            } catch (error) {
                console.error('Erreur lors de la déclaration d\'incident:', error);
                res.status(500).json({ error: 'Erreur interne du serveur' });
            }
        });

        // Récupérer les notes d'un asset
        this.get('/:id/notes', authenticatedOptions, async (req: any, res: any) => {
            try {
                const { id } = req.params;
                const page = parseInt(req.query.page as string) || 1;
                const limit = parseInt(req.query.limit as string) || 10;
                const skip = (page - 1) * limit;

                const asset = await AssetModel.findById(id);
                if (!asset) {
                    return res.status(404).json({ error: 'Asset non trouvé' });
                }

                const [notes, total] = await Promise.all([
                    NoteModel.find({ _id: { $in: asset.notes } })
                        .sort({ createdAt: -1 })
                        .skip(skip)
                        .limit(limit)
                        .populate({
                            path: 'createdBy',
                            select: 'firstname lastname',
                            options: { strictPopulate: false }
                        }),
                    NoteModel.countDocuments({ _id: { $in: asset.notes } })
                ]);

                const totalPages = Math.ceil(total / limit);

                return res.json({
                    data: notes.map(note => {
                        const noteObject = note.toObject();
                        const createdBy = note.createdBy as any;
                        return {
                            ...noteObject,
                            createdBy: {
                                firstname: createdBy.firstname,
                                lastname: createdBy.lastname
                            }
                        };
                    }),
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
                console.error('Erreur lors de la récupération des notes:', error);
                res.status(500).json({ error: 'Erreur interne du serveur' });
            }
        });

        // Ajouter une note à un asset
        this.post('/:id/notes', authenticatedOptions, async (req: any, res: any) => {
            try {
                const asset = await AssetModel.findById(req.params.id);
                if (!asset) {
                    return res.status(404).json({ error: 'Asset non trouvé' });
                }

                // Créer la nouvelle note
                const note = new NoteModel({
                    content: req.body.content,
                    createdBy: req.user._id
                });
                await note.save();

                // Ajouter la note à l'asset
                asset.notes.push(note._id);
                await asset.save();

                // Récupérer la note avec les informations de l'auteur
                const populatedNote = await NoteModel.findById(note._id)
                    .populate({
                        path: 'createdBy',
                        select: 'firstname lastname',
                        options: { strictPopulate: false }
                    });

                if (!populatedNote) {
                    return res.status(500).json({ error: 'Erreur lors de la récupération de la note' });
                }

                const noteObject = populatedNote.toObject();
                const createdBy = populatedNote.createdBy as any;

                return res.status(201).json({
                    ...noteObject,
                    createdBy: {
                        firstname: createdBy.firstname,
                        lastname: createdBy.lastname
                    }
                });
            } catch (error) {
                console.error('Erreur lors de l\'ajout de la note:', error);
                res.status(500).json({ error: 'Erreur interne du serveur' });
            }
        });
    }
}

const router = new AssetsRouter();
export default router;