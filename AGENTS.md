# DAHLIA — webapp

Webapp beta.gouv.fr d'aide au traitement des contentieux du droit au logement et à l'hébergement opposable (DALO/DAHO). Next.js + DSFR, données issues de Télérecours.

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

#### ⚠ Migrations et colonnes générées (`GENERATED ALWAYS … STORED`)

La table `actors` a deux colonnes calculées par Postgres (`displayName`,
`displayNameNormalized`, cf. migrations `actor_display_name`, `search_unaccent`,
`actor_display_name_by_actor_type`). Prisma 7 **ne supporte pas** les colonnes
générées : dans le schéma elles sont déclarées en simples `String?`. Résultat,
**à chaque** `pnpm db:migrate`, Prisma détecte une fausse différence et injecte
des `ALTER TABLE "actors" ALTER COLUMN … DROP DEFAULT` que Postgres refuse
(erreur `42601`), faisant échouer la migration.

Workflow obligatoire pour créer une migration tant que ces colonnes existent :

```sh
# 1. Générer la migration SANS l'appliquer
pnpm exec prisma migrate dev --create-only --name <nom>
# 2. Éditer prisma/migrations/<…>_<nom>/migration.sql :
#    supprimer toute ligne parasite ALTER TABLE "actors" ALTER COLUMN … DROP DEFAULT
#    (ne garder que les changements réellement voulus)
# 3. Appliquer la migration corrigée
pnpm exec prisma migrate deploy
pnpm db:generate
```

Ne jamais lancer `pnpm db:migrate` directement pour une nouvelle migration : il
applique aussitôt et échoue avant qu'on puisse corriger le SQL.

### Import de données

`pnpm scrape:telerecours` (`data/scrape-telerecours.ts`) : scrape l'API Télérecours et **upsert** en base. Nécessite `<JURIDICTION>_TELERECOURS_USERNAME/PASSWORD` dans `.env`. Args : `--jurisdiction TA069 --page 0 --size 30 --all --legalEntityDivisionIds 2488`. Documentation complète des options et du déroulé (phases A/B/C) dans le README, section « Import des données (scraping Télérecours) ».

## Architecture & conventions

### Organisation des dossiers (Next.js App Router)

- **`app/`** : routes App Router. Groupes de routes entre parenthèses (ex. `(protected)/`) pour le layout/auth sans segment d'URL. Pages publiques hors de ce groupe (`/`, `/connexion`).
- **`app/**/page.tsx`** : UI de la route (Server Component par défaut). Charge les données via `app/lib/data/*`, compose des composants `app/ui/*`, exporte `metadata` / `generateMetadata`. `params` et `searchParams` sont des Promises (Next 16) : toujours `await` avant usage.
- **`app/**/layout.tsx`** : layout partagé (shell, garde d'accès). Le layout `(protected)` vérifie session + `isValidated` ; ne pas y mettre de fetch métier de page.
- **`app/**/actions.ts`** : Server Actions (`'use server'` en tête de fichier), colocalisées avec la route qu'elles mutent. Gardes d'accès (`canAccessCaseFile`, `requireAdmin` / `withAdminAction`) **avant** toute écriture ; `revalidatePath` après mutation réussie. Helpers transverses dans `app/lib/` (`admin-actions.ts`, `form-actions.ts`), pas de JSX.
- **`app/**/route.ts`** : Route Handlers pour réponses non-UI (export CSV, téléchargement de pièce, API auth). Pas de `page.tsx` et `route.ts` GET sur le même segment.
- **`app/lib/`** : code serveur / partagé **sans UI React** — Prisma, auth, scope, formatage, parsing de query, helpers de formulaires. Importable depuis pages, actions et route handlers.
- **`app/lib/data/*.ts`** : couche d'accès lecture (requêtes Prisma) appelée depuis les Server Components. Pas d'appels Prisma directs dans `page.tsx` ni dans `app/ui/`.
- **`app/ui/`** : composants React réutilisables (Server Components par défaut), organisés par domaine (`table/`, `form/`, `admin/`, …). Pas de requêtes Prisma ici ; recevoir les données en props depuis la page.
- **`data/`** (racine) : pipeline d'import / scraping Télérecours (CLI, client API, persistence). **Hors** App Router ; scripts standalone qui peuvent instancier leur propre `PrismaClient`. La webapp peut en réimporter des briques (`enrichCaseFile`, client Télérecours, `describeError`) depuis une Server Action ou un `route.ts`.
- **`proxy.ts`** (racine, Next 16) : équivalent du middleware — redirection auth globale. Ne pas y mettre de logique métier de dossier.

### Données, UI et styles

- **Schéma Prisma multi-fichiers** : `prisma/schema/*.prisma` (un fichier par domaine, agrégés automatiquement). `schema.prisma` ne contient que datasource + generator ; l'URL de connexion vit dans `prisma.config.ts` (`DATABASE_URL`), **pas** dans le schéma (changement Prisma 7).
- **Tables en snake_case** via `@@map` (ex. `case_files`), modèles/champs en camelCase côté code.
- **Client Prisma** : importer depuis `@/app/lib/prisma` (singleton sur `globalThis` pour survivre au HMR). Ne jamais instancier `new PrismaClient()` ailleurs (sauf scripts standalone dans `data/`).
- **Périmètre de droit** : toute requête sur `CaseFile`, `AttachedFile` ou `CaseFileEvent` doit être cloisonnée via `app/lib/case-file-scope.ts` (`caseFileScopeWhere()` / `caseFileRelationScopeWhere()`), et toute Server Action qui écrit sur un dossier doit d'abord appeler `canAccessCaseFile()`. Un dossier hors périmètre se comporte comme un dossier inexistant (404). Règle détaillée dans le README, section « Périmètre de droit ».
- **Composants client** : `'use client'` uniquement quand nécessaire (hooks navigateur, état local interactif — ex. `useRouter` / `useSearchParams`). Le tri/pagination passent par les query params de l'URL.
- **DSFR** : utiliser les composants `@codegouvfr/react-dsfr/*` et `fr.cx(...)` pour les classes. Bootstrap DSFR dans `src/dsfr-bootstrap/` et `app/layout.tsx`.
- **Tailwind** : utiliser Tailwind v4 en complément du DSFR lorsque le DSFR ne propose pas la classe voulue ou pour personnaliser. Combiner avec `fr.cx(...)` et `clsx(...)` si besoin.
- **Styles** : éviter au maximum l'attribut `style` ; préférer des classes DSFR ou Tailwind. Si l'attribut `style` est nécessaire, demander confirmation à l'utilisateur en justifiant pourquoi les classes ne conviennent pas.
- **TypeScript** : toujours vérifier que les contrôles TypeScript passent et utiliser les types générés par Prisma (ex. `Prisma.CaseFileGetPayload`) pour le code de la couche données.
- **Titre de page (RGAA 8.5/8.6)** : toute nouvelle page doit exporter un `metadata.title` (ou `generateMetadata`) **spécifique et significatif**. Le layout racine applique le gabarit `%s - DAHLIA` : ne pas inclure « - DAHLIA » dans le titre de la page. Ajouter aussi un cas dans `app/page-titles.unit.test.tsx` (et l'inclure dans le test d'unicité des titres).

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
