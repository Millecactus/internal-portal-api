import { EnduranceRouter, enduranceEmitter, enduranceEventTypes, EnduranceAuthMiddleware, SecurityOptions } from '@programisto/endurance-core';
import OrganizationModel from '../models/organization.model.js';
import ContactModel from '../models/contact.model.js';
import { ObjectId } from 'mongodb';

class OrganizationAdminRouter extends EnduranceRouter {
    constructor() {
        super(EnduranceAuthMiddleware.getInstance());
    }

    setupRoutes(): void {
        const authenticatedOptions: SecurityOptions = {
            requireAuth: true,
            permissions: []
        };

        // Lister toutes les organisations
        this.get('/', authenticatedOptions, async (req: any, res: any) => {
            try {
                const page = parseInt(req.query.page as string) || 1;
                const limit = parseInt(req.query.limit as string) || 10;
                const skip = (page - 1) * limit;
                const search = req.query.search as string || '';
                const city = req.query.city as string || 'all';
                const industry = req.query.industry as string || 'all';
                const sortBy = req.query.sortBy as string || 'updatedAt';
                const sortOrder = req.query.sortOrder as string || 'desc';

                // Construction de la requête de recherche
                const query: any = {};

                // Filtres
                if (city !== 'all') {
                    query.city = city;
                }
                if (industry !== 'all') {
                    query.industry = industry;
                }

                // Recherche sur nom, email, ville et secteur
                if (search) {
                    // Diviser la recherche en mots-clés
                    const keywords = search.split(/\s+/).filter(Boolean);

                    // Créer des expressions régulières pour chaque mot-clé
                    const regexPatterns = keywords.map(keyword =>
                        new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
                    );

                    query.$or = [
                        { name: { $in: regexPatterns } },
                        { email: { $in: regexPatterns } },
                        { city: { $in: regexPatterns } },
                        { industry: { $in: regexPatterns } },
                        { siret: { $in: regexPatterns } }
                    ];
                }

                // Construction du tri
                const sortOptions: Record<string, 1 | -1> = {
                    [sortBy]: sortOrder === 'asc' ? 1 : -1
                };

                const [organizations, total] = await Promise.all([
                    OrganizationModel.find(query)
                        .sort(sortOptions)
                        .skip(skip)
                        .limit(limit)
                        .populate('contacts', 'firstname lastname email')
                        .exec(),
                    OrganizationModel.countDocuments(query)
                ]);

                const totalPages = Math.ceil(total / limit);

                return res.json({
                    data: organizations,
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
                console.error('Erreur lors de la récupération des organisations:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Récupérer le détail d'une organisation
        this.get('/:id', authenticatedOptions, async (req: any, res: any) => {
            try {
                const id = req.params.id;
                const organization = await OrganizationModel.findById(id)
                    .populate('contacts', 'firstname lastname email phone city');

                if (!organization) {
                    return res.status(404).json({ message: 'Organisation non trouvée' });
                }

                return res.json(organization);
            } catch (error) {
                console.error('Erreur lors de la récupération du détail de l\'organisation:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Créer une nouvelle organisation
        this.post('/', authenticatedOptions, async (req: any, res: any) => {
            try {
                const organization = new OrganizationModel(req.body);
                const savedOrganization = await organization.save();

                enduranceEmitter.emit(enduranceEventTypes.ORGANIZATION_CREATED, {
                    userId: req.user._id,
                    organizationId: savedOrganization._id,
                    organizationData: savedOrganization
                });

                return res.status(201).json(savedOrganization);
            } catch (error) {
                console.error('Erreur lors de la création de l\'organisation:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Modifier une organisation existante
        this.put('/:id', authenticatedOptions, async (req: any, res: any) => {
            try {
                const oldOrganization = await OrganizationModel.findById(req.params.id);
                if (!oldOrganization) {
                    return res.status(404).send('Organisation non trouvée');
                }

                const organization = await OrganizationModel.findByIdAndUpdate(
                    req.params.id,
                    req.body,
                    { new: true }
                );

                if (!organization) {
                    return res.status(404).send('Organisation non trouvée');
                }

                enduranceEmitter.emit(enduranceEventTypes.ORGANIZATION_UPDATED, {
                    userId: req.user._id,
                    organizationId: organization._id,
                    previousData: oldOrganization,
                    newData: organization
                });

                return res.json(organization);
            } catch (error) {
                console.error('Erreur lors de la mise à jour de l\'organisation:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Supprimer une organisation
        this.delete('/:id', authenticatedOptions, async (req: any, res: any) => {
            try {
                const organization = await OrganizationModel.findById(req.params.id);
                if (!organization) {
                    return res.status(404).send('Organisation non trouvée');
                }

                // Les contacts seront automatiquement retirés car la relation est unidirectionnelle

                await OrganizationModel.findByIdAndDelete(req.params.id);

                enduranceEmitter.emit(enduranceEventTypes.ORGANIZATION_DELETED, {
                    userId: req.user._id,
                    organizationId: req.params.id,
                    organizationData: organization
                });

                return res.status(204).send();
            } catch (error) {
                console.error('Erreur lors de la suppression de l\'organisation:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Ajouter un contact à une organisation
        this.post('/:id/contacts', authenticatedOptions, async (req: any, res: any) => {
            try {
                const organizationId = req.params.id;
                const contactId = req.body.contactId;

                if (!contactId) {
                    return res.status(400).json({ message: 'ID du contact requis' });
                }

                const organization = await OrganizationModel.findById(organizationId);
                const contact = await ContactModel.findById(contactId);

                if (!organization) {
                    return res.status(404).json({ message: 'Organisation non trouvée' });
                }

                if (!contact) {
                    return res.status(404).json({ message: 'Contact non trouvé' });
                }

                // Vérifier si le contact n'est pas déjà dans cette organisation
                if (organization.contacts.includes(new ObjectId(contactId))) {
                    return res.status(400).json({ message: 'Le contact est déjà dans cette organisation' });
                }

                // Ajouter le contact à l'organisation
                organization.contacts.push(new ObjectId(contactId));
                await organization.save();

                enduranceEmitter.emit(enduranceEventTypes.ORGANIZATION_CONTACT_ADDED, {
                    userId: req.user._id,
                    organizationId: organizationId,
                    contactId: contactId
                });

                return res.json({ message: 'Contact ajouté à l\'organisation avec succès' });
            } catch (error) {
                console.error('Erreur lors de l\'ajout du contact à l\'organisation:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Retirer un contact d'une organisation
        this.delete('/:id/contacts/:contactId', authenticatedOptions, async (req: any, res: any) => {
            try {
                const organizationId = req.params.id;
                const contactId = req.params.contactId;

                const organization = await OrganizationModel.findById(organizationId);
                const contact = await ContactModel.findById(contactId);

                if (!organization) {
                    return res.status(404).json({ message: 'Organisation non trouvée' });
                }

                if (!contact) {
                    return res.status(404).json({ message: 'Contact non trouvé' });
                }

                // Retirer le contact de l'organisation
                organization.contacts = organization.contacts.filter(id =>
                    id.toString() !== contactId
                );
                await organization.save();

                enduranceEmitter.emit(enduranceEventTypes.ORGANIZATION_CONTACT_REMOVED, {
                    userId: req.user._id,
                    organizationId: organizationId,
                    contactId: contactId
                });

                return res.status(204).send();
            } catch (error) {
                console.error('Erreur lors de la suppression du contact de l\'organisation:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Récupérer les statistiques des organisations
        this.get('/stats/overview', authenticatedOptions, async (req: any, res: any) => {
            try {
                const totalOrganizations = await OrganizationModel.countDocuments();
                const totalContacts = await OrganizationModel.aggregate([
                    { $unwind: '$contacts' },
                    { $count: 'total' }
                ]).then(result => result[0]?.total || 0);
                const organizationsWithContacts = await OrganizationModel.countDocuments({ contacts: { $exists: true, $ne: [] } });

                // Top 5 des secteurs d'activité
                const topIndustries = await OrganizationModel.aggregate([
                    { $match: { industry: { $exists: true, $ne: null } } },
                    { $group: { _id: '$industry', count: { $sum: 1 } } },
                    { $sort: { count: -1 } },
                    { $limit: 5 }
                ]);

                // Top 5 des villes
                const topCities = await OrganizationModel.aggregate([
                    { $match: { city: { $exists: true, $ne: null } } },
                    { $group: { _id: '$city', count: { $sum: 1 } } },
                    { $sort: { count: -1 } },
                    { $limit: 5 }
                ]);

                return res.json({
                    totalOrganizations,
                    totalContacts,
                    organizationsWithContacts,
                    topIndustries,
                    topCities
                });
            } catch (error) {
                console.error('Erreur lors de la récupération des statistiques:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });
    }
}

const router = new OrganizationAdminRouter();
export default router;
