import { EnduranceRouter, EnduranceAuthMiddleware, SecurityOptions } from '@programisto/endurance-core';
import ProjectTaskModel from '../models/project-task.model.js';
import ProjectModel from '../models/project.model.js';
import NoteModel from '../models/note.model.js';
import { ObjectId } from 'mongodb';

class ProjectTaskAdminRouter extends EnduranceRouter {
    constructor() {
        super(EnduranceAuthMiddleware.getInstance());
    }

    setupRoutes(): void {
        const authenticatedOptions: SecurityOptions = {
            requireAuth: true,
            permissions: []
        };

        // Lister toutes les tâches d'un projet
        this.get('/project/:projectId', authenticatedOptions, async (req: any, res: any) => {
            try {
                const page = parseInt(req.query.page as string) || 1;
                const limit = parseInt(req.query.limit as string) || 10;
                const skip = (page - 1) * limit;
                const search = req.query.search as string || '';
                const status = req.query.status as string || 'all';
                const priority = req.query.priority as string || 'all';
                const assignedTo = req.query.assignedTo as string || 'all';
                const sortBy = req.query.sortBy as string || 'createdAt';
                const sortOrder = req.query.sortOrder as string || 'desc';

                // Construction de la requête de recherche
                const query: any = { project: req.params.projectId };

                // Filtres
                if (status !== 'all') {
                    query.status = status;
                }

                if (priority !== 'all') {
                    query.priority = priority;
                }

                if (assignedTo !== 'all') {
                    query.assignedTo = new ObjectId(assignedTo);
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

                const tasks = await ProjectTaskModel.find(query)
                    .sort(sort)
                    .skip(skip)
                    .limit(limit);

                // Convertir en objets simples
                const populatedTasks = tasks.map(task => task.toObject());

                const total = await ProjectTaskModel.countDocuments(query);

                res.json({
                    tasks: populatedTasks,
                    pagination: {
                        currentPage: page,
                        totalPages: Math.ceil(total / limit),
                        totalItems: total,
                        itemsPerPage: limit
                    }
                });
            } catch (error) {
                console.error('Erreur lors de la récupération des tâches:', error);
                res.status(500).json({ message: 'Erreur interne du serveur' });
            }
        });

        // Récupérer une tâche par ID
        this.get('/:id', authenticatedOptions, async (req: any, res: any) => {
            try {
                const task = await ProjectTaskModel.findById(req.params.id);

                if (!task) {
                    return res.status(404).json({ message: 'Tâche non trouvée' });
                }

                // Convertir en objet simple
                const populatedTask = task.toObject();

                res.json(populatedTask);
            } catch (error) {
                console.error('Erreur lors de la récupération de la tâche:', error);
                res.status(500).json({ message: 'Erreur interne du serveur' });
            }
        });

        // Créer une nouvelle tâche
        this.post('/', authenticatedOptions, async (req: any, res: any) => {
            try {
                const {
                    project,
                    title,
                    description,
                    startDate,
                    endDate,
                    estimatedHours,
                    assignedTo,
                    contributors,
                    tags,
                    categories,
                    priority,
                    parentTask
                } = req.body;

                // Validation des champs requis
                if (!project || !title || !description || !startDate) {
                    return res.status(400).json({
                        message: 'Les champs project, title, description et startDate sont requis'
                    });
                }

                // Vérifier que le projet existe
                const projectExists = await ProjectModel.findById(project);
                if (!projectExists) {
                    return res.status(400).json({ message: 'Projet non trouvé' });
                }

                // Validation des ObjectId si fournis
                if (assignedTo && !ObjectId.isValid(assignedTo)) {
                    return res.status(400).json({ message: 'ID utilisateur assigné invalide' });
                }

                if (contributors && contributors.length > 0) {
                    for (const contributor of contributors) {
                        if (!ObjectId.isValid(contributor)) {
                            return res.status(400).json({ message: 'ID contributeur invalide' });
                        }
                    }
                }

                // Vérifier que la tâche parent existe si fournie
                if (parentTask) {
                    const parentExists = await ProjectTaskModel.findById(parentTask);
                    if (!parentExists) {
                        return res.status(400).json({ message: 'Tâche parent non trouvée' });
                    }
                }

                const task = new ProjectTaskModel({
                    project,
                    title,
                    description,
                    startDate: new Date(startDate),
                    endDate: endDate ? new Date(endDate) : undefined,
                    estimatedHours,
                    assignedTo,
                    contributors: contributors || [],
                    tags: tags || [],
                    categories: categories || [],
                    priority: priority || 'MEDIUM',
                    parentTask
                });

                await task.save();

                // Si c'est une sous-tâche, l'ajouter à la liste des sous-tâches du parent
                if (parentTask) {
                    await ProjectTaskModel.findByIdAndUpdate(
                        parentTask,
                        { $push: { subtasks: task._id } }
                    );
                }

                // Ajouter la tâche à la liste des tâches du projet
                await ProjectModel.findByIdAndUpdate(
                    project,
                    { $push: { tasks: task._id } }
                );

                // Convertir en objet simple
                const populatedTask = task.toObject();

                res.status(201).json(populatedTask);
            } catch (error) {
                console.error('Erreur lors de la création de la tâche:', error);
                res.status(500).json({ message: 'Erreur interne du serveur' });
            }
        });

        // Mettre à jour une tâche
        this.put('/:id', authenticatedOptions, async (req: any, res: any) => {
            try {
                const task = await ProjectTaskModel.findById(req.params.id);
                if (!task) {
                    return res.status(404).json({ message: 'Tâche non trouvée' });
                }

                const {
                    title,
                    description,
                    startDate,
                    endDate,
                    estimatedHours,
                    actualHours,
                    assignedTo,
                    contributors,
                    tags,
                    categories,
                    status,
                    priority,
                    progress,
                    parentTask
                } = req.body;

                // Validation des ObjectId si fournis
                if (assignedTo && !ObjectId.isValid(assignedTo)) {
                    return res.status(400).json({ message: 'ID utilisateur assigné invalide' });
                }

                if (contributors && contributors.length > 0) {
                    for (const contributor of contributors) {
                        if (!ObjectId.isValid(contributor)) {
                            return res.status(400).json({ message: 'ID contributeur invalide' });
                        }
                    }
                }

                if (parentTask) {
                    const parentExists = await ProjectTaskModel.findById(parentTask);
                    if (!parentExists) {
                        return res.status(400).json({ message: 'Tâche parent non trouvée' });
                    }
                }

                // Gestion du changement de tâche parent
                if (parentTask !== undefined && parentTask !== task.parentTask?.toString()) {
                    // Retirer de l'ancien parent si il y en avait un
                    if (task.parentTask) {
                        await ProjectTaskModel.findByIdAndUpdate(
                            task.parentTask,
                            { $pull: { subtasks: task._id } }
                        );
                    }

                    // Ajouter au nouveau parent
                    if (parentTask) {
                        await ProjectTaskModel.findByIdAndUpdate(
                            parentTask,
                            { $push: { subtasks: task._id } }
                        );
                    }
                }

                // Mise à jour des champs
                if (title !== undefined) task.title = title;
                if (description !== undefined) task.description = description;
                if (startDate !== undefined) task.startDate = new Date(startDate);
                if (endDate !== undefined) task.endDate = endDate ? new Date(endDate) : undefined;
                if (estimatedHours !== undefined) task.estimatedHours = estimatedHours;
                if (actualHours !== undefined) task.actualHours = actualHours;
                if (assignedTo !== undefined) task.assignedTo = assignedTo;
                if (contributors !== undefined) task.contributors = contributors;
                if (tags !== undefined) task.tags = tags;
                if (categories !== undefined) task.categories = categories;
                if (status !== undefined) task.status = status;
                if (priority !== undefined) task.priority = priority;
                if (progress !== undefined) task.progress = progress;
                if (parentTask !== undefined) task.parentTask = parentTask;

                await task.save();

                // Convertir en objet simple
                const populatedTask = task.toObject();

                res.json(populatedTask);
            } catch (error) {
                console.error('Erreur lors de la mise à jour de la tâche:', error);
                res.status(500).json({ message: 'Erreur interne du serveur' });
            }
        });

        // Supprimer une tâche
        this.delete('/:id', authenticatedOptions, async (req: any, res: any) => {
            try {
                const task = await ProjectTaskModel.findById(req.params.id);
                if (!task) {
                    return res.status(404).json({ message: 'Tâche non trouvée' });
                }

                // Supprimer les sous-tâches
                if (task.subtasks && task.subtasks.length > 0) {
                    await ProjectTaskModel.deleteMany({ _id: { $in: task.subtasks } });
                }

                // Retirer de la tâche parent si il y en a une
                if (task.parentTask) {
                    await ProjectTaskModel.findByIdAndUpdate(
                        task.parentTask,
                        { $pull: { subtasks: task._id } }
                    );
                }

                // Retirer de la liste des tâches du projet
                await ProjectModel.findByIdAndUpdate(
                    task.project,
                    { $pull: { tasks: task._id } }
                );

                // Supprimer la tâche
                await ProjectTaskModel.findByIdAndDelete(req.params.id);

                res.json({ message: 'Tâche supprimée avec succès' });
            } catch (error) {
                console.error('Erreur lors de la suppression de la tâche:', error);
                res.status(500).json({ message: 'Erreur interne du serveur' });
            }
        });

        // Récupérer les statistiques d'un projet
        this.get('/project/:projectId/stats', authenticatedOptions, async (req: any, res: any) => {
            try {
                const projectId = req.params.projectId;

                // Vérifier que le projet existe
                const project = await ProjectModel.findById(projectId);
                if (!project) {
                    return res.status(404).json({ message: 'Projet non trouvé' });
                }

                // Statistiques des tâches
                const totalTasks = await ProjectTaskModel.countDocuments({ project: projectId });
                const completedTasks = await ProjectTaskModel.countDocuments({
                    project: projectId,
                    status: 'COMPLETED'
                });
                const inProgressTasks = await ProjectTaskModel.countDocuments({
                    project: projectId,
                    status: 'IN_PROGRESS'
                });
                const todoTasks = await ProjectTaskModel.countDocuments({
                    project: projectId,
                    status: 'TODO'
                });

                // Temps estimé vs temps réel
                const timeStats = await ProjectTaskModel.aggregate([
                    { $match: { project: new ObjectId(projectId) } },
                    {
                        $group: {
                            _id: null,
                            totalEstimatedHours: { $sum: '$estimatedHours' },
                            totalActualHours: { $sum: '$actualHours' }
                        }
                    }
                ]);

                // Tâches par priorité
                const priorityStats = await ProjectTaskModel.aggregate([
                    { $match: { project: new ObjectId(projectId) } },
                    {
                        $group: {
                            _id: '$priority',
                            count: { $sum: 1 }
                        }
                    }
                ]);

                // Tâches par statut
                const statusStats = await ProjectTaskModel.aggregate([
                    { $match: { project: new ObjectId(projectId) } },
                    {
                        $group: {
                            _id: '$status',
                            count: { $sum: 1 }
                        }
                    }
                ]);

                res.json({
                    totalTasks,
                    completedTasks,
                    inProgressTasks,
                    todoTasks,
                    completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
                    timeStats: timeStats[0] || { totalEstimatedHours: 0, totalActualHours: 0 },
                    priorityStats,
                    statusStats
                });
            } catch (error) {
                console.error('Erreur lors de la récupération des statistiques:', error);
                res.status(500).json({ message: 'Erreur interne du serveur' });
            }
        });

        // Ajouter une note à une tâche
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

                // Vérifier que la tâche existe
                const task = await ProjectTaskModel.findById(req.params.id);
                if (!task) {
                    return res.status(404).json({ message: 'Tâche non trouvée' });
                }

                // Créer la note
                const note = new NoteModel({
                    content,
                    createdBy
                });

                await note.save();

                // Ajouter la note à la tâche
                task.notes.push(note._id);
                await task.save();

                // Convertir en objet simple
                const populatedNote = note.toObject();

                res.status(201).json(populatedNote);
            } catch (error) {
                console.error('Erreur lors de l\'ajout de la note:', error);
                res.status(500).json({ message: 'Erreur interne du serveur' });
            }
        });

        // Récupérer les notes d'une tâche
        this.get('/:id/notes', authenticatedOptions, async (req: any, res: any) => {
            try {
                const task = await ProjectTaskModel.findById(req.params.id);
                if (!task) {
                    return res.status(404).json({ message: 'Tâche non trouvée' });
                }

                const notes = await NoteModel.find({ _id: { $in: task.notes } })
                    .sort({ createdAt: -1 });

                // Convertir en objets simples
                const populatedNotes = notes.map(note => note.toObject());

                res.json(populatedNotes);
            } catch (error) {
                console.error('Erreur lors de la récupération des notes:', error);
                res.status(500).json({ message: 'Erreur interne du serveur' });
            }
        });

        // Supprimer une note d'une tâche
        this.delete('/:id/notes/:noteId', authenticatedOptions, async (req: any, res: any) => {
            try {
                const task = await ProjectTaskModel.findById(req.params.id);
                if (!task) {
                    return res.status(404).json({ message: 'Tâche non trouvée' });
                }

                const note = await NoteModel.findById(req.params.noteId);
                if (!note) {
                    return res.status(404).json({ message: 'Note non trouvée' });
                }

                // Retirer la note de la tâche
                task.notes = task.notes.filter(noteId => noteId.toString() !== req.params.noteId);
                await task.save();

                // Supprimer la note
                await NoteModel.findByIdAndDelete(req.params.noteId);

                res.json({ message: 'Note supprimée avec succès' });
            } catch (error) {
                console.error('Erreur lors de la suppression de la note:', error);
                res.status(500).json({ message: 'Erreur interne du serveur' });
            }
        });

        // Mettre à jour les documents d'une tâche
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

                const task = await ProjectTaskModel.findById(req.params.id);
                if (!task) {
                    return res.status(404).json({ message: 'Tâche non trouvée' });
                }

                task.documents = documents;
                await task.save();

                // Convertir en objet simple
                const populatedTask = task.toObject();

                res.json(populatedTask);
            } catch (error) {
                console.error('Erreur lors de la mise à jour des documents:', error);
                res.status(500).json({ message: 'Erreur interne du serveur' });
            }
        });
    }
}

const router = new ProjectTaskAdminRouter();
export default router;
