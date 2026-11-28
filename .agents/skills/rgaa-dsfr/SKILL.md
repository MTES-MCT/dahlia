---
name: rgaa-dsfr
description: Checklist accessibilité RGAA 4.1 + DSFR pour DAHLIA. À utiliser AVANT d'écrire ou de relire toute UI (app/ui/**, app/**/page.tsx, layout, formulaires, tableaux, modales, messages d'action) et pour une revue a11y d'un diff.
paths:
  - "app/ui/**"
  - "app/**/page.tsx"
  - "app/**/layout.tsx"
---

# RGAA + DSFR — checklist DAHLIA

Référence : audit `audits/rgaa-2026-07-20.md`. Les règles dures de AGENTS.md (titre de page, largeur des champs) s'appliquent toujours.

## Principe

1. **Composant DSFR d'abord** (`@codegouvfr/react-dsfr/*`) : il embarque déjà la sémantique ARIA. On ne recrée pas un bouton, une modale, un onglet ou une alerte à la main.
2. **HTML natif ensuite** (`<button>`, `<a href>`, `<label>`, `<table>`), et ARIA en dernier recours.
3. **Couleurs** : uniquement les tokens DSFR (`fr.colors.*`, classes `fr-*`), pas de couleur Tailwind arbitraire, pour garantir le contraste (RGAA 3.2).

## Checklist (par motif présent dans l'app)

**Page**

- `metadata.title` spécifique (sans « - DAHLIA ») + un cas dans `app/page-titles.unit.test.tsx` (8.5/8.6).
- Un seul `<h1>`, hiérarchie des titres sans saut (9.1).
- Le lien d'évitement et `lang="fr"` sont gérés par `app/layout.tsx` : ne pas les casser.

**Formulaires (11.x)**

- Chaque champ a un `<label>` visible associé (les composants `Input` / `Select` DSFR le font).
- En cas d'erreur : `state="error"` + `stateRelatedMessage` (DSFR), ou `aria-invalid="true"` + `aria-describedby` vers le message.
- Avertissement non bloquant (ex. valeur automatique à valider) : `<p class="fr-message fr-message--warning">` sous le champ, relié par `aria-describedby` au contrôle natif (`nativeInputProps` / `nativeSelectProps`), sans `aria-invalid` ni `state="error"`.
- Champs obligatoires indiqués dans le label, pas seulement par la couleur.
- Largeur adaptée à la saisie attendue (`max-w-*`, `fr-col-md-*`), jamais 100 %, sauf la recherche principale d'un tableau.
- `autocomplete` sur les champs de données personnelles de l'utilisateur.

**Tableaux (5.x)**

- `<caption>` = titre du contenu (pas un compteur).
- `<th scope="col">`, et `aria-sort` sur la colonne triée.
- Les boutons de tri sont de vrais `<button>` avec un libellé explicite.

**Messages dynamiques (7.5)**

- Résultat d'une Server Action (succès ou erreur) : il doit être annoncé, via `role="status"` (succès) ou `role="alert"` (erreur), ou `Alert` DSFR dans une zone live.
- Une bannière statique ne prend pas `role="status"`.

**Focus et clavier (7.1, 10.7, 12.x)**

- Tout est accessible au clavier, et le focus reste visible (ne pas surcharger `outline`).
- Popover, modale ou filtre : le focus entre dans l'élément à l'ouverture et revient au déclencheur à la fermeture. Utiliser la `Modal` DSFR.
- Après une soumission qui change de vue, déplacer le focus sur le titre ou le message.

**Contenus non textuels (1.x)**

- `alt` pertinent ou `alt=""` si décoratif. Icônes DSFR décoratives : `aria-hidden`.
- `<object>` / `<iframe>` (PDF) : `title` ou `aria-label`, plus un lien de téléchargement alternatif.
- Lien ou bouton qui ne contient qu'une icône : libellé accessible (`title` + texte `fr-sr-only`).

**Liens (6.x)** : intitulé explicite hors contexte. « voir » seul ne suffit pas, il faut « Voir le dossier 2401234 ». Signaler l'ouverture dans une nouvelle fenêtre.

## Vérifier

- `pnpm lint` : `jsx-a11y` est actif, et le hook post-edit le lance sur chaque fichier modifié.
- Tester au clavier (Tab, Shift+Tab, Entrée, Échap) sur `pnpm dev`, puis avec VoiceOver (macOS ⌘F5) sur les parcours modifiés.
- Pour une revue de diff : produire un rapport `fichier:ligne → critère RGAA → correction`, sans modifier le code tant que l'utilisateur n'a pas validé.
