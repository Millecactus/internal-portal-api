import { EnduranceRouter, enduranceEmitter, enduranceEventTypes, EnduranceAuthMiddleware, SecurityOptions } from '@programisto/endurance-core';
import JobApplicationModel, { ApplicationStatus, ApplicationStep } from '../models/job-application.model.js';
import JobModel from '../models/job.model.js';
import CandidateModel from '../models/candidate.model.js';
import ContactModel from '../models/contact.model.js';

class JobApplicationAdminRouter extends EnduranceRouter {
    constructor() {
        super(EnduranceAuthMiddleware.getInstance());
    }

    setupRoutes(): void {
        const authenticatedOptions: SecurityOptions = {
            requireAuth: true,
            permissions: []
        };

        // Lister toutes les candidatures avec filtres
        this.get('/', authenticatedOptions, async (req: any, res: any) => {
            try {
                const page = parseInt(req.query.page as string) || 1;
                const limit = parseInt(req.query.limit as string) || 10;
                const skip = (page - 1) * limit;
                const search = req.query.search as string || '';
                const status = req.query.status as string || 'all';
                const step = req.query.step as string || 'all';
                const sortBy = req.query.sortBy as string || 'updatedAt';
                const sortOrder = req.query.sortOrder as string || 'desc';

                const query: any = {};

                if (status !== 'all') {
                    query.status = status;
                }
                if (step !== 'all') {
                    query.step = step;
                }

                if (search) {
                    query.$or = [
                        { 'candidate.firstname': { $regex: search, $options: 'i' } },
                        { 'candidate.lastname': { $regex: search, $options: 'i' } },
                        { 'job.title': { $regex: search, $options: 'i' } }
                    ];
                }

                const sortOptions: Record<string, 1 | -1> = {
                    [sortBy]: sortOrder === 'asc' ? 1 : -1
                };

                const [applications, total] = await Promise.all([
                    JobApplicationModel.find(query)
                        .select('_id jobId candidateId status step prequalificationInfo technicalInterviewInfo managerInterviewInfo offerInfo missionInfo createdAt updatedAt')
                        .populate({
                            path: 'jobId',
                            select: 'title contractType workMode experienceLevel requiredSkills location salaryRange',
                            options: { strictPopulate: false }
                        })
                        .populate({
                            path: 'candidateId',
                            select: 'firstname lastname experienceLevel yearsOfExperience skills contact',
                            options: { strictPopulate: false }
                        })
                        .sort(sortOptions)
                        .skip(skip)
                        .limit(limit)
                        .exec(),
                    JobApplicationModel.countDocuments(query)
                ]);

                // Récupérer les contacts pour tous les candidats
                const candidateContacts = await Promise.all(
                    applications.map(async (application) => {
                        const candidate = application.candidateId as any;
                        if (candidate?.contact) {
                            const contact = await ContactModel.findById(candidate.contact)
                                .select('email phone linkedin firstname lastname currentCompany currentPosition location availability noticePeriod');
                            return {
                                applicationId: application._id,
                                contact: contact ? contact.toObject() : null
                            };
                        }
                        return {
                            applicationId: application._id,
                            contact: null
                        };
                    })
                );

                // Combiner les applications avec leurs contacts
                const applicationsWithContacts = applications.map(application => {
                    const contactInfo = candidateContacts.find(c => c.applicationId.equals(application._id));
                    const applicationObject = application.toObject();
                    console.log(applications);
                    return {
                        ...applicationObject,
                        step: applicationObject.step,
                        status: applicationObject.status,
                        candidate: {
                            ...(application.candidateId as any).toObject(),
                            contact: contactInfo?.contact || null
                        }
                    };
                });

                const totalPages = Math.ceil(total / limit);

                return res.json({
                    data: applicationsWithContacts,
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
                console.error('Erreur lors de la récupération des candidatures:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Récupérer le détail d'une candidature
        this.get('/:id', authenticatedOptions, async (req: any, res: any) => {
            try {
                const application = await JobApplicationModel.findById(req.params.id)
                    .populate({
                        path: 'jobId',
                        select: 'title contractType workMode description requiredSkills',
                        options: { strictPopulate: false }
                    })
                    .populate({
                        path: 'candidateId',
                        select: 'firstname lastname experienceLevel yearsOfExperience skills contact',
                        options: { strictPopulate: false }
                    });

                if (!application) {
                    return res.status(404).json({ message: 'Candidature non trouvée' });
                }

                // Récupérer les informations du contact
                const candidate = application.candidateId as any;
                const contact = await ContactModel.findById(candidate.contact);

                return res.json({
                    ...application.toObject(),
                    candidate: {
                        ...candidate.toObject(),
                        contact: contact ? contact.toObject() : null
                    }
                });
            } catch (error) {
                console.error('Erreur lors de la récupération du détail de la candidature:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Modifier le statut d'une candidature
        this.put('/:id/status', authenticatedOptions, async (req: any, res: any) => {
            try {
                const { status, rejectionReason } = req.body;
                if (!Object.values(ApplicationStatus).includes(status)) {
                    return res.status(400).send('Statut invalide');
                }

                const oldApplication = await JobApplicationModel.findById(req.params.id);
                if (!oldApplication) {
                    return res.status(404).send('Candidature non trouvée');
                }

                const updatedApplication = await JobApplicationModel.findByIdAndUpdate(
                    req.params.id,
                    {
                        status,
                        rejectionReason,
                        updatedAt: new Date()
                    },
                    { new: true }
                );

                if (!updatedApplication) {
                    return res.status(404).send('Candidature non trouvée');
                }

                enduranceEmitter.emit(enduranceEventTypes.APPLICATION_STATUS_UPDATED, {
                    userId: req.user._id,
                    jobId: updatedApplication.jobId,
                    applicationId: updatedApplication._id,
                    previousStatus: oldApplication.status,
                    newStatus: updatedApplication.status,
                    rejectionReason: updatedApplication.rejectionReason
                });

                return res.json(updatedApplication);
            } catch (error) {
                console.error('Erreur lors de la modification du statut de la candidature:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Modifier l'étape d'une candidature
        this.put('/:id/step', authenticatedOptions, async (req: any, res: any) => {
            try {
                const { step, ...stepData } = req.body;
                if (!Object.values(ApplicationStep).includes(step)) {
                    return res.status(400).send('Étape invalide');
                }

                const oldApplication = await JobApplicationModel.findById(req.params.id);
                if (!oldApplication) {
                    return res.status(404).send('Candidature non trouvée');
                }

                // Mise à jour des informations spécifiques à l'étape
                const updateData: any = {
                    step,
                    updatedAt: new Date()
                };

                // Ajout des données spécifiques à l'étape
                switch (step) {
                    case ApplicationStep.PREQUALIFICATION_DONE:
                        updateData.prequalificationInfo = {
                            ...oldApplication.prequalificationInfo,
                            ...stepData,
                            date: new Date()
                        };
                        break;
                    case ApplicationStep.TECHNICAL_INTERVIEW_DONE:
                        updateData.technicalInterviewInfo = {
                            ...oldApplication.technicalInterviewInfo,
                            ...stepData,
                            date: new Date()
                        };
                        break;
                    case ApplicationStep.MANAGER_INTERVIEW_DONE:
                        updateData.managerInterviewInfo = {
                            ...oldApplication.managerInterviewInfo,
                            ...stepData,
                            date: new Date()
                        };
                        break;
                    case ApplicationStep.OFFER_SENT:
                        updateData.offerInfo = {
                            ...oldApplication.offerInfo,
                            ...stepData,
                            sentDate: new Date()
                        };
                        break;
                    case ApplicationStep.OFFER_VALIDATED:
                        updateData.offerInfo = {
                            ...oldApplication.offerInfo,
                            ...stepData,
                            validationDate: new Date()
                        };
                        break;
                    case ApplicationStep.PROFILE_ON_MISSION:
                    case ApplicationStep.FREELANCE_ON_MISSION:
                        updateData.missionInfo = {
                            ...oldApplication.missionInfo,
                            ...stepData,
                            startDate: new Date()
                        };
                        break;
                }

                const updatedApplication = await JobApplicationModel.findByIdAndUpdate(
                    req.params.id,
                    updateData,
                    { new: true }
                );

                if (!updatedApplication) {
                    return res.status(404).send('Candidature non trouvée');
                }

                enduranceEmitter.emit(enduranceEventTypes.APPLICATION_STEP_UPDATED, {
                    userId: req.user._id,
                    jobId: updatedApplication.jobId,
                    applicationId: updatedApplication._id,
                    previousStep: oldApplication.step,
                    newStep: updatedApplication.step,
                    stepData
                });

                return res.json(updatedApplication);
            } catch (error) {
                console.error('Erreur lors de la modification de l\'étape de la candidature:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });
    }
}

const router = new JobApplicationAdminRouter();
export default router;
