import { EnduranceRouter, enduranceEmitter, enduranceEventTypes, EnduranceAuthMiddleware, SecurityOptions } from '@programisto/endurance-core';
import CandidateModel, { ExperienceLevel } from '../models/candidate.model.js';
import ContactModel from '../models/contact.model.js';
import NoteModel from '../models/note.model.js';
import JobApplicationModel from '../models/job-application.model.js';
import { ObjectId } from 'mongodb';

class CandidateAdminRouter extends EnduranceRouter {
    constructor() {
        super(EnduranceAuthMiddleware.getInstance());
    }

    setupRoutes(): void {
        const authenticatedOptions: SecurityOptions = {
            requireAuth: true,
            permissions: []
        };

        // Lister tous les candidats avec leurs informations de contact
        this.get('/', authenticatedOptions, async (req: any, res: any) => {
            try {
                const page = parseInt(req.query.page as string) || 1;
                const limit = parseInt(req.query.limit as string) || 10;
                const skip = (page - 1) * limit;
                const search = req.query.search as string || '';
                const experienceLevel = req.query.experienceLevel as string || 'all';
                const city = req.query.city as string || 'all';
                const sortBy = req.query.sortBy as string || 'updatedAt';
                const sortOrder = req.query.sortOrder as string || 'desc';

                // Construction de la requête de recherche
                const query: any = {};

                // Filtres
                if (experienceLevel !== 'all') {
                    query.experienceLevel = experienceLevel;
                }
                if (city !== 'all') {
                    query['contact.city'] = city;
                }

                // Recherche sur compétences, nom, prénom et email
                if (search) {
                    // Diviser la recherche en mots-clés
                    const keywords = search.split(/\s+/).filter(Boolean);

                    // Créer des expressions régulières pour chaque mot-clé
                    const regexPatterns = keywords.map(keyword =>
                        new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
                    );

                    query.$or = [
                        // Recherche sur les compétences avec correspondance partielle
                        { skills: { $all: regexPatterns } },
                        { 'contact.firstname': { $regex: search, $options: 'i' } },
                        { 'contact.lastname': { $regex: search, $options: 'i' } },
                        { 'contact.email': { $regex: search, $options: 'i' } }
                    ];
                }

                // Construction du tri
                const sortOptions: Record<string, 1 | -1> = {
                    [sortBy]: sortOrder === 'asc' ? 1 : -1
                };

                const [candidates, total] = await Promise.all([
                    CandidateModel.find(query)
                        .sort(sortOptions)
                        .skip(skip)
                        .limit(limit)
                        .exec(),
                    CandidateModel.countDocuments(query)
                ]);

                // Récupérer tous les contacts associés aux candidats
                const contactIds = candidates.map(candidate => candidate.contact).filter(Boolean);
                const contacts = await ContactModel.find({ _id: { $in: contactIds } });
                const contactsMap = contacts.reduce((acc, contact) => {
                    acc[contact._id.toString()] = contact.toObject();
                    return acc;
                }, {} as Record<string, any>);

                // Récupérer le nombre de candidatures par statut pour chaque candidat
                const candidatesWithApplications = await Promise.all(candidates.map(async (candidate) => {
                    const applications = await JobApplicationModel.find({ candidateId: candidate._id });
                    const applicationsByStatus = applications.reduce((acc, application) => {
                        acc[application.status] = (acc[application.status] || 0) + 1;
                        return acc;
                    }, {} as Record<string, number>);

                    const candidateObj = candidate.toObject();
                    const contactId = candidate.contact?.toString();
                    const contact = contactId ? contactsMap[contactId] : null;

                    return {
                        ...candidateObj,
                        contact: contact ? {
                            _id: contact._id,
                            firstname: contact.firstname,
                            lastname: contact.lastname,
                            email: contact.email,
                            phone: contact.phone,
                            linkedin: contact.linkedin,
                            city: contact.city
                        } : null,
                        applicationsCount: {
                            total: applications.length,
                            ...applicationsByStatus
                        }
                    };
                }));

                const totalPages = Math.ceil(total / limit);

                return res.json({
                    data: candidatesWithApplications,
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
                console.error('Erreur lors de la récupération des candidats:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Récupérer le détail d'un candidat avec toutes ses candidatures
        this.get('/:id', authenticatedOptions, async (req: any, res: any) => {
            try {
                const id = req.params.id;
                const candidate = await CandidateModel.findById(id)
                    .populate({
                        path: 'contact',
                        select: 'firstname lastname email phone linkedin city notes',
                        options: { strictPopulate: false }
                    });

                if (!candidate) {
                    return res.status(404).json({ message: 'Candidat non trouvé' });
                }

                // Récupérer les candidatures avec les offres d'emploi
                const applications = await JobApplicationModel.find({ candidateId: id })
                    .populate({
                        path: 'jobId',
                        select: 'title contractType workMode status',
                        options: { strictPopulate: false }
                    });

                return res.json({
                    ...candidate.toObject(),
                    applications
                });
            } catch (error) {
                console.error('Erreur lors de la récupération du détail du candidat:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Créer un nouveau candidat
        this.post('/', authenticatedOptions, async (req: any, res: any) => {
            try {
                // Créer d'abord le contact
                const contact = new ContactModel(req.body.contact);
                await contact.save();

                // Créer le candidat avec la référence au contact
                const candidate = new CandidateModel({
                    ...req.body,
                    contact: contact._id
                });
                await candidate.save();

                enduranceEmitter.emit(enduranceEventTypes.CANDIDATE_CREATED, {
                    userId: req.user._id,
                    candidateId: candidate._id,
                    candidateData: {
                        experienceLevel: candidate.experienceLevel,
                        yearsOfExperience: candidate.yearsOfExperience
                    }
                });

                return res.status(201).json(candidate);
            } catch (error) {
                console.error('Erreur lors de la création du candidat:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Modifier un candidat existant
        this.put('/:id', authenticatedOptions, async (req: any, res: any) => {
            try {
                const oldCandidate = await CandidateModel.findById(req.params.id);
                if (!oldCandidate) {
                    return res.status(404).send('Candidat non trouvé');
                }

                // Mettre à jour le contact
                await ContactModel.findByIdAndUpdate(
                    oldCandidate.contact,
                    req.body.contact,
                    { new: true }
                );

                // Mettre à jour le candidat
                const candidate = await CandidateModel.findByIdAndUpdate(
                    req.params.id,
                    req.body,
                    { new: true }
                );

                if (!candidate) {
                    return res.status(404).send('Candidat non trouvé');
                }

                enduranceEmitter.emit(enduranceEventTypes.CANDIDATE_UPDATED, {
                    userId: req.user._id,
                    candidateId: candidate._id,
                    previousData: {
                        experienceLevel: oldCandidate.experienceLevel,
                        yearsOfExperience: oldCandidate.yearsOfExperience
                    },
                    newData: {
                        experienceLevel: candidate.experienceLevel,
                        yearsOfExperience: candidate.yearsOfExperience
                    }
                });

                return res.json(candidate);
            } catch (error) {
                console.error('Erreur lors de la modification du candidat:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Supprimer un candidat
        this.delete('/:id', authenticatedOptions, async (req: any, res: any) => {
            try {
                const candidate = await CandidateModel.findById(req.params.id);
                if (!candidate) {
                    return res.status(404).send('Candidat non trouvé');
                }

                // Supprimer le contact associé
                await ContactModel.findByIdAndDelete(candidate.contact);

                // Supprimer le candidat
                await CandidateModel.findByIdAndDelete(req.params.id);

                enduranceEmitter.emit(enduranceEventTypes.CANDIDATE_DELETED, {
                    userId: req.user._id,
                    candidateId: candidate._id
                });

                return res.status(204).send();
            } catch (error) {
                console.error('Erreur lors de la suppression du candidat:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Récupérer les notes d'un contact
        this.get('/contacts/:contactId/notes', authenticatedOptions, async (req: any, res: any) => {
            try {
                const { contactId } = req.params;
                const page = parseInt(req.query.page as string) || 1;
                const limit = parseInt(req.query.limit as string) || 10;
                const skip = (page - 1) * limit;

                const contact = await ContactModel.findById(contactId);
                if (!contact) {
                    return res.status(404).json({ message: 'Contact non trouvé' });
                }

                const [notes, total] = await Promise.all([
                    NoteModel.find({ _id: { $in: contact.notes } })
                        .sort({ createdAt: -1 })
                        .skip(skip)
                        .limit(limit)
                        .populate({
                            path: 'createdBy',
                            select: 'firstname lastname',
                            options: { strictPopulate: false }
                        }),
                    NoteModel.countDocuments({ _id: { $in: contact.notes } })
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
                res.status(500).send('Erreur interne du serveur');
            }
        });
    }
}

const router = new CandidateAdminRouter();
export default router;
