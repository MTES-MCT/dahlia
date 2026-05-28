# DAHL'ia

Application d'aide pour organiser les défenses des dossier DALO, DAHO et DAHU
permets de récupérer les dossiers de contentieux du droit aux logements que les départements doivent défendre

Ce répertoire contient le code de la webapp DAHL'ia

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

Lancement de l'application en envronnement de développement

```sh
pnpm dev
```

Ouvrir [http://localhost:3000](http://localhost:3000) dans votre navigateur pour voir le résultat.

## Schéma de base de données

Source de vérité : `prisma/schema/*.prisma`. Le diagramme ci-dessous est généré
manuellement à partir de ces fichiers ; pensez à le mettre à jour lors d'un
changement de schéma.

```mermaid
erDiagram
    CaseFile {
        string caseFileNumber PK
        int assignedToLegalEntityDivisionId FK
        int urgencyId FK
        int lastStatusId FK
        DateTime lastStatusDate
        string lastHearingId FK "unique, nullable"
        string procedureState "nullable"
        int mainClaimantId FK
        int mainDefenderId FK
        DateTime createdAt
        DateTime updatedAt
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

    Hearing {
        string hearingId PK
        DateTime convocationDate
        string room
        DateTime creationDate "nullable"
        DateTime modificationDates "array"
        int lastConclusionId FK "unique, nullable"
    }

    Conclusion {
        int id PK
        string conclusionSense
        DateTime publicationDate
        string author "nullable"
        int conclusionOperativePartId FK
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

    User {
        int id PK
        string firstName
        string lastName
        string email UK
        string passwordHash
        DateTime createdAt
        DateTime updatedAt
        DateTime lastLoginAt "nullable"
    }

    LegalEntityDivision ||--o{ CaseFile : "assignedTo"
    Urgency             ||--o{ CaseFile : "has urgency"
    Status              ||--o{ CaseFile : "lastStatus"
    CaseFile            |o--o| Hearing  : "lastHearing"
    Actor               ||--o{ CaseFile : "mainClaimant"
    Actor               ||--o{ CaseFile : "mainDefender"
    Hearing             |o--o| Conclusion : "lastConclusion"
    ConclusionOperativePart ||--o{ Conclusion : "operativePart"
    Quality             ||--o{ Actor    : "has quality"
```

## Questions Ouvertes

### Pièces jointes

Le pièces sont enregistrées dans Télérecours
Puis on ajoute des pièces dans DAHL'ia
Et on les repartages dans Télérecours et/ou LITIJ

Est-ce qu'on peut s'épargner de stocker les pièces qui le sont déjà dans Télérecours ?
