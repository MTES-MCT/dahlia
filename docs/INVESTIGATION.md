# Investigation des solutions existantes

Ici on notera les questions relatives aux partenaires potentiels ou avérés.
Il s'agit de questions techniques.

## TéléRecours

### Scapper

- Est-ce qu'on veut que le code du scrapper soit open source ?
- est-ce qu'il est prévu une double authentification ?

### API

Il existe déjà une API utilisée par l'interface

- Est-ce possibe d'avoir rapidement une authentification machine à machine pour ne pas avoir a émuler l'authentification d'un utilisateur sur le portail d'authentification (SSO) https://authentification.telerecours.fr/
- Est-ce possible de faire évoler la route API `/api/case-file`
  - Permettre de récupérer la liste des dossier par bloc de 100 ou 1000
  - Permettre de récupérer les objets liés historiques et documents directement avec cette route API
  - Permettre de filtrer sur la date du dernier événement de l'historique

Note : une API en lecture seule est suffisante pour les besoins de notre première itération. Selon la trajectoire de DAHL'ia, nous aurons peut-être un jour besoin de déposer des fichiers dans un dossier

### Architecture

- Comment Télérecours détermine qu'un utilisateur à les droits pour visualider les dossiers du tribunal administartif du Rhône (TA069)

## Ministère de l'interieur / ASTREE

### Scrapper

Où en être vous du développement d'un scrapper de TéléRecours ?
Est-ce qu'on peut mutualiser l'effort, si oui, quelles sont vos containtes ?

### Lecture et interprétation de document

Où est-ce que vous en êtes ?

## DocumentIA

- Est ce que vous avez besoin d'un GPU pour faire tourner votre solution
- Est-ce qu'il y a un score de fiabilité

## Mon Dalo

MonDalo est l'application en amont de DAHL'ia qui gère les recours gracieux au sein de la COMED (Commité de médiation)
Nous avons tout intérêt à s'aligner sur nos pratiques tant que faire se peut dans la perspective de pérénisation future

- Context
Dev commencé il y a 1 an 1/2
Dépo du dossieren ligne par'usager -> fait livré 10/25
Partie agent : affectation, traitement, enregistrement(n° comDalo), Décision de la CoMed
RAF : échange agent <-> usager
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
-> CERBERE, FranceConnect
(BetterAuth)

- Stockage de document : S3 ? Sous quel réseau
-> S3 du MTE

- Déploiement : Où est-ce déployé, cloud, interne, PaaS, IaaS ? DNUM ou cloud ?
-> Ecocompose (docker-compose sur des machine de prod)

- Combien d’environnement ?
-> en déployé : dev -> preprod, preprod -> ecole, prod

- Quelle techno DB ?
-> postgres -> ecosql (postgres toujours)

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
