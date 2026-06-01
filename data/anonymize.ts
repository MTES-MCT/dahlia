import { faker, fakerFR } from "@faker-js/faker";
import { Actor } from "./interfaces";

faker.seed();

export function anonymizeActor(actor: Actor): Actor {
  if (actor.actorType === "NATURAL_PERSON") {
    const firstName = fakerFR.person.firstName();
    const lastName = fakerFR.person.lastName();
    const birthLastName = fakerFR.person.lastName();

    return {
      ...actor,
      firstName,
      lastName,
      lastFirstName: firstName,
      firstLastName: birthLastName,
    };
  }

  // We don't anonymize legal persons for now because it usually is "PREFET•E"
  // if (actor.actorType === "LEGAL_PERSON") {
  //   return {
  //     ...actor,
  //     legalPersonName: fakerFR.company.name(),
  //   };
  // }

  return actor;
}
