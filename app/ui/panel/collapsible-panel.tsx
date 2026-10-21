"use client";

import { useId, useState } from "react";
import clsx from "clsx";
import { fr } from "@codegouvfr/react-dsfr";
import { Button } from "@codegouvfr/react-dsfr/Button";

type Props = {
  title: React.ReactNode;
  // Secondary line under the title, always visible.
  hint?: React.ReactNode;
  // Shown only while the panel is collapsed.
  summary?: React.ReactNode;
  defaultOpen?: boolean;
  openLabel?: string;
  children: React.ReactNode;
};

export function CollapsiblePanel({
  title,
  hint,
  summary,
  defaultOpen = false,
  openLabel = "Afficher",
  children,
}: Props) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const titleId = useId();
  const bodyId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className={clsx(
        fr.cx("fr-px-3w", "fr-mb-3w", isOpen ? "fr-py-3w" : "fr-py-2w"),
        "border",
        "border-solid",
        "border-(--border-default-grey)",
        "bg-(--background-default-grey)",
      )}
    >
      <div
        className={clsx(
          "flex",
          "items-start",
          "justify-between",
          "gap-4",
          isOpen &&
            clsx("pb-3", "border-0", "border-b", "border-solid", "border-(--border-default-grey)"),
        )}
      >
        <div className={clsx("min-w-0", "flex-1")}>
          <h2 id={titleId} className={fr.cx("fr-h6", "fr-mb-0")}>
            {title}
          </h2>
          {hint && <p className={fr.cx("fr-hint-text", "fr-mb-0")}>{hint}</p>}
        </div>
        <Button
          priority="tertiary no outline"
          size="small"
          iconId={isOpen ? "fr-icon-arrow-up-s-line" : "fr-icon-arrow-down-s-line"}
          iconPosition="right"
          onClick={() => setIsOpen((open) => !open)}
          nativeButtonProps={{ "aria-expanded": isOpen, "aria-controls": bodyId }}
        >
          {isOpen ? "Replier" : openLabel}
        </Button>
      </div>

      {!isOpen && summary && (
        <div
          className={clsx(
            fr.cx("fr-text--sm", "fr-mt-1w", "fr-mb-0"),
            "text-(--text-mention-grey)",
          )}
        >
          {summary}
        </div>
      )}

      <div id={bodyId} hidden={!isOpen} className={fr.cx("fr-mt-5v")}>
        {children}
      </div>
    </section>
  );
}
