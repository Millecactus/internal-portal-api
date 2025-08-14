import { EnduranceRouter, enduranceEmitter, enduranceEventTypes, EnduranceAuthMiddleware, SecurityOptions } from '@programisto/endurance-core';
import CandidateModel, { ExperienceLevel } from '../models/candidate.model.js';
import ContactModel from '../models/contact.model.js';
import NoteModel from '../models/note.model.js';
import JobApplicationModel from '../models/job-application.model.js';
import { ObjectId } from 'mongodb';
import jwt from 'jsonwebtoken';
import { config } from 'dotenv';

config();

class CandidateAdminRouter extends EnduranceRouter {
    constructor() {
        super(EnduranceAuthMiddleware.getInstance());
    }

    setupRoutes(): void {
        const authenticatedOptions: SecurityOptions = {
            requireAuth: false,
            permissions: []
        };

        // Récupérer le détail d'un candidat avec toutes ses candidatures
        this.get('/:email', authenticatedOptions, async (req: any, res: any) => {
            try {
                const email = req.params.email;
                const contact = await ContactModel.findOne({ email });

                if (!contact) {
                    return res.status(404).json({ message: 'Contact non trouvé' });
                }

                const candidate = await CandidateModel.findOne({ contact: contact._id });

                if (!candidate) {
                    return res.status(404).json({ message: 'Candidat non trouvé' });
                }

                // Récupérer les informations du contact
                let contactInfo: { firstname: string; lastname: string; email: string } | null = null;
                if (candidate && candidate.contact) {
                    const contact = await ContactModel.findById(candidate.contact);
                    contactInfo = contact ? {
                        firstname: contact.firstname,
                        lastname: contact.lastname,
                        email: contact.email
                    } : null;
                }

                // Récupérer les candidatures avec les offres d'emploi
                const applications = await JobApplicationModel.find({ candidateId: candidate._id })
                    .populate({
                        path: 'jobId',
                        select: 'title contractType workMode status',
                        options: { strictPopulate: false }
                    });

                return res.json({
                    ...candidate.toObject(),
                    contact: contactInfo,
                    applications
                });
            } catch (error) {
                console.error('Erreur lors de la récupération du détail du candidat:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Générer un lien magique pour le candidat
        this.post('/magic-link', { requireAuth: false }, async (req: any, res: any) => {
            try {
                const { email } = req.body;

                if (!email) {
                    return res.status(400).json({ message: 'Email requis' });
                }

                // Trouver le candidat par son email via le contact associé
                const contact = await ContactModel.findOne({ email });
                if (!contact) {
                    return res.status(404).json({ message: 'Candidat non trouvé' });
                }

                const candidate = await CandidateModel.findOne({ contact: contact._id });
                if (!candidate) {
                    return res.status(404).json({ message: 'Candidat non trouvé' });
                }

                // Générer le token JWT
                const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
                const token = jwt.sign(
                    {
                        email,
                        expiresAt: expiresAt.toISOString()
                    },
                    process.env.JWT_SECRET || 'your-secret-key',
                    { expiresIn: '10m' }
                );

                // Mettre à jour le candidat avec le token
                candidate.magicLinkToken = token;
                candidate.magicLinkExpiresAt = expiresAt;
                await candidate.save();

                // Envoyer l'email avec le lien magique
                const magicLink = `${process.env.CANDIDATE_MAGIC_LINK}${token}`;
                await enduranceEmitter.emit(enduranceEventTypes.SEND_EMAIL, {
                    template: 'candidate-magic-link',
                    to: email,
                    subject: 'Connexion à votre espace candidat Programisto',
                    data: {
                        magicLink
                    }
                });

                return res.json({ message: 'Lien magique envoyé avec succès' });
            } catch (error) {
                console.error('Erreur lors de la génération du lien magique:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Vérifier et consommer le token magique
        this.post('/verify-magic-link', { requireAuth: false }, async (req: any, res: any) => {
            try {
                const { token } = req.body;

                if (!token) {
                    return res.status(400).json({ message: 'Token requis' });
                }

                // Vérifier le token JWT
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as { email: string, expiresAt: string };

                // Vérifier si le token n'a pas expiré
                if (new Date(decoded.expiresAt) < new Date()) {
                    return res.status(401).json({ message: 'Token expiré' });
                }

                // Trouver le candidat avec ce token (première requête, sans populate)
                const candidate = await CandidateModel.findOne({
                    magicLinkToken: token,
                    magicLinkExpiresAt: { $gt: new Date() }
                });

                // Si le candidat existe, récupérer le contact dans une deuxième requête
                let contactInfo: { firstname: string; lastname: string; email: string } | null = null;
                if (candidate && candidate.contact) {
                    const contact = await CandidateModel.db.model('Contact').findById(candidate.contact);
                    // Extraire seulement les champs nécessaires du contact
                    contactInfo = contact ? {
                        firstname: contact.firstname,
                        lastname: contact.lastname,
                        email: contact.email
                    } : null;
                }

                if (!candidate) {
                    return res.status(401).json({ message: 'Token invalide ou déjà utilisé' });
                }

                // Consommer le token en le supprimant
                candidate.magicLinkToken = undefined;
                candidate.magicLinkExpiresAt = undefined;

                // Générer un nouveau token d'authentification valide 24h
                const authExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 heures
                const authToken = jwt.sign(
                    {
                        candidateId: candidate._id.toString(),
                        email: decoded.email,
                        type: 'candidate_auth'
                    },
                    process.env.JWT_SECRET || 'your-secret-key',
                    { expiresIn: '24h' }
                );

                // Sauvegarder le nouveau token
                candidate.authToken = authToken;
                candidate.authTokenExpiresAt = authExpiresAt;
                await candidate.save();

                // Retourner les informations du candidat avec le nouveau token
                return res.json({
                    message: 'Connexion réussie',
                    authToken,
                    candidate: {
                        id: candidate._id,
                        email: decoded.email,
                        contact: contactInfo
                    }
                });
            } catch (error) {
                if (error instanceof jwt.JsonWebTokenError) {
                    return res.status(401).json({ message: 'Token invalide' });
                }
                console.error('Erreur lors de la vérification du token:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });
    }
}

const router = new CandidateAdminRouter();
export default router;
