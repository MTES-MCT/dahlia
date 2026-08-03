import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import Home from "./page";

const SERVICE_PUBLIC_URL = "https://www.service-public.gouv.fr/particuliers/vosdroits/F18005";

vi.mock("@/src/dsfr-bootstrap", () => ({
  StartDsfrOnHydration: () => null,
}));

describe("Page d'accueil", () => {
  afterEach(() => {
    cleanup();
  });

  it("redirige vers la fiche service-public au clic sur la carte particulier", () => {
    render(<Home />);

    const link = screen.getByRole("link", {
      name: "Vous êtes un particulier",
    }) as HTMLAnchorElement;

    expect(link.getAttribute("href")).toBe(SERVICE_PUBLIC_URL);
    expect(link.getAttribute("target")).toBe("_self");

    let navigationTarget: string | undefined;
    link.addEventListener("click", (event) => {
      if (!event.defaultPrevented) {
        navigationTarget = link.href;
      }
    });

    fireEvent.click(link);

    expect(navigationTarget).toBe(SERVICE_PUBLIC_URL);
  });

  it("la fiche service-public F18005 répond en HTTP 200", async () => {
    const response = await fetch(SERVICE_PUBLIC_URL, {
      method: "HEAD",
      redirect: "follow",
    });

    expect(response.status).toBe(200);
  });
});
