import { EnduranceRouter, EnduranceAuthMiddleware, SecurityOptions } from '@programisto/endurance-core';
import ProjectCategoryModel from '../models/project-category.model.js';

class ProjectCategoryAdminRouter extends EnduranceRouter {
    constructor() {
        super(EnduranceAuthMiddleware.getInstance());
    }

    setupRoutes(): void {
        const authenticatedOptions: SecurityOptions = {
            requireAuth: true,
            permissions: []
        };

        // Lister toutes les catégories
        this.get('/', authenticatedOptions, async (req: any, res: any) => {
            try {
                const page = parseInt(req.query.page as string) || 1;
                const limit = parseInt(req.query.limit as string) || 10;
                const skip = (page - 1) * limit;
                const search = req.query.search as string || '';
                const sortBy = req.query.sortBy as string || 'name';
                const sortOrder = req.query.sortOrder as string || 'asc';

                // Construction de la requête de recherche
                const query: any = {};

                // Recherche sur nom et description
                if (search) {
                    const keywords = search.split(/\s+/).filter(Boolean);
                    const regexPatterns = keywords.map(keyword =>
                        new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
                    );

                    query.$or = [
                        { name: { $in: regexPatterns } },
                        { description: { $in: regexPatterns } }
                    ];
                }

                // Tri
                const sort: any = {};
                sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

                const categories = await ProjectCategoryModel.find(query)
                    .sort(sort)
                    .skip(skip)
                    .limit(limit);

                const total = await ProjectCategoryModel.countDocuments(query);

                res.json({
                    categories,
                    pagination: {
                        currentPage: page,
                        totalPages: Math.ceil(total / limit),
                        totalItems: total,
                        itemsPerPage: limit
                    }
                });
            } catch (error) {
                console.error('Erreur lors de la récupération des catégories:', error);
                res.status(500).json({ message: 'Erreur interne du serveur' });
            }
        });

        // Récupérer une catégorie par ID
        this.get('/:id', authenticatedOptions, async (req: any, res: any) => {
            try {
                const category = await ProjectCategoryModel.findById(req.params.id);

                if (!category) {
                    return res.status(404).json({ message: 'Catégorie non trouvée' });
                }

                res.json(category);
            } catch (error) {
                console.error('Erreur lors de la récupération de la catégorie:', error);
                res.status(500).json({ message: 'Erreur interne du serveur' });
            }
        });

        // Créer une nouvelle catégorie
        this.post('/', authenticatedOptions, async (req: any, res: any) => {
            try {
                const { name, description, color } = req.body;

                // Validation des champs requis
                if (!name) {
                    return res.status(400).json({
                        message: 'Le champ name est requis'
                    });
                }

                // Vérifier que le nom n'existe pas déjà
                const existingCategory = await ProjectCategoryModel.findOne({ name });
                if (existingCategory) {
                    return res.status(400).json({ message: 'Une catégorie avec ce nom existe déjà' });
                }

                const category = new ProjectCategoryModel({
                    name,
                    description,
                    color
                });

                await category.save();

                res.status(201).json(category);
            } catch (error) {
                console.error('Erreur lors de la création de la catégorie:', error);
                res.status(500).json({ message: 'Erreur interne du serveur' });
            }
        });

        // Mettre à jour une catégorie
        this.put('/:id', authenticatedOptions, async (req: any, res: any) => {
            try {
                const category = await ProjectCategoryModel.findById(req.params.id);
                if (!category) {
                    return res.status(404).json({ message: 'Catégorie non trouvée' });
                }

                const { name, description, color, isActive } = req.body;

                // Vérifier que le nom n'existe pas déjà (si changé)
                if (name && name !== category.name) {
                    const existingCategory = await ProjectCategoryModel.findOne({ name });
                    if (existingCategory) {
                        return res.status(400).json({ message: 'Une catégorie avec ce nom existe déjà' });
                    }
                }

                // Mise à jour des champs
                if (name !== undefined) category.name = name;
                if (description !== undefined) category.description = description;
                if (color !== undefined) category.color = color;
                if (isActive !== undefined) category.isActive = isActive;

                await category.save();

                res.json(category);
            } catch (error) {
                console.error('Erreur lors de la mise à jour de la catégorie:', error);
                res.status(500).json({ message: 'Erreur interne du serveur' });
            }
        });

        // Supprimer une catégorie
        this.delete('/:id', authenticatedOptions, async (req: any, res: any) => {
            try {
                const category = await ProjectCategoryModel.findById(req.params.id);
                if (!category) {
                    return res.status(404).json({ message: 'Catégorie non trouvée' });
                }

                // Vérifier si la catégorie est utilisée dans des projets
                const ProjectModel = (await import('../models/project.model.js')).default;
                const projectsUsingCategory = await ProjectModel.find({
                    categories: category.name
                });

                if (projectsUsingCategory.length > 0) {
                    return res.status(400).json({
                        message: `Cette catégorie est utilisée dans ${projectsUsingCategory.length} projet(s). Supprimez d'abord les références.`
                    });
                }

                await ProjectCategoryModel.findByIdAndDelete(req.params.id);

                res.json({ message: 'Catégorie supprimée avec succès' });
            } catch (error) {
                console.error('Erreur lors de la suppression de la catégorie:', error);
                res.status(500).json({ message: 'Erreur interne du serveur' });
            }
        });

        // Lister toutes les catégories actives (pour les selects)
        this.get('/active/list', authenticatedOptions, async (req: any, res: any) => {
            try {
                const categories = await ProjectCategoryModel.find({ isActive: true })
                    .select('name description color')
                    .sort({ name: 1 });

                res.json(categories);
            } catch (error) {
                console.error('Erreur lors de la récupération des catégories actives:', error);
                res.status(500).json({ message: 'Erreur interne du serveur' });
            }
        });
    }
}

const router = new ProjectCategoryAdminRouter();
export default router;
