import { describe, expect, it } from "vitest";
import { classify } from "./engine";
import { normalizeText } from "./normalize";
import { DEFAULT_RULES } from "./rules";
import type { ClassificationResult } from "./types";

// Real titles observed in Telerecours (TA069), with what the ruleset must
// deduce from them. Add a row here whenever a rule is added or tuned.
const cases: {
  title: string;
  expected: Omit<ClassificationResult, "matches">;
}[] = [
  {
    title: "DALO LIQUIDATION ASTREINTE",
    expected: {
      litigationType: "LIQUIDATION_ASTREINTE",
      rightType: "DALO",
      summary: "Liquidation d'astreinte",
    },
  },
  {
    title: "Hébergement_Liquidation d'astreinte",
    expected: {
      litigationType: "LIQUIDATION_ASTREINTE",
      rightType: "DAHO",
      summary: "Liquidation d'astreinte",
    },
  },
  {
    title: "DALO_Liquidation d'astreintes",
    expected: {
      litigationType: "LIQUIDATION_ASTREINTE",
      rightType: "DALO",
      summary: "Liquidation d'astreinte",
    },
  },
  {
    title: "Liquidation d'astreinte DAHO",
    expected: {
      litigationType: "LIQUIDATION_ASTREINTE",
      rightType: "DAHO",
      summary: "Liquidation d'astreinte",
    },
  },
  {
    // The explicit acronym wins over the generic "hébergement" wording.
    title: "DALO : absence de proposition d'hébergement. Décision du 05/01/2016.",
    expected: {
      litigationType: "INJONCTION",
      rightType: "DALO",
      summary: "Absence de proposition d'hébergement",
    },
  },
  {
    title: "Logement DALO\r\nAbsence de proposition de logement\r\nDécision du 08/03/2022",
    expected: {
      litigationType: "INJONCTION",
      rightType: "DALO",
      summary: "Absence de proposition de logement",
    },
  },
  {
    // Misspelled "indemmitaire", as typed in Telerecours.
    title: "DALO- Recours indemmitaire",
    expected: {
      litigationType: "INDEMNITAIRE",
      rightType: "DALO",
      summary: "Recours indemnitaire",
    },
  },
  {
    title: "LOGEMENT- Refus implicite de reconnaissance prioritaire au titre du DALO",
    expected: {
      litigationType: "EXCES_DE_POUVOIR",
      rightType: "DALO",
      summary: "Refus de reconnaissance prioritaire",
    },
  },
  {
    title: "Recours c/rejet commission dalo - décision 20 février 2024",
    expected: {
      litigationType: "EXCES_DE_POUVOIR",
      rightType: "DALO",
      summary: "Recours contre le rejet de la commission",
    },
  },
  {
    title: "RECOURS C/ COMMISSION DALO du 4 juin 24- REFERE SUSPENSION",
    expected: {
      litigationType: "REFERE",
      rightType: "DALO",
      summary: "Référé suspension",
    },
  },
  {
    title: "ETRANGERS - Hébergement d'urgence - Référé Liberté",
    expected: {
      litigationType: "REFERE",
      rightType: "DAHO",
      summary: "Référé liberté",
    },
  },
  {
    // The situation is more informative than the "recours indemnitaire" label.
    title:
      "LOGEMENT - Refus implicite d'indemnisation du préjudice subi du fait de la carence de l'Etat dans la prise en charge de personnes sans abri au titre de sa compétence en matière d'hébergement d'urgence à compter du 01/01/2021 - Responsabilité",
    expected: {
      litigationType: "INDEMNITAIRE",
      rightType: "DAHO",
      summary: "Carence en hébergement d'urgence",
    },
  },
  {
    // Execution of a judgment: the procedure itself stays to be qualified.
    title: "DAHO - exe jugt ordonnance du 23/09/24",
    expected: {
      rightType: "DAHO",
      summary: "Exécution de jugement",
    },
  },
  {
    title: "DALO_Recours sortie du dispositif - Décision du 02/03/2026",
    expected: {
      rightType: "DALO",
      summary: "Recours contre la sortie du dispositif",
    },
  },
  {
    // "liquidation de l'astreinte", with the article, as typed at TA034.
    title: "LIQUIDATION DE L'ASTREINTE DU JUGEMENT DU DOSSIER DALO N° 2506462 DU 26 NOVEMBRE 2025.",
    expected: {
      litigationType: "LIQUIDATION_ASTREINTE",
      rightType: "DALO",
      summary: "Liquidation d'astreinte",
    },
  },
  {
    // The refusal is described without naming the commission.
    title:
      "DALO: ANNULATION DE LA DECISION EN DATE DU 4 MARS 2025 REFUSANT LA RECONNAISSANCE DU CARACTERE PRIORITAIRE DE SA DEMANDE DE LOGEMENT.",
    expected: {
      litigationType: "EXCES_DE_POUVOIR",
      rightType: "DALO",
      summary: "Refus de reconnaissance prioritaire",
    },
  },
  {
    // Same refusal, but the commission is named: the commission wording wins.
    title:
      "DALO : ANNULATION DE LA DECISION DU 3 JUIN 2025 PRISE PAR LA COMMISSION DE MEDIATION DE L'HERAULT REFUSANT LA RECONNAISSANCE DU CARACTERE PRIORITAIRE DE SA DEMANDE DE LOGEMENT.",
    expected: {
      litigationType: "EXCES_DE_POUVOIR",
      rightType: "DALO",
      summary: "Recours contre le rejet de la commission",
    },
  },
  {
    // Plural "décisions" + the commission's full name.
    title:
      "DALO - Annulation des décisions implicites du 17 février 2026 et du 9 mai 2026 par lesquelles la commission départementale du droit au logement opposable de l’Hérault a rejeté le recours amiable et le recours gracieux",
    expected: {
      litigationType: "EXCES_DE_POUVOIR",
      rightType: "DALO",
      summary: "Recours contre le rejet de la commission",
    },
  },
  {
    // No known situation: the generic "annulation d'une décision" fallback.
    title:
      "DALO - Annulation de la décision implicite de rejet de la demande du 19 janvier 2024 en vue d'une offre de logement",
    expected: {
      litigationType: "EXCES_DE_POUVOIR",
      rightType: "DALO",
      summary: "Recours en annulation d'une décision",
    },
  },
  {
    // Indemnity claim described by its purpose only; the right type stays unknown.
    title:
      "Condamnation du préfet de l'Hérault à verser au requérant la somme de 250 euros par mois de carence de l'administration, soit un montant total de 2 500 euros au titre de son trouble dans les conditions de l'existence au mois d'août 2026",
    expected: {
      litigationType: "INDEMNITAIRE",
      summary: "Recours indemnitaire",
    },
  },
  {
    // Only the right type can be deduced from a bare decision date.
    title: "DALO - Décision du 08/04/2025",
    expected: { rightType: "DALO" },
  },
  {
    // Out of scope: nothing to deduce.
    title: "POLICE: Suspension permis de conduire",
    expected: {},
  },
];

