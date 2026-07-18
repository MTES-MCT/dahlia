import type { LitigationType, Prisma, RightType } from "@prisma/client";
import {
  getMainClaimantActor,
  getMainDefenderActor,
  type CaseFileWithActors,
} from "@/app/lib/case-file-actors";
import { litigationTypeShortLabel, rightTypeShortLabel } from "@/app/lib/case-file-enums";

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

// Mirror Postgres `displayName` (cf. migration actor_display_name_by_actor_type):
// natural persons use first/last name; legal persons use legalPersonName/legalEntityName.
export function getActorDisplayName(actor: ActorForDisplay): string {
  if (!actor) return "-";

  if (actor.actorType === "NATURAL_PERSON") {
    if (actor.firstName && actor.lastName) return `${actor.lastName} ${actor.firstName}`;
    if (actor.lastName) return actor.lastName;
    if (actor.firstName) return actor.firstName;
    if (actor.legalEntityName) return actor.legalEntityName;
    return "-";
  }

  if (actor.legalPersonName) return actor.legalPersonName;
  if (actor.legalEntityName) return actor.legalEntityName;
  if (actor.firstName && actor.lastName) return `${actor.lastName} ${actor.firstName}`;
  if (actor.lastName) return actor.lastName;
  if (actor.firstName) return actor.firstName;
  return "-";
}

export type CaseFileDisplayNameSource = {
  caseFileNumber: string;
  title: string | null;
  litigationType: LitigationType | null;
  rightType: RightType | null;
  summary: string | null;
};

// Compact label: `<number> - <title> - <claimant> - <litigation> - <right> (summary)`.
// Undefined segments are omitted rather than shown as placeholders.
export function getCaseFileDisplayName(
  caseFile: CaseFileDisplayNameSource & CaseFileWithActors,
): string {
  const parts = [caseFile.caseFileNumber];
  const mainClaimantName = getActorDisplayName(getMainClaimantActor(caseFile));
  const mainDefenderName = getActorDisplayName(getMainDefenderActor(caseFile));
  const litigation = litigationTypeShortLabel(caseFile.litigationType);
  const right = rightTypeShortLabel(caseFile.rightType);

  // we display the title only if it is not a litigation or right type
  if (mainClaimantName !== "-" && mainDefenderName !== "-") {
    parts.push(`${mainClaimantName} vs ${mainDefenderName}`);
  } else if (mainClaimantName !== "-") {
    parts.push(mainClaimantName);
  } else if (mainDefenderName !== "-") {
    parts.push(mainDefenderName);
  }
  if (litigation) parts.push(litigation);
  if (right) parts.push(right);

  const base = parts.join(" - ");
  return caseFile.summary ? `${base} (${caseFile.summary})` : base;
}
