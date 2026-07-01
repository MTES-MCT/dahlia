import type { Prisma } from "@prisma/client";

// Pure formatting helpers shared between Server Components and Client Components.
// They must NOT import the Prisma client (which pulls `pg`/`dns`): keeping them
// in a dedicated module lets `'use client'` components reuse them without
// dragging server-only code into the browser bundle.

type ActorForDisplay = Prisma.ActorGetPayload<object> | null;

// Format a date as dd/mm/yyyy (French format); empty string when absent.
export function formatDateFr(date: Date | null | undefined): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function getActorDisplayName(actor: ActorForDisplay): string {
  if (!actor) return "-";
  if (actor.legalPersonName) return actor.legalPersonName;
  if (actor.legalEntityName) return actor.legalEntityName;
  if (actor.firstName && actor.lastName) return `${actor.lastName} ${actor.firstName}`;
  if (actor.lastName) return actor.lastName;
  if (actor.firstName) return actor.firstName;
  return "-";
}
