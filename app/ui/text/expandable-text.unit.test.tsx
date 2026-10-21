import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { ExpandableText } from "./expandable-text";

const TEXT = "Article 1er : il est enjoint au préfet de reloger M. Dupont.";

// jsdom has no layout engine: element heights are driven by these values.
let scrollHeight = 0;
let clientHeight = 0;

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  observe = vi.fn();
  disconnect = vi.fn();

  constructor(private readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }

  trigger() {
    this.callback([], this as unknown as ResizeObserver);
  }
}

function setHeights(scroll: number, client: number) {
  scrollHeight = scroll;
  clientHeight = client;
}

function getParagraph() {
  return screen.getByText(TEXT);
}

describe("ExpandableText", () => {
  beforeEach(() => {
    setHeights(0, 0);
    FakeResizeObserver.instances = [];
    vi.spyOn(Element.prototype, "scrollHeight", "get").mockImplementation(() => scrollHeight);
    vi.spyOn(Element.prototype, "clientHeight", "get").mockImplementation(() => clientHeight);
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("affiche le texte limité à deux lignes, sans bouton quand il ne déborde pas", () => {
    setHeights(40, 40);
    render(<ExpandableText text={TEXT} className="font-medium" />);

    const paragraph = getParagraph();
    expect(paragraph.classList.contains("line-clamp-2")).toBe(true);
    expect(paragraph.classList.contains("font-medium")).toBe(true);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("affiche « Voir plus » quand le texte déborde", () => {
    setHeights(120, 40);
    render(<ExpandableText text={TEXT} />);

    const toggle = screen.getByRole("button", { name: "Voir plus" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.getAttribute("aria-controls")).toBe(getParagraph().id);
  });

  it("déplie puis replie le texte au clic", () => {
    setHeights(120, 40);
    render(<ExpandableText text={TEXT} />);

    fireEvent.click(screen.getByRole("button", { name: "Voir plus" }));
    const toggle = screen.getByRole("button", { name: "Voir moins" });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(getParagraph().classList.contains("line-clamp-2")).toBe(false);

    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Voir plus" })).toBeTruthy();
    expect(getParagraph().classList.contains("line-clamp-2")).toBe(true);
  });

  it("affiche « Voir plus » quand le texte devient visible et déborde", () => {
    // Rendered inside a hidden ancestor: zero height on mount.
    render(<ExpandableText text={TEXT} />);
    expect(screen.queryByRole("button")).toBeNull();

    setHeights(120, 40);
    act(() => FakeResizeObserver.instances.at(-1)?.trigger());

    expect(screen.getByRole("button", { name: "Voir plus" })).toBeTruthy();
  });

  it("masque le bouton quand le texte ne déborde plus après un redimensionnement", () => {
    setHeights(120, 40);
    render(<ExpandableText text={TEXT} />);
    expect(screen.getByRole("button", { name: "Voir plus" })).toBeTruthy();

    setHeights(40, 40);
    act(() => FakeResizeObserver.instances.at(-1)?.trigger());

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("observe le paragraphe et se déconnecte au démontage", () => {
    const { unmount } = render(<ExpandableText text={TEXT} />);

    const observer = FakeResizeObserver.instances.at(-1);
    expect(observer?.observe).toHaveBeenCalledWith(getParagraph());

    unmount();
    expect(observer?.disconnect).toHaveBeenCalled();
  });

  it("fonctionne sans ResizeObserver", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    setHeights(120, 40);
    render(<ExpandableText text={TEXT} />);

    expect(screen.getByRole("button", { name: "Voir plus" })).toBeTruthy();
  });
});
