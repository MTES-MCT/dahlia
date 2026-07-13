import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { PIECES_PARAMS } from "@/app/lib/pieces-table";
import { TableSearchForm } from "./table-search-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

function getForm(): HTMLFormElement {
  return screen.getByRole("search") as HTMLFormElement;
}

function hiddenValue(form: HTMLFormElement, name: string): string | undefined {
  const field = form.querySelector<HTMLInputElement>(`input[type="hidden"][name="${name}"]`);
  return field?.value;
}

const baseProps = {
  action: "/case_files/TA069-2026-001",
  params: PIECES_PARAMS,
  label: "Rechercher une pièce",
  currentQuery: "",
  hiddenParams: [{ name: "tab", value: "pieces" }],
  resetHref: "/case_files/TA069-2026-001?tab=pieces",
};

describe("TableSearchForm", () => {
  afterEach(() => {
    cleanup();
  });

  it("est un form GET vers l'action fournie sans champ page", () => {
    render(<TableSearchForm {...baseProps} />);

    const form = getForm();
    expect(form.getAttribute("method")).toBe("get");
    expect(form.getAttribute("action")).toBe("/case_files/TA069-2026-001");
    expect(form.querySelector(`input[name="${PIECES_PARAMS.page}"]`)).toBeNull();
  });

  it("pré-remplit le champ de recherche avec la valeur courante", () => {
    render(<TableSearchForm {...baseProps} currentQuery="dupont" />);

    const input = screen.getByRole("searchbox") as HTMLInputElement;
    expect(input.name).toBe("pcq");
    expect(input.defaultValue).toBe("dupont");
  });

  it("affiche le placeholder quand il est fourni", () => {
    render(<TableSearchForm {...baseProps} placeholder="ex. « requête »" />);

    expect(screen.getByPlaceholderText("ex. « requête »")).toBeTruthy();
  });

  it("émet les champs cachés fournis", () => {
    render(
      <TableSearchForm
        {...baseProps}
        hiddenParams={[
          { name: "tab", value: "pieces" },
          { name: "pcSort", value: "date" },
        ]}
      />,
    );

    const form = getForm();
    expect(hiddenValue(form, "tab")).toBe("pieces");
    expect(hiddenValue(form, "pcSort")).toBe("date");
    expect(hiddenValue(form, "pcq")).toBeUndefined();
  });

  it("affiche un bouton « Rechercher » et un lien de réinitialisation", () => {
    render(<TableSearchForm {...baseProps} />);

    expect(screen.getByRole("button", { name: "Rechercher" }).getAttribute("type")).toBe("submit");
    expect(
      screen.getByRole("link", { name: /Ré-initialiser la recherche/ }).getAttribute("href"),
    ).toBe("/case_files/TA069-2026-001?tab=pieces");
  });

  it("remplace la barre par défaut quand searchSlot est fourni", () => {
    render(<TableSearchForm {...baseProps} searchSlot={<div>Recherche custom</div>} />);

    expect(screen.getByText("Recherche custom")).toBeTruthy();
    expect(screen.queryByRole("searchbox")).toBeNull();
  });
});
