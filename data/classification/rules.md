# Règles de caractérisation des dossiers

Ce fichier décrit `rules.ts` : le jeu de règles qui déduit les caractéristiques
métier d’un dossier à partir de son texte libre. Il explique comment lire une
règle, pourquoi l’ordre compte, et comment le moteur s’en sert à la
classification.

## Ce que les règles produisent

Trois attributs, les mêmes que ceux saisis à la main dans la fiche dossier
(« Raison », type de contentieux, type de droit) :

| Attribut         | Valeurs                                                                             | Sens                                 |
| ---------------- | ----------------------------------------------------------------------------------- | ------------------------------------ |
| `rightType`      | `DALO` / `DAHO`                                                                     | Droit au logement ou à l’hébergement |
| `litigationType` | `LIQUIDATION_ASTREINTE`, `REFERE`, `INDEMNITAIRE`, `INJONCTION`, `EXCES_DE_POUVOIR` | Nature du recours                    |
| `summary`        | Chaîne libre courte                                                                 | Libellé affiché comme « Raison »     |

Une règle n’est pas obligée de tout remplir. Certaines ne posent que le type de
droit, d’autres seulement un `summary`. C’est voulu : plusieurs règles
**complètent** un même dossier, attribut par attribut.

## Quand et comment c’est utilisé

Le moteur est **pur** : `classify(input, rules)` reçoit du texte et renvoie un
résultat

1. Charge les dossiers non supprimés qui ont un **titre** (sans titre, rien à
   analyser : le dossier est ignoré, pas listé parmi les « non reconnus »).
2. Construit l’entrée du moteur :
   - `title` : intitulé Télérecours ;
   - `decision` : nature + dispositif de la dernière lecture de décision,
     concaténés (souvent encore vide aujourd’hui).
3. Appelle `classify()` avec `DEFAULT_RULES`.
4. Décide quoi écrire (`planCaseFileUpdate`) :
   - seulement les attributs que les règles ont **effectivement produits** ;
   - seulement s’ils **diffèrent** de la valeur en base ;
   - et, **sauf si c'est demandé explicitement avec les options `--overwrite` / `--classify-overwrite`**, seulement si le champ
     est encore vide — pour ne pas écraser une saisie humaine.

Un dossier est « reconnu » dès qu’**au moins un** attribut a été déduit. Un
dossier « non reconnu » n’a matché aucune règle utile.

## Normalisation : écrire les motifs contre une forme canonique

Les titres Télérecours sont saisis à la main. Ponctuation, casses, accents,
tirets, underscores et retours à la ligne varient. Avant tout matching, chaque
champ passe par `normalizeText` :

- minuscules ;
- accents retirés (`hébergement` → `hebergement`) ;
- toute suite de caractères **non alphanumériques** réduite à **une** espace.

Conséquence : les motifs de `rules.ts` sont écrits **déjà normalisés**. On ne
cherche pas `d'astreinte` ni `d’astreinte`, mais `d astreinte`. On n’écrit pas
`hébergement`, mais `hebergement`.

Exemples d’équivalence :

| Titre brut                               | Texte vu par les règles                |
| ---------------------------------------- | -------------------------------------- |
| `DALO_Liquidation d'astreinte`           | `dalo liquidation d astreinte`         |
| `DALO - LIQUIDATION ASTREINTES`          | `dalo liquidation astreintes`          |
| `LOGEMENT - Recours en excès de pouvoir` | `logement recours en exces de pouvoir` |

`\b` (frontière de mot) reste pertinent : après normalisation, les mots sont
séparés par des espaces.

## Anatomie d’une règle

Chaque entrée de `DEFAULT_RULES` a cette forme :

```ts
{
  id: "litigation-refere",           // identifiant stable, tracé dans les logs / CSV
  description: "…",                  // pourquoi la règle existe (sorties --explain)
  pattern: /\brefere\b( (liberte|suspension))?/,  // regex sur le texte NORMALISÉ
  fields: ["title"],                 // optionnel : champs à inspecter, dans l’ordre
  litigationType: "REFERE",          // attributs optionnels, indépendants
  rightType: "DALO",
  summary: "Référé",                 // chaîne fixe, ou fonction (match, texte) => string
  examples: ["…"],                   // titres réels Télérecours, testés automatiquement
}
```

Points d’interprétation :

- **`id`** : apparaît dans les logs (`ruleIds`) et le CSV d’export. Ne pas le
  renommer à la légère.
- **`pattern`** : un `String.match` (donc le **premier** match dans le champ,
  pas tous). Les groupes de capture servent surtout aux `summary` calculés.
