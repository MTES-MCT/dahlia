import { afterEach, describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /logout", () => {
  afterEach(() => {
    delete process.env.BETTER_AUTH_URL;
  });

  it("redirige vers la page d'accueil", () => {
    const response = GET(new Request("https://dahlia.example/logout?state=abc"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://dahlia.example/");
  });

  it("utilise BETTER_AUTH_URL plutôt que l’origine de la requête quand il est défini", () => {
    process.env.BETTER_AUTH_URL = "https://dahlia.beta.gouv.fr";
    const response = GET(new Request("http://127.0.0.1:21432/logout?state=abc"));

    expect(response.headers.get("location")).toBe("https://dahlia.beta.gouv.fr/");
  });
});
