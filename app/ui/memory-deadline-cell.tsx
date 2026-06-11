import { fr } from "@codegouvfr/react-dsfr";
import { Badge, type BadgeProps } from "@codegouvfr/react-dsfr/Badge";
import { formatDateFr } from "@/app/lib/data/case-files";

// Number of days before the deadline under which it is flagged as "Urgent".
const URGENT_WINDOW_DAYS = 14;

// Cell for the "Date limite de production de mémoire" column: shows the hearing
// convocation date and, depending on how close it is, a status badge below it:
// - "Passé" when the date is already in the past,
// - "Urgent" when it falls within the next two weeks.
export function MemoryDeadlineCell({ date }: { date: Date | null }) {
  if (!date) return null;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const urgentLimit = new Date(startOfToday);
  urgentLimit.setDate(urgentLimit.getDate() + URGENT_WINDOW_DAYS);

  let badgeLabel: string | null = null;
  let badgeSeverity: BadgeProps["severity"] = "warning";
  if (date < startOfToday) {
    badgeLabel = "Passé";
    badgeSeverity = "error";
  } else if (date < urgentLimit) {
    badgeLabel = "Urgent";
    badgeSeverity = "warning";
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
