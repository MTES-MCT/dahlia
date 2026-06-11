# DAHL'ia — webapp

Webapp beta.gouv.fr d'aide au traitement des contentieux du droit au logement (DALO/DAHO). Next.js + DSFR, données issues de Télérecours.

## Stack

- **Next.js 16** (App Router, Server Components par défaut) + **React 19**
- **TypeScript** strict, alias `@/*` → racine du projet (`webapp/`)
- **Prisma 7** + Postgres via driver adapter `@prisma/adapter-pg` (`pg`)
- **DSFR** via `@codegouvfr/react-dsfr` (Système de Design de l'État) + Tailwind v4
- **pnpm** (Node 22.14, cf. `.tools-version`), **Vitest** (jsdom)

## Commandes

```sh
docker compose up -d        # Postgres — depuis la RACINE du repo (../), pas webapp/
pnpm install                # installer les deps (postinstall lance prisma generate)
pnpm dev                    # dev sur http://localhost:3000
pnpm test                   # vitest
pnpm lint                   # eslint (next core-web-vitals + typescript)
pnpm format                 # prettier --write (formate tout le repo)
pnpm format:check           # prettier --check (utile en CI)
pnpm build                  # build prod
```

### Base de données (Prisma)

```sh
pnpm db:migrate             # créer/appliquer une migration en dev
pnpm db:generate            # régénérer le client
pnpm db:studio              # Prisma Studio
pnpm db:reset               # reset complet
pnpm db:format              # formater les .prisma
```

### Import de données

`pnpm scrape:dev` (`data/scrape-telerecours.ts`) : scrape l'API Télérecours et **upsert** en base. Nécessite `<JURIDICTION>_TELERECOURS_USERNAME/PASSWORD` dans `.env`. Args : `--jurisdiction TA069 --page 0 --size 30 --all --legalEntityDivisionIds 2488`. Documentation complète des options et du déroulé (phases A/B/C) dans le README, section « Import des données (scraping Télérecours) ».

## Architecture & conventions

- **Schéma Prisma multi-fichiers** : `prisma/schema/*.prisma` (un fichier par domaine, agrégés automatiquement). `schema.prisma` ne contient que datasource + generator ; l'URL de connexion vit dans `prisma.config.ts` (`DATABASE_URL`), **pas** dans le schéma (changement Prisma 7).
- **Tables en snake_case** via `@@map` (ex. `case_files`), modèles/champs en camelCase côté code.
- **Client Prisma** : importer depuis `@/app/lib/prisma` (singleton sur `globalThis` pour survivre au HMR). Ne jamais instancier `new PrismaClient()` ailleurs (sauf scripts standalone dans `data/`).
- **Accès données** : fonctions dans `app/lib/data/*.ts`, appelées depuis les Server Components (`app/**/page.tsx`). Les pages `await searchParams` (Next 16).
- **Composants client** : `'use client'` uniquement quand nécessaire (ex. `app/ui/sortable-column-header.tsx` qui utilise `useRouter`/`useSearchParams`). Le tri/pagination passent par les query params de l'URL.
- **DSFR** : utiliser les composants `@codegouvfr/react-dsfr/*` et `fr.cx(...)` pour les classes. Bootstrap DSFR dans `src/dsfr-bootstrap/` et `app/layout.tsx`.
- **TypeScript** : toujours vérifier que les contrôles TypeScript passent et utiliser les types générés par Prisma (ex. `Prisma.CaseFileGetPayload`) pour le code de la couche données.

## Tests

- Vitest, environnement `jsdom`, alias résolus via `vite-tsconfig-paths`.
- Tests colocalisés (`*.test.ts(x)`). Mocker Prisma avec `vi.mock('@/app/lib/prisma', ...)` (cf. `app/lib/data/case-files.test.ts`).
- Toujours exécuter la suite de tests après avoir modifier du code et vérifier que tous les tests passent : `pnpm test`
- Toujours demander confirmation avant de modifier un test pour savoir s'il faut modifier le code ou le test

## Modèle métier

`CaseFile` (dossier, PK = `caseFileNumber`) relie `Actor` (mainClaimant/mainDefender), `Urgency` (optionnelle), `Status` (lastStatus), `LegalEntityDivision`, `Hearing` → `Conclusion`. Schéma complet (diagramme mermaid) dans `README.md`, à mettre à jour manuellement lors d'un changement de schéma.

## Debugging

- Avant toute modification de code, donne-moi tes 2 principales hypothèses sur la cause racine de cette erreur, comment tu vérifierais chacune, et laquelle tu testeras en premier. Ne modifie aucun fichier tant que nous ne sommes pas d'accord sur la cause.
- Après avoir corrigé le problème, exécute l'ensemble de la suite de tests pertinente et colle-en le résumé. Si quelque chose échoue, corrige-le avant de me dire que c'est terminé.

## Commentaires

Tous les commentaires dans les fichiers de la base de code doivent être rédigés en anglais
