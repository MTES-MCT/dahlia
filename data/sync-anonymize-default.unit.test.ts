import { afterEach, describe, expect, it, vi } from "vitest";
import { syncAnonymizeByDefault } from "./sync-anonymize-default";

describe("syncAnonymizeByDefault", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("anonymizes when ENVIRONMENT is unset", () => {
    delete process.env.ENVIRONMENT;
    delete process.env.NO_ANONYMIZE;
    expect(syncAnonymizeByDefault()).toBe(true);
  });

  it("anonymizes in development", () => {
    vi.stubEnv("ENVIRONMENT", "development");
    expect(syncAnonymizeByDefault()).toBe(true);
  });

  it("does not anonymize in production", () => {
    vi.stubEnv("ENVIRONMENT", "production");
    expect(syncAnonymizeByDefault()).toBe(false);
  });

  it("does not anonymize in development when NO_ANONYMIZE is true", () => {
    vi.stubEnv("ENVIRONMENT", "development");
    vi.stubEnv("NO_ANONYMIZE", "true");
    expect(syncAnonymizeByDefault()).toBe(false);
  });

  it("still does not anonymize in production when NO_ANONYMIZE is true", () => {
    vi.stubEnv("ENVIRONMENT", "production");
    vi.stubEnv("NO_ANONYMIZE", "true");
    expect(syncAnonymizeByDefault()).toBe(false);
  });
});
