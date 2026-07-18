import type { Prisma } from "@prisma/client";

// Pure formatting helpers shared between Server Components and Client Components.
// They must NOT import the Prisma client (which pulls `pg`/`dns`): keeping them
// in a dedicated module lets `'use client'` components reuse them without
// dragging server-only code into the browser bundle.

type ActorForDisplay = Prisma.ActorGetPayload<object> | null;

// Format a date as yyyy-mm-dd for HTML date inputs; empty string when absent.
export function formatDateInputValue(date: Date | null | undefined): string {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Today's calendar date (yyyy-mm-dd) in the court's time zone.
// FIXME : check if we need to get the TA timezone instead of Paris
function getTodayDateInputValueInParis(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(new Date());
}

export const PRODUCTION_DEADLINE_DATE_IN_PAST_WARNING =
  "Attention, la date limite de production est dans le passé.";

// True when a yyyy-mm-dd value is strictly before the given today reference.
export function isDateInputBeforeToday(
  dateInputValue: string,
  today = getTodayDateInputValueInParis(),
): boolean {
  if (!dateInputValue) return false;
  return dateInputValue < today;
}

// Format a date as dd/mm/yyyy (French format); empty string when absent.
export function formatDateFr(date: Date | null | undefined): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

// Format a date as dd/mm/yyyy à HHhMM; empty string when absent. Telerecours
// sends instants in UTC, so the time is rendered in the court's time zone rather
// than the runtime's (which is UTC in production).
export function formatDateTimeFr(date: Date | null | undefined): string {
  if (!date) return "";
  const parts = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} à ${get("hour")}h${get("minute")}`;
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
