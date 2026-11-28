import { describe, it, expect } from "vitest";
import {
  anonymizeActor,
  anonymizeCaseFileDetail,
  anonymizeDocumentIaResult,
  createNameScrubber,
  demandeurActor,
  FAKE_EMAIL,
} from "./anonymize";
import { caseFileDetailFixture } from "./test-support/fixtures";
import { Actor } from "./telerecours/types";

describe("anonymizeActor", () => {
  it("remplace les noms d'une personne physique par des valeurs aléatoires non nulles", () => {
    const actor: Actor = {
      id: 1,
      firstName: "Jean",
      lastName: "Dupont",
      lastFirstName: "Jean",
      firstLastName: "Dupont",
      legalPersonName: null,
      legalEntityName: null,
      legalEntityId: null,
      actorType: "NATURAL_PERSON",
    };

    const anonymized = anonymizeActor(actor);

    expect(anonymized.firstName).toBeTruthy();
    expect(anonymized.lastName).toBeTruthy();
    expect(anonymized.firstName).not.toBe("Jean");
    expect(anonymized.lastName).not.toBe("Dupont");
    expect(anonymized.lastFirstName).toBe(anonymized.lastName + " " + anonymized.firstName);
    expect(anonymized.firstLastName).toBe(anonymized.firstName + " " + anonymized.lastName);
    expect(anonymized.id).toBe(1);
  });

  // We don't anonymize legal persons for now because it usually is "PREFET•E"
  // it("remplace le nom d'une personne morale", () => {
  //   const actor: Actor = {
  //     id: 2,
  //     firstName: null,
  //     lastName: null,
  //     lastFirstName: null,
  //     firstLastName: null,
  //     legalPersonName: "DDETS du Rhône",
  //     legalEntityName: null,
  //     legalEntityId: null,
  //     actorType: "LEGAL_PERSON",
  //   };

  //   const anonymized = anonymizeActor(actor);

  //   expect(anonymized.legalPersonName).toBeTruthy();
  //   expect(anonymized.legalPersonName).not.toBe("DDETS du Rhône");
  //   expect(anonymized.firstName).toBeNull();
  // });
});

describe("createNameScrubber", () => {
  const person = (
    firstName: string | null,
    lastName: string | null,
    over: Partial<Actor> = {},
  ) => ({
    id: 1,
    firstName,
    lastName,
    lastFirstName: null,
    firstLastName: null,
    legalPersonName: null,
    legalEntityName: null,
    legalEntityId: null,
    actorType: "NATURAL_PERSON",
    ...over,
  });

  const dupont = person("Jean", "Dupont");
  const fake = anonymizeActor(dupont);
  const scrub = createNameScrubber([dupont]);

  it.each([
    ["Requete_DUPONT_Jean.pdf", `Requete_${fake.lastName}_${fake.firstName}.pdf`],
    ["jean-dupont.pdf", `${fake.firstName}-${fake.lastName}.pdf`],
    ["courrier M. Dupont.pdf", `courrier M. ${fake.lastName}.pdf`],
  ])("remplace les noms quelle que soit leur casse : %s", (text, expected) => {
    expect(scrub(text)).toBe(expected);
  });

  it("utilise les faux noms de l'acteur anonymisé", () => {
    expect(scrub("Dupont")).toBe(fake.lastName);
  });

  it("ignore les accents du nom comme du texte", () => {
    const actor = person("Hélène", "Lefèvre");
    const { firstName, lastName } = anonymizeActor(actor);
    const scrubActor = createNameScrubber([actor]);
    expect(scrubActor("HELENE_LEFEVRE.pdf")).toBe(`${firstName}_${lastName}.pdf`);
    expect(scrubActor("Mémoire de Mme Léfèvre.pdf")).toBe(`Mémoire de Mme ${lastName}.pdf`);
  });

  it("reconnaît un nom composé, entier ou par ses mots", () => {
    const actor = person(null, "BEN SALAH");
    const { lastName } = anonymizeActor(actor);
    const scrubActor = createNameScrubber([actor]);
    expect(scrubActor("ben_salah.pdf")).toBe(`${lastName}.pdf`);
    expect(scrubActor("BENSALAH.pdf")).toBe(`${lastName}.pdf`);
    expect(scrubActor("salah.pdf")).toBe(`${lastName}.pdf`);
    expect(scrubActor("ben_arous.pdf")).toBe("ben_arous.pdf");
  });

  it("ne remplace pas un nom à l'intérieur d'un mot", () => {
    const scrubActor = createNameScrubber([person(null, "Roux")]);
    expect(scrubActor("Rouxel.pdf")).toBe("Rouxel.pdf");
  });

  it("laisse le texte intact, normalisation comprise, sans nom à remplacer", () => {
    const decomposed = "me\u0301moire.pdf";
    expect(scrub(decomposed)).toBe(decomposed);
  });

  it("garde les personnes morales et les textes sans acteur", () => {
    const legal = person(null, null, {
      actorType: "LEGAL_PERSON",
      legalPersonName: "PREFET DU RHONE",
    });
    expect(createNameScrubber([legal])("PREFET DU RHONE.pdf")).toBe("PREFET DU RHONE.pdf");
    expect(createNameScrubber([])("Dupont.pdf")).toBe("Dupont.pdf");
  });

  it("remplace une raison sociale portée par une personne physique, en entier seulement", () => {
    const actor = person("Jean", "Dupont", { legalEntityName: "SCP Martin Avocats" });
    const { legalEntityName } = anonymizeActor(actor);
    const scrubActor = createNameScrubber([actor]);
    expect(scrubActor("SCP_Martin_Avocats.pdf")).toBe(`${legalEntityName}.pdf`);
    expect(scrubActor("Avocats.pdf")).toBe("Avocats.pdf");
  });
});

