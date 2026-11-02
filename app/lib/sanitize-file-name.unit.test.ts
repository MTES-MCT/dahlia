import { describe, expect, it } from "vitest";
import { dahliaNameValidationError, sanitizeFileName } from "@/app/lib/sanitize-file-name";

describe("sanitizeFileName", () => {
  it("replaces path separators and forbidden characters", () => {
    expect(sanitizeFileName("a/b\\c:d*e?f\"g<h>i|j")).toBe("a_b_c_d_e_f_g_h_i_j");
  });
});

describe("dahliaNameValidationError", () => {
  it("accepts a normal label", () => {
    expect(dahliaNameValidationError("Pièce introductive")).toBeNull();
  });

  it("rejects path separators and forbidden characters", () => {
    expect(dahliaNameValidationError("../../etc/passwd")).toMatch(/\\/);
  });

  it("rejects parent-directory segments", () => {
    expect(dahliaNameValidationError("safe..name")).toBe("Le nom ne peut pas contenir ..");
  });
});
