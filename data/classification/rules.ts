import type { ClassificationRule } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Rule set used to derive `rightType`, `litigationType` and `summary` from the
// free-text fields of a case file (today its `title`, tomorrow its decision).
//
// Patterns are matched against the NORMALIZED value (see normalize.ts): lower
// case, accent-free, every non-alphanumeric run collapsed into one space. So
// "DALO_Liquidation d'astreinte" and "DALO - LIQUIDATION ASTREINTES" are both
// seen as "dalo liquidation d astreinte(s)".
//
// Order matters: rules are evaluated top-down and the first one providing a
// given attribute wins. Hence the three sections below, from the most specific
// to the most generic:
//   A. right type   — explicit acronym (DALO/DAHO) before the generic wording
//                     (logement/hébergement), so "DALO : absence de proposition
//                     d'hébergement" stays a DALO case file.
//   B. situations that do NOT qualify the procedure — they only feed `summary`,
//                     which is why they come before section C: their wording is
//                     more informative than the litigation label itself.
//   C. litigation   — explicit procedure markers.
//   D. situations that DO qualify the procedure — `summary` + `litigationType`.
//   E. generic fallback — evaluated last, fills only what is still missing.
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_RULES: readonly ClassificationRule[] = [
  // ───── A. Right type ─────
  {
    id: "right-type-daho-explicit",
    description: "Acronyme DAHO explicite dans le champ",
    pattern: /\bdaho\b/,
    rightType: "DAHO",
    examples: ["DAHO - décision 30 janvier 2024", "Liquidation d'astreinte DAHO"],
  },
  {
    id: "right-type-dalo-explicit",
    description: "Acronyme DALO explicite (prioritaire sur le mot « hébergement »)",
    pattern: /\bdalo\b/,
    rightType: "DALO",
    examples: ["DALO_Liquidation d'astreinte", "DALO : absence de proposition d'hébergement."],
  },
  {
    id: "right-type-daho-hebergement",
    description: "Mention de l'hébergement sans acronyme : droit à l'hébergement (DAHO)",
    pattern: /\bhebergement\b/,
    rightType: "DAHO",
    examples: ["Hébergement_Liquidation d'astreinte"],
  },
  {
    id: "right-type-dalo-logement",
    description: "Mention du logement sans acronyme : droit au logement (DALO)",
    pattern: /\b(logement|logt|lgt)\b/,
    rightType: "DALO",
    examples: ["LOGEMENT - Liquidation d'astreinte"],
  },

  // ───── B. Situations that do not qualify the procedure (summary only) ─────
  {
    id: "situation-execution-jugement",
    description:
      "Demande d'exécution d'un jugement / d'une ordonnance (le type de contentieux reste à qualifier)",
    pattern:
      /\bexecution (du |de la |d une |d un )?(jugement|decision|ordonnance)\b|\bexe jugt\b|\bdemande d execution\b/,
    summary: "Exécution de jugement",
    examples: [
      "Exécution du jugement du 23/11/2020",
      "DAHO - exe jugt ordonnance du 23/09/24",
      "DALO_Demande d'exécution décision TA 2501186",
      "EXECUTION JUGEMENT - recours contre rejet commission dalo -ordonance 2207297",
    ],
  },
  {
    id: "situation-sortie-dispositif",
    description: "Recours contre une sortie du dispositif",
    pattern: /\bsortie du dispositif\b/,
    summary: "Recours contre la sortie du dispositif",
    examples: ["DALO_Recours sortie du dispositif - Décision du 02/03/2026"],
  },
  {
    id: "situation-carence-hebergement-urgence",
    description: "Carence de l'État ou de la métropole en matière d'hébergement d'urgence",
    pattern: /\bcarence\b.*\bhebergement d urgence\b/,
    summary: "Carence en hébergement d'urgence",
    examples: [
      "LOGEMENT - Refus implicite d'indemnisation du préjudice subi du fait de la carence de l'Etat dans la prise en charge de personnes sans abri au titre de sa compétence en matière d'hébergement d'urgence à compter du 01/01/2021 - Responsabilité",
    ],
  },

  // ───── C. Litigation type ─────
  {
    id: "litigation-liquidation-astreinte",
    description: "Liquidation d'astreinte (avec ou sans apostrophe, au pluriel ou non)",
    pattern: /\bliquidation (de l |de la |des |d une |d )?astreintes?\b/,
    litigationType: "LIQUIDATION_ASTREINTE",
    summary: "Liquidation d'astreinte",
    examples: [
      "DALO LIQUIDATION ASTREINTE",
      "DALO_Liquidation d'astreinte",
      "DALO_Liquidation d'astreintes",
      "DALO - Liquidation d'astreinte",
      "Hébergement_Liquidation d'astreinte",
      "LIQUIDATION DE L'ASTREINTE DU DOSSIER DALO N° 2400745. JUGEMENT DU 19MARS 2024.",
      "LIQUIDATION DE L'ASTREINTE DU JUGEMENT DALO N° 2505293 DU 29 OCTOBRE 2025.",
    ],
  },
  {
    id: "litigation-refere",
    description: "Référé (liberté, suspension ou non qualifié)",
    // Group 2 carries the qualifier, when the field gives one.
    pattern: /\brefere\b( (liberte|suspension))?/,
    litigationType: "REFERE",
    summary: (match) => {
      if (match[2] === "liberte") return "Référé liberté";
      if (match[2] === "suspension") return "Référé suspension";
      return "Référé";
    },
    examples: [
      "ETRANGERS - Hébergement d'urgence - Référé Liberté",
      "RECOURS C/ COMMISSION DALO du 4 juin 24- REFERE SUSPENSION",
    ],
  },
  {
    id: "litigation-indemnitaire",
    description:
      "Recours indemnitaire / demande d'indemnisation (« indemmitaire » mal orthographié inclus), " +
      "y compris quand seul le résultat recherché est décrit : condamnation à verser une somme, " +
      "réparation d'un préjudice, trouble dans les conditions d'existence",
    pattern:
      /\bindem[mn]itaires?\b|\bindemnisation\b|\bcondamnation\b.{0,80}\ba (lui )?verser\b|\breparation d(u|es) prejudices?\b|\btroubles? dans (les|ses) conditions (de l )?existence\b/,
    litigationType: "INDEMNITAIRE",
    summary: "Recours indemnitaire",
    examples: [
      "RECOURS INDEMNITAIRE DALO",
      "DALO- Recours indemmitaire",
      "LOGEMENT -Recours indemnitaire DALO -  décision implicite de rejet",
      "DALO - Demande indemnitaire -  decision 14 mars 2023",
      "Condamnation du préfet de l'Hérault à verser au requérant la somme de 250 euros par mois de carence de l'administration, soit un montant total de 2 500 euros au titre de son trouble dans les conditions de l'existence au mois d'août 2026",
    ],
  },
  {
    id: "litigation-injonction",
    description: "Recours en injonction explicite",
    pattern: /\binjonctions?\b/,
    litigationType: "INJONCTION",
    summary: "Recours en injonction",
    examples: ["DALO - recours injonction"],
  },
  {
    id: "litigation-exces-de-pouvoir",
    description: "Recours pour excès de pouvoir explicite (REP)",
    pattern: /\bexces de pouvoir\b|\brep\b/,
    litigationType: "EXCES_DE_POUVOIR",
    examples: ["LOGEMENT - Recours en excès de pouvoir - décision du 12/04/2022"],
  },

  // ───── D. Situations that qualify the procedure (summary + litigation type) ─────
  {
    id: "situation-rejet-commission",
    description: "Recours contre une décision de rejet de la commission DALO/DAHO",
    // "décision" is a trigger too: a title mentioning the commission's decision
    // is a recours against it.
    pattern:
      /\b(recours|rejet|refus|opposition|decisions?)\b.*\bcommission (dalo|daho|de mediation|departementale du droit au logement opposable)\b/,
    litigationType: "EXCES_DE_POUVOIR",
    summary: "Recours contre le rejet de la commission",
    examples: [
      "Recours c/rejet commission dalo - décision 20 février 2024",
      "LOGEMENT - Recours contre rejet commission DALO - décision du 19/08/2025",
      "LOGEMENT - Refus de faire droit à une demande de logement - Décision commission DALO du 12/04/2022",
      "DALO - Annulation des décisions implicites du 17 février 2026 et du 9 mai 2026 par lesquelles la commission de médiation du département de l'Hérault a respectivement rejeté le recours amiable n°2025-034-001938 et le recours gracieux tendant à la reconnaissance du caractère prioritaire et urgent de la demande de logement -",
      "DALO - Annulation de la décision du 3 février 2026 par laquelle la commission départementale du droit au logement opposable de l’Hérault a rejeté le recours amiable tendant à ce que la demande de logement soit reconnue comme prioritaire et urgente",
    ],
  },
  {
    // Deliberately placed AFTER `situation-rejet-commission`: when the
    // commission is named, "recours contre le rejet de la commission" is more
    // informative than the refusal wording. This rule catches the titles that
    // describe the refusal without naming the commission.
    id: "situation-refus-reconnaissance-prioritaire",
    description:
      "Contestation d'un refus de reconnaissance du caractère prioritaire (commission non nommée)",
    pattern:
      /\brefus\b( implicite)?( de| d une)? reconnaissance prioritaire\b|\b(refus|refusant|refuse|rejetant|rejete)\b (la |le |de )?(reconnaissance du )?caractere (urgent et |prioritaire et )?(prioritaire|urgent)\b/,
    litigationType: "EXCES_DE_POUVOIR",
    summary: "Refus de reconnaissance prioritaire",
    examples: [
      "LOGEMENT - Refus reconnaissance prioritaire au titre du DALO - décision du 24/03/2026",
      "LOGEMENT- Refus implicite de reconnaissance prioritaire au titre du DALO",
      "DALO: ANNULATION DE LA DECISION EN DATE DU 4 MARS 2025 REFUSANT LA RECONNAISSANCE DU CARACTERE PRIORITAIRE DE SA DEMANDE DE LOGEMENT.",
      "DALO: ANNULATION DE LA DECISION EN DATE DU 7 JANVIER 2025 REFUSANT LE CARACTERE PRIORITAIRE DE SA DEMANDE DE LOGEMENT",
    ],
  },
  {
    id: "situation-absence-proposition-logement",
    description: "Absence de proposition de logement : recours injonction DALO",
    pattern: /\babsence (de |d une )?proposition (de |d un )?logement\b/,
    litigationType: "INJONCTION",
    summary: "Absence de proposition de logement",
    examples: ["Logement DALO\r\nAbsence de proposition de logement\r\nDécision du 08/03/2022"],
  },
  {
    id: "situation-absence-proposition-hebergement",
    description: "Absence de proposition d'hébergement : recours injonction DAHO",
    pattern: /\babsence (de |d une )?proposition (d |de l )?hebergement\b/,
    litigationType: "INJONCTION",
    summary: "Absence de proposition d'hébergement",
    examples: [
      "LOGEMENT - ABSENCE PROPOSITION D'HEBERGEMENT",
      "DALO : absence de proposition d'hébergement. Décision du 05/01/2016.",
    ],
  },

  // ───── E. Generic fallback (evaluated last) ─────
  {
    id: "litigation-annulation-decision",
    description:
      "Demande d'annulation d'une décision administrative : recours pour excès de pouvoir. " +
      "Filet de sécurité évalué en dernier, pour les intitulés dont la situation n'est pas reconnue.",
    // Title only: the operative part of ANY annulment ruling reads "annulation
    // de la décision …", whatever the subject matter. Matching `decision` here
    // would drag in the case files of other chambers (travail, aide sociale,
    // police …), which carry no right type and are out of the DALO/DAHO scope.
    fields: ["title"],
    pattern: /\bannul(ation|er) (de |des |d une |d )?(la |les |l )?decisions?\b/,
    litigationType: "EXCES_DE_POUVOIR",
    summary: "Recours en annulation d'une décision",
    examples: [
      "DALO - Annulation de la décision implicite de rejet de la demande du 19 janvier 2024 en vue d'une offre de logement",
    ],
  },
];
