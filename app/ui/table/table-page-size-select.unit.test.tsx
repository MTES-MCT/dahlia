import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { TablePageSizeSelect } from "./table-page-size-select";

describe("TablePageSizeSelect", () => {
  afterEach(() => {
    cleanup();
  });

  it("affiche une option par taille de page disponible et sélectionne la valeur courante", () => {
    render(<TablePageSizeSelect pageSize={30} onChange={vi.fn()} />);

    const select = screen.getByLabelText("Résultats par page") as HTMLSelectElement;
    expect(select.value).toBe("30");
    expect(screen.getByRole("option", { name: "10" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "30" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "100" })).toBeTruthy();
  });

  it("appelle onChange avec la taille sélectionnée sous forme de nombre", () => {
    const onChange = vi.fn();
    render(<TablePageSizeSelect pageSize={10} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Résultats par page"), { target: { value: "100" } });

    expect(onChange).toHaveBeenCalledWith(100);
    expect(typeof onChange.mock.calls[0][0]).toBe("number");
  });
});
