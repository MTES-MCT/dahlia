# Choix technologique

## Base de données

On va rapidement avoir des millions de lignes à traiter et indexer

Ex : dans le Rhone on a 30 000 dossiers qui on en moyennes 10 pièces attachées et 10 lignes d'historique.

Il faut donc utiliser une base de données optimisable, on préfèrera `postgres` à `grist`

On aura aussi des centaines de miliers de documents à stocker. On utilisera un stockage de type s3

## Application : Langage de programmation et Framework

Les applications proche de DAHL'AI utilise des framework `node` :

- LITIJ : node + Pasta (framework in house)
- MonDalo : Astro (astro.build)

il n'est pas recommandé d'utiliser Pasta car il n'a pas de communauté public et le maintient peu être couteux

Astro est une solution réputée pour sa rapidité et son approche `Island architecture`. Cependant, ce n'est pas un framework utilisé dans la communauté beta.gouv.fr

On peut utiliser le framework `node` «next.js» avec une plus grosse communauté mais surtout une grosse communauté `beta.gouv`. Cela permet de ne pas trop s'éloigner des technologies utilisé au sein de la DGALN tout en utilisant une techno avec une importante communauté. De plus, dans sa dernière version next.js promeux une architecture serveur side rendering de la même manière que le framework `astro`

### Utilisation d'un cloud souverain

Plusieurs options :

- Scalingo : c'est un PaaS (plateforme as a service), on lui envoie du code et il se débrouille pour l'exécuter 
  - avantage : simple
  - désavantage : peu flexible, pas complet (pas de stockage de type s3), performances dégradé quand les bases de données commence à être importante
- Scaleway : C'est un IaaS (Infrastructure as a service)
  - avantage : plus d'option, possilité d'avoir des GPU
  - désantage : plus de code pour configurer l'infrastructure
