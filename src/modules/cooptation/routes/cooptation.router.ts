import { EnduranceRouter, enduranceEmitter, enduranceEventTypes, EnduranceAuthMiddleware, SecurityOptions } from 'endurance-core';
import Cooptation from '../models/cooptation.model.js';

class CooptationRouter extends EnduranceRouter {
    constructor() {
        super(EnduranceAuthMiddleware.getInstance());
    }

    setupRoutes(): void {
        const authenticatedOptions: SecurityOptions = {
            requireAuth: true,
            permissions: []
        };

        // Lister les cooptations de l'utilisateur connecté
        this.get('/', authenticatedOptions, async (req: any, res: any) => {
            try {
                const cooptations = await Cooptation.find({ cooptationUserId: req.user._id })
                    .sort({ updatedAt: -1 })
                    .exec();
                res.json(cooptations);
            } catch (error) {
                console.error('Erreur lors de la récupération des cooptations:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Créer une nouvelle cooptation
        this.post('/', authenticatedOptions, async (req: any, res: any) => {
            try {
                const cooptation = new Cooptation({
                    ...req.body,
                    cooptationUserId: req.user._id
                });
                await cooptation.save();

                // Émettre un événement pour la création d'une cooptation
                enduranceEmitter.emit(enduranceEventTypes.COOPTATION_CREATED, {
                    userId: req.user._id,
                    cooptationId: cooptation._id,
                    cooptationData: {
                        lastname: cooptation.lastname,
                        firstname: cooptation.firstname,
                        email: cooptation.email
                    }
                });

                enduranceEmitter.emit(enduranceEventTypes.SEND_EMAIL, {
                    template: 'cooptation',
                    to: 'sourcing@programisto.fr',
                    subject: 'Nouvelle cooptation - My Programisto',
                    data: {
                        user_name: req.user.firstname + ' ' + req.user.lastname,
                        cooptation_name: cooptation.firstname + ' ' + cooptation.lastname,
                        cooptation_email: cooptation.email,
                        cooptation_phone: cooptation.phone,
                        cooptation_linkedin: cooptation.linkedinUrl,
                        cooptation_note: cooptation.note
                    }
                });

                // Envoyer un message à Discord pour notifier de la nouvelle cooptation
                /*const discordWebhooks = process.env.COOPTATION_DISCORD_WEBHOOKS;

                if (discordWebhooks) {
                    const discordWebhooksArray = discordWebhooks.split(";");

                    const message = `🎉 **Nouvelle cooptation !**\n- **Coopteur:** ${req.user.firstname} ${req.user.lastname}\n- **Candidat:** ${cooptation.firstname} ${cooptation.lastname}\n- **Email:** ${cooptation.email}\n- **Téléphone:** ${cooptation.phone}\n- **LinkedIn:** ${cooptation.linkedinUrl}\n- **Note:** ${cooptation.note}`;

                    for (const webhook of discordWebhooksArray) {
                        try {
                            await fetch(webhook, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({ content: message }),
                            });
                        } catch (error) {
                            console.error('Erreur lors de l\'envoi du message à Discord:', error);
                        }
                    }
                }*/

                const pipedriveWebhooks = process.env.COOPTATION_PIPEDRIVE_WEBHOOKS;

                if (pipedriveWebhooks) {
                    const pipedriveWebhooksArray = pipedriveWebhooks.split(";");

                    for (const webhook of pipedriveWebhooksArray) {
                        try {
                            console.log(webhook);
                            const any = await fetch(webhook, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'User-Agent': 'my.programisto.fr'
                                },
                                body: JSON.stringify({
                                    "cooptation-firstname": cooptation.firstname,
                                    "cooptation-lastname": cooptation.lastname,
                                    "cooptation-email": cooptation.email,
                                    "cooptation-tel": cooptation.phone,
                                    "your-linkedin-url": cooptation.linkedinUrl,
                                    "your-message": cooptation.note,
                                    "programisto-email": req.user.email
                                }),
                            });
                            const result = await any.json();
                            console.log('Résultat de l\'envoi à Pipedrive:', result);
                        } catch (error) {
                            console.error('Erreur lors de l\'envoi du message à N8N:', error);
                        }
                    }
                }

                res.status(201).json(cooptation);
            } catch (error) {
                console.error('Erreur lors de la création de la cooptation:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Modifier une cooptation existante
        this.put('/:id', authenticatedOptions, async (req: any, res: any) => {
            try {
                const cooptation = await Cooptation.findOne({
                    _id: req.params.id,
                    cooptationUserId: req.user._id
                }).exec();

                if (!cooptation) {
                    return res.status(404).send('Cooptation non trouvée');
                }

                // Sauvegarder les données avant modification pour l'événement
                const previousData = {
                    lastname: cooptation.lastname,
                    firstname: cooptation.firstname,
                    email: cooptation.email
                };

                Object.assign(cooptation, req.body);
                await cooptation.save();

                // Émettre un événement pour la modification d'une cooptation
                enduranceEmitter.emit(enduranceEventTypes.COOPTATION_UPDATED, {
                    userId: req.user._id,
                    cooptationId: cooptation._id,
                    previousData: previousData,
                    newData: {
                        lastname: cooptation.lastname,
                        firstname: cooptation.firstname,
                        email: cooptation.email
                    }
                });

                res.json(cooptation);
            } catch (error) {
                console.error('Erreur lors de la modification de la cooptation:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });

        // Supprimer une cooptation
        this.delete('/:id', authenticatedOptions, async (req: any, res: any) => {
            try {
                const cooptation = await Cooptation.findOneAndDelete({
                    _id: req.params.id,
                    cooptationUserId: req.user._id
                }).exec();

                if (!cooptation) {
                    return res.status(404).send('Cooptation non trouvée');
                }

                res.status(204).send();
            } catch (error) {
                console.error('Erreur lors de la suppression de la cooptation:', error);
                res.status(500).send('Erreur interne du serveur');
            }
        });
    }
}

const router = new CooptationRouter();
export default router;
