import { fr } from "@codegouvfr/react-dsfr";
import { Badge, type BadgeProps } from "@codegouvfr/react-dsfr/Badge";
import { differenceInBusinessDays } from "date-fns";
import { formatDateFr } from "@/app/lib/data/case-files";

// Number of business days before the deadline under which it is flagged as
// "Très urgent" (less than 2) or "Urgent" (less than 10).
const VERY_URGENT_WINDOW_BUSINESS_DAYS = 3;
const URGENT_WINDOW_BUSINESS_DAYS = 11;

// Cell for the "Date limite de production de mémoire" column: shows the hearing
// convocation date and, depending on how close it is, a status badge below it:
// - "Passé" when the date is already in the past,
// - "Très urgent" when it falls within the next 2 business days,
// - "Urgent" when it falls within the next 10 business days.
export function MemoryDeadlineCell({ date }: { date: Date | null }) {
  if (!date) return null;

  // Compare calendar days only: startOfDay normalizes both dates to local
  // midnight so the time component (and any timezone offset on the stored
  // convocation date) no longer affects the comparison.
  const startOfToday = new Date();
  const startOfDeadline = date;

  let badgeLabel: string | null = null;
  let badgeSeverity: BadgeProps["severity"] = "warning";
  if (startOfDeadline < startOfToday) {
    badgeLabel = "Passé";
    badgeSeverity = "error";
  } else {
    const businessDays = differenceInBusinessDays(startOfDeadline, startOfToday);
    if (businessDays < VERY_URGENT_WINDOW_BUSINESS_DAYS) {
      badgeLabel = "Très urgent";
      badgeSeverity = "error";
    } else if (businessDays < URGENT_WINDOW_BUSINESS_DAYS) {
      badgeLabel = "Urgent";
      badgeSeverity = "warning";
    }
  }

  return (
    <>
      {formatDateFr(date)}
      {badgeLabel && (
        <div className={fr.cx("fr-mt-1v")}>
          <Badge severity={badgeSeverity}>{badgeLabel}</Badge>
        </div>
      )}
    </>
  );
}