- **`fields`** : par défaut `title` puis `decision`. Une règle restreinte à
  `["title"]` ignore volontairement le dispositif de la décision. C’est le cas
  du filet `litigation-annulation-decision` : le mot « annulation » dans un
  dispositif est trop générique (toutes chambres).
- **`summary` fonction** : reçoit le `RegExpMatchArray` et le texte normalisé.
  Exemple : `litigation-refere` distingue « Référé liberté », « Référé
  suspension » et « Référé ».
- **`examples`** : titres **bruts** (tels que dans Télérecours). Le test les
  normalise, vérifie que **cette** règle pose bien les attributs attendus, et
  qu’**aucune règle antérieure** ne les lui vole.

## Sémantique du moteur : la première règle gagne, par attribut

`classify()` parcourt `DEFAULT_RULES` de haut en bas. Pour chaque règle, il
essaie les champs dans l’ordre (`fields` ou `title` puis `decision`). Au
premier champ qui matche :

1. Pour chaque attribut que la règle **propose**, s’il n’est **pas encore
   renseigné** dans le résultat, il est posé.
2. Si au moins un attribut a réellement été posé, la règle est enregistrée dans
   `matches` (avec le champ et la liste des attributs qu’elle a contribués).
3. La règle n’est **plus réévaluée** sur les champs suivants.

Conséquences pratiques :

- **L’ordre dans `rules.ts` est de la sémantique**, pas de la documentation.
  Une règle trop générique placée trop haut « vole » l’attribut aux plus
  spécifiques.
- Les attributs sont **indépendants**. Un titre `DALO_Liquidation d'astreinte`
  est caractérisé par **deux** règles : l’une pose `rightType = DALO`, l’autre
  pose `litigationType` et `summary`.
- Une règle plus bas qui matche encore mais dont tous les attributs sont déjà
  pris **ne contribue rien** (elle n’apparaît pas dans `matches`).
- On peut donc laisser une règle de section B poser un `summary` informatif,
  puis une règle de section C poser seulement le `litigationType` manquant.

## Les cinq sections, de la plus spécifique à la plus générique

Le fichier est découpé en blocs A → E. Ce n’est pas décoratif : c’est
l’ordre d’évaluation.

### A. Type de droit (`rightType` seulement)

But : décider DALO vs DAHO **avant** que le reste du titre ne brouille la
piste.

1. Acronymes explicites `DAHO` puis `DALO` — un dossier
   « DALO : absence de proposition d’hébergement » reste un **DALO**, même si
   le mot « hébergement » apparaît.
2. Mot « hébergement » sans acronyme → DAHO.
3. Mot « logement » / `logt` / `lgt` sans acronyme → DALO.

Ces règles ne touchent ni au contentieux ni à la raison.

### B. Situations qui ne qualifient **pas** la procédure (`summary` seulement)

Libellés plus parlants que le type de recours, mais qui **ne disent pas** s’il
s’agit d’un REP, d’une injonction, etc. Elles viennent **avant** la section C
pour que le `summary` soit déjà pris : une liquidation d’astreinte plus bas ne
pourra plus l’écraser.

| Id                                      | Raison posée                           | Ne pose pas      |
| --------------------------------------- | -------------------------------------- | ---------------- |
| `situation-execution-jugement`          | Exécution de jugement                  | `litigationType` |
| `situation-sortie-dispositif`           | Recours contre la sortie du dispositif | `litigationType` |
| `situation-carence-hebergement-urgence` | Carence en hébergement d’urgence       | `litigationType` |

Le type de contentieux, s’il est identifiable par ailleurs, sera posé par C
(ou D, ou E).

### C. Type de contentieux (marqueurs explicites)

Quand le titre **nomme** la procédure.

| Id                                 | `litigationType`        | `summary`                                        |
| ---------------------------------- | ----------------------- | ------------------------------------------------ |
| `litigation-liquidation-astreinte` | `LIQUIDATION_ASTREINTE` | Liquidation d’astreinte                          |
| `litigation-refere`                | `REFERE`                | Référé / Référé liberté / Référé suspension      |
| `litigation-indemnitaire`          | `INDEMNITAIRE`          | Recours indemnitaire                             |
| `litigation-injonction`            | `INJONCTION`            | Recours en injonction                            |
| `litigation-exces-de-pouvoir`      | `EXCES_DE_POUVOIR`      | _(aucun — laissé aux situations plus parlantes)_ |

