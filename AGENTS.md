# Repository Guidelines

## Structure du Projet
- Sources: `src/` avec l’entrypoint HTTP `src/bin/www.ts`.
- Modules principaux: `src/modules/*/` avec `routes/`, `models/`, `listeners/`, `crons/`, `services/`, `providers/`, `config/`, `docs/`, `examples/`, `scripts/`.
- Build: `dist/` (sortie TypeScript). Tests dans `test/` (ex: `dummy.test.js`).

## Principes Endurance (endurance-core)
- Modularité stricte: aucun import/dépendance entre dossiers de `src/modules/*`. Chaque module est autonome, y compris la redéclaration de ses modèles si nécessaire.
- Cœur commun: `@programisto/endurance-core` fournit le routeur (`EnduranceRouter`), les schémas (`EnduranceSchema`) et un bus d’événements (`enduranceEmitter`, `enduranceEventTypes`). `enduranceCron` pour les CRONs. `enduranceListener` pour les listeners de bus d'évenements.
- Événements inter-modules: orchestrez des actions entre modules via les events plutôt que par import direct.
  Exemple: `enduranceEmitter.emit(enduranceEventTypes.FILE_STORED, payload)`.
- Marketplace: toute dépendance préfixée `edrm-` est un module installable (`npm i edrm-...`) exposant une API intégrable au runtime.

## Commandes Dev, Build et Tests
- `npm run dev`: compile en watch et lance `dist/bin/www`.
- `npm run build`: compile TypeScript (`tsc`) et copie les assets nécessaires vers `dist/`.
- `npm start`: exécute l’app compilée (`node dist/bin/www`).
- `npm test`: lance la suite Mocha.
- `npm run lint`: ESLint sur les sources TypeScript.

## Style et Conventions
- Langage: TypeScript (Node.js, ESM, cible `ESNext`).
- Lint: base `standard` + plugin TypeScript. Points-virgules requis; `space-before-function-paren` désactivé; préfixer d’un `_` les arguments inutilisés.
- Nommage: fichiers en kebab-case avec suffixe domaine (`*.model.ts`, `*.service.ts`, `*.provider.ts`). Classes en PascalCase; variables/fonctions en camelCase.

## Tests
- Framework: Mocha (+ Supertest disponible). Placer les tests dans `test/` et nommer `*.test.js`.
- Favoriser les tests boîte noire des routes d’`EnduranceRouter` du module `edrm-storage`.
- Exécuter via `npm test`. Pour des tests TS, utiliser `ts-node` ou transpiler avant.

## Commits & Pull Requests
- Commits: Conventional Commits (commitlint). Exemples:
  - `feat(storage): add S3 signed URL generation`
  - `fix(routes): handle missing fileId gracefully`
- Releases: `semantic-release` sur `main` et `develop` (versioning + changelog).
- PRs: description claire, issues liées, tests ajoutés/mis à jour; faire passer `npm run lint` et `npm test`.

## Sécurité & Configuration
- Secrets: ne jamais committer `.env`. Se baser sur `src/modules/edrm-storage/config/environment.example.ts`.
- Providers: pour S3, exposer les credentials et le bucket via les variables d’environnement.
- Docker: image via `Dockerfile` après `npm run build` pour embarquer les assets compilés.
