# Investigation des solutions existantes

Ici on notera les questions relatives aux partenaires potentiels ou avérés.
Il s'agit de questions techniques.

## TéléRecours

### Scapper

- Attention : tout changement de méthode d'authentification a un fort impact (voir un impact descructeur) sur notre outil DAHLIA

### Problématiques

#### Authentification et Droits des utilisateurs

Les dossiers sont affichés selon les droits des utilisateurs, la plus part du temps l'utilisateur peut voir les dossiers d'un département ou d'un service au sein du département mais il se peut que l'utilisateur ait aussi quelques dossier dans d'autre département. Une des problématique est de pouvoir récupérer cette compléxité d'authentification et d'accès aux dossiers avec différent niveaux de droit sur chaque dossier pour les utilisateurs des applications tierces.

deux solutions:

- soit l'application tierce, grâce à un SSO ou à partir de l'email de l'utilisateur peut récupérer les droits appliqués à l'utilisateur et les réappliquer dans l'application tierce
- soit les droits sont reproduits sur l'application tierce sans lien avec les droits appliqués sur télérecours

On préfèrerait la première solution

#### Accusé de réception suite à la visualisation des pièces d'un dossier

Quand un utilisateur visualise une pièce d'un dossier pour la première fois, cela génère un accusé de réception qui fait potentiellement courrir des délais de justice.

Aujourd'hui sur DAHLIA, on affiche le document en utilisant une route directe vers télérecours, ceci crée un accusé de réception.

Demain, on voudra faire des prétraitements sur le document sans générer d'accusé de réception puisque aucun utinisateur n'aura visualiser la pièce, il est donc nécessaire d'avoir des routes API permettant de générer et de ne pas générer d'accusé de réception lors du téléchargement de la pièce et d'xpliquer qu'il est de la responsabilité des applications tierces d'appliquer la règle de droit pour choisir la route à utiliser

#### Paternité des pièces partagées

lorsqu'on récupère les pièces d'un dossier, elle sont attaché à un evènement, les évenements cont la reception et la comunication des pièces par les greffes.
en tant que partie (requérant ou défendeur du dossier), les pièces sont attachées à l'évenement qui permet de voir les pièces, soit la réception si on est producteur des pièces, soit les communications si on en est destinataire, dans tous les cas c'est l'utilisateur courant qui est attaché à l'évenement, du coup, on ne sais pas qui est le réel producteur des pièces, on a donc besoin de connaitre qui les a produites

### API

Il existe déjà une API utilisée par l'interface

- Gestion des utilisateurs et des habilitations
  - Est-ce possibe d'avoir rapidement une authentification machine à machine pour ne pas avoir a émuler l'authentification d'un utilisateur sur le portail d'authentification (SSO) https://authentification.telerecours.fr/
  - Gestion des utilisateurs : est-ce possible de récupérer les autorisations assignées aux utilisateurs ?
  - entity -> pas toujours renvoyé lors de la récupération de la liste des case-files
- Est-ce possible de faire évoler la route API `/api/case-file`
  - Permettre de récupérer la liste des dossier par bloc de 100 ou 1000
  - Permettre de récupérer les objets liés historiques et documents directement avec cette route API, ainsi que les champs et objets :
    - string title "nullable"
    - DateTime creationDate "nullable"
    - DateTime depositDate "nullable"
    - string type "nullable"
    - DateTime estimatedHearingDate "nullable"
    - string estimatedHearingPeriod "nullable"
    - DateTime earliestInstructionClosingDate "nullable"
    - DateTime lastDecisionReading "nullable"
    - string directoryReference "nullable"
    - string directoryComplementaryEmails "array"
    - string keywords "array"
    - int recipientContactCount "nullable"
    - int chamberId FK "nullable"
      et les objets:
    - hearings
    - chamber
    - measure
    - caseFileEvent
    - AttachedFile (avec FileFamilyType)
    - RelatedCaseFile
  - Permettre de filtrer sur la date du dernier événement de l'historique
- Récupérer d'une manière ou d'une autre le producteur de la pièce jointe, ex : dans quel évenement elle a été partagée en premier
- Avoir une route qui permet de récupérer les pièces jointes sans générer d'acusé de lecture (dans le cas d'un prétraitement machine) et avec accusé de lecture (dans le cas de la visualisation par un utilisateur)

Question :

- Est-ce que l'accusé de lecture est assigné à un utilisateur ?

Note : une API en lecture seule est suffisante pour les besoins de notre première itération. Selon la trajectoire de DAHLIA, nous aurons peut-être un jour besoin de déposer des pièces dans un dossier

## Ministère de l'interieur / ASTREE

### Actuellement

Prototype pas interfacé à télérecours
Agent : télérecours -> puis SIAGE : double saisi dans SIAGE et TELERECOURS
SIAGE n'est pas relié à télérecours
ASTREE - synchro avec SIAGE

Difficultés techniques lié à l'environnement du MI très contraignant
Refonte technique de SIAGE

### Prochainement

Prototype v2

- gestion du flux entrant
  - 4 grandes fct
  - Téléchargement automatique depuis télérecours
    Accord pour faire un robot de scrapping
    API trouvée, essai plutôt concluant
  - rappatriment des pièces
  - déversement auto dans SIAGE
    refonte conséquente : pas possible en 2026
- conserver le contentieux "permis à point"
- ajout contentieux "étrangers" - très varié

QUESTIONS :

- Interprétation des pièces avec IA ?
  - tests en cours
- Reverser des pièces dans TELERECOURS ?
  - C'est un sujet mais pas la priorité

