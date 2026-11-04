import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { parseUpdatePieceNamesArgs, updatePieceNames } from "./update-piece-names";

describe("parseUpdatePieceNamesArgs", () => {
  it("applique les valeurs par défaut", () => {
    expect(parseUpdatePieceNamesArgs([])).toEqual({
      jurisdiction: null,
      dryRun: false,
      force: false,
      verbose: false,
      help: false,
    });
  });

  it("lit les options", () => {
    expect(
      parseUpdatePieceNamesArgs([
        "--jurisdiction",
        "TA069",
        "--dry-run",
        "--force-update-piece-name",
        "--verbose",
      ]),
    ).toEqual({ jurisdiction: "TA069", dryRun: true, force: true, verbose: true, help: false });
  });

  it("refuse --jurisdiction sans valeur et les options inconnues", () => {
    expect(() => parseUpdatePieceNamesArgs(["--jurisdiction"])).toThrow("--jurisdiction");
    expect(() => parseUpdatePieceNamesArgs(["--jurisdiction", "--dry-run"])).toThrow();
    expect(() => parseUpdatePieceNamesArgs(["--nope"])).toThrow("Argument inconnu");
  });
});

describe("updatePieceNames", () => {
  let prisma: DeepMockProxy<PrismaClient>;
  const OPTIONS = { jurisdiction: "TA069", dryRun: false, force: false, verbose: false };

  const piece = (
    encodedFileId: string,
    dahliaName: string | null,
    fileName = "P_34_requete.pdf",
  ) => ({
    jurisdictionCode: "TA069",
    encodedFileId,
    fileName,
    dahliaName,
  });

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("ne cible que les pièces sans nom hors force, et les renomme (origine script)", async () => {
    prisma.attachedFile.findMany.mockResolvedValueOnce([piece("ENC-1", null)] as never);

    expect(await updatePieceNames(prisma, OPTIONS)).toEqual({ scanned: 1, renamed: 1 });

    expect(prisma.attachedFile.findMany.mock.calls[0][0]!.where).toEqual({
      AND: [{ jurisdictionCode: "TA069", OR: [{ dahliaName: null }, { dahliaName: "" }] }, {}],
    });
    expect(prisma.fieldChange.findMany).not.toHaveBeenCalled();
    expect(prisma.fieldChange.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        modelId: "ENC-1",
        previousValue: null,
        newValue: "034 requete",
        origin: "script",
      }),
    });
  });

  it("n'écrit rien en dry-run", async () => {
    prisma.attachedFile.findMany.mockResolvedValueOnce([piece("ENC-1", null)] as never);

    expect(await updatePieceNames(prisma, { ...OPTIONS, dryRun: true })).toEqual({
      scanned: 1,
      renamed: 1,
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.attachedFile.update).not.toHaveBeenCalled();
  });

  it("en force, renomme les pièces nommées sauf celles renommées par un utilisateur", async () => {
    prisma.attachedFile.findMany.mockResolvedValueOnce([
      piece("ENC-NEVER", "Nom importé"),
      piece("ENC-SCRIPT", "00034 requete"),
      piece("ENC-USER", "Nom saisi"),
    ] as never);
    prisma.fieldChange.findMany.mockResolvedValue([
      { jurisdictionCode: "TA069", modelId: "ENC-USER" },
    ] as never);

    expect(await updatePieceNames(prisma, { ...OPTIONS, force: true })).toEqual({
      scanned: 3,
      renamed: 2,
    });
    expect(prisma.fieldChange.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          model: "AttachedFile",
          field: "dahliaName",
          origin: "user",
        }),
      }),
    );
    const renamed = prisma.fieldChange.create.mock.calls.map((call) => call[0].data.modelId);
    expect(renamed).toEqual(["ENC-NEVER", "ENC-SCRIPT"]);
  });

  it("nomme un courrier codé de la juridiction par son type de pièce", async () => {
    prisma.attachedFile.findMany.mockResolvedValueOnce([
      {
        ...piece("ENC-COUK", "1083731924 notreq", "1083731924_notreq.pdf"),
        fileTypeLabel: "Communication de la requête",
        fileFamilyTypeCode: "COUK",
      },
    ] as never);
    prisma.fieldChange.findMany.mockResolvedValue([] as never);

    expect(await updatePieceNames(prisma, { ...OPTIONS, force: true })).toEqual({
      scanned: 1,
      renamed: 1,
    });
    expect(prisma.attachedFile.findMany.mock.calls[0][0]!.select).toMatchObject({
      fileTypeLabel: true,
      fileFamilyTypeCode: true,
    });
    expect(prisma.fieldChange.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        previousValue: "1083731924 notreq",
        newValue: "Communication de la requête",
        origin: "script",
      }),
    });
  });

  it("pagine par clé jusqu'à épuisement", async () => {
    const fullBatch = Array.from({ length: 500 }, (_, i) =>
      piece(`ENC-${String(i).padStart(4, "0")}`, "034 requete"),
    );
    prisma.attachedFile.findMany
      .mockResolvedValueOnce(fullBatch as never)
      .mockResolvedValueOnce([] as never);

    expect(await updatePieceNames(prisma, OPTIONS)).toEqual({ scanned: 500, renamed: 0 });
    expect(prisma.attachedFile.findMany).toHaveBeenCalledTimes(2);
    expect(prisma.attachedFile.findMany.mock.calls[1][0]!.where).toEqual({
      AND: [
        expect.anything(),
        {
          OR: [
            { jurisdictionCode: { gt: "TA069" } },
            { jurisdictionCode: "TA069", encodedFileId: { gt: "ENC-0499" } },
          ],
        },
      ],
    });
  });
});
