import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LogoutLink } from "./logout-link";

describe("LogoutLink", () => {
  afterEach(() => {
    cleanup();
  });

  it("pointe vers la déconnexion ProConnect", () => {
    render(<LogoutLink />);

    expect(screen.getByRole("link", { name: "Se déconnecter" }).getAttribute("href")).toBe(
      "/api/auth/proconnect-logout",
    );
  });

  it("laisse le navigateur charger la déconnexion, sans intercepter le clic", () => {
    render(<LogoutLink />);

    const link = screen.getByRole("link", { name: "Se déconnecter" });
    expect(link.tagName).toBe("A");
    expect(fireEvent.click(link)).toBe(true);
  });
});
