import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import {
  RowSelectionProvider,
  RowSelectionCheckbox,
  RowSelectionHeaderCheckbox,
  useRowSelectionState,
} from "./row-selection";

const IDS = ["ENC-A", "ENC-B", "ENC-C"];

// Small consumer exposing the selection state so tests can assert on it.
function SelectionSummary() {
  const { selectedIds, clear } = useRowSelectionState();
  return (
    <div>
      <span data-testid="count">{selectedIds.length}</span>
      <span data-testid="ids">{selectedIds.join(",")}</span>
      <button type="button" onClick={clear}>
        vider
      </button>
    </div>
  );
}

function renderHarness(allIds: string[] = IDS) {
  return render(
    <RowSelectionProvider allIds={allIds}>
      <RowSelectionHeaderCheckbox />
      {allIds.map((id) => (
        <RowSelectionCheckbox key={id} id={id} label={id} />
      ))}
      <SelectionSummary />
    </RowSelectionProvider>,
  );
}

function headerCheckbox() {
  return screen.getByRole("checkbox", { name: "Tout sélectionner" }) as HTMLInputElement;
}

function rowCheckbox(id: string) {
  return screen.getByRole("checkbox", { name: `Sélectionner ${id}` }) as HTMLInputElement;
}

describe("row-selection", () => {
  afterEach(() => {
    cleanup();
  });

  it("coche/décoche une ligne individuelle", () => {
    renderHarness();

    expect(screen.getByTestId("count").textContent).toBe("0");

    fireEvent.click(rowCheckbox("ENC-B"));
    expect(rowCheckbox("ENC-B").checked).toBe(true);
    expect(screen.getByTestId("ids").textContent).toBe("ENC-B");

    fireEvent.click(rowCheckbox("ENC-B"));
    expect(rowCheckbox("ENC-B").checked).toBe(false);
    expect(screen.getByTestId("count").textContent).toBe("0");
  });

  it("la case d'en-tête sélectionne puis désélectionne toutes les lignes", () => {
    renderHarness();

    fireEvent.click(headerCheckbox());
    expect(screen.getByTestId("count").textContent).toBe("3");
    expect(headerCheckbox().checked).toBe(true);
    IDS.forEach((id) => expect(rowCheckbox(id).checked).toBe(true));

    fireEvent.click(headerCheckbox());
    expect(screen.getByTestId("count").textContent).toBe("0");
    IDS.forEach((id) => expect(rowCheckbox(id).checked).toBe(false));
  });

  it("passe la case d'en-tête à l'état indéterminé quand la sélection est partielle", () => {
    renderHarness();

    fireEvent.click(rowCheckbox("ENC-A"));

    const header = headerCheckbox();
    expect(header.checked).toBe(false);
    expect(header.indeterminate).toBe(true);
  });

  it("coche l'en-tête (non indéterminé) quand toutes les lignes sont cochées à la main", () => {
    renderHarness();

    IDS.forEach((id) => fireEvent.click(rowCheckbox(id)));

    const header = headerCheckbox();
    expect(header.checked).toBe(true);
    expect(header.indeterminate).toBe(false);
  });

  it("clear() vide la sélection", () => {
    renderHarness();

    fireEvent.click(headerCheckbox());
    expect(screen.getByTestId("count").textContent).toBe("3");

    fireEvent.click(screen.getByRole("button", { name: "vider" }));
    expect(screen.getByTestId("count").textContent).toBe("0");
  });

  it("lève une erreur si les composants sont utilisés hors du provider", () => {
    // Silence the expected React error log for this render.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<RowSelectionHeaderCheckbox />)).toThrow(
      /must be used within a RowSelectionProvider/,
    );
    spy.mockRestore();
  });
});
