import clsx from "clsx";
import { fr } from "@codegouvfr/react-dsfr";

export const ASK_DAHLIA_TEAM_FORM_URL =
  "https://grist.numerique.gouv.fr/o/dahlia/forms/6K1awdXkBeigPzf2AfoMb9/34";

const LABEL = "Demander à l'équipe DAHLIA";

// Floating help button (Intercom-style). Icon-only by default; the label
// expands on hover / keyboard focus. Opens the Grist contact form in a new tab.
export function AskDahliaTeamButton() {
  return (
    <a
      href={ASK_DAHLIA_TEAM_FORM_URL}
      target="_blank"
      rel="noopener noreferrer"
      title={LABEL}
      className={clsx(
        fr.cx("fr-btn", "fr-btn--secondary", "ri-question-line", "fr-btn--icon-left", "fr-btn--lg"),
        "group",
        "fixed",
        "right-6",
        "bottom-6",
        "z-[1000]",
        "min-h-14",
        "min-w-14",
        "justify-center",
        "!rounded-full",
        "!bg-(--background-default-grey)",
        "hover:!bg-(--background-default-grey-hover)",
        "focus-visible:!bg-(--background-default-grey-hover)",
        "shadow-lg",
      )}
    >
      <span
        className={clsx(
          "inline-block",
          "max-w-0",
          "overflow-hidden",
          "whitespace-nowrap",
          "opacity-0",
          "transition-[max-width,opacity] duration-200 ease-out",
          "group-hover:max-w-xs",
          "group-hover:opacity-100",
          "group-focus-visible:max-w-xs",
          "group-focus-visible:opacity-100",
        )}
        aria-hidden="true"
      >
        {LABEL}
      </span>
      <span className={fr.cx("fr-sr-only")}>{LABEL} (nouvelle fenêtre)</span>
    </a>
  );
}
