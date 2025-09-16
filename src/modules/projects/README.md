# Module Projets

Ce module gère la gestion complète des projets, des tâches associées et des utilisateurs assignés.

## Modèles

### Project
Modèle principal pour les projets avec les champs suivants :
- `title` : Titre du projet (requis)
- `description` : Description du projet (requis)
- `startDate` : Date de début (requis)
- `endDate` : Date de fin (optionnel)
- `accountManager` : Référence vers l'account manager (UserAdmin)
- `client` : Référence vers l'organisation cliente (Organization)
- `clientSponsor` : Référence vers le sponsor client (Contact)
- `categories` : Tableau de catégories
- `tags` : Tableau de tags
- `notes` : Références vers les notes
- `pnl` : PnL ou équipe financière
- `team` : Équipe du projet
- `billingType` : Type de facturation ('TIME_AND_MATERIALS' ou 'FIXED_PRICE')
- `fixedPrice` : Prix fixe si applicable
- `assignedUsers` : Utilisateurs assignés au projet
- `tasks` : Tâches du projet
- `status` : Statut du projet ('PLANNING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED')
- `progress` : Pourcentage de progression (0-100)
- `budget` : Budget du projet
- `isActive` : Projet actif ou non

### ProjectUser
Gestion des utilisateurs assignés aux projets avec leur TJM :
- `project` : Référence vers le projet
- `user` : Référence vers l'utilisateur
- `dailyRate` : TJM en euros (requis)
- `startDate` : Date de début d'assignation (requis)
- `endDate` : Date de fin d'assignation (optionnel)
- `status` : Statut de l'assignation ('ACTIVE', 'INACTIVE', 'COMPLETED')
- `role` : Rôle dans le projet
- `allocation` : Pourcentage d'allocation (0-100)
- `notes` : Notes sur l'assignation

### ProjectTask
Gestion des tâches de projet :
- `project` : Référence vers le projet
- `title` : Titre de la tâche (requis)
- `description` : Description de la tâche (requis)
- `startDate` : Date de début (requis)
- `endDate` : Date de fin (optionnel)
- `estimatedHours` : Temps prévu en heures
- `actualHours` : Temps total réel passé en heures (calculé automatiquement)
- `assignedTo` : Utilisateur principal responsable de la tâche
- `contributors` : Utilisateurs qui contribuent à la tâche
- `notes` : Références vers les notes
- `tags` : Tableau de tags
- `categories` : Tableau de catégories
- `status` : Statut de la tâche ('TODO', 'IN_PROGRESS', 'REVIEW', 'TESTING', 'COMPLETED', 'CANCELLED')
- `priority` : Priorité ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')
- `progress` : Pourcentage de progression (0-100)
- `parentTask` : Tâche parent (pour les sous-tâches)
- `subtasks` : Sous-tâches
- `isActive` : Tâche active ou non

### ProjectTaskTimeTracking
Gestion du suivi du temps par utilisateur sur les tâches :
- `task` : Référence vers la tâche
- `user` : Référence vers l'utilisateur
- `date` : Date de la session de travail (requis)
- `hours` : Nombre d'heures travaillées (requis)
- `description` : Description du travail effectué
- `workType` : Type de travail ('DEVELOPMENT', 'TESTING', 'REVIEW', 'MEETING', 'DOCUMENTATION', 'OTHER')
- `isBillable` : Si le temps est facturable
- `notes` : Notes additionnelles

### ProjectCategory
Gestion des catégories de projets :
- `name` : Nom de la catégorie (requis, unique)
- `description` : Description de la catégorie
- `color` : Couleur hexadécimale pour l'affichage
- `isActive` : Catégorie active ou non

## Routes

### Project Admin Router (`/projects`)
- `GET /` : Lister tous les projets avec pagination et filtres
- `GET /:id` : Récupérer un projet par ID
- `POST /` : Créer un nouveau projet
- `PUT /:id` : Mettre à jour un projet
- `DELETE /:id` : Supprimer un projet
- `POST /:id/users` : Assigner un utilisateur à un projet
- `GET /:id/users` : Récupérer les utilisateurs assignés à un projet
- `PUT /:id/users/:userId` : Mettre à jour l'assignation d'un utilisateur
- `DELETE /:id/users/:userId` : Supprimer l'assignation d'un utilisateur

### Project Task Admin Router (`/project-tasks`)
- `GET /project/:projectId` : Lister toutes les tâches d'un projet
- `GET /:id` : Récupérer une tâche par ID
- `POST /` : Créer une nouvelle tâche
- `PUT /:id` : Mettre à jour une tâche
- `DELETE /:id` : Supprimer une tâche
- `GET /project/:projectId/stats` : Récupérer les statistiques d'un projet

### Project Task Time Tracking Router (`/project-task-time-tracking`)
- `GET /task/:taskId` : Lister le suivi du temps d'une tâche
- `GET /project/:projectId/user/:userId` : Lister le suivi du temps d'un utilisateur sur un projet
- `POST /` : Créer une nouvelle entrée de suivi du temps
- `PUT /:id` : Mettre à jour une entrée de suivi du temps
- `DELETE /:id` : Supprimer une entrée de suivi du temps
- `GET /task/:taskId/stats` : Récupérer les statistiques de temps d'une tâche

### Project Category Admin Router (`/project-categories`)
- `GET /` : Lister toutes les catégories
- `GET /:id` : Récupérer une catégorie par ID
- `POST /` : Créer une nouvelle catégorie
- `PUT /:id` : Mettre à jour une catégorie
- `DELETE /:id` : Supprimer une catégorie
- `GET /active/list` : Lister toutes les catégories actives

## Fonctionnalités

- **Gestion complète des projets** : Création, modification, suppression avec toutes les informations nécessaires
- **Assignation d'utilisateurs** : Gestion des utilisateurs assignés avec leur TJM et allocation
- **Gestion des tâches** : Système de tâches avec sous-tâches, priorités et suivi du temps multi-utilisateurs
- **Suivi du temps détaillé** : Suivi du temps par utilisateur avec types de travail et facturation
- **Catégorisation** : Système de catégories et tags pour organiser les projets
- **Statistiques** : Suivi de la progression et des métriques des projets
- **Recherche et filtres** : Recherche avancée avec filtres multiples
- **Pagination** : Pagination pour toutes les listes
- **Validation** : Validation des données et vérification des références

## Utilisation

Toutes les routes nécessitent une authentification et sont conçues pour être utilisées côté administration. Les routes suivent les conventions REST et retournent des réponses JSON structurées.