- Extrait des morceaux de pièce
  - dans le document : word, PDF, scan - pas de requête manuscrite
  - techniquement
    -> OCR (Mistral OCR), DocumentIA : étude en cours
    -> Extraction LLM
    -> Récupération des prénom, nom, num permis… etc dans les requêtes
    -> Open-Source ?
  - tip
    - plusieurs prénoms
    - I vs 1
    - Paramétrage juridique : Moyen vs infraction, ex: exces de vitesse () mais contestation car jamais notifié
    - recherche de mot clé selon le juriste -> rentre
    - 500 requêtes dossiers clos -> requête + décision -> apprentissage
    - Qualité un peu moyenne après cette apprentissage -> demande d'annotation

Astree jénère un squelète de mémoire avec le plan de défense, pas d'interprétation de défense
-> suite : automatisation avec banque de paragraphe ? paramétrable ?

Recherche de jurisprudence : demande mais pas une priorité, déjà

Recueil de jurisprudance par l'ADAGE

- Mutualisation
  - Code open-source ? -> en attente de partage
  - techno python
  - API TEERECOURS, SGG / DINUM, demande en cours

#### RDV - 23-07-2026

AGILE - Safe
prod vs QA

en prod : n'utilise pas télérecours, utilise 2 autres applications
en QA :

- RPA (Scrapping) -> exactement la même méthode
- Accord de principe avec télérecours, CR de réu
- Audit DINUM et le conseil d'état à partir de septembre
- Démarche numérique -> IHM et DB pour sauvegarder les dossiers
- pas d'environnement déployé -> peur d'être bani
- extraction des entités dans les requêtes
  - AI agentic ->

Paddle OCR -> pas de GPU
Catégorisation -> au niveau de la page ou du doc
Agent pour rechercher les informations
Pas de classification d'image
-> sort une synthèse
DocumentIA -> pas investigué

Mutualiser : question d'organisation avant tout

### Scrapper

Où en êtes vous du développement d'un scrapper de TéléRecours ?
Est-ce qu'on peut mutualiser l'effort, si oui, quelles sont vos containtes ?

### Lecture et interprétation de document

Où est-ce que vous en êtes ?

## DocumentIA

- Est ce que vous avez besoin d'un GPU pour faire tourner votre solution
- Est-ce qu'il y a un score de fiabilité

## Mon Dalo

MonDalo est l'application en amont de DAHLIA qui gère les recours gracieux au sein de la COMED (Commité de médiation)
Nous avons tout intérêt à s'aligner sur nos pratiques tant que faire se peut dans la perspective de pérénisation future

- Context
  Dev commencé il y a 1 an 1/2
  Dépo du dossier en ligne par usager -> fait livré 10/25
  Partie agent : affectation, traitement, enregistrement(n° comDalo), Décision de la CoMed
  Reste à faire : échange agent <-> usager
  Traitement : qualification du dossier -> à faire d'ici la fin de l'année
  Décommissionnement ComDalo en fin 2027
  Irritant -> accéléré la cadence de livraison

- Coté serveur : node + astro si j’ai bien compris
  - Est-ce qu’il y a un compiler type Parcel ou vite
  - Est-ce qu’il y a d’autres packages structurants ?
    Astro.build (avant Nest + Nuxt) : migration page par page (target 11/26)
    Composant en Vue.js
    Typescript
    Très peu d'utilisation de Astro

- Coté client : est-ce que vous utilisé un framework type React ?
  Vue.js

- SSO : CERBERE, FranceConnect, ProConnect ?
  CERBERE, FranceConnect
  (BetterAuth)

- Stockage de document : S3 ? Sous quel réseau
  S3 du MTE

- Déploiement : Où est-ce déployé, cloud, interne, PaaS, IaaS ? DNUM ou cloud ?
  Ecocompose (docker-compose sur des machine de prod)

- Combien d’environnement ?
  en déployé : dev -> preprod, preprod -> ecole, prod

- Quelle techno DB ?
  postgres -> ecosql (postgres toujours)

- Est-ce que vous avez une API ? REST ou GraphQL ? Téléchargement de pièces possibles ?
  Pas d'API prévu (pour le moment)

- Gestion de version : gitlab ?
  gitlab ministère

- CI/CD : gitlab ?
  gitlab ministère

- CD : Comment est-ce déployé ? Sur tag ou branche ou autre ? Qui, quand, comment ?
  merge MR -> déploiement sur `preprod` -> version `prod`
  Déploiement continue -> version selon le num d'epic

- DocumentIA : où est-ce que vous en êtes ? Utilisation en SaaS ? Est-ce qu’il y a des limitations
  Convention à signer pour appeler l'API
  Commence par l'avis d'imposition
  A priori pas de pièces manustrites

## LITIJ

LITIJ est l'application en aval de DALH'ia qui gère le suivi des contentions au niveau du MATTE (pas uniquement le droit au logement et à l'hébergement)

- Est-ce qu'il y a une API ? Est-ce qu'elle permet de déposer des documents

Utilisateurs

- Central
- Départements

A quoi ça sert

Quand il y a une affaire saisie, les agents du greffe ajoute
Pas de synchro
4 greffes ui copient à la main
copier coller des infos de base
puis c'est les juristes d la DAJ qui prennent la suite
ils complètent le dossier
utilisation de partaj pour consulter les experts
Greffe -> recopie colle les information sur télérecours

Gain :
-> Interface avec Télérecours
-> Interface avec Partaj
Meilleur granularité

LITIJ remplace le SIG

- framework interne PASTA (nest.js + vuejs)

PASTA -> qu'est-ce que ça apporte

- Interfacage avec la brique d'authentification
- administration
- pièces jointes
- CRUD over http
- Ajout d'une surcouche au DSFR
