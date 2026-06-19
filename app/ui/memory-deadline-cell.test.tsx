import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryDeadlineCell } from "./memory-deadline-cell";

// formatDateFr lives in the data-access module, which imports the Prisma client:
// mock it so importing the component does not instantiate a real client.
vi.mock("@/app/lib/prisma", () => ({ prisma: {} }));

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
    const { container } = render(<MemoryDeadlineCell date={null} />);

    expect(container.innerHTML).toBe("");
  });

  it("affiche la date formatee sans badge quand elle est lointaine", () => {
    render(<MemoryDeadlineCell date={new Date("2026-08-01T13:00:00")} />);

    expect(screen.getByText("01/08/2026")).toBeTruthy();
    expect(screen.queryByText("Urgent")).toBeNull();
    expect(screen.queryByText("Passé")).toBeNull();
  });

  it('affiche le badge "Urgent" quand la date est dans les deux prochaines semaines', () => {
    render(<MemoryDeadlineCell date={new Date("2026-06-15T13:00:00")} />);

    expect(screen.getByText("15/06/2026")).toBeTruthy();
    expect(screen.getByText("Urgent")).toBeTruthy();
  });

  it('affiche le badge "Très urgent" quand la date est a moins de 3 jours ouvres + 1 jour', () => {
    // today (2026-06-09, tuesday) + 1 business days = wednesday 2026-06-10.
    render(<MemoryDeadlineCell date={new Date("2026-06-10T13:00:00")} />);

    expect(screen.getByText("10/06/2026")).toBeTruthy();
    expect(screen.getByText("Très urgent")).toBeTruthy();
    expect(screen.queryByText("Urgent")).toBeNull();
  });

  it('affiche le badge "Très urgent" quand la date est a moins de 3 jours ouvres + 2 jours', () => {
    // today (2026-06-09, tuesday) + 1 business days = wednesday 2026-06-10.
    render(<MemoryDeadlineCell date={new Date("2026-06-11T13:00:00")} />);

    expect(screen.getByText("11/06/2026")).toBeTruthy();
    expect(screen.getByText("Très urgent")).toBeTruthy();
    expect(screen.queryByText("Urgent")).toBeNull();
  });

  it('affiche le badge "Passé" quand la date est anterieure a aujourd\'hui', () => {
    render(<MemoryDeadlineCell date={new Date("2026-06-01T13:00:00")} />);

    expect(screen.getByText("01/06/2026")).toBeTruthy();
    expect(screen.getByText("Passé")).toBeTruthy();
  });

  it("considere une date juste a la limite des deux semaines comme non urgente", () => {
    // today (2026-06-09) + 11 business days = 2026-06-24 → not strictly inferior, so no badge.
    render(<MemoryDeadlineCell date={new Date("2026-06-24T00:00:00")} />);

    expect(screen.queryByText("Urgent")).toBeNull();
    expect(screen.queryByText("Passé")).toBeNull();
  });
});
