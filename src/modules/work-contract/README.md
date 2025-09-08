# Module Work Contract

Ce module gère les contrats de travail des employés avec toutes les fonctionnalités requises.

## Fonctionnalités

### Modèles

#### User
- **firstname** : Prénom de l'utilisateur
- **lastname** : Nom de l'utilisateur  
- **workContracts** : Liste des contrats de travail (références)
- **isActive** : Statut actif de l'utilisateur

#### WorkContract
- **user** : Référence vers l'utilisateur
- **contractType** : Type de contrat (CDI, CDD, Contrat d'apprentissage, Contrat pro, Stage, Freelance)
- **startDate** : Date de début du contrat
- **endDate** : Date de fin du contrat (optionnelle)
- **isActive** : Statut actif du contrat
- **annualCost** : Coût total employeur annuel (salaire + charges)
- **monthlyCost** : Coût mensuel
- **dailyCost** : Coût journalier
- **annualSalary** : Salaire brut annuel (optionnel, principalement pour CDI/CDD)
- **annualSalaryToDailyCostCoefficient** : Coefficient pour calculer le CJM à partir du salaire annuel (défaut: 0.0078)
- **weeklyHours** : Nombre d'heures hebdomadaires (35h, 37.5h, Forfait jours)
- **hasRTT** : Droit aux RTT (calculé automatiquement si > 35h ou forfait jours)
- **documents** : Liste des documents associés (contrat, annexes RGPD, etc.)
- **notes** : Notes optionnelles

### Types de contrats disponibles
- CDI
- CDD
- Contrat d'apprentissage
- Contrat pro
- Stage
- Freelance

### Types de temps de travail
- 35h
- 37.5h
- Forfait jours

## Routes API

### Routes d'administration (`/work-contract-admin`)

#### Utilisateurs
- `GET /users` - Lister tous les utilisateurs avec leurs contrats
- `GET /users/:id` - Détail d'un utilisateur avec ses contrats
- `POST /users` - Créer un nouvel utilisateur
- `PUT /users/:id` - Modifier un utilisateur
- `GET /users/:id/contracts` - Récupérer les contrats d'un utilisateur

#### Contrats
- `GET /contracts` - Lister tous les contrats avec filtres
- `GET /contracts/:id` - Détail d'un contrat
- `POST /contracts` - Créer un nouveau contrat
- `POST /contracts/:id/close` - Clôturer un contrat (créer un avenant)
- `DELETE /contracts/:id` - Supprimer un contrat (seulement s'il n'est pas actif)

#### Documents
- `POST /contracts/:id/documents` - Uploader un document pour un contrat
- `GET /contracts/:id/documents` - Lister les documents d'un contrat
- `GET /contracts/:id/documents/:documentId` - Télécharger un document spécifique
- `DELETE /contracts/:id/documents/:documentId` - Supprimer un document spécifique

#### Options et calculs
- `GET /options` - Récupérer les types de contrats et temps de travail disponibles
- `POST /calculate-cjm` - Calculer le CJM à partir du salaire annuel

### Routes utilisateur (`/work-contract`)

- `GET /me` - Informations de l'utilisateur connecté
- `GET /me/current-contract` - Contrat actuel de l'utilisateur
- `GET /me/contracts` - Historique des contrats de l'utilisateur
- `GET /options` - Options disponibles

## Règles métier

### Contrats actifs
- Un utilisateur ne peut avoir qu'un seul contrat actif à un instant T
- La validation est automatique via un middleware pre-save
- Un contrat est considéré comme actif s'il a `isActive: true` et que la date actuelle est entre `startDate` et `endDate` (si définie)

### RTT
- Les RTT sont automatiquement calculées :
  - Si `weeklyHours` = "37.5h" → `hasRTT: true`
  - Si `weeklyHours` = "Forfait jours" → `hasRTT: true`
  - Si `weeklyHours` = "35h" → `hasRTT: false`

### Gestion des contrats
- **Impossible de modifier un contrat** : Pour respecter les obligations légales, on ne peut pas modifier un contrat existant
- **Clôture et avenant** : Pour "modifier" un contrat, on clôture l'ancien et on crée un nouveau
- **Suppression** : Un contrat ne peut être supprimé que s'il n'est pas actif

### Documents
- Support des formats : PDF, JPEG, PNG
- Taille maximale : 10MB
- Stockage local dans `/uploads/contracts/`
- Chaque contrat peut avoir un document associé

## Événements émis

Le module émet les événements suivants via `enduranceEmitter` :

- `USER_CREATED` - Utilisateur créé
- `USER_UPDATED` - Utilisateur modifié
- `CONTRACT_CREATED` - Contrat créé
- `CONTRACT_CLOSED` - Contrat clôturé
- `CONTRACT_DELETED` - Contrat supprimé
- `CONTRACT_DOCUMENT_UPLOADED` - Document uploadé
- `CONTRACT_DOCUMENT_DELETED` - Document supprimé

## Exemples d'utilisation

### Créer un utilisateur
```json
POST /work-contract-admin/users
{
  "firstname": "Jean",
  "lastname": "Dupont"
}
```

### Créer un contrat
```json
POST /work-contract-admin/contracts
{
  "user": "64f1a2b3c4d5e6f7g8h9i0j1",
  "contractType": "CDI",
  "startDate": "2024-01-01T00:00:00.000Z",
  "annualCost": 70000,
  "monthlyCost": 5833.33,
  "dailyCost": 268.35,
  "annualSalary": 50000,
  "annualSalaryToDailyCostCoefficient": 0.0078,
  "weeklyHours": "37.5h"
}
```

### Calculer le CJM
```json
POST /work-contract-admin/calculate-cjm
{
  "annualSalary": 50000,
  "annualSalaryToDailyCostCoefficient": 0.0078
}
```

Réponse :
```json
{
  "annualSalary": 50000,
  "annualSalaryToDailyCostCoefficient": 0.0078,
  "cjm": 390,
  "calculatedCosts": {
    "monthlyCost": 4166.67,
    "dailyCost": 229.36,
    "estimatedAnnualCost": 70000
  }
}
```

### Clôturer un contrat et créer un avenant
```json
POST /work-contract-admin/contracts/64f1a2b3c4d5e6f7g8h9i0j1/close
{
  "endDate": "2024-06-30T23:59:59.999Z",
  "newContract": {
    "contractType": "CDI",
    "startDate": "2024-07-01T00:00:00.000Z",
    "annualCost": 55000,
    "monthlyCost": 4583.33,
    "dailyCost": 211.54,
    "weeklyHours": "37.5h"
  }
}
```
