import { fr } from "@codegouvfr/react-dsfr";
import { Badge, type BadgeProps } from "@codegouvfr/react-dsfr/Badge";
import { Tooltip } from "@codegouvfr/react-dsfr/Tooltip";
import { differenceInBusinessDays } from "date-fns";
import { formatDateFr } from "@/app/lib/case-file-format";
import { normalizeForSearch } from "@/app/lib/case-file-search";

// Number of business days before the deadline under which it is flagged as
// "Très urgent" (less than 2) or "Urgent" (less than 10).
const VERY_URGENT_WINDOW_BUSINESS_DAYS = 3;
const URGENT_WINDOW_BUSINESS_DAYS = 11;

// The memory-production deadline only makes sense once the case file is
// scheduled for a hearing: the badge is therefore computed and shown only for
// this status. Compared in normalized form (lowercase, accent-insensitive) to
// tolerate label casing/accent variations.
const MEMORY_DEADLINE_STATUS = normalizeForSearch("Inscrit au rôle d'une audience");

// Cell for the "Date limite de production de mémoire" column: shows the hearing
// convocation date and, when the case file is "Inscrit au rôle d'une audience"
// and depending on how close the date is, a status badge below it:
// - "Passé" when the date is already in the past,
// - "Très urgent" when it falls within the next 2 business days,
// - "Urgent" when it falls within the next 10 business days.
export function MemoryDeadlineCell({ date, status }: { date: Date | null; status: string }) {
  if (!date) return null;

  // Compare calendar days only: startOfDay normalizes both dates to local
  // midnight so the time component (and any timezone offset on the stored
  // convocation date) no longer affects the comparison.
  const startOfToday = new Date();
  const startOfDeadline = date;

  let badgeLabel: string | null = null;
  let badgeTooltip: string | null = null;
  let badgeSeverity: BadgeProps["severity"] = "warning";
  // The badge is only relevant for case files scheduled for a hearing.
  if (normalizeForSearch(status) === MEMORY_DEADLINE_STATUS) {
    if (startOfDeadline < startOfToday) {
      badgeLabel = "Passé";
      badgeSeverity = "error";
    } else {
      const businessDays = differenceInBusinessDays(startOfDeadline, startOfToday);
      if (businessDays < VERY_URGENT_WINDOW_BUSINESS_DAYS) {
        badgeLabel = "Très urgent";
        badgeTooltip = "Échéance dans moins de 2 jours ouvrés";
        badgeSeverity = "error";
      } else if (businessDays < URGENT_WINDOW_BUSINESS_DAYS) {
        badgeLabel = "Urgent";
        badgeTooltip = "Échéance dans moins de 2 semaines";
        badgeSeverity = "warning";
      }
    }
  }

  return (
    <>
      {formatDateFr(date)}
      {badgeLabel && (
        <div className={fr.cx("fr-mt-1v")}>
          {badgeTooltip ? (
            <Tooltip title={badgeTooltip}>
              <Badge severity={badgeSeverity}>{badgeLabel}</Badge>
            </Tooltip>
          ) : (
            <Badge severity={badgeSeverity}>{badgeLabel}</Badge>
          )}
        </div>
      )}
    </>
  );
}
