import { EnduranceRouter, enduranceEmitter, enduranceEventTypes, EnduranceAuthMiddleware, SecurityOptions } from '@programisto/endurance-core';
import ContactModel from '../models/contact.model.js';
import NoteModel from '../../jobs/models/note.model.js';
import CandidateModel from '../models/candidate.model.js';
import JobApplicationModel from '../models/job-application.model.js';
import JobModel from '../models/job.model.js';
import { ObjectId } from 'mongodb';

class ContactAdminRouter extends EnduranceRouter {
    constructor() {
        super(EnduranceAuthMiddleware.getInstance());
    }

    setupRoutes(): void {
        const authenticatedOptions: SecurityOptions = {
            requireAuth: true,
            permissions: []
        };

        // Lister tous les contacts
        this.get('/', authenticatedOptions, async (req: any, res: any) => {
            try {
                const page = parseInt(req.query.page as string) || 1;
                const limit = parseInt(req.query.limit as string) || 10;
                const skip = (page - 1) * limit;
                const search = req.query.search as string || '';
                const city = req.query.city as string || 'all';
                const sortBy = req.query.sortBy as string || 'updatedAt';
                const sortOrder = req.query.sortOrder as string || 'desc';

                // Construction de la requête de recherche
                const query: any = {};

                // Filtres
                if (city !== 'all') {
                    query.city = city;
                }

                // Recherche sur nom, prénom, email et ville
                if (search) {
                    // Diviser la recherche en mots-clés
                    const keywords = search.split(/\s+/).filter(Boolean);

                    // Créer des expressions régulières pour chaque mot-clé
                    const regexPatterns = keywords.map(keyword =>
                        new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
                    );

                    query.$or = [
                        { firstname: { $in: regexPatterns } },
                        { lastname: { $in: regexPatterns } },
                        { email: { $in: regexPatterns } },
                        { city: { $in: regexPatterns } }
                    ];
                }

                // Construction du tri
                const sortOptions: Record<string, 1 | -1> = {
                    [sortBy]: sortOrder === 'asc' ? 1 : -1
                };

                const [contacts, total] = await Promise.all([
                    ContactModel.find(query)
                        .sort(sortOptions)
                        .skip(skip)
                        .limit(limit)
                        .exec(),
                    ContactModel.countDocuments(query)
                ]);

                const totalPages = Math.ceil(total / limit);

                return res.json({
                    data: contacts,
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
                console.error('Erreur lors de la récupération des contacts:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Récupérer le détail d'un contact
        this.get('/:id', authenticatedOptions, async (req: any, res: any) => {
            try {
                const id = req.params.id;
                const contact = await ContactModel.findById(id);

                if (!contact) {
                    return res.status(404).json({ message: 'Contact non trouvé' });
                }

                // Récupérer les notes avec les informations de l'auteur
                const [notes, total] = await Promise.all([
                    NoteModel.find({ _id: { $in: contact.notes } })
                        .sort({ createdAt: -1 })
                        .populate({
                            path: 'createdBy',
                            select: 'firstname lastname',
                            options: { strictPopulate: false }
                        }),
                    NoteModel.countDocuments({ _id: { $in: contact.notes } })
                ]);

                // Vérifier si le contact a un profil candidat
                const candidate = await CandidateModel.findOne({ contact: id });

                let candidateData: any = null;
                if (candidate) {
                    // Récupérer les candidatures avec les offres d'emploi associées
                    const applications = await JobApplicationModel.find({ candidateId: candidate._id })
                        .populate({
                            path: 'jobId',
                            select: 'title contractType workMode status',
                            options: { strictPopulate: false }
                        });

                    candidateData = {
                        ...candidate.toObject(),
                        applications: applications.map(application => {
                            const applicationObject = application.toObject();
                            const job = application.jobId as any;
                            return {
                                ...applicationObject,
                                job: job ? {
                                    title: job.title,
                                    contractType: job.contractType,
                                    workMode: job.workMode,
                                    status: job.status
                                } : null
                            };
                        })
                    };
                }

                const contactWithData = {
                    ...contact.toObject(),
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
                    }),
                    candidate: candidateData
                };

                return res.json(contactWithData);
            } catch (error) {
                console.error('Erreur lors de la récupération du détail du contact:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Modifier un candidat existant
        this.put('/candidate/:id', authenticatedOptions, async (req: any, res: any) => {
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

        // Créer un nouveau contact
        this.post('/', authenticatedOptions, async (req: any, res: any) => {
            try {
                const contact = new ContactModel(req.body);
                await contact.save();

                enduranceEmitter.emit(enduranceEventTypes.CONTACT_CREATED, {
                    userId: req.user._id,
                    contactId: contact._id,
                    contactData: {
                        firstname: contact.firstname,
                        lastname: contact.lastname,
                        email: contact.email
                    }
                });

                return res.status(201).json(contact);
            } catch (error) {
                console.error('Erreur lors de la création du contact:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Modifier un contact existant
        this.put('/:id', authenticatedOptions, async (req: any, res: any) => {
            try {
                const oldContact = await ContactModel.findById(req.params.id);
                if (!oldContact) {
                    return res.status(404).send('Contact non trouvé');
                }

                const contact = await ContactModel.findByIdAndUpdate(
                    req.params.id,
                    req.body,
                    { new: true }
                );

                if (!contact) {
                    return res.status(404).send('Contact non trouvé');
                }

                enduranceEmitter.emit(enduranceEventTypes.CONTACT_UPDATED, {
                    userId: req.user._id,
                    contactId: contact._id,
                    previousData: {
                        firstname: oldContact.firstname,
                        lastname: oldContact.lastname,
                        email: oldContact.email
                    },
                    newData: {
                        firstname: contact.firstname,
                        lastname: contact.lastname,
                        email: contact.email
                    }
                });

                return res.json(contact);
            } catch (error) {
                console.error('Erreur lors de la modification du contact:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Supprimer un contact
        this.delete('/:id', authenticatedOptions, async (req: any, res: any) => {
            try {
                const contact = await ContactModel.findByIdAndDelete(req.params.id);
                if (!contact) {
                    return res.status(404).send('Contact non trouvé');
                }

                enduranceEmitter.emit(enduranceEventTypes.CONTACT_DELETED, {
                    userId: req.user._id,
                    contactId: contact._id
                });

                return res.status(204).send();
            } catch (error) {
                console.error('Erreur lors de la suppression du contact:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Récupérer les notes d'un contact
        this.get('/:id/notes', authenticatedOptions, async (req: any, res: any) => {
            try {
                const { id } = req.params;
                const page = parseInt(req.query.page as string) || 1;
                const limit = parseInt(req.query.limit as string) || 10;
                const skip = (page - 1) * limit;

                const contact = await ContactModel.findById(id);
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

        // Ajouter une note à un contact
        this.post('/:id/notes', authenticatedOptions, async (req: any, res: any) => {
            try {
                const contact = await ContactModel.findById(req.params.id);
                if (!contact) {
                    return res.status(404).json({ message: 'Contact non trouvé' });
                }

                // Créer la nouvelle note
                const note = new NoteModel({
                    content: req.body.content,
                    createdBy: req.user._id
                });
                await note.save();

                // Ajouter la note au contact
                contact.notes.push(note._id);
                await contact.save();

                // Récupérer la note avec les informations de l'auteur
                const populatedNote = await NoteModel.findById(note._id)
                    .populate({
                        path: 'createdBy',
                        select: 'firstname lastname',
                        options: { strictPopulate: false }
                    });

                if (!populatedNote) {
                    return res.status(500).send('Erreur lors de la récupération de la note');
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
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Modifier une note d'un contact
        this.put('/:id/notes/:noteId', authenticatedOptions, async (req: any, res: any) => {
            try {
                const contact = await ContactModel.findById(req.params.id);
                if (!contact) {
                    return res.status(404).json({ message: 'Contact non trouvé' });
                }

                // Vérifier que la note appartient bien au contact
                if (!contact.notes.includes(new ObjectId(req.params.noteId))) {
                    return res.status(404).json({ message: 'Note non trouvée pour ce contact' });
                }

                // Mettre à jour la note
                const note = await NoteModel.findByIdAndUpdate(
                    req.params.noteId,
                    { content: req.body.content },
                    { new: true }
                ).populate({
                    path: 'createdBy',
                    select: 'firstname lastname',
                    options: { strictPopulate: false }
                });

                if (!note) {
                    return res.status(404).json({ message: 'Note non trouvée' });
                }

                const noteObject = note.toObject();
                const createdBy = note.createdBy as any;

                return res.json({
                    ...noteObject,
                    createdBy: {
                        firstname: createdBy.firstname,
                        lastname: createdBy.lastname
                    }
                });
            } catch (error) {
                console.error('Erreur lors de la modification de la note:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Supprimer une note d'un contact
        this.delete('/:id/notes/:noteId', authenticatedOptions, async (req: any, res: any) => {
            try {
                const contact = await ContactModel.findById(req.params.id);
                if (!contact) {
                    return res.status(404).json({ message: 'Contact non trouvé' });
                }

                // Vérifier que la note appartient bien au contact
                if (!contact.notes.includes(new ObjectId(req.params.noteId))) {
                    return res.status(404).json({ message: 'Note non trouvée pour ce contact' });
                }

                // Supprimer la note
                await NoteModel.findByIdAndDelete(req.params.noteId);

                // Retirer la note du contact
                contact.notes = contact.notes.filter(noteId =>
                    noteId.toString() !== req.params.noteId
                );
                await contact.save();

                return res.status(204).send();
            } catch (error) {
                console.error('Erreur lors de la suppression de la note:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });
    }
}

const router = new ContactAdminRouter();
export default router;
