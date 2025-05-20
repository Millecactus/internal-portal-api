import { EnduranceRouter, enduranceEmitter, enduranceEventTypes, EnduranceAuthMiddleware, SecurityOptions } from 'endurance-core';
import JobModel, { JobStatus } from '../models/job.model.js';
import CandidateModel from '../models/candidate.model.js';
import ContactModel from '../models/contact.model.js';
import NoteModel from '../models/note.model.js';
import JobApplicationModel, { ApplicationStatus } from '../models/job-application.model.js';
import { ObjectId } from 'mongodb';

class JobAdminRouter extends EnduranceRouter {
    constructor() {
        super(EnduranceAuthMiddleware.getInstance());
    }

    setupRoutes(): void {
        const authenticatedOptions: SecurityOptions = {
            requireAuth: true,
            permissions: []
        };

        // Lister toutes les offres d'emploi avec le nombre de candidatures par statut
        this.get('/', authenticatedOptions, async (req: any, res: any) => {
            try {
                const page = parseInt(req.query.page as string) || 1;
                const limit = parseInt(req.query.limit as string) || 10;
                const skip = (page - 1) * limit;
                const search = req.query.search as string || '';
                const contractType = req.query.contractType as string || 'all';
                const workMode = req.query.workMode as string || 'all';
                const experienceLevel = req.query.experienceLevel as string || 'all';
                const status = req.query.status as string || 'all';
                const sortBy = req.query.sortBy as string || 'updatedAt';
                const sortOrder = req.query.sortOrder as string || 'desc';

                // Construction de la requête de recherche
                const query: any = {};

                // Filtres
                if (contractType !== 'all') {
                    query.contractType = contractType;
                }
                if (workMode !== 'all') {
                    query.workMode = workMode;
                }
                if (experienceLevel !== 'all') {
                    query.experienceLevel = experienceLevel;
                }
                if (status !== 'all') {
                    query.status = status;
                }

                // Recherche sur titre, description et compétences
                if (search) {
                    query.$or = [
                        { title: { $regex: search, $options: 'i' } },
                        { description: { $regex: search, $options: 'i' } },
                        { requiredSkills: { $regex: search, $options: 'i' } }
                    ];
                }

                // Construction du tri
                const sortOptions: Record<string, 1 | -1> = {
                    [sortBy]: sortOrder === 'asc' ? 1 : -1
                };

                const [jobs, total] = await Promise.all([
                    JobModel.find(query)
                        .sort(sortOptions)
                        .skip(skip)
                        .limit(limit)
                        .exec(),
                    JobModel.countDocuments(query)
                ]);

                // Récupérer le nombre de candidatures par statut pour chaque offre
                const jobsWithApplications = await Promise.all(jobs.map(async (job) => {
                    const applications = await JobApplicationModel.find({ jobId: job._id });
                    const applicationsByStatus = applications.reduce((acc, application) => {
                        acc[application.status] = (acc[application.status] || 0) + 1;
                        return acc;
                    }, {} as Record<string, number>);

                    return {
                        ...job.toObject(),
                        applicationsCount: {
                            total: applications.length,
                            ...applicationsByStatus
                        }
                    };
                }));

                const totalPages = Math.ceil(total / limit);

                return res.json({
                    data: jobsWithApplications,
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
                console.error('Erreur lors de la récupération des offres d\'emploi:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Récupérer le détail d'une offre avec toutes les candidatures
        this.get('/:id', authenticatedOptions, async (req: any, res: any) => {
            try {
                const id = req.params.id;
                const job = await JobModel.findById(id);
                if (!job) {
                    return res.status(404).json({ message: 'Offre non trouvée' });
                }

                // Récupérer les applications avec les candidats
                const applications = await JobApplicationModel.find({ jobId: id })
                    .populate({
                        path: 'candidateId',
                        select: 'experienceLevel yearsOfExperience skills contact',
                        options: { strictPopulate: false }
                    });

                // Pour chaque candidat, récupérer son contact
                const applicationsWithContacts = await Promise.all(
                    applications.map(async (application) => {
                        const candidate = application.candidateId as any;
                        const contact = await ContactModel.findById(candidate.contact);

                        return {
                            ...application.toObject(),
                            candidate: {
                                ...candidate.toObject(),
                                contact: contact ? contact.toObject() : null
                            }
                        };
                    })
                );

                return res.json({
                    ...job.toObject(),
                    applications: applicationsWithContacts
                });
            } catch (error) {
                console.error('Erreur lors de la récupération du détail de l\'offre:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Créer une nouvelle offre d'emploi
        this.post('/', authenticatedOptions, async (req: any, res: any) => {
            try {
                const job = new JobModel(req.body);
                await job.save();

                enduranceEmitter.emit(enduranceEventTypes.JOB_CREATED, {
                    userId: req.user._id,
                    jobId: job._id,
                    jobData: {
                        title: job.title,
                        contractType: job.contractType,
                        workMode: job.workMode
                    }
                });

                return res.status(201).json(job);
            } catch (error) {
                console.error('Erreur lors de la création de l\'offre d\'emploi:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Modifier une offre d'emploi existante
        this.put('/:id', authenticatedOptions, async (req: any, res: any) => {
            try {
                const oldJob = await JobModel.findById(req.params.id);
                if (!oldJob) {
                    return res.status(404).send('Offre d\'emploi non trouvée');
                }

                const job = await JobModel.findByIdAndUpdate(
                    req.params.id,
                    req.body,
                    { new: true }
                );

                if (!job) {
                    return res.status(404).send('Offre d\'emploi non trouvée');
                }

                enduranceEmitter.emit(enduranceEventTypes.JOB_UPDATED, {
                    userId: req.user._id,
                    jobId: job._id,
                    previousData: {
                        title: oldJob.title,
                        contractType: oldJob.contractType,
                        workMode: oldJob.workMode
                    },
                    newData: {
                        title: job.title,
                        contractType: job.contractType,
                        workMode: job.workMode
                    }
                });

                return res.json(job);
            } catch (error) {
                console.error('Erreur lors de la modification de l\'offre d\'emploi:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Modifier le statut d'une offre
        this.put('/:id/status', authenticatedOptions, async (req: any, res: any) => {
            try {
                const { status } = req.body;
                if (!Object.values(JobStatus).includes(status)) {
                    return res.status(400).send('Statut invalide');
                }

                const oldJob = await JobModel.findById(req.params.id);
                if (!oldJob) {
                    return res.status(404).send('Offre d\'emploi non trouvée');
                }

                const job = await JobModel.findByIdAndUpdate(
                    req.params.id,
                    { status },
                    { new: true }
                );

                if (!job) {
                    return res.status(404).send('Offre d\'emploi non trouvée');
                }

                enduranceEmitter.emit(enduranceEventTypes.JOB_STATUS_UPDATED, {
                    userId: req.user._id,
                    jobId: job._id,
                    previousStatus: oldJob.status,
                    newStatus: job.status
                });

                return res.json(job);
            } catch (error) {
                console.error('Erreur lors de la modification du statut de l\'offre:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Modifier le statut d'une candidature
        this.put('/:jobId/applications/:applicationId/status', authenticatedOptions, async (req: any, res: any) => {
            try {
                const { status, rejectionReason } = req.body;
                if (!Object.values(ApplicationStatus).includes(status)) {
                    return res.status(400).send('Statut invalide');
                }

                const oldApplication = await JobApplicationModel.findOne({
                    _id: req.params.applicationId,
                    jobId: req.params.jobId
                });
                if (!oldApplication) {
                    return res.status(404).send('Candidature non trouvée');
                }

                const application = await JobApplicationModel.findByIdAndUpdate(
                    req.params.applicationId,
                    {
                        status,
                        rejectionReason,
                        updatedAt: new Date()
                    },
                    { new: true }
                );

                if (!application) {
                    return res.status(404).send('Candidature non trouvée');
                }

                enduranceEmitter.emit(enduranceEventTypes.APPLICATION_STATUS_UPDATED, {
                    userId: req.user._id,
                    jobId: application.jobId,
                    applicationId: application._id,
                    previousStatus: oldApplication.status,
                    newStatus: application.status,
                    rejectionReason: application.rejectionReason
                });

                return res.json(application);
            } catch (error) {
                console.error('Erreur lors de la modification du statut de la candidature:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Supprimer une offre d'emploi
        this.delete('/:id', authenticatedOptions, async (req: any, res: any) => {
            try {
                const job = await JobModel.findByIdAndDelete(req.params.id);
                if (!job) {
                    return res.status(404).send('Offre d\'emploi non trouvée');
                }

                enduranceEmitter.emit(enduranceEventTypes.JOB_DELETED, {
                    userId: req.user._id,
                    jobId: job._id
                });

                return res.status(204).send();
            } catch (error) {
                console.error('Erreur lors de la suppression de l\'offre d\'emploi:', error);
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

const router = new JobAdminRouter();
export default router;
