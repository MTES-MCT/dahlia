import { describe, it, expect, vi, afterEach } from "vitest";
import { Prisma } from "@prisma/client";
import { describePrismaError } from "./form-actions";

describe("describePrismaError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renvoie le message associé à un code Prisma connu", () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed on the fields: (`label`)",
      { code: "P2002", clientVersion: "test" },
    );

    expect(describePrismaError(error, { P2002: "Un tag porte déjà ce libellé." })).toBe(
      "Un tag porte déjà ce libellé.",
    );
  });

  it("masque un code Prisma non prévu et journalise le détail", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Prisma.PrismaClientKnownRequestError(
      "Foreign key constraint failed on the field: `case_file_tags_tag_id_fkey`",
      { code: "P2003", clientVersion: "test" },
    );

    expect(describePrismaError(error)).toBe("Une erreur est survenue.");
    expect(consoleError).toHaveBeenCalledWith(error);
  });

  it("masque une erreur inattendue sans exposer son message", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(
      describePrismaError(new Error('column "displayNameNormalized" of relation "actors"')),
    ).toBe("Une erreur est survenue.");
  });
});
