import { EnduranceRouter, EnduranceAuthMiddleware, type SecurityOptions } from '@programisto/endurance-core';
import UserAdmin from '../models/user-admin.model.js';
import Contact from '../models/contact.model.js';
import FileModel from '../models/file.model.js';

class UserRouter extends EnduranceRouter {
    constructor() {
        super(EnduranceAuthMiddleware.getInstance());
    }

    setupRoutes(): void {
        const securityOptions: SecurityOptions = {
            requireAuth: true,
            permissions: []
        };

        // Récupérer les informations de l'utilisateur connecté
        this.get('/profile', securityOptions, async (req: any, res: any) => {
            console.log('req.user', req.user);
            try {
                const userId = req.user._id; // ID de l'utilisateur connecté

                // Récupérer les informations de base de l'utilisateur
                const user = await UserAdmin.findById(userId);
                if (!user) {
                    return res.status(404).json({ error: 'Utilisateur non trouvé' });
                }

                // Récupérer les informations de contact basées sur l'email
                let contact = await Contact.findOne({ email: user.email });
                if (!contact) {
                    // Créer un contact vide si il n'existe pas
                    contact = new Contact({
                        email: user.email,
                        firstname: user.firstname,
                        lastname: user.lastname
                    });
                    await contact.save();
                }

                // Combiner les données
                const userProfile = {
                    // Informations de base (du modèle UserAdmin)
                    firstname: user.firstname,
                    lastname: user.lastname,
                    email: user.email, // Email professionnel (non modifiable)
                    backupEmail: user.backupEmail, // Email personnel
                    isActive: user.isActive,

                    // Informations de contact (du modèle Contact)
                    profilePhoto: contact.profilePhoto,
                    birthDate: contact.birthDate,
                    phone: contact.phone,
                    discordId: contact.discordId,
                    linkedin: contact.linkedin
                };

                return res.json(userProfile);
            } catch (error) {
                console.error('Erreur lors de la récupération du profil:', error);
                res.status(500).json({ error: 'Erreur interne du serveur' });
            }
        });

        // Modifier les informations de l'utilisateur connecté
        this.put('/profile', securityOptions, async (req: any, res: any) => {
            try {
                const userId = req.user._id; // ID de l'utilisateur connecté
                const updateData = req.body;

                // Vérifier que l'utilisateur existe
                const user = await UserAdmin.findById(userId);
                if (!user) {
                    return res.status(404).json({ error: 'Utilisateur non trouvé' });
                }

                // Mettre à jour les informations de base (seulement les champs autorisés)
                const allowedUserFields = ['firstname', 'lastname', 'backupEmail'];
                const userUpdates: any = {};

                for (const field of allowedUserFields) {
                    if (updateData[field] !== undefined) {
                        userUpdates[field] = updateData[field];
                    }
                }

                if (Object.keys(userUpdates).length > 0) {
                    await UserAdmin.findByIdAndUpdate(userId, userUpdates);
                }

                // Mettre à jour ou créer les informations de contact
                const contactUpdates: any = {};
                const allowedContactFields = [
                    'profilePhoto',
                    'birthDate',
                    'phone',
                    'discordId',
                    'linkedin'
                ];

                for (const field of allowedContactFields) {
                    if (updateData[field] !== undefined) {
                        contactUpdates[field] = updateData[field];
                    }
                }

                // Synchroniser firstname et lastname si ils ont été modifiés
                if (userUpdates.firstname !== undefined) {
                    contactUpdates.firstname = userUpdates.firstname;
                }
                if (userUpdates.lastname !== undefined) {
                    contactUpdates.lastname = userUpdates.lastname;
                }

                if (Object.keys(contactUpdates).length > 0) {
                    await Contact.findOneAndUpdate(
                        { email: user.email },
                        contactUpdates,
                        { upsert: true, new: true }
                    );
                }

                // Récupérer les données mises à jour
                const updatedUser = await UserAdmin.findById(userId);
                const updatedContact = await Contact.findOne({ email: updatedUser!.email });

                const updatedProfile = {
                    // Informations de base
                    firstname: updatedUser!.firstname,
                    lastname: updatedUser!.lastname,
                    email: updatedUser!.email, // Email professionnel (non modifiable)
                    backupEmail: updatedUser!.backupEmail, // Email personnel
                    isActive: updatedUser!.isActive,

                    // Informations de contact
                    profilePhoto: updatedContact?.profilePhoto,
                    birthDate: updatedContact?.birthDate,
                    phone: updatedContact?.phone,
                    discordId: updatedContact?.discordId,
                    linkedin: updatedContact?.linkedin
                };

                return res.json({
                    message: 'Profil mis à jour avec succès',
                    user: updatedProfile
                });
            } catch (error) {
                console.error('Erreur lors de la mise à jour du profil:', error);
                res.status(500).json({ error: 'Erreur interne du serveur' });
            }
        });

        // Récupérer les informations du fichier de la photo de profil
        this.get('/profile/photo', securityOptions, async (req: any, res: any) => {
            try {
                const userId = req.user._id; // ID de l'utilisateur connecté

                // Récupérer les informations de base de l'utilisateur
                const user = await UserAdmin.findById(userId);
                if (!user) {
                    return res.status(404).json({ error: 'Utilisateur non trouvé' });
                }

                // Récupérer les informations de contact
                const contact = await Contact.findOne({ email: user.email });

                if (!contact) {
                    return res.status(404).json({ error: 'Contact non trouvé' });
                }

                if (!contact.profilePhoto) {
                    return res.status(404).json({ error: 'Aucune photo de profil trouvée' });
                }

                // Récupérer les informations complètes du fichier
                const fileInfo = await FileModel.findById(contact.profilePhoto);

                if (!fileInfo) {
                    return res.status(404).json({ error: 'Fichier de photo de profil non trouvé' });
                }

                // Retourner les informations du fichier
                return res.json({
                    file: fileInfo,
                    user: {
                        firstname: user.firstname,
                        lastname: user.lastname,
                        email: user.email
                    }
                });
            } catch (error) {
                console.error('Erreur lors de la récupération de la photo de profil:', error);
                res.status(500).json({ error: 'Erreur interne du serveur' });
            }
        });
    }
}

const router = new UserRouter();
export default router;