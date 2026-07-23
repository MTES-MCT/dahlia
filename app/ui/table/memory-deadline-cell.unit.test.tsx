import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryDeadlineCell } from "./memory-deadline-cell";

describe("MemoryDeadlineCell", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-09T10:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("ne rend rien quand la date est nulle", () => {
    const { container } = render(<MemoryDeadlineCell date={null} source={null} />);

    expect(container.innerHTML).toBe("");
  });

  it("affiche la date formatee sans badge d'urgence quand elle est lointaine", () => {
    render(<MemoryDeadlineCell date={new Date("2026-08-01T13:00:00")} source="hearing" />);

    expect(screen.getByText("01/08/2026")).toBeTruthy();
    expect(screen.getByText("Audience")).toBeTruthy();
    expect(screen.queryByText("Urgent")).toBeNull();
    expect(screen.queryByText("Passé")).toBeNull();
  });

  it('affiche le badge "Urgent" quand la date est dans les deux prochaines semaines', () => {
    render(<MemoryDeadlineCell date={new Date("2026-06-15T13:00:00")} source="hearing" />);

    expect(screen.getByText("15/06/2026")).toBeTruthy();
    expect(screen.getByText("Audience")).toBeTruthy();
    expect(screen.getByText("Urgent")).toBeTruthy();
  });

  it('affiche le badge "Très urgent" quand la date est a moins de 3 jours ouvres + 1 jour', () => {
    render(<MemoryDeadlineCell date={new Date("2026-06-10T13:00:00")} source="hearing" />);

    expect(screen.getByText("10/06/2026")).toBeTruthy();
    expect(screen.getByText("Très urgent")).toBeTruthy();
    expect(screen.queryByText("Urgent")).toBeNull();
  });

  it('affiche le badge "Très urgent" quand la date est a moins de 3 jours ouvres + 2 jours', () => {
    render(<MemoryDeadlineCell date={new Date("2026-06-11T13:00:00")} source="hearing" />);

    expect(screen.getByText("11/06/2026")).toBeTruthy();
    expect(screen.getByText("Très urgent")).toBeTruthy();
    expect(screen.queryByText("Urgent")).toBeNull();
  });

  it('affiche le badge "Passé" quand la date est anterieure a aujourd\'hui', () => {
    render(<MemoryDeadlineCell date={new Date("2026-06-01T13:00:00")} source="hearing" />);

    expect(screen.getByText("01/06/2026")).toBeTruthy();
    expect(screen.getByText("Passé")).toBeTruthy();
  });

  it("considere une date juste a la limite des deux semaines comme non urgente", () => {
    render(<MemoryDeadlineCell date={new Date("2026-06-24T00:00:00")} source="hearing" />);

    expect(screen.queryByText("Urgent")).toBeNull();
    expect(screen.queryByText("Passé")).toBeNull();
  });

  it('affiche une infobulle native sur le badge "Urgent"', () => {
    render(<MemoryDeadlineCell date={new Date("2026-06-15T13:00:00")} source="hearing" />);

    expect(screen.getByTitle("Échéance dans moins de 2 semaines")).toBeTruthy();
  });

  it('affiche une infobulle native sur le badge "Très urgent"', () => {
    render(<MemoryDeadlineCell date={new Date("2026-06-10T13:00:00")} source="hearing" />);

    expect(screen.getByTitle("Échéance dans moins de 2 jours ouvrés")).toBeTruthy();
  });

  it("n'affiche pas d'infobulle sur le badge Passé", () => {
    render(<MemoryDeadlineCell date={new Date("2026-06-01T13:00:00")} source="hearing" />);

    expect(screen.getByText("Passé")).toBeTruthy();
    expect(screen.queryByTitle(/Échéance/)).toBeNull();
  });

  it('affiche le badge "Mise en demeure" pour une échéance saisie manuellement', () => {
    render(
      <MemoryDeadlineCell
        date={new Date("2026-07-01T00:00:00")}
        source="MISE_EN_DEMEURE_DE_PRODUIRE"
      />,
    );

    expect(screen.getByText("01/07/2026")).toBeTruthy();
    expect(screen.getByText("Mise en demeure")).toBeTruthy();
  });

  it('affiche le badge "Clôture d\'instruction" pour une échéance saisie manuellement', () => {
    render(
      <MemoryDeadlineCell date={new Date("2026-07-01T00:00:00")} source="CLOTURE_INSTRUCTION" />,
    );

    expect(screen.getByText("01/07/2026")).toBeTruthy();
    expect(screen.getByText("Clôture d'instruction")).toBeTruthy();
  });
});
