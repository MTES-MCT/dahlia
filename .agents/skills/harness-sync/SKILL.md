---
name: harness-sync
description: Revue du harnais IA (AGENTS.md, skills, hooks, permissions, sous-agents) face au code modifié depuis la dernière synchronisation. À lancer avant une PR importante, quand le hook stop-check le suggère, ou quand l'utilisateur a corrigé plusieurs fois le même comportement.
---

# /harness-sync — garder le harnais aligné sur le code

**Règle d'or : proposer, jamais appliquer sans validation.**

## Étapes

1. **Point de départ** : lire `.agents/HARNESS_SYNC` (SHA de la dernière revue).
2. **Collecte (déléguer à `scout`)** : `git log --oneline <sha>..HEAD`, `git diff --stat <sha>..HEAD` et les changements non commités. Confronter le résultat à `.agents/harness-triggers.txt`. Résumé attendu : liste `zone touchée → élément du harnais concerné`.
3. **Analyse (modèle principal)** : pour chaque zone, relire la section concernée et vérifier si elle est encore vraie.
   - `AGENTS.md` : commandes, chemins, stack, règles.
   - `.agents/skills/*` et `.agents/agents/*`.
   - `.agents/settings.json` (allow / ask / deny) et `.agents/hooks/*`.
   - Diagramme mermaid du `README.md` si le schéma Prisma a changé.
4. **Retours de session** : relever les corrections répétées de l'utilisateur. Une **règle d'équipe** va dans AGENTS.md. Une **préférence personnelle** va dans la mémoire Claude. Une **règle vérifiable par une machine** devient une règle ESLint ou un hook plutôt qu'une phrase.
5. **Proposition** : liste numérotée de diffs courts, chacun avec 1 ligne de justification. Rester frugal : supprimer une règle obsolète vaut mieux qu'en ajouter une.
6. **Après validation** : appliquer les diffs, puis écrire `git rev-parse HEAD > .agents/HARNESS_SYNC`.

## Garde-fous

- Ne jamais affaiblir une règle `deny` ni un hook de sécurité sans demande explicite de l'utilisateur.
- Ne pas ajouter de skill ou de MCP sans besoin avéré et récurrent.
- AGENTS.md est partagé avec d'autres agents (opencode/Albert) : n'y mettre que des consignes valables pour tous.
