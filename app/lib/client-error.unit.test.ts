import { afterEach, describe, expect, it, vi } from "vitest";
import { clientErrorMessage } from "./client-error";
import { withDevelopmentDetail } from "./development-detail";

const UPSTREAM = new Error(
  "GET https://administrations.telerecours.fr/api/case-file/1 failed: 502\nBody: upstream-secret",
);

describe("withDevelopmentDetail", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("conserve le détail en développement", () => {
    vi.stubEnv("NODE_ENV", "development");

    expect(withDevelopmentDetail("Échec de la synchronisation", "Timeout")).toBe(
      "Échec de la synchronisation : Timeout",
    );
  });

  it("retire le détail en dehors du développement", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(withDevelopmentDetail("Échec de la synchronisation", "Timeout")).toBe(
      "Échec de la synchronisation",
    );
  });
});

describe("clientErrorMessage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("journalise l'erreur et n'expose pas l'URL ni le corps amont hors développement", () => {
    vi.stubEnv("NODE_ENV", "production");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const message = clientErrorMessage(UPSTREAM, "Échec du téléchargement de la pièce");

    expect(message).toBe("Échec du téléchargement de la pièce");
    expect(message).not.toContain("administrations.telerecours.fr");
    expect(message).not.toContain("upstream-secret");
    expect(consoleError).toHaveBeenCalledWith(
      "Error: GET https://administrations.telerecours.fr/api/case-file/1 failed: 502Body: upstream-secret",
    );
  });

  it("neutralise les retours à la ligne dans le journal", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const injected = new Error("échec\r\nINFO forged entry\nBody: suite");

    clientErrorMessage(injected, "Échec du téléchargement de la pièce");

    const logged = consoleError.mock.calls[0]?.[0];
    expect(logged).toBe("Error: échecINFO forged entryBody: suite");
    expect(String(logged)).not.toMatch(/\n|\r/);
  });

  it("ajoute le diagnostic describeError en développement", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(clientErrorMessage(UPSTREAM, "Échec du téléchargement de la pièce")).toBe(
      "Échec du téléchargement de la pièce : Error: GET https://administrations.telerecours.fr/api/case-file/1 failed: 502\nBody: upstream-secret",
    );
  });
});
