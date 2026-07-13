import { describe, expect, it } from "vitest";
import { uniqueName } from "./route";

describe("uniqueName", () => {
  it("returns the name unchanged when it is not already used", () => {
    const used = new Set<string>();

    expect(uniqueName("requete.pdf", used)).toBe("requete.pdf");
    expect(used).toEqual(new Set(["requete.pdf"]));
  });

  it("appends (2) before the extension on the first duplicate", () => {
    const used = new Set(["requete.pdf"]);

    expect(uniqueName("requete.pdf", used)).toBe("requete (1).pdf");
    expect(used).toEqual(new Set(["requete.pdf", "requete (1).pdf"]));
  });

  it("increments the suffix until an unused name is found", () => {
    const used = new Set(["doc.pdf", "doc (1).pdf", "doc (2).pdf"]);

    expect(uniqueName("doc.pdf", used)).toBe("doc (3).pdf");
    expect(used.has("doc (3).pdf")).toBe(true);
  });

  it("handles names without an extension", () => {
    const used = new Set(["README"]);

    expect(uniqueName("README", used)).toBe("README (1)");
  });

  it("treats a leading dot as part of the base name, not an extension", () => {
    const used = new Set([".gitignore"]);

    expect(uniqueName(".gitignore", used)).toBe(".gitignore (1)");
  });

  it("uses the last dot as the extension separator", () => {
    const used = new Set(["archive.tar.gz"]);

    expect(uniqueName("archive.tar.gz", used)).toBe("archive (1).tar.gz");
  });
});
