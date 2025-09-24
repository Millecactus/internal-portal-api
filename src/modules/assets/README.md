# Module Assets - Gestion du Matériel

Ce module permet de gérer le matériel de l'entreprise et son affectation aux utilisateurs.

## Fonctionnalités

### Gestion des Assets
- **CRUD complet** : Création, lecture, mise à jour et suppression des assets
- **Filtres avancés** : Par statut, catégorie, utilisateur affecté
- **Recherche** : Par nom, description, numéro de série
- **Tri et pagination** : Tri par différents critères avec pagination
- **Statuts** : Commandé, Actif, Archivé, Incident en cours

### Affectation du Matériel
- **Affectation** : Assigner un asset à un utilisateur
- **Désaffectation** : Retirer l'affectation d'un asset
- **Historique** : Création automatique de notes lors des affectations
- **Notifications** : Événements émis lors des changements d'affectation

### Gestion des Incidents
- **Déclaration d'incident** : Un utilisateur peut déclarer un incident sur un asset
- **Changement de statut** : L'asset passe automatiquement en statut "Incident"
- **Notifications** : Événements émis pour les incidents

### Catégories
- **Gestion des catégories** : Liste des catégories existantes pour éviter les doublons
- **Tags** : Système de catégories sous forme de tags

## Modèles

### Asset
- `name` : Nom de l'asset (requis)
- `description` : Description libre (optionnel)
- `serialNumber` : Numéro de série (optionnel)
- `image` : ID de l'image (géré via edrm-storage)
- `assignedUser` : ID de l'utilisateur affecté (optionnel)
- `notes` : Liste des IDs des notes
- `status` : Statut de l'asset (Commandé, Actif, Archivé, Incident)
- `categories` : Liste des catégories (tags)
- `documents` : Liste des IDs des documents (gérés via edrm-storage)

### User
- Modèle utilisateur simplifié avec email, prénom, nom et statut actif

### Contact
- Modèle contact avec prénom, nom, email, téléphone, LinkedIn et ville

### Note
- Modèle note avec contenu, date de création et auteur

## Routes API

### Assets
- `GET /` : Lister les assets (avec filtres, tri, pagination)
  - **Filtres** : 
    - `status` : statut unique ou liste séparée par virgules (ex: "ACTIVE,ORDERED" ou "ORDERED%2CACTIVE%2CINCIDENT")
    - `category` : catégorie unique
    - `assignedUser` : all/unassigned/me/ObjectId
  - **Recherche** : `search` (nom, description, numéro de série)
  - **Tri** : `sortBy`, `sortOrder`
  - **Pagination** : `page`, `limit`
- `GET /:id` : Récupérer le détail d'un asset
- `POST /` : Créer un nouvel asset
- `PUT /:id` : Modifier un asset
- `DELETE /:id` : Supprimer un asset

### Catégories
- `GET /categories/list` : Lister toutes les catégories existantes

### Affectation
- `POST /:id/assign` : Affecter un asset à un utilisateur
- `POST /:id/unassign` : Retirer l'affectation d'un asset

### Incidents
- `POST /:id/incident` : Déclarer un incident sur un asset

### Notes
- `GET /:id/notes` : Récupérer les notes d'un asset (avec pagination)
- `POST /:id/notes` : Ajouter une note à un asset

### Utilisateurs
- `GET /users` : Lister tous les utilisateurs (avec filtres, tri, pagination)
- `GET /users/:id` : Récupérer le détail d'un utilisateur avec ses assets affectés

## Événements

Le module émet les événements suivants :
- `ASSET_CREATED` : Asset créé
- `ASSET_UPDATED` : Asset modifié
- `ASSET_DELETED` : Asset supprimé
- `ASSET_ASSIGNED` : Asset affecté à un utilisateur
- `ASSET_UNASSIGNED` : Affectation d'un asset retirée
- `ASSET_INCIDENT` : Incident déclaré sur un asset

## Utilisation

Le module est automatiquement chargé par le système endurance-core. Aucune configuration supplémentaire n'est nécessaire.

### Exemple de création d'un asset

```javascript
POST /assets
{
  "name": "MacBook Pro 16\"",
  "description": "Ordinateur portable pour développement",
  "serialNumber": "ABC123456",
  "categories": ["informatique", "portable"],
  "status": "ORDERED"
}
```

### Exemple d'affectation

```javascript
POST /assets/:id/assign
{
  "userId": "64a1b2c3d4e5f6789012345"
}
```

### Exemple de déclaration d'incident

```javascript
POST /assets/:id/incident
{
  "description": "Écran qui clignote, problème d'affichage"
}
```

### Exemple de liste des utilisateurs

```javascript
GET /assets/users?search=john&isActive=true&sortBy=lastname&sortOrder=asc&page=1&limit=10
```

### Exemple de filtrage des assets

```javascript
GET /assets?assignedUser=me&status=ACTIVE&search=macbook
// assignedUser peut être : 'all', 'unassigned', 'me', ou un ObjectId utilisateur

GET /assets?status=ACTIVE,ORDERED&category=informatique
// Filtre par plusieurs statuts : Actif ET Commandé

GET /assets?status=ACTIVE,INCIDENT&assignedUser=me
// Mes assets actifs ou en incident

GET /assets?status=ORDERED%2CACTIVE%2CINCIDENT
// Format encodé URL depuis le frontend (ORDERED,ACTIVE,INCIDENT)
```

### Exemple de détail d'un utilisateur

```javascript
GET /assets/users/64a1b2c3d4e5f6789012345
// Retourne l'utilisateur avec ses assets affectés
```
