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
    pattern: /\bliquidation (d )?astreintes?\b/,
    litigationType: "LIQUIDATION_ASTREINTE",
    summary: "Liquidation d'astreinte",
    examples: [
      "DALO LIQUIDATION ASTREINTE",
      "DALO_Liquidation d'astreinte",
      "DALO_Liquidation d'astreintes",
      "DALO - Liquidation d'astreinte",
      "Hébergement_Liquidation d'astreinte",
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
      "Recours indemnitaire / demande d'indemnisation (« indemmitaire » mal orthographié inclus)",
    pattern: /\bindem[mn]itaires?\b|\bindemnisation\b/,
    litigationType: "INDEMNITAIRE",
    summary: "Recours indemnitaire",
    examples: [
      "RECOURS INDEMNITAIRE DALO",
      "DALO- Recours indemmitaire",
      "LOGEMENT -Recours indemnitaire DALO -  décision implicite de rejet",
      "DALO - Demande indemnitaire -  decision 14 mars 2023",
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
    id: "situation-refus-reconnaissance-prioritaire",
    description: "Contestation d'un refus de reconnaissance du caractère prioritaire",
    pattern: /\brefus\b( implicite)?( de| d une)? reconnaissance prioritaire\b/,
    litigationType: "EXCES_DE_POUVOIR",
    summary: "Refus de reconnaissance prioritaire",
    examples: [
      "LOGEMENT - Refus reconnaissance prioritaire au titre du DALO - décision du 24/03/2026",
      "LOGEMENT- Refus implicite de reconnaissance prioritaire au titre du DALO",
    ],
  },
  {
    id: "situation-rejet-commission",
    description: "Recours contre une décision de rejet de la commission DALO/DAHO",
    // "décision" is a trigger too: a title mentioning the commission's decision
    // is a recours against it.
    pattern:
      /\b(recours|rejet|refus|opposition|decision)\b.*\bcommission (dalo|daho|de mediation)\b/,
    litigationType: "EXCES_DE_POUVOIR",
    summary: "Recours contre le rejet de la commission",
    examples: [
      "Recours c/rejet commission dalo - décision 20 février 2024",
      "LOGEMENT - Recours contre rejet commission DALO - décision du 19/08/2025",
      "LOGEMENT - Refus de faire droit à une demande de logement - Décision commission DALO du 12/04/2022",
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
];
