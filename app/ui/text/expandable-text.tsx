"use client";

import { useEffect, useId, useRef, useState } from "react";
import clsx from "clsx";
import { fr } from "@codegouvfr/react-dsfr";

type Props = {
  text: string;
  // Rendered inline before the text, inside the clamped paragraph (e.g. a bold label).
  prefix?: React.ReactNode;
  className?: string;
  // Extra classes applied once expanded, e.g. a max height with a scrollbar.
  expandedClassName?: string;
};

// Long text clamped to two lines, with a "Voir plus" toggle that only appears
// when the text actually overflows.
export function ExpandableText({ text, prefix, className, expandedClassName }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);
  const textId = useId();

  // Measured on every resize: an element rendered inside a hidden ancestor
  // (e.g. a collapsed panel) has a zero height until it becomes visible.
  useEffect(() => {
    const element = textRef.current;
    if (!element || isOpen) return;
    const measure = () => setOverflows(element.scrollHeight > element.clientHeight);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text, isOpen]);

  return (
    <>
      <p
        id={textId}
        ref={textRef}
        className={clsx(
          fr.cx("fr-mb-1v"),
          "whitespace-pre-line",
          isOpen ? expandedClassName : "line-clamp-2",
          className,
        )}
      >
        {prefix}
        {text}
      </p>
      {(overflows || isOpen) && (
        <button
          type="button"
          className={fr.cx("fr-link", "fr-link--sm")}
          aria-expanded={isOpen}
          aria-controls={textId}
          onClick={() => {
            // Collapsing keeps the scroll offset of a scrollable expanded text
            // (see `expandedClassName`): reset it so the clamped lines show the start.
            if (isOpen && textRef.current) textRef.current.scrollTop = 0;
            setIsOpen(!isOpen);
          }}
        >
          {isOpen ? "Voir moins" : "Voir plus"}
        </button>
      )}
    </>
  );
}
