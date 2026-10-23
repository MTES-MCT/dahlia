import { describe, expect, it } from "vitest";
import {
  filterStatusOptionsByGroup,
  isTerminatedStatusLabel,
  resolveStatusGroup,
  statusLabelBelongsToGroup,
} from "@/app/lib/dashboard-filter";

const CATALOGUE = [
  "Dossier rayé",
  "En cours d'instruction",
  "Inscrit au rôle d'une audience",
  "Terminé",
];

describe("isTerminatedStatusLabel", () => {
  it("matches catalogue labels accent/case-insensitively", () => {
    expect(isTerminatedStatusLabel("Terminé")).toBe(true);
    expect(isTerminatedStatusLabel("termine")).toBe(true);
    expect(isTerminatedStatusLabel("Dossier rayé")).toBe(true);
    expect(isTerminatedStatusLabel("En cours d'instruction")).toBe(false);
  });
});

describe("resolveStatusGroup", () => {
  it("defaults to « en cours » when absent or unknown", () => {
    expect(resolveStatusGroup(undefined)).toBe("en_cours");
    expect(resolveStatusGroup("inconnu")).toBe("en_cours");
  });

  it("keeps a known group", () => {
    expect(resolveStatusGroup("termine")).toBe("termine");
    expect(resolveStatusGroup("tous")).toBe("tous");
  });
});

describe("filterStatusOptionsByGroup", () => {
  it("keeps « Terminé » and « Dossier rayé » in the « terminé » group", () => {
    expect(filterStatusOptionsByGroup(CATALOGUE, "termine")).toEqual(["Dossier rayé", "Terminé"]);
  });

  it("keeps every other status in the « en cours » group", () => {
    expect(filterStatusOptionsByGroup(CATALOGUE, "en_cours")).toEqual([
      "En cours d'instruction",
      "Inscrit au rôle d'une audience",
    ]);
  });

  it("keeps every status in the « tous » group", () => {
    expect(filterStatusOptionsByGroup(CATALOGUE, "tous")).toEqual(CATALOGUE);
  });
});

describe("statusLabelBelongsToGroup", () => {
  it("matches terminated labels accent/case-insensitively", () => {
    expect(statusLabelBelongsToGroup("termine", "termine")).toBe(true);
    expect(statusLabelBelongsToGroup("Dossier rayé", "en_cours")).toBe(false);
  });

  it("puts every other label in « en cours »", () => {
    expect(statusLabelBelongsToGroup("En cours d'instruction", "en_cours")).toBe(true);
    expect(statusLabelBelongsToGroup("En cours d'instruction", "termine")).toBe(false);
  });

  it("accepts any label in « tous »", () => {
    expect(statusLabelBelongsToGroup("Terminé", "tous")).toBe(true);
  });
});
