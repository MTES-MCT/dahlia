import { fakerFR } from "@faker-js/faker";
import { createHash } from "node:crypto";
import { Actor } from "./interfaces";

function seedFor(value: string): number {
  return createHash("sha256").update(value).digest().readUInt32BE(0);
}

function deterministic<T>(source: string | null | undefined, fn: () => T): T {
  if (source) fakerFR.seed(seedFor(source));
  else fakerFR.seed();
  return fn();
}

export function anonymizeActor(actor: Actor): Actor {
  if (actor.actorType === "NATURAL_PERSON") {
    const firstName = deterministic(actor.firstName, () => fakerFR.person.firstName());
    const lastName = deterministic(actor.lastName, () => fakerFR.person.lastName().toUpperCase());
    const birthLastName = deterministic(actor.firstLastName, () =>
      fakerFR.person.lastName().toUpperCase(),
    );

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
