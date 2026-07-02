"use client";

import { Checkbox } from "@codegouvfr/react-dsfr/Checkbox";
import { createContext, useContext, useEffect, useId, useMemo, useRef, useState } from "react";

type RowSelectionContextValue = {
  selectedIds: string[];
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  toggleAll: () => void;
  allSelected: boolean;
  someSelected: boolean;
  clear: () => void;
};

const RowSelectionContext = createContext<RowSelectionContextValue | null>(null);

function useRowSelection(): RowSelectionContextValue {
  const context = useContext(RowSelectionContext);
  if (!context) {
    throw new Error("useRowSelection must be used within a RowSelectionProvider");
  }
  return context;
}

type ProviderProps = {
  // Ids of every selectable row currently rendered (drives the "select all" box).
  allIds: string[];
  children: React.ReactNode;
};

// Client-side selection state shared by the header/row checkboxes and any action
// bar rendered below the table. Selection resets when `allIds` changes (e.g. on
// pagination) since the component remounts with the new page's rows.
export function RowSelectionProvider({ allIds, children }: ProviderProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const value = useMemo<RowSelectionContextValue>(() => {
    const selectableSelected = allIds.filter((id) => selected.has(id));
    return {
      selectedIds: selectableSelected,
      isSelected: (id) => selected.has(id),
      toggle: (id) =>
        setSelected((previous) => {
          const next = new Set(previous);
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
          return next;
        }),
      toggleAll: () =>
        setSelected((previous) => {
          const allChecked = allIds.length > 0 && allIds.every((id) => previous.has(id));
          return allChecked ? new Set() : new Set(allIds);
        }),
      allSelected: allIds.length > 0 && selectableSelected.length === allIds.length,
      someSelected: selectableSelected.length > 0,
      clear: () => setSelected(new Set()),
    };
  }, [allIds, selected]);

  return <RowSelectionContext.Provider value={value}>{children}</RowSelectionContext.Provider>;
}

type RowCheckboxProps = {
  id: string;
  // Accessible label, e.g. the pièce name.
  label: string;
};

// Per-row selection checkbox (DSFR styling requires the associated label).
export function RowSelectionCheckbox({ id, label }: RowCheckboxProps) {
  const { isSelected, toggle } = useRowSelection();

  return (
    <Checkbox
      className="fr-mb-3w"
      small
      options={[
        {
          label: <span className="fr-sr-only">Sélectionner {label}</span>,
          nativeInputProps: {
            checked: isSelected(id),
            onChange: () => toggle(id),
          },
        },
      ]}
    />
  );
}

// Header checkbox: checks/unchecks every row on the page, with an indeterminate
// state when only some rows are selected.
export function RowSelectionHeaderCheckbox() {
  const { allSelected, someSelected, toggleAll } = useRowSelection();
  const inputId = useId();
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = someSelected && !allSelected;
    }
  }, [someSelected, allSelected]);

  return (
    <div className="fr-checkbox-group fr-checkbox-group--sm">
      <input type="checkbox" id={inputId} ref={ref} checked={allSelected} onChange={toggleAll} />
      <label className="fr-label" htmlFor={inputId}>
        <span className="fr-sr-only">Tout sélectionner</span>
      </label>
    </div>
  );
}

// Hook for action bars rendered below the table.
export function useRowSelectionState(): RowSelectionContextValue {
  return useRowSelection();
}
