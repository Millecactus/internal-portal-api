import { EnduranceRouter, SecurityOptions, FileUploadConfig } from '@programisto/endurance-core';
import JobModel from '../models/job.model.js';
import CandidateModel from '../models/candidate.model.js';
import ContactModel from '../models/contact.model.js';
import JobApplicationModel, { ApplicationStatus, ApplicationStep } from '../models/job-application.model.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Créer le dossier uploads s'il n'existe pas
const uploadDir = path.join(process.cwd(), 'uploads', 'applications');
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
        // Garder le nom original et ajouter le suffixe
        const nameWithoutExt = file.originalname.replace(/\.[^/.]+$/, '');
        const extension = file.originalname.split('.').pop()?.toLowerCase() || 'pdf';
        const finalName = `${nameWithoutExt} - ${uniqueSuffix}.${extension}`;
        console.log('Nom final du fichier:', finalName);
        cb(null, finalName);
    }
});

class JobPublicRouter extends EnduranceRouter {
    constructor() {
        super();
    }

    setupRoutes(): void {
        const publicOptions: SecurityOptions = {
            requireAuth: false,
            permissions: []
        };

        // Lister toutes les offres d'emploi publiées
        this.get('/', publicOptions, async (req: any, res: any) => {
            try {
                const page = parseInt(req.query.page as string) || 1;
                const limit = parseInt(req.query.limit as string) || 10;
                const skip = (page - 1) * limit;
                const search = req.query.search as string || '';
                const contractType = req.query.contractType as string || 'all';
                const workMode = req.query.workMode as string || 'all';
                const experienceLevel = req.query.experienceLevel as string || 'all';
                const sortBy = req.query.sortBy as string || 'updatedAt';
                const sortOrder = req.query.sortOrder as string || 'desc';

                // Construction de la requête de recherche
                const query: any = {
                    status: 'PUBLISHED' // Seules les offres publiées sont visibles
                };

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

                const totalPages = Math.ceil(total / limit);

                return res.json({
                    data: jobs,
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

        // Récupérer le détail d'une offre (sans les candidatures)
        this.get('/:id', publicOptions, async (req: any, res: any) => {
            try {
                const job = await JobModel.findOne({
                    _id: req.params.id,
                    status: 'PUBLISHED'
                });

                if (!job) {
                    return res.status(404).send('Offre d\'emploi non trouvée');
                }

                return res.json(job);
            } catch (error) {
                console.error('Erreur lors de la récupération du détail de l\'offre:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Route pour télécharger les documents
        this.get('/documents/:filename', publicOptions, async (req: any, res: any) => {
            try {
                const filename = req.params.filename;
                const filePath = path.join(uploadDir, filename);

                if (!fs.existsSync(filePath)) {
                    return res.status(404).send('Document non trouvé');
                }

                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
                fs.createReadStream(filePath).pipe(res);
            } catch (error) {
                console.error('Erreur lors du téléchargement du document:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Route pour postuler avec fichiers
        this.post('/:id/apply', publicOptions,
            FileUploadConfig.multiple('documents', 5, {
                allowedMimeTypes: ['application/pdf'],
                maxFileSize: 10 * 1024 * 1024, // 10MB
                storage
            }),
            async (req: any, res: any) => {
                try {
                    const job = await JobModel.findOne({
                        _id: req.params.id,
                        status: 'PUBLISHED'
                    });

                    if (!job) {
                        return res.status(404).send('Offre d\'emploi non trouvée');
                    }

                    // Créer le contact
                    const contact = new ContactModel({
                        firstname: req.body.firstname,
                        lastname: req.body.lastname,
                        email: req.body.email,
                        phone: req.body.phone,
                        linkedin: req.body.linkedin,
                        city: req.body.city
                    });
                    await contact.save();

                    // Créer le candidat
                    const candidate = new CandidateModel({
                        contact: contact._id,
                        experienceLevel: req.body.experienceLevel,
                        yearsOfExperience: req.body.yearsOfExperience,
                        skills: req.body.skills
                    });
                    await candidate.save();

                    // Préparer les documents
                    const documents = (req.files || []).map((file: Express.Multer.File) => ({
                        name: file.originalname,
                        type: file.mimetype,
                        path: file.filename,
                        uploadedAt: new Date()
                    }));
                    console.log('documents', documents);

                    // Créer la candidature avec les fichiers
                    const application = new JobApplicationModel({
                        jobId: job._id,
                        candidateId: candidate._id,
                        message: req.body.message,
                        documents: documents,
                        status: ApplicationStatus.IN_PROGRESS,
                        step: ApplicationStep.TO_CONTACT
                    });

                    console.log('Application avant sauvegarde:', application);
                    await application.save();
                    console.log('Application après sauvegarde:', application);

                    // Ajouter la candidature à l'offre
                    job.applications.push(application._id);
                    await job.save();

                    return res.status(201).json({
                        message: 'Candidature envoyée avec succès',
                        applicationId: application._id,
                        documents: documents
                    });
                } catch (error: any) {
                    console.error('Erreur lors de la candidature:', error);
                    if (error.message === 'Seuls les fichiers PDF sont acceptés') {
                        return res.status(400).send(error.message);
                    }
                    res.status(500).send('Erreur interne du serveur');
                }
            }
        );
    }
}

const router = new JobPublicRouter();
export default router; 