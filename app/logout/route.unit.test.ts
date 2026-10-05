import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /logout", () => {
  it("redirige vers la page d'accueil", () => {
    const response = GET(new Request("https://dahlia.example/logout?state=abc"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://dahlia.example/");
  });
});
