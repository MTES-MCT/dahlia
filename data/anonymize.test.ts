import { describe, it, expect } from "vitest";
import { anonymizeActor } from "./anonymize";
import { Actor } from "./interfaces";

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
