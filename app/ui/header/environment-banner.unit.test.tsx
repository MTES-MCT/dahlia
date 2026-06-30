import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { EnvironmentBanner } from "./environment-banner";

describe("EnvironmentBanner", () => {
  afterEach(() => {
    cleanup();
  });

  it("affiche le nom de l'environnement quand il n'est pas la production", () => {
    render(<EnvironmentBanner environment="staging" />);

    expect(screen.getByText("Vous êtes en environnement de staging")).toBeTruthy();
  });

  it('utilise "développement" comme repli quand l\'environnement est absent', () => {
    render(<EnvironmentBanner />);

    expect(screen.getByText("Vous êtes en environnement de développement")).toBeTruthy();
  });

  it("ne rend rien en production", () => {
    const { container } = render(<EnvironmentBanner environment="production" />);

    expect(container.firstChild).toBeNull();
  });

  it('expose le bandeau avec le rôle "status"', () => {
    render(<EnvironmentBanner environment="development" />);

    expect(screen.getByRole("status")).toBeTruthy();
  });
});
