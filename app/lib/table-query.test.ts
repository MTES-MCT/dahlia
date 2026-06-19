import { describe, it, expect } from "vitest";
import { queryTableRows, type TableColumn, type TableQuery } from "./table-query";

type Row = { name: string; type: string; date: Date | null };

const columns: TableColumn<Row>[] = [
  { key: "nom", text: (r) => r.name, sortValue: (r) => r.name, searchable: true, facet: true },
  { key: "type", text: (r) => r.type, sortValue: (r) => r.type, searchable: true, facet: true },
  { key: "date", text: (r) => r.date?.toISOString() ?? "", sortValue: (r) => r.date },
];

const rows: Row[] = [
  { name: "Requête introductive", type: "PDF", date: new Date("2026-01-10") },
  { name: "Mémoire en défense", type: "PDF", date: new Date("2026-03-05") },
  { name: "Pièce annexe", type: "Image", date: null },
  { name: "Accusé de réception", type: "Courrier", date: new Date("2026-02-01") },
];

const base: TableQuery = {
  query: null,
  sortBy: null,
  sortOrder: "descending",
  page: 1,
  pageSize: 10,
};

describe("queryTableRows", () => {
  describe("filtrage texte libre", () => {
    it("cherche dans toutes les colonnes searchable (insensible à la casse/accents)", () => {
      const { pageRows, totalCount } = queryTableRows(rows, columns, { ...base, query: "memoire" });
      expect(totalCount).toBe(1);
      expect(pageRows[0].name).toBe("Mémoire en défense");
    });

    it("ne cherche pas dans les colonnes non searchable (la date)", () => {
      const { totalCount } = queryTableRows(rows, columns, { ...base, query: "2026" });
      expect(totalCount).toBe(0);
    });
  });

  describe("facettes", () => {
    it("restreint à une colonne via key:value", () => {
      const { pageRows, totalCount } = queryTableRows(rows, columns, {
        ...base,
        query: "type:pdf",
      });
      expect(totalCount).toBe(2);
      expect(pageRows.map((r) => r.name)).toContain("Requête introductive");
    });

    it("combine plusieurs mots d'une facette en AND", () => {
      const { totalCount } = queryTableRows(rows, columns, {
        ...base,
        query: 'nom:"accuse reception"',
      });
      expect(totalCount).toBe(1);
    });

    it("ignore une facette dont la clé n'est pas une colonne facet", () => {
      const { totalCount } = queryTableRows(rows, columns, { ...base, query: "date:2026" });
      // `date` n'est pas une facette → traité comme texte libre, qui ne matche pas.
      expect(totalCount).toBe(0);
    });
  });

  describe("tri", () => {
    it("trie par date décroissante avec les valeurs nulles en dernier", () => {
      const { pageRows } = queryTableRows(rows, columns, {
        ...base,
        sortBy: "date",
        sortOrder: "descending",
      });
      expect(pageRows.map((r) => r.name)).toEqual([
        "Mémoire en défense",
        "Accusé de réception",
        "Requête introductive",
        "Pièce annexe",
      ]);
    });

    it("place aussi les nulls en dernier en tri croissant", () => {
      const { pageRows } = queryTableRows(rows, columns, {
        ...base,
        sortBy: "date",
        sortOrder: "ascending",
      });
      expect(pageRows[pageRows.length - 1].name).toBe("Pièce annexe");
    });
  });

  describe("pagination", () => {
    it("découpe par page et renvoie le nombre total de pages", () => {
      const { pageRows, totalPages } = queryTableRows(rows, columns, {
        ...base,
        sortBy: "nom",
        sortOrder: "ascending",
        pageSize: 2,
        page: 2,
      });
      expect(totalPages).toBe(2);
      expect(pageRows).toHaveLength(2);
    });

    it("ramène une page hors limite dans la plage disponible", () => {
      const { currentPage } = queryTableRows(rows, columns, { ...base, pageSize: 2, page: 99 });
      expect(currentPage).toBe(2);
    });
  });
});