describe("anonymizeCaseFileDetail", () => {
  const scrub = (text: string) => text.replace("Dupont", "FAUX");
  const reading = {
    readingDate: "2026-01-01",
    notificationDate: null,
    nature: "Jugement",
    operativePart: "M. Dupont est rejeté",
  };

  it("remplace les noms du titre et du dispositif, et les e-mails", () => {
    const anonymized = anonymizeCaseFileDetail(
      caseFileDetailFixture({
        title: "M. Dupont",
        directory: { reference: "R1", complementaryRecipientEmails: "a@b.fr, c@d.fr" },
        lastDecisionReading: reading,
      }),
      scrub,
    );

    expect(anonymized.title).toBe("M. FAUX");
    expect(anonymized.lastDecisionReading?.operativePart).toBe("M. FAUX est rejeté");
    expect(anonymized.lastDecisionReading?.nature).toBe("Jugement");
    expect(anonymized.directory).toEqual({
      reference: "R1",
      complementaryRecipientEmails: FAKE_EMAIL,
    });
  });

  it("n'invente pas de valeur pour les champs vides", () => {
    const anonymized = anonymizeCaseFileDetail(
      caseFileDetailFixture({
        title: null,
        directory: { reference: "R1", complementaryRecipientEmails: null },
        lastDecisionReading: { ...reading, operativePart: null },
      }),
      scrub,
    );

    expect(anonymized.title).toBeNull();
    expect(anonymized.directory?.complementaryRecipientEmails).toBeNull();
    expect(anonymized.lastDecisionReading?.operativePart).toBeNull();
  });
});

describe("anonymizeDocumentIaResult", () => {
  const motifs = ["Mme MARTIN Lucie n'a pas fourni son avis d'imposition"];
  const kept = {
    type_recours: "logement",
    date_courrier: "2022-09-27",
    date_decision: "2022-09-06",
    sens_decision: "rejet",
    motifs_recours: ["Logement inadapté au handicap"],
    numero_recours: "2022-034-000514",
    tribunal_competent: "Tribunal Administratif de Montpellier",
    date_reception_recours: "2022-03-23",
    departement_commission: "Hérault",
  };
  const outcome = () => ({
    status: "SUCCESS" as const,
    metadata: { demandeur: "MARTIN Lucie", motifs_decision: motifs, ...kept },
    rawResult: {
      barcodes: [{ type: "2D-DOC", data: "MARTIN LUCIE" }],
      extraction: {
        type: "decision_comed",
        properties: [
          {
            name: "demandeur",
            type: "string",
            value: "MARTIN Lucie",
            anomaly: { code: "x", raw_value: "MARTIN Lucie" },
          },
          { name: "motifs_decision", type: "list", value: motifs },
          { name: "numero_recours", type: "string", value: kept.numero_recours },
        ],
      },
      classification: {
        confidence: 0.95,
        explanation: "Décision DALO concernant MARTIN Lucie",
        document_type: "decision_comed",
      },
    },
  });
  const fake = anonymizeActor(demandeurActor("MARTIN Lucie")!);
  const fakeName = `${fake.lastName} ${fake.firstName}`;

  it("splits the claimant into last name (upper case) and first name", () => {
    expect(demandeurActor("MARTIN Lucie")).toMatchObject({
      lastName: "MARTIN",
      firstName: "Lucie",
    });
    expect(demandeurActor("LE GALL Anne Marie")).toMatchObject({
      lastName: "LE GALL",
      firstName: "Anne Marie",
    });
    expect(demandeurActor({ nom: "TALBI" })).toMatchObject({ lastName: "TALBI", firstName: null });
    expect(demandeurActor(null)).toBeNull();
  });

  it("replaces the claimant with the fake name anonymizeActor gives them", () => {
    const result = anonymizeDocumentIaResult(outcome());
    expect(fake.lastName).not.toBe("MARTIN");
    expect(result.metadata.demandeur).toBe(fakeName);
    const [demandeur] = result.rawResult.extraction.properties;
    expect(demandeur).toMatchObject({ value: fakeName, anomaly: { raw_value: fakeName } });
  });

  it("scrubs the claimant's name from free texts and drops the barcodes", () => {
    const result = anonymizeDocumentIaResult(outcome());
    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(/MARTIN|Lucie/i);
    expect(result.metadata.motifs_decision).toEqual([
      `Mme ${fakeName} n'a pas fourni son avis d'imposition`,
    ]);
    expect(result.rawResult.classification.explanation).toBe(
      `Décision DALO concernant ${fakeName}`,
    );
    expect(result.rawResult.barcodes).toEqual([]);
  });

  it("keeps the procedural fields and is deterministic", () => {
    const result = anonymizeDocumentIaResult(outcome());
    expect(result.metadata).toMatchObject(kept);
    expect(result.rawResult.classification).toMatchObject({
      confidence: 0.95,
      document_type: "decision_comed",
    });
    expect(result.rawResult.extraction.properties[2]).toEqual(
      outcome().rawResult.extraction.properties[2],
    );
    expect(anonymizeDocumentIaResult(outcome())).toEqual(result);
  });

  it("leaves a result without claimant unchanged", () => {
    const input = { metadata: { ...kept }, rawResult: { classification: null } };
    expect(anonymizeDocumentIaResult(input)).toEqual(input);
  });
});
