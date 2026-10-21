"use client";

import { useEffect, useId, useRef, useState } from "react";
import clsx from "clsx";
import { fr } from "@codegouvfr/react-dsfr";

type Props = {
  text: string;
  className?: string;
};

// Long text clamped to two lines, with a "Voir plus" toggle that only appears
// when the text actually overflows.
export function ExpandableText({ text, className }: Props) {
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
          !isOpen && "line-clamp-2",
          className,
        )}
      >
        {text}
      </p>
      {(overflows || isOpen) && (
        <button
          type="button"
          className={fr.cx("fr-link", "fr-link--sm")}
          aria-expanded={isOpen}
          aria-controls={textId}
          onClick={() => setIsOpen((open) => !open)}
        >
          {isOpen ? "Voir moins" : "Voir plus"}
        </button>
      )}
    </>
  );
}