La règle indemnitaire est volontairement large : fautes de frappe
(`indemmitaire`), « indemnisation », « condamnation … à verser », « réparation
du préjudice », « trouble dans les conditions d’existence ».

### D. Situations qui **qualifient** la procédure (`summary` + `litigationType`)

Le titre décrit un **fait** d’où l’on infère le recours, sans le nommer.

| Id                                           | Inférence                                      | Pourquoi cet ordre interne                                                                                               |
| -------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `situation-rejet-commission`                 | REP — recours contre le rejet de la commission | La commission est nommée : c’est le libellé le plus précis                                                               |
| `situation-refus-reconnaissance-prioritaire` | REP — refus de reconnaissance prioritaire      | **Après** la précédente : si la commission est citée, on préfère son `summary`                                           |
| `situation-absence-proposition-logement`     | Injonction DALO                                |                                                                                                                          |
| `situation-absence-proposition-hebergement`  | Injonction DAHO                                | Même si le titre dit « LOGEMENT », l’absence d’hébergement reste une injonction ; le `rightType` a déjà été tranché en A |

### E. Filet de sécurité (évalué en dernier)

`litigation-annulation-decision` : une demande d’annulation d’une décision
administrative est un REP, avec le `summary` « Recours en annulation d’une
décision ».

Restreinte à `fields: ["title"]`. Dans un **dispositif**, « annulation de la
décision » est le libellé standard de **toute** annulation, y compris hors
DALO/DAHO. Matcher `decision` ramènerait des dossiers d’autres chambres.

## Exemple pas à pas

Titre : `DALO : absence de proposition d'hébergement. Décision du 05/01/2016.`

1. Normalisation →
   `dalo absence de proposition d hebergement decision du 05 01 2016`.
2. **A** `right-type-dalo-explicit` (`\bdalo\b`) → `rightType = DALO`.
   Plus tard, `right-type-daho-hebergement` matcherait aussi « hebergement »,
   mais `rightType` est déjà pris.
3. **B** : aucun motif d’exécution / sortie / carence.
4. **C** : pas de liquidation, référé, indemnitaire, injonction **nommée**, ni
   « exces de pouvoir » / `rep`.
5. **D** `situation-absence-proposition-hebergement` →
   `litigationType = INJONCTION`,
   `summary = "Absence de proposition d'hébergement"`.
6. **E** matcherait « decision » dans un autre intitulé d’annulation ; ici
   `litigationType` et `summary` sont déjà posés, donc sans effet.

Résultat : DALO + injonction + « Absence de proposition d’hébergement ».

Autre cas fréquent, `DALO_Liquidation d'astreinte` :

- A → DALO ;
- C → liquidation d’astreinte (type **et** raison) ;
- B n’a rien pris avant, donc C peut encore poser le `summary`.

## Lire `matches` (logs, CSV)

Chaque contribution est `{ ruleId, field, attributes }`. Un dossier typique
agrège plusieurs ids, par exemple :

```text
right-type-dalo-explicit + litigation-liquidation-astreinte
```

En `--dry-run` / `--verbose`, une ligne ressemble à :

```text
2400745: DALO_Liquidation d'astreinte, litigationType=LIQUIDATION_ASTREINTE, rightType=DALO, summary=Liquidation d'astreinte (right-type-dalo-explicit + litigation-liquidation-astreinte)
```

Si un attribut manque dans cette ligne, aucune règle ne l’a produit (ou il
était déjà en base et `--overwrite` n’est pas actif).

## Ajouter ou ajuster une règle

1. Placer la nouvelle entrée **dans la bonne section**, et **au bon rang**
   dans cette section (plus spécifique au-dessus).
2. Écrire le `pattern` contre du texte **normalisé**. Vérifier avec
   `normalizeText("titre réel")` si le motif est ambigu.
3. Ne renseigner que les attributs que la règle **doit** poser. Pour un
   `summary` plus informatif que le libellé de contentieux, omettre
   `litigationType` et mettre la règle en B.
4. Ajouter des `examples` : des titres **réels**, pas inventés. Le test
   `rules.unit.test.ts` garantit que chaque exemple est reconnu **par cette
   règle** et qu’aucune règle **au-dessus** ne lui prend ses attributs.
5. Ajouter une ligne dans le tableau de cas de bout en bout du même fichier
   de test (titre → triplet attendu), surtout si plusieurs règles
   coopèrent.
6. Lancer `pnpm test` sur `data/classification/`. Un
   `pnpm classify:case-files -- --jurisdiction TA069 --dry-run` liste les
   dossiers encore non reconnus : c’est la source habituelle des prochaines
   règles.