describe("DEFAULT_RULES", () => {
  it.each(cases)("classifies $title", ({ title, expected }) => {
    const { litigationType, rightType, summary } = classify({ title });
    expect({ litigationType, rightType, summary }).toEqual(expected);
  });

  it("deduces the right type from a decision when the title says nothing", () => {
    const result = classify({
      title: "Décision du 08/03/2022",
      decision: "Rejet du recours DAHO",
    });
    expect(result.rightType).toBe("DAHO");
    expect(result.matches[0].field).toBe("decision");
  });

  it("does not apply the generic annulment fallback to a decision's operative part", () => {
    // An out-of-scope case file (aide sociale) whose ruling annuls a decision:
    // the operative part must not turn it into a DALO/DAHO litigation.
    const result = classify({
      title:
        "AIDE SOCIALE\r\nRefus bénéfice du parcours de sortie de la prostitution et d'insertion sociale et professionnelle - Décision du 09/07/2020",
      decision: "Annulation de la décision du 9 juillet 2020",
    });
    expect(result.litigationType).toBeUndefined();
    expect(result.summary).toBeUndefined();
  });

  it("has unique rule ids", () => {
    const ids = DEFAULT_RULES.map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has patterns written in normalized form (lower case, no accent)", () => {
    for (const rule of DEFAULT_RULES) {
      expect.soft(rule.pattern.source, `rule ${rule.id}`).not.toMatch(/[A-ZÀ-ɏ]/);
    }
  });

  it("recognizes every example declared on a rule", () => {
    for (const rule of DEFAULT_RULES) {
      for (const example of rule.examples ?? []) {
        const context = `rule ${rule.id} / example ${JSON.stringify(example)}`;
        expect.soft(normalizeText(example), context).toMatch(rule.pattern);

        // The example must also survive the whole ruleset: no earlier rule may
        // shadow the attributes this rule is meant to provide.
        const result = classify({ title: example });
        expect
          .soft(
            result.matches.map((match) => match.ruleId),
            context,
          )
          .toContain(rule.id);
        if (rule.litigationType) {
          expect.soft(result.litigationType, context).toBe(rule.litigationType);
        }
        if (rule.rightType) {
          expect.soft(result.rightType, context).toBe(rule.rightType);
        }
        if (typeof rule.summary === "string") {
          expect.soft(result.summary, context).toBe(rule.summary);
        }
      }
    }
  });
});
