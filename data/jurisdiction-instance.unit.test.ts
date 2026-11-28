import { afterEach, describe, expect, it, vi } from "vitest";
import { jurisdictionInstanceWhere, telerecoursCredentials } from "./jurisdiction-instance";

describe("jurisdictionInstanceWhere", () => {
  it("filters case files on the Dahlia instance, not on the court code", () => {
    expect(jurisdictionInstanceWhere("TA069bis")).toEqual({
      jurisdiction: { shortName: "TA069bis" },
    });
  });
});

describe("telerecoursCredentials", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads the instance's own credentials", () => {
    vi.stubEnv("TA069bis_TELERECOURS_USERNAME", "user-bis");
    vi.stubEnv("TA069bis_TELERECOURS_PASSWORD", "secret-bis");
    expect(telerecoursCredentials("TA069bis")).toEqual({
      username: "user-bis",
      password: "secret-bis",
    });
  });

  it("fails when the instance has no credentials", () => {
    vi.stubEnv("TA999_TELERECOURS_USERNAME", "");
    expect(() => telerecoursCredentials("TA999")).toThrow(/TA999_TELERECOURS_USERNAME/);
  });
});
