import { describe, it, expect } from "vitest";
import {
  DEFAULT_TABLE_PAGE_SIZES,
  getTablePageSizeStorageKey,
  parseTablePageSize,
} from "./table-page-size";

describe("parseTablePageSize", () => {
  it("retourne une taille valide quand la valeur est reconnue", () => {
    expect(parseTablePageSize("100", DEFAULT_TABLE_PAGE_SIZES.dashboard)).toBe(100);
  });

  it("retourne la taille par défaut pour une valeur invalide ou absente", () => {
    expect(parseTablePageSize("7", DEFAULT_TABLE_PAGE_SIZES.pieces)).toBe(10);
    expect(parseTablePageSize(null, DEFAULT_TABLE_PAGE_SIZES.pieces)).toBe(10);
  });
});

describe("getTablePageSizeStorageKey", () => {
  it("préfixe l'identifiant du tableau", () => {
    expect(getTablePageSizeStorageKey("pieces")).toBe("dahlia:tablePageSize:pieces");
  });
});
