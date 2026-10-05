import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LogoutLink } from "./logout-link";

describe("LogoutLink", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("pointe vers la déconnexion ProConnect sans préchargement", () => {
    render(<LogoutLink />);

    expect(screen.getByRole("link", { name: "Se déconnecter" }).getAttribute("href")).toBe(
      "/api/auth/proconnect-logout",
    );
  });

  it("charge la déconnexion en navigation de page, pas via le routeur", () => {
    const assign = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({
      ...window.location,
      assign,
    } as Location);

    render(<LogoutLink />);

    expect(fireEvent.click(screen.getByRole("link", { name: "Se déconnecter" }))).toBe(false);
    expect(assign).toHaveBeenCalledWith("/api/auth/proconnect-logout");
  });
});
