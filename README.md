# DAHLIA

Application d'aide pour organiser les défenses des dossier DALO, DAHO et DAHU
permets de récupérer les dossiers de contentieux du droit aux logements que les départements doivent défendre

Ce répertoire contient le code de la webapp DAHLIA

- Application NextJS
- Utilisation du DSFR via `@codegouvfr/react-dsfr`

## Getting Started

### Installation

Lancement des services tiers (postgresql)

```sh
docker compose up -d
```

Installation des librairies JS

```sh
pnpm ci
```

### Hooks Git (pre-commit)

Le script `prepare` du `package.json` configure automatiquement
[Husky](https://typicode.github.io/husky/) lors de `pnpm ci` ou `pnpm install`.
Git pointe alors vers `.husky/` comme dossier de hooks (`core.hooksPath`).

Avant chaque commit, le hook **pre-commit** exécute :

- `pnpm lint` (ESLint)
- `pnpm exec tsc --noEmit` (vérification TypeScript)

Si les hooks ne semblent pas actifs après un clone (par exemple si
`git config core.hooksPath` ne renvoie rien), relancer :

```sh
pnpm prepare
```

Pour tester le hook sans committer :

```sh
.husky/pre-commit
```

Pour désactiver temporairement le hook (debug uniquement) :

```sh
HUSKY=0 git commit -m "…"
```

### Exécution en environnement de développement

Lancement de l'application en envronnement de développement

```sh
pnpm dev
```

Ouvrir [http://localhost:3000](http://localhost:3000) dans votre navigateur pour voir le résultat.

## Authentification & autorisation (ProConnect)

L'authentification repose sur [better-auth](https://www.better-auth.com/) avec le
plugin `genericOAuth` configuré pour **ProConnect** (OIDC). La configuration vit
dans [`app/lib/auth.ts`](app/lib/auth.ts) (serveur) et
[`app/lib/auth-client.ts`](app/lib/auth-client.ts) (client). Les routes d'auth
sont montées sur `/api/auth/*`.

### Variables d'environnement requises (`.env`)

| Variable                   | Description                                                                                                                   |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`       | Clé de signature des sessions. Générer avec `openssl rand -base64 32`.                                                        |
| `BETTER_AUTH_URL`          | URL de base de l'app (ex. `http://localhost:3000`).                                                                           |
| `PROCONNECT_CLIENT_ID`     | Identifiant client de l'app déclarée sur l'espace partenaire ProConnect.                                                      |
| `PROCONNECT_CLIENT_SECRET` | Secret client ProConnect.                                                                                                     |
| `PROCONNECT_URL`           | Domaine de base ProConnect (intégration : `https://fca.integ01.dev-agentconnect.fr`). Les endpoints OIDC sont sous `/api/v2`. |

> Côté espace partenaire ProConnect, déclarer la **redirect URI**
> `http://localhost:3000/api/auth/oauth2/callback/proconnect` et la
> **post-logout redirect URI** `http://localhost:3000/`.

### Flux

- La page d'accueil `/` est **publique** ; toutes les autres pages exigent un
  compte **connecté et validé** (cf. `proxy.ts` + `app/(protected)/layout.tsx`).
- À la première connexion ProConnect, l'utilisateur est créé en base avec
  `validated = false`. Tant qu'il n'est pas validé, il voit un message d'attente.
- **Validation manuelle** (admin) via Prisma Studio (`pnpm db:studio`) ou en SQL :

  ```sql
  UPDATE users SET "validated" = true WHERE email = 'prenom.nom@exemple.gouv.fr';
  ```

- La particularité ProConnect du `userinfo` renvoyé en **JWT signé** est gérée par
  un `getUserInfo` personnalisé (vérification via JWKS avec `jose`). La
  déconnexion fait un logout complet (`end_session_endpoint`).

## Import des données (scraping Télérecours)

Le script [data/cli/scrape-telerecours.ts](data/cli/scrape-telerecours.ts) interroge
l'API Télérecours et **upsert** les dossiers en base. Il se lance via :

```sh
pnpm scrape:dev -- [options]
```

### Pré-requis (`.env`)

Le script lit les variables d'environnement, préfixées par le code de juridiction
ciblé (`<JURIDICTION>_…`) :

| Variable                              | Rôle                                                                                                                                    |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                        | Connexion Postgres où les données sont upsertées                                                                                        |
| `<JURIDICTION>_TELERECOURS_USERNAME`  | Identifiant Télérecours (ex. `TA069_TELERECOURS_USERNAME`)                                                                              |
| `<JURIDICTION>_TELERECOURS_PASSWORD`  | Mot de passe Télérecours                                                                                                                |
| `<JURIDICTION>_TELERECOURS_DIVISIONS` | IDs des divisions par défaut, séparés par des virgules (ex. `2488,1234`) — utilisé si `--legalEntityDivisionIds` n'est pas passé en CLI |

### Options

| Option                           | Défaut                    | Description                                                                                                                                                                    |
| -------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--jurisdiction <code>`          | `TA069`                   | Code de la juridiction. Détermine aussi quelles variables d'env sont lues (`<code>_TELERECOURS_*`) et l'en-tête `X-Jurisdiction-Code` envoyé à l'API.                          |
| `--page <n>`                     | `0`                       | Page de départ (0-based) pour la liste des dossiers (Phase A). Le script continue ensuite jusqu'à la dernière page.                                                            |
| `--size <n>`                     | `30`                      | Nombre de dossiers par page lors de l'appel à `/api/case-file`.                                                                                                                |
| `--sort <champ>`                 | _(aucun)_                 | Critère de tri transmis tel quel à l'API (paramètre `sort`).                                                                                                                   |
| `--all`                          | `false`                   | Récupère **tous** les dossiers sans filtre de statut. Sans ce flag, seuls les dossiers « en cours » sont demandés (groupes INPROGRESS de l'API Télérecours, hors « Terminé »). |
| `--legalEntityDivisionIds <ids>` | env `…_DIVISIONS`         | Liste d'IDs de divisions à filtrer, séparés par des virgules (ex. `2488,1234`). Surcharge la variable d'env. Sert aussi à cibler les dossiers à enrichir (Phases B/C).         |
| `--anonymize`                    | `true` sauf si `ENV=prod` | Anonymise les acteurs (requérants/défendeurs) avant insertion en base. Le défaut dépend de la variable d'env `ENV` : anonymisation activée en dev/preprod, désactivée en prod. |
| `--skipEnrichment`               | `false`                   | N'exécute que la Phase A (liste des dossiers) et saute les Phases B et C (détails, audiences, mesures, pièces jointes, dossiers liés).                                         |

### Déroulé du script

1. **Phase A** — scrape la liste `/api/case-file` (paginée) et upsert chaque dossier
   avec ses entités de base (acteurs, statut, urgence, division, dernière audience…).
2. **Phase B** _(sautée si `--skipEnrichment`)_ — pour chaque dossier actif en base
   (hors « Terminé ») et dans les divisions ciblées, récupère
   le détail enrichi, **toutes** les audiences, les mesures (events) et les pièces
   jointes.
3. **Phase C** _(sautée si `--skipEnrichment`)_ — crée les liens entre dossiers liés
   (`related-case-files`) pour les mêmes dossiers cibles.

### Suivi de synchronisation Télérecours

À la fin de chaque enrichissement (Phase B ou rafraîchissement depuis l'UI),
`enrichCaseFile` met à jour trois champs de suivi sur le dossier. Ils sont
distincts de `updatedAt` (géré par Prisma et modifié à chaque écriture en base,
y compris les mises à jour locales dans l'application) :

| Champ                    | Mis à jour quand…                                                                     | Rôle                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `telerecoursSyncAt`      | À **chaque** synchronisation avec Télérecours, qu'il y ait eu changement ou non.      | Indique la dernière fois que le scraper (ou l'UI) a interrogé Télérecours pour ce dossier.                                             |
| `telerecoursUpdatedAt`   | Uniquement lorsque le contenu scrapé **a réellement changé** depuis la dernière fois. | Indique la dernière fois que Télérecours a apporté une modification détectable (détail, audiences, mesures ou pièces).                 |
| `telerecoursContentHash` | En même temps que `telerecoursUpdatedAt`.                                             | Empreinte SHA-256 du payload scrapé (détail + audiences + mesures + pièces), utilisée pour comparer deux synchronisations successives. |

Le détecteur de changement calcule un hash du payload complet renvoyé par
Télérecours (voir `data/persistence/content-hash.ts`). Les collections sont triées
par identifiant stable avant hachage, de sorte qu'un simple réordonnancement ne
soit pas interprété comme une modification. Si le hash est identique à celui déjà
stocké, seul `telerecoursSyncAt` est rafraîchi ; `telerecoursUpdatedAt` et
`telerecoursContentHash` restent inchangés.

### Exemples

```sh
# Scrape complet de la juridiction par défaut (TA069), divisions issues de l'env
pnpm scrape:dev

# Cibler une juridiction et des divisions précises
pnpm scrape:dev -- --jurisdiction TA069 --legalEntityDivisionIds 2488

# Récupérer tous les dossiers quelques soit leur statut
pnpm scrape:dev -- --all

# Tester rapidement la seule Phase A, anonymisée, sur une page
pnpm scrape:dev -- --page 0 --size 30 --skipEnrichment --anonymize
```

### Architecture du code

Le code de scraping est organisé par responsabilité sous `data/`, depuis
l'entrypoint CLI jusqu'à la couche de persistance :

```text
data/
  cli/
    scrape-telerecours.ts      # entrypoint mince : wiring Prisma + client → runScrape → exit
    parse-args.ts              # parseArgs / getEnv / parseDivisionIds (fonctions pures)
  telerecours/
    client.ts                  # TelerecoursClient — méthodes typées (renvoient les DTO)
    client.interface.ts        # interface TelerecoursClient = le « seam » que les tests mockent
    http.ts                    # fetchWithRetry, backoff, describeError, content-disposition
    auth.ts                    # flux d'authentification OIDC / PKCE
    types.ts                   # DTO de l'API Télérecours
  persistence/
    upsert-case-file.ts        # upsertCaseFile + upsertActor (vue liste)
    enrich-case-file.ts        # enrichCaseFile + upserts détail / audiences / events / pièces
    paginate.ts                # helper de pagination des endpoints Télérecours
  scrape/
    pipeline.ts                # Args, ScrapeDeps, runScrape (orchestration A → A.5 → B → C)
    phase-a-list.ts            # phaseA + reconcileDeleted (Phase A.5, soft-delete)
    phase-b-enrich.ts          # phaseB
    phase-c-related.ts         # phaseC + linkRelatedCaseFiles
    where.ts                   # divisionWhere / enrichmentTargetsWhere (fragments Prisma, purs)
  anonymize.ts                 # anonymisation des acteurs
  telecharge-fichier.ts        # script standalone de téléchargement de pièce (pnpm download:dev)
```

Trois principes guident cette organisation :

1. **Injection de dépendances (`ScrapeDeps`)** — la pipeline et les phases
   reçoivent `{ prisma, client, rateLimitMs }` au lieu d'instancier Prisma et le
   client eux-mêmes ou de lire un singleton global. C'est ce qui rend chaque
   phase testable avec un faux client et un Prisma mocké.
2. **Client typé (`TelerecoursClient`)** — les méthodes du client renvoient
   directement les DTO (`PagedResponse<CaseFile>`, `CaseFileDetail`…). L'interface
   `client.interface.ts` est le contrat partagé entre l'implémentation réelle
   (`client.ts`) et le faux client des tests : un fixture qui dévie de la forme
   attendue échoue à la compilation.
3. **Phases A.5 (réconciliation)** — après la Phase A, tout dossier présent en
   base dans le périmètre scrapé mais **absent** de la liste renvoyée par
   Télérecours est marqué supprimé (soft-delete `isDeleted`/`deletedAt`). Le
   périmètre reflète le scope du scrape (divisions ciblées, et hors « Terminé »
   sans `--all`).

La webapp réutilise une partie de ce code : `enrichCaseFile`
(`data/persistence/enrich-case-file.ts`), `getTelerecoursCaseFileClient` et
`describeError` (`data/telerecours/`) servent au rafraîchissement d'un dossier et
au téléchargement de pièces depuis l'UI.

### Tests

La suite est lancée avec `pnpm test` (Vitest). Le scraping est testé **sans
réseau ni base réelle**, en mockant l'API Télérecours à deux niveaux :

- **Niveau pipeline / mapping** (la majorité des tests) — un faux client
  implémentant `TelerecoursClient` (`data/test-support/fake-client.ts`) renvoie
  des fixtures typées (`data/test-support/fixtures.ts`), et Prisma est mocké via
  `mockDeep<PrismaClient>()` (`vitest-mock-extended`). On vérifie ainsi
  l'orchestration des phases, la pagination, la réconciliation (soft-delete), le
  mapping DTO → Prisma et la dérivation du `lastProducer`.
- **Niveau client HTTP** — quelques tests stubbent `fetch`
  (`vi.stubGlobal("fetch", …)`) pour couvrir ce que le mock d'interface ne voit
  pas : retry sur 429/5xx, `AuthenticationError` sur 401 (déclenchant la
  reconnexion en amont), et le parsing de l'en-tête `Content-Disposition`.

Les fonctions pures (`parseArgs`, `divisionWhere`/`enrichmentTargetsWhere`,
`describeError`, `findLastProducerId`) ont des tests unitaires directs. Le délai
de rate-limiting (`rateLimitMs`) est injectable et fixé à `0` dans les tests pour
ne pas attendre réellement.

## Schéma de base de données

Source de vérité : `prisma/schema/*.prisma`. Le diagramme ci-dessous est généré
manuellement à partir de ces fichiers ; pensez à le mettre à jour lors d'un
changement de schéma.

```mermaid
erDiagram
    CaseFile {
        string caseFileNumber PK
        string title "nullable"
        DateTime creationDate "nullable"
        DateTime depositDate "nullable"
        string type "nullable"
        DateTime estimatedHearingDate "nullable"
        string estimatedHearingPeriod "nullable"
        DateTime earliestInstructionClosingDate "nullable"
        string directoryReference "nullable"
        string directoryComplementaryEmails "array"
        string keywords "array"
        int recipientContactCount "nullable"
        int assignedToLegalEntityDivisionId FK
        int urgencyId FK
        int lastStatusId FK
        DateTime lastStatusDate
        string lastHearingId FK "nullable"
        string procedureState "nullable"
        int chamberId FK "nullable"
        int mainClaimantId FK
        int mainDefenderId FK "nullable"
        int lastProducerId FK "nullable"
        DateTime createdAt
        DateTime updatedAt
        DateTime telerecoursSyncAt "nullable"
        DateTime telerecoursUpdatedAt "nullable"
        string telerecoursContentHash "nullable"
    }

    LegalEntityDivision {
        int id PK
        string name
        string shortName UK
    }

    Urgency {
        int id PK
        string key "nullable"
        string description
        string colorHexadecimalCode
    }

    Status {
        int id PK
        string label
        string category
        int groupId
    }

    Chamber {
        int id PK
        string name
    }

    Hearing {
        string hearingId PK
        DateTime convocationDate
        string room
        DateTime creationDate "nullable"
        DateTime modificationDates "array"
        int lastConclusionId FK "unique, nullable"
        string caseFileNumber FK "nullable"
    }

    Conclusion {
        int id PK
        string conclusionSense
        DateTime publicationDate
        string author "nullable"
        int conclusionOperativePartId FK "nullable"
    }

    ConclusionOperativePart {
        int id PK
        string label UK
    }

    Actor {
        int id PK
        string firstName "nullable"
        string lastName "nullable"
        string lastFirstName "nullable"
        string firstLastName "nullable"
        string legalPersonName "nullable"
        string legalEntityName "nullable"
        int legalEntityId "nullable"
        ActorType actorType
        string qualityCode FK
    }

    Quality {
        string code PK
        string name UK
    }

    Measure {
        string code PK
        string label
        string type
        bool isImportant
        string family "nullable"
    }

    CaseFileEvent {
        int id PK
        int subEventId
        DateTime eventDate
        string deadlineLabel "nullable"
        DateTime receiptDate "nullable"
        DateTime instructionClosingDate "nullable"
        string comment "nullable"
        bool hasAttachment
        bool generateAR
        int nbEventFile
        bool piecesNonDownloadable "nullable"
        int relatedEventCount
        string caseFileNumber FK
        string measureCode FK
        int actorId FK "nullable"
    }

    FileFamilyType {
        string code PK
        string label
    }

    AttachedFile {
        string encodedFileId PK
        string originalFileName
        string fileName
        string mimeType
        string documentType
        int subEventId
        int receiptAcknowledgmentId "nullable"
        string receiptAcknowledgmentType "nullable"
        string fileTypeLabel
        DateTime eventCreationDate
        string caseFileNumber FK
        int eventId FK
        string fileFamilyTypeCode FK
    }

    RelatedCaseFile {
        string caseFileNumber PK_FK
        string relatedCaseFileNumber PK_FK
    }

    LastDecisionReading {
        string caseFileNumber PK_FK
        DateTime readingDate
        DateTime notificationDate "nullable"
        string nature "nullable"
        string operativePart "nullable"
    }

    User {
        string id PK
        string name
        string email UK
        boolean emailVerified
        string image "nullable"
        string firstName "nullable"
        string lastName "nullable"
        boolean validated "défaut false (autorisation)"
        DateTime createdAt
        DateTime updatedAt
    }

    LegalEntityDivision ||--o{ CaseFile : "assignedTo"
    Urgency             ||--o{ CaseFile : "has urgency"
    Status              ||--o{ CaseFile : "lastStatus"
    Chamber             ||--o{ CaseFile : "chamber"
    CaseFile            |o--o| Hearing  : "lastHearing"
    CaseFile            ||--o{ Hearing  : "hearings"
    Actor               ||--o{ CaseFile : "mainClaimant"
    Actor               ||--o{ CaseFile : "mainDefender"
    Actor               |o--o{ CaseFile : "lastProducer"
    Hearing             |o--o| Conclusion : "lastConclusion"
    ConclusionOperativePart |o--o{ Conclusion : "operativePart"
    Quality             ||--o{ Actor    : "has quality"
    CaseFile            ||--o{ CaseFileEvent : "events"
    Measure             ||--o{ CaseFileEvent : "type"
    Actor               |o--o{ CaseFileEvent : "actor"
    CaseFile            ||--o{ AttachedFile : "attachedFiles"
    CaseFileEvent       ||--o{ AttachedFile : "event"
    FileFamilyType      ||--o{ AttachedFile : "family"
    CaseFile            ||--o{ RelatedCaseFile : "source"
    CaseFile            ||--o{ RelatedCaseFile : "target"
    CaseFile            |o--o| LastDecisionReading : "lastDecisionReading"
```

## Questions Ouvertes

### Pièces jointes

Le pièces sont enregistrées dans Télérecours
Puis on ajoute des pièces dans DAHLIA
Et on les repartages dans Télérecours et/ou LITIJ

Est-ce qu'on peut s'épargner de stocker les pièces qui le sont déjà dans Télérecours ?
