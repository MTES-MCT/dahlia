"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { fr } from "@codegouvfr/react-dsfr";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { normalizeForSearch } from "@/app/lib/case-file-search";
import {
  HAS_TAGS_FIELD_NAME,
  TAG_IDS_FIELD_NAME,
  type CaseFileTagView,
} from "@/app/lib/case-file-tags";
import { TagBadge } from "@/app/ui/case-file/tag-badge";

export type TagPickerProps = {
  // Every existing tag, already sorted by label. Users pick from this list only:
  // creating a tag is reserved to administrators.
  availableTags: CaseFileTagView[];
  defaultSelectedIds: number[];
  className?: string;
};

export function TagPicker({ availableTags, defaultSelectedIds, className }: TagPickerProps) {
  const [selectedIds, setSelectedIds] = useState<number[]>(defaultSelectedIds);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const optionId = (index: number) => `${baseId}-option-${index}`;
  const containerRef = useRef<HTMLDivElement>(null);

  const tagsById = useMemo(
    () => new Map(availableTags.map((tag) => [tag.id, tag])),
    [availableTags],
  );

  const selectedTags = selectedIds
    .map((id) => tagsById.get(id))
    .filter((tag): tag is CaseFileTagView => tag !== undefined);

  // Already-selected tags drop out of the list; typing narrows it down by
  // accent- and case-insensitive match on the label.
  const suggestions = useMemo(() => {
    const normalizedQuery = normalizeForSearch(query.trim());
    return availableTags.filter(
      (tag) =>
        !selectedIds.includes(tag.id) &&
        (normalizedQuery === "" || normalizeForSearch(tag.label).includes(normalizedQuery)),
    );
  }, [availableTags, selectedIds, query]);

  // Keep the highlight inside the (possibly shrunk) suggestion list.
  const activeIndex =
    suggestions.length === 0 ? -1 : Math.min(highlightedIndex, suggestions.length - 1);

  // A pointer press outside the field closes the list; `blur` alone is not
  // enough, since clicking an option must not close it before the selection.
  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [isOpen]);

  // The list only shows once at least one character is typed: opening the whole
  // catalogue on focus covered the rest of the form for no real gain.
  function syncOpenState(nextQuery: string) {
    setIsOpen(nextQuery.trim().length > 0);
    setHighlightedIndex(0);
  }

  function selectTag(tag: CaseFileTagView) {
    setSelectedIds((ids) => (ids.includes(tag.id) ? ids : [...ids, tag.id]));
    // Clearing the query empties the list, so it closes with it.
    setQuery("");
    setIsOpen(false);
    setHighlightedIndex(0);
  }

  function removeTag(tagId: number) {
    setSelectedIds((ids) => ids.filter((id) => id !== tagId));
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!isOpen) {
        syncOpenState(query);
        return;
      }
      if (suggestions.length === 0) return;
      const offset = event.key === "ArrowDown" ? 1 : -1;
      setHighlightedIndex((index) => {
        const next = (Math.min(index, suggestions.length - 1) + offset) % suggestions.length;
        return next < 0 ? suggestions.length - 1 : next;
      });
      return;
    }

    if (event.key === "Enter") {
      // Never let the combobox submit the surrounding details form.
      if (isOpen && activeIndex >= 0) {
        event.preventDefault();
        selectTag(suggestions[activeIndex]);
      } else if (isOpen) {
        event.preventDefault();
      }
      return;
    }

    if (event.key === "Escape") {
      if (isOpen) {
        event.preventDefault();
        setIsOpen(false);
      }
      return;
    }

    if (event.key === "Backspace" && query === "" && selectedTags.length > 0) {
      removeTag(selectedTags[selectedTags.length - 1].id);
    }
  }

  return (
    <div className={clsx(fr.cx("fr-mb-1w"), className)} ref={containerRef}>
      <input type="hidden" name={HAS_TAGS_FIELD_NAME} value="true" />
      {selectedIds.map((id) => (
        <input key={id} type="hidden" name={TAG_IDS_FIELD_NAME} value={id} />
      ))}

      <div className="relative">
        {/* DSFR adds 1.5rem under `.fr-input-group:not(:last-child)`. Opening the
            list inserts a sibling, which would otherwise gap the popover and
            shove the selected tags down. */}
        <Input
          label="Tags"
          hintText="Saisissez au moins une lettre pour rechercher parmi les tags existants."
          className={fr.cx("fr-mb-0")}
          nativeInputProps={{
            type: "text",
            value: query,
            autoComplete: "off",
            role: "combobox",
            "aria-expanded": isOpen,
            "aria-controls": listboxId,
            "aria-autocomplete": "list",
            "aria-activedescendant": isOpen && activeIndex >= 0 ? optionId(activeIndex) : undefined,
            onFocus: () => syncOpenState(query),
            onClick: () => syncOpenState(query),
            onChange: (event) => {
              const nextQuery = event.currentTarget.value;
              setQuery(nextQuery);
              syncOpenState(nextQuery);
            },
            onKeyDown,
          }}
        />

        {isOpen && (
          <div
            className={clsx(
              "absolute top-full z-10 max-h-60 w-full overflow-y-auto",
              "bg-(--background-overlap-grey)",
              "border border-solid border-(--border-default-grey)",
            )}
          >
            {suggestions.length === 0 ? (
              <p className={clsx(fr.cx("fr-text--sm", "fr-p-1w"), "fr-mb-0")}>
                Aucun tag correspondant.
              </p>
            ) : (
              <ul
                id={listboxId}
                role="listbox"
                aria-label="Tags disponibles"
                // `list-none` and the reset padding drop the browser's default
                // bullets: options are rendered as badges, not as a bullet list.
                className={clsx("fr-my-0", "list-none", "fr-pl-0", "fr-pr-0")}
              >
                {suggestions.map((tag, index) => (
                  <li
                    key={tag.id}
                    id={optionId(index)}
                    role="option"
                    aria-selected={index === activeIndex}
                    className={clsx(
                      fr.cx("fr-p-1v"),
                      "cursor-pointer",
                      "list-none",
                      index === activeIndex && "bg-(--background-default-grey-hover)",
                    )}
                    // Keep focus on the input so the click is not lost to blur.
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => selectTag(tag)}
                  >
                    <TagBadge tag={tag} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Selected tags sit below the field, so the suggestion popover never
          pushes them around as the list opens and closes. Each one is a badge
          (same rendering as everywhere else) wrapped in a bare `<button>` that
          performs the removal. */}
      {selectedTags.length > 0 && (
        <ul
          aria-label="Tags sélectionnés"
          className={clsx(
            // `fr-raw-list` zeros DSFR list spacing (`--li-bottom`, indent).
            fr.cx("fr-raw-list", "fr-mt-1w", "fr-mb-0"),
            "flex flex-wrap gap-1",
          )}
        >
          {selectedTags.map((tag) => (
            // Inherited `li` line-height is a content-list strut taller than a
            // small badge. Collapse it so the row matches the chip.
            <li key={tag.id} className="leading-none">
              <button
                type="button"
                aria-label={`Retirer le tag ${tag.label}`}
                className="inline-flex cursor-pointer border-0 bg-transparent p-0 leading-none"
                onClick={() => removeTag(tag.id)}
              >
                <TagBadge tag={tag} removable />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
