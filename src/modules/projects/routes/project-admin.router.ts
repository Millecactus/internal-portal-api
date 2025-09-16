import { EnduranceRouter, EnduranceAuthMiddleware, SecurityOptions } from '@programisto/endurance-core';
import ProjectModel from '../models/project.model.js';
import ProjectUserModel from '../models/project-user.model.js';
import ProjectTaskModel from '../models/project-task.model.js';
import ProjectCategoryModel from '../models/project-category.model.js';
import NoteModel from '../models/note.model.js';
import { ObjectId } from 'mongodb';

class ProjectAdminRouter extends EnduranceRouter {
    constructor() {
        super(EnduranceAuthMiddleware.getInstance());
    }

    setupRoutes(): void {
        const authenticatedOptions: SecurityOptions = {
            requireAuth: true,
            permissions: []
        };

        // Lister tous les projets
        this.get('/', authenticatedOptions, async (req: any, res: any) => {
            try {
                const page = parseInt(req.query.page as string) || 1;
                const limit = parseInt(req.query.limit as string) || 10;
                const skip = (page - 1) * limit;
                const search = req.query.search as string || '';
                const status = req.query.status as string || 'all';
                const client = req.query.client as string || 'all';
                const sortBy = req.query.sortBy as string || 'updatedAt';
                const sortOrder = req.query.sortOrder as string || 'desc';

                // Construction de la requête de recherche
                const query: any = {};

                // Filtres
                if (status !== 'all') {
                    query.status = status;
                }

                if (client !== 'all') {
                    query.client = new ObjectId(client);
                }

                // Recherche sur titre et description
                if (search) {
                    const keywords = search.split(/\s+/).filter(Boolean);
                    const regexPatterns = keywords.map(keyword =>
                        new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
                    );

                    query.$or = [
                        { title: { $in: regexPatterns } },
                        { description: { $in: regexPatterns } }
                    ];
                }

                // Tri
                const sort: any = {};
                sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

                const projects = await ProjectModel.find(query)
                    .sort(sort)
                    .skip(skip)
                    .limit(limit);

                // Convertir les projets en objets simples
                const populatedProjects = projects.map(project => project.toObject());

                const total = await ProjectModel.countDocuments(query);

                res.json({
                    projects,
                    pagination: {
                        currentPage: page,
                        totalPages: Math.ceil(total / limit),
                        totalItems: total,
                        itemsPerPage: limit
                    }
                });
            } catch (error) {
                console.error('Erreur lors de la récupération des projets:', error);
                res.status(500).json({ message: 'Erreur interne du serveur' });
            }
        });

        // Récupérer un projet par ID
        this.get('/:id', authenticatedOptions, async (req: any, res: any) => {
            try {
                const project = await ProjectModel.findById(req.params.id);

                if (!project) {
                    return res.status(404).json({ message: 'Projet non trouvé' });
                }

                // Convertir le projet en objet simple
                const populatedProject = project.toObject();

                res.json(populatedProject);
            } catch (error) {
                console.error('Erreur lors de la récupération du projet:', error);
                res.status(500).json({ message: 'Erreur interne du serveur' });
            }
        });

        // Créer un nouveau projet
        this.post('/', authenticatedOptions, async (req: any, res: any) => {
            try {
                const {
                    title,
                    description,
                    startDate,
                    endDate,
                    accountManager,
                    client,
                    clientSponsor,
                    categories,
                    tags,
                    pnl,
                    team,
                    billingType,
                    fixedPrice,
                    budget
                } = req.body;

                // Validation des champs requis
                if (!title || !description || !startDate || !accountManager || !client) {
                    return res.status(400).json({
                        message: 'Les champs titre, description, date de début, account manager et client sont requis'
                    });
                }

                // Validation des ObjectId
                if (!ObjectId.isValid(accountManager)) {
                    return res.status(400).json({ message: 'ID account manager invalide' });
                }

                if (!ObjectId.isValid(client)) {
                    return res.status(400).json({ message: 'ID client invalide' });
                }

                if (clientSponsor && !ObjectId.isValid(clientSponsor)) {
                    return res.status(400).json({ message: 'ID sponsor client invalide' });
                }

                const project = new ProjectModel({
                    title,
                    description,
                    startDate: new Date(startDate),
                    endDate: endDate ? new Date(endDate) : undefined,
                    accountManager,
                    client,
                    clientSponsor,
                    categories: categories || [],
                    tags: tags || [],
                    pnl,
                    team,
                    billingType: billingType || 'TIME_AND_MATERIALS',
                    fixedPrice,
                    budget
                });

                await project.save();

                // Convertir le projet en objet simple
                const populatedProject = project.toObject();

                res.status(201).json(populatedProject);
            } catch (error) {
                console.error('Erreur lors de la création du projet:', error);
                res.status(500).json({ message: 'Erreur interne du serveur' });
            }
        });

        // Mettre à jour un projet
        this.put('/:id', authenticatedOptions, async (req: any, res: any) => {
            try {
                const project = await ProjectModel.findById(req.params.id);
                if (!project) {
                    return res.status(404).json({ message: 'Projet non trouvé' });
                }

                const {
                    title,
                    description,
                    startDate,
                    endDate,
                    accountManager,
                    client,
                    clientSponsor,
                    categories,
                    tags,
                    pnl,
                    team,
                    billingType,
                    fixedPrice,
                    budget,
                    status,
                    progress
                } = req.body;

                // Validation des ObjectId si fournis
                if (accountManager && !ObjectId.isValid(accountManager)) {
                    return res.status(400).json({ message: 'ID account manager invalide' });
                }

                if (client && !ObjectId.isValid(client)) {
                    return res.status(400).json({ message: 'ID client invalide' });
                }

                if (clientSponsor && !ObjectId.isValid(clientSponsor)) {
                    return res.status(400).json({ message: 'ID sponsor client invalide' });
                }

                // Mise à jour des champs
                if (title !== undefined) project.title = title;
                if (description !== undefined) project.description = description;
                if (startDate !== undefined) project.startDate = new Date(startDate);
                if (endDate !== undefined) project.endDate = endDate ? new Date(endDate) : undefined;
                if (accountManager !== undefined) project.accountManager = accountManager;
                if (client !== undefined) project.client = client;
                if (clientSponsor !== undefined) project.clientSponsor = clientSponsor;
                if (categories !== undefined) project.categories = categories;
                if (tags !== undefined) project.tags = tags;
                if (pnl !== undefined) project.pnl = pnl;
                if (team !== undefined) project.team = team;
                if (billingType !== undefined) project.billingType = billingType;
                if (fixedPrice !== undefined) project.fixedPrice = fixedPrice;
                if (budget !== undefined) project.budget = budget;
                if (status !== undefined) project.status = status;
                if (progress !== undefined) project.progress = progress;

                await project.save();

                // Convertir le projet en objet simple
                const populatedProject = project.toObject();

                res.json(populatedProject);
            } catch (error) {
                console.error('Erreur lors de la mise à jour du projet:', error);
                res.status(500).json({ message: 'Erreur interne du serveur' });
            }
        });

        // Supprimer un projet
        this.delete('/:id', authenticatedOptions, async (req: any, res: any) => {
            try {
                const project = await ProjectModel.findById(req.params.id);
                if (!project) {
                    return res.status(404).json({ message: 'Projet non trouvé' });
                }

                // Supprimer les utilisateurs assignés au projet
                await ProjectUserModel.deleteMany({ project: project._id });

                // Supprimer les tâches du projet
                await ProjectTaskModel.deleteMany({ project: project._id });

                // Supprimer le projet
                await ProjectModel.findByIdAndDelete(req.params.id);

                res.json({ message: 'Projet supprimé avec succès' });
            } catch (error) {
                console.error('Erreur lors de la suppression du projet:', error);
                res.status(500).json({ message: 'Erreur interne du serveur' });
            }
        });

        // Assigner un utilisateur à un projet
        this.post('/:id/users', authenticatedOptions, async (req: any, res: any) => {
            try {
                const { user, dailyRate, startDate, endDate, role, allocation, notes } = req.body;

                if (!user || !dailyRate || !startDate) {
                    return res.status(400).json({
                        message: 'Les champs user, dailyRate et startDate sont requis'
                    });
                }

                // Vérifier que le projet existe
                const project = await ProjectModel.findById(req.params.id);
                if (!project) {
                    return res.status(404).json({ message: 'Projet non trouvé' });
                }

                // Validation de l'ObjectId utilisateur
                if (!ObjectId.isValid(user)) {
                    return res.status(400).json({ message: 'ID utilisateur invalide' });
                }

                // Vérifier que l'utilisateur n'est pas déjà assigné au projet
                const existingAssignment = await ProjectUserModel.findOne({
                    project: req.params.id,
                    user: user,
                    status: 'ACTIVE'
                });

                if (existingAssignment) {
                    return res.status(400).json({ message: 'Cet utilisateur est déjà assigné au projet' });
                }

                const projectUser = new ProjectUserModel({
                    project: req.params.id,
                    user,
                    dailyRate,
                    startDate: new Date(startDate),
                    endDate: endDate ? new Date(endDate) : undefined,
                    role,
                    allocation: allocation || 100,
                    notes
                });

                await projectUser.save();

                // Ajouter l'utilisateur à la liste des utilisateurs assignés du projet
                project.assignedUsers.push(projectUser._id);
                await project.save();

                // Convertir en objet simple
                const populatedProjectUser = projectUser.toObject();

                res.status(201).json(populatedProjectUser);
            } catch (error) {
                console.error('Erreur lors de l\'assignation de l\'utilisateur:', error);
                res.status(500).json({ message: 'Erreur interne du serveur' });
            }
        });

        // Récupérer les utilisateurs assignés à un projet
        this.get('/:id/users', authenticatedOptions, async (req: any, res: any) => {
            try {
                const projectUsers = await ProjectUserModel.find({ project: req.params.id })
                    .sort({ createdAt: -1 });

                // Convertir en objets simples
                const populatedProjectUsers = projectUsers.map(projectUser => projectUser.toObject());

                res.json(populatedProjectUsers);
            } catch (error) {
                console.error('Erreur lors de la récupération des utilisateurs:', error);
                res.status(500).json({ message: 'Erreur interne du serveur' });
            }
        });

        // Mettre à jour l'assignation d'un utilisateur
        this.put('/:id/users/:userId', authenticatedOptions, async (req: any, res: any) => {
            try {
                const { dailyRate, endDate, role, allocation, notes, status } = req.body;

                const projectUser = await ProjectUserModel.findOne({
                    project: req.params.id,
                    _id: req.params.userId
                });

                if (!projectUser) {
                    return res.status(404).json({ message: 'Assignation non trouvée' });
                }

                if (dailyRate !== undefined) projectUser.dailyRate = dailyRate;
                if (endDate !== undefined) projectUser.endDate = endDate ? new Date(endDate) : undefined;
                if (role !== undefined) projectUser.role = role;
                if (allocation !== undefined) projectUser.allocation = allocation;
                if (notes !== undefined) projectUser.notes = notes;
                if (status !== undefined) projectUser.status = status;

                await projectUser.save();

                // Convertir en objet simple
                const populatedProjectUser = projectUser.toObject();

                res.json(populatedProjectUser);
            } catch (error) {
                console.error('Erreur lors de la mise à jour de l\'assignation:', error);
                res.status(500).json({ message: 'Erreur interne du serveur' });
            }
        });

        // Supprimer l'assignation d'un utilisateur
        this.delete('/:id/users/:userId', authenticatedOptions, async (req: any, res: any) => {
            try {
                const projectUser = await ProjectUserModel.findOne({
                    project: req.params.id,
                    _id: req.params.userId
                });

                if (!projectUser) {
                    return res.status(404).json({ message: 'Assignation non trouvée' });
                }

                // Retirer l'utilisateur de la liste des utilisateurs assignés du projet
                await ProjectModel.findByIdAndUpdate(
                    req.params.id,
                    { $pull: { assignedUsers: projectUser._id } }
                );

                // Supprimer l'assignation
                await ProjectUserModel.findByIdAndDelete(projectUser._id);

                res.json({ message: 'Assignation supprimée avec succès' });
            } catch (error) {
                console.error('Erreur lors de la suppression de l\'assignation:', error);
                res.status(500).json({ message: 'Erreur interne du serveur' });
            }
        });

        // Ajouter une note à un projet
        this.post('/:id/notes', authenticatedOptions, async (req: any, res: any) => {
            try {
                const { content, createdBy } = req.body;

                if (!content || !createdBy) {
                    return res.status(400).json({
                        message: 'Les champs content et createdBy sont requis'
                    });
                }

                // Validation de l'ObjectId createdBy
                if (!ObjectId.isValid(createdBy)) {
                    return res.status(400).json({ message: 'ID utilisateur invalide' });
                }

                // Vérifier que le projet existe
                const project = await ProjectModel.findById(req.params.id);
                if (!project) {
                    return res.status(404).json({ message: 'Projet non trouvé' });
                }

                // Créer la note
                const note = new NoteModel({
                    content,
                    createdBy
                });

                await note.save();

                // Ajouter la note au projet
                project.notes.push(note._id);
                await project.save();

                // Convertir en objet simple
                const populatedNote = note.toObject();

                res.status(201).json(populatedNote);
            } catch (error) {
                console.error('Erreur lors de l\'ajout de la note:', error);
                res.status(500).json({ message: 'Erreur interne du serveur' });
            }
        });

        // Récupérer les notes d'un projet
        this.get('/:id/notes', authenticatedOptions, async (req: any, res: any) => {
            try {
                const project = await ProjectModel.findById(req.params.id);
                if (!project) {
                    return res.status(404).json({ message: 'Projet non trouvé' });
                }

                const notes = await NoteModel.find({ _id: { $in: project.notes } })
                    .sort({ createdAt: -1 });

                // Convertir en objets simples
                const populatedNotes = notes.map(note => note.toObject());

                res.json(populatedNotes);
            } catch (error) {
                console.error('Erreur lors de la récupération des notes:', error);
                res.status(500).json({ message: 'Erreur interne du serveur' });
            }
        });

        // Supprimer une note d'un projet
        this.delete('/:id/notes/:noteId', authenticatedOptions, async (req: any, res: any) => {
            try {
                const project = await ProjectModel.findById(req.params.id);
                if (!project) {
                    return res.status(404).json({ message: 'Projet non trouvé' });
                }

                const note = await NoteModel.findById(req.params.noteId);
                if (!note) {
                    return res.status(404).json({ message: 'Note non trouvée' });
                }

                // Retirer la note du projet
                project.notes = project.notes.filter(noteId => noteId.toString() !== req.params.noteId);
                await project.save();

                // Supprimer la note
                await NoteModel.findByIdAndDelete(req.params.noteId);

                res.json({ message: 'Note supprimée avec succès' });
            } catch (error) {
                console.error('Erreur lors de la suppression de la note:', error);
                res.status(500).json({ message: 'Erreur interne du serveur' });
            }
        });

        // Mettre à jour les documents d'un projet
        this.put('/:id/documents', authenticatedOptions, async (req: any, res: any) => {
            try {
                const { documents } = req.body;

                if (!Array.isArray(documents)) {
                    return res.status(400).json({ message: 'Le champ documents doit être un tableau' });
                }

                // Validation des ObjectId
                for (const docId of documents) {
                    if (!ObjectId.isValid(docId)) {
                        return res.status(400).json({ message: 'ID document invalide' });
                    }
                }

                const project = await ProjectModel.findById(req.params.id);
                if (!project) {
                    return res.status(404).json({ message: 'Projet non trouvé' });
                }

                project.documents = documents;
                await project.save();

                // Convertir en objet simple
                const populatedProject = project.toObject();

                res.json(populatedProject);
            } catch (error) {
                console.error('Erreur lors de la mise à jour des documents:', error);
                res.status(500).json({ message: 'Erreur interne du serveur' });
            }
        });

        // Mettre à jour le logo d'un projet
        this.put('/:id/logo', authenticatedOptions, async (req: any, res: any) => {
            try {
                const { logo } = req.body;

                if (logo && !ObjectId.isValid(logo)) {
                    return res.status(400).json({ message: 'ID logo invalide' });
                }

                const project = await ProjectModel.findById(req.params.id);
                if (!project) {
                    return res.status(404).json({ message: 'Projet non trouvé' });
                }

                project.logo = logo || undefined;
                await project.save();

                // Convertir en objet simple
                const populatedProject = project.toObject();

                res.json(populatedProject);
            } catch (error) {
                console.error('Erreur lors de la mise à jour du logo:', error);
                res.status(500).json({ message: 'Erreur interne du serveur' });
            }
        });
    }
}

const router = new ProjectAdminRouter();
export default router;
