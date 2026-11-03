import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { enrichCaseFile, findLastProducerId, pieceNameFromFileName } from "./enrich-case-file";
import { fakeTelerecoursClient } from "../test-support/fake-client";
import {
  attachedFileFixture,
  caseFileDetailFixture,
  eventFixture,
  hearingFixture,
  page,
} from "../test-support/fixtures";

// Stored attached_files row matching attachedFileFixture() once upserted for
// case file TA069-001 (family label "Requête").
function storedPiece(over: Record<string, unknown> = {}) {
  const file = attachedFileFixture();
  return {
    jurisdictionCode: "TA069",
    encodedFileId: file.encodedFileId,
    originalFileName: file.originalFileName,
    fileName: file.fileName,
    mimeType: file.mimeType,
    documentType: file.documentType,
    subEventId: file.subEventId,
    receiptAcknowledgmentId: file.receiptAcknowledgmentId,
    receiptAcknowledgmentType: file.receiptAcknowledgmentType,
    fileTypeLabel: file.fileTypeLabel,
    fileFamilyTypeLabel: "Requête",
    eventCreationDate: new Date(file.eventCreationDate),
    caseFileNumber: "TA069-001",
    eventId: file.eventId,
    fileFamilyTypeCode: file.fileFamilyType,
    dahliaName: null,
    comment: null,
    isFavorite: false,
    telerecoursUpdatedAt: null,
    ...over,
  };
}

describe("findLastProducerId", () => {
  it("returns the actor of the most recent 'reception…' event", () => {
    const events = [
      eventFixture({
        id: 1,
        eventDate: "2026-01-01",
        actor: { ...eventFixture().actor!, id: 10 },
        measure: { ...eventFixture().measure, label: "Réception mémoire" },
      }),
      eventFixture({
        id: 2,
        eventDate: "2026-02-01",
        actor: { ...eventFixture().actor!, id: 20 },
        measure: { ...eventFixture().measure, label: "RECEPTION pièces" },
      }),
      eventFixture({
        id: 3,
        eventDate: "2026-03-01",
        actor: { ...eventFixture().actor!, id: 30 },
        measure: { ...eventFixture().measure, label: "Ordonnance de clôture" },
      }),
    ];
    expect(findLastProducerId(events)).toBe(20);
  });

  it("returns null when no event matches", () => {
    expect(
      findLastProducerId([
        eventFixture({ measure: { ...eventFixture().measure, label: "Autre" } }),
      ]),
    ).toBeNull();
  });
});

describe("pieceNameFromFileName", () => {
  it("zero-pads the leading number to 3 digits and replaces underscores", () => {
    expect(pieceNameFromFileName("034_memoire_en_defense.pdf")).toBe("034 memoire en defense");
    expect(pieceNameFromFileName("34-_requete_introductive.PDF")).toBe("034 requete introductive");
    expect(pieceNameFromFileName("100034_piece.pdf")).toBe("100034 piece");
  });

  it("normalizes every leading number", () => {
    expect(pieceNameFromFileName("20261021_34_requête.pdf")).toBe("20261021 034 requête");
  });

  it("drops a P_ prefix before the number", () => {
    expect(pieceNameFromFileName("P_34_requete.pdf")).toBe("034 requete");
    expect(pieceNameFromFileName("P_20261021_34_requete.pdf")).toBe("20261021 034 requete");
  });

  it("keeps names without leading number, only replacing underscores", () => {
    expect(pieceNameFromFileName("requete_introductive.pdf")).toBe("requete introductive");
    expect(pieceNameFromFileName("note_annexe.odt")).toBe("note annexe.odt");
  });

  it("drops piece prefixes (PJ, P, Piece, piece n°) before the number", () => {
    expect(pieceNameFromFileName("PJ5_Mail_OPAC_20180329.pdf")).toBe("005 Mail OPAC 20180329");
    expect(pieceNameFromFileName("1141718428_P12_-_COPIE_TITRE.pdf")).toBe(
      "1141718428 012 COPIE TITRE",
    );
    expect(pieceNameFromFileName("41818856_piece_n_4_Attestation.pdf")).toBe(
      "41818856 004 Attestation",
    );
    expect(pieceNameFromFileName("1118543015_Piece_33_Commandement.pdf")).toBe(
      "1118543015 033 Commandement",
    );
    expect(pieceNameFromFileName("Pièce n°3 bail.pdf")).toBe("003 bail");
    expect(pieceNameFromFileName("Pièce_3.pdf")).toBe("003");
  });

  it("keeps leading dates as text", () => {
    expect(pieceNameFromFileName("2025-01-17_Requete_DALO_1146530602.pdf")).toBe(
      "2025-01-17 Requete DALO 1146530602",
    );
    expect(pieceNameFromFileName("100764654_18_05_18_memoire.pdf")).toBe(
      "100764654 18 05 18 memoire",
    );
    expect(pieceNameFromFileName("001_21.01.2025_rejet.pdf")).toBe("001 21.01.2025 rejet");
  });

  it("collapses repeated underscores into a single space", () => {
    expect(pieceNameFromFileName("015_Moisissures__ds_les_sanitaires__1159052506.pdf")).toBe(
      "015 Moisissures ds les sanitaires 1159052506",
    );
  });

  it("handles a number alone and empty names", () => {
    expect(pieceNameFromFileName("034.pdf")).toBe("034");
    expect(pieceNameFromFileName(".pdf")).toBeNull();
  });
});

describe("enrichCaseFile", () => {
  let prisma: DeepMockProxy<PrismaClient>;

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    prisma.jurisdiction.upsert.mockResolvedValue({
      id: 1,
      name: "",
      shortName: "TA069",
      jurisdictionCode: "TA069",
    });
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("upserts detail, hearings, events and attached files, then sets lastProducer", async () => {
    // The attached file's event must already exist in DB for it to be linked.
    prisma.caseFileEvent.findUnique.mockResolvedValue({ id: 90001 } as never);
    prisma.fileFamilyType.upsert.mockResolvedValue({ code: "REQ", label: "Requête" } as never);

    const client = fakeTelerecoursClient({
      getCaseFileDetail: vi.fn().mockResolvedValue(caseFileDetailFixture()),
      getCaseFileHearings: vi.fn().mockResolvedValue(page([hearingFixture()])),
      getCaseFileMeasures: vi.fn().mockResolvedValue(
        page([
          eventFixture({
            measure: {
              id: "RECMEM",
              label: "Réception mémoire",
              type: "T",
              isImportant: false,
              family: null,
            },
          }),
        ]),
      ),
      getCaseFileAttachedFiles: vi.fn().mockResolvedValue(page([attachedFileFixture()])),
    });

    await enrichCaseFile(prisma, client, "TA069-001", "TA069", true);

    expect(prisma.hearing.upsert).toHaveBeenCalledOnce();
    expect(prisma.caseFileHearing.upsert).toHaveBeenCalledOnce();
    expect(prisma.caseFileHearing.deleteMany).toHaveBeenCalledOnce();
    expect(prisma.caseFileEvent.upsert).toHaveBeenCalledOnce();
    expect(prisma.attachedFile.create).toHaveBeenCalledOnce();
    // lastProducer derived from the "Réception mémoire" event (actor 1001).
    expect(prisma.caseFile.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lastProducerId: 1001 }) }),
    );
  });

  it.each([
    ["REQ", true],
    ["PRQ", false],
  ])(
    "flags a newly created %s pièce as favorite=%s, never on update",
    async (fileFamilyType, isFavorite) => {
      prisma.caseFileEvent.findUnique.mockResolvedValue({ id: 90001 } as never);
      prisma.fileFamilyType.upsert.mockResolvedValue({ code: fileFamilyType, label: "x" } as never);
      const client = fakeTelerecoursClient({
        getCaseFileDetail: vi.fn().mockResolvedValue(caseFileDetailFixture()),
        getCaseFileMeasures: vi.fn().mockResolvedValue(page([eventFixture({ id: 90001 })])),
        getCaseFileAttachedFiles: vi
          .fn()
          .mockResolvedValue(page([attachedFileFixture({ fileFamilyType })])),
      });

      await enrichCaseFile(prisma, client, "TA069-001", "TA069", true);
      expect(prisma.attachedFile.create.mock.calls[0][0].data).toMatchObject({ isFavorite });

      // Re-scrape of a stored pièce whose Telerecours data changed.
      prisma.attachedFile.findUnique.mockResolvedValue(
        storedPiece({ fileName: "ancien.pdf", isFavorite: !isFavorite }) as never,
      );
      await enrichCaseFile(prisma, client, "TA069-001", "TA069", true);
      expect(prisma.attachedFile.update.mock.calls[0][0].data).not.toHaveProperty("isFavorite");
    },
  );

  it("stamps telerecoursUpdatedAt and telerecoursSyncAt on first sync (no prior hash)", async () => {
    prisma.caseFileEvent.findUnique.mockResolvedValue({ id: 90001 } as never);
    prisma.fileFamilyType.upsert.mockResolvedValue({ code: "REQ", label: "Requête" } as never);
    // No existing case file → no stored hash → the payload counts as changed.
    prisma.caseFile.findUnique.mockResolvedValue(null);

    const client = fakeTelerecoursClient({
      getCaseFileDetail: vi.fn().mockResolvedValue(caseFileDetailFixture()),
      getCaseFileHearings: vi.fn().mockResolvedValue(page([hearingFixture()])),
      getCaseFileMeasures: vi.fn().mockResolvedValue(page([eventFixture()])),
      getCaseFileAttachedFiles: vi.fn().mockResolvedValue(page([attachedFileFixture()])),
    });

    await enrichCaseFile(prisma, client, "TA069-001", "TA069", true);

    const data = prisma.caseFile.update.mock.calls.at(-1)![0].data as Record<string, unknown>;
    expect(data.telerecoursSyncAt).toBeInstanceOf(Date);
    expect(data.telerecoursUpdatedAt).toBeInstanceOf(Date);
    expect(typeof data.telerecoursContentHash).toBe("string");
  });

  it("refreshes only telerecoursSyncAt when the scraped payload is unchanged", async () => {
    prisma.caseFileEvent.findUnique.mockResolvedValue({ id: 90001 } as never);
    prisma.fileFamilyType.upsert.mockResolvedValue({ code: "REQ", label: "Requête" } as never);
    prisma.caseFile.findUnique.mockResolvedValue(null);

    const client = fakeTelerecoursClient({
      getCaseFileDetail: vi.fn().mockResolvedValue(caseFileDetailFixture()),
      getCaseFileHearings: vi.fn().mockResolvedValue(page([hearingFixture()])),
      getCaseFileMeasures: vi.fn().mockResolvedValue(page([eventFixture()])),
      getCaseFileAttachedFiles: vi.fn().mockResolvedValue(page([attachedFileFixture()])),
    });

    // First scrape computes the hash of this exact payload.
    await enrichCaseFile(prisma, client, "TA069-001", "TA069", true);
    const firstData = prisma.caseFile.update.mock.calls.at(-1)![0].data as Record<string, unknown>;
    const hash = firstData.telerecoursContentHash as string;

    // Second scrape sees the same stored hash → nothing changed.
    prisma.caseFile.findUnique.mockResolvedValue({ telerecoursContentHash: hash } as never);
    await enrichCaseFile(prisma, client, "TA069-001", "TA069", true);

    const secondData = prisma.caseFile.update.mock.calls.at(-1)![0].data as Record<string, unknown>;
    expect(secondData.telerecoursSyncAt).toBeInstanceOf(Date);
    expect(secondData.telerecoursUpdatedAt).toBeUndefined();
    expect(secondData.telerecoursContentHash).toBeUndefined();
  });

  it("skips an attached file whose event is not in DB", async () => {
    prisma.caseFileEvent.findUnique.mockResolvedValue(null);

    const client = fakeTelerecoursClient({
      getCaseFileDetail: vi.fn().mockResolvedValue(caseFileDetailFixture()),
      getCaseFileAttachedFiles: vi.fn().mockResolvedValue(page([attachedFileFixture()])),
    });

    await enrichCaseFile(prisma, client, "TA069-001", "TA069", true);

    expect(prisma.attachedFile.create).not.toHaveBeenCalled();
    expect(prisma.attachedFile.update).not.toHaveBeenCalled();
  });

  it("keys every row by the court of the Dahlia instance (TA069bis → TA069)", async () => {
    process.env.TA069bis_TELERECOURS_JURISDICTION = "TA069";
    prisma.jurisdiction.upsert.mockResolvedValue({
      id: 2,
      name: "",
      shortName: "TA069bis",
      jurisdictionCode: "TA069",
    });
    prisma.caseFileEvent.findUnique.mockResolvedValue({ id: 90001 } as never);
    prisma.fileFamilyType.upsert.mockResolvedValue({ code: "REQ", label: "Requête" } as never);

    const client = fakeTelerecoursClient({
      getCaseFileDetail: vi.fn().mockResolvedValue(caseFileDetailFixture()),
      getCaseFileMeasures: vi.fn().mockResolvedValue(page([eventFixture({ id: 90001 })])),
      getCaseFileAttachedFiles: vi.fn().mockResolvedValue(page([attachedFileFixture()])),
    });

    try {
      await enrichCaseFile(prisma, client, "TA069-001", "TA069bis", true);
    } finally {
      delete process.env.TA069bis_TELERECOURS_JURISDICTION;
    }

    expect(prisma.caseFileEvent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { jurisdictionCode_id: { jurisdictionCode: "TA069", id: 90001 } },
      }),
    );
    expect(prisma.attachedFile.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ jurisdictionCode: "TA069", caseFileNumber: "TA069-001" }),
    });
    expect(prisma.caseFile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          jurisdictionCode_caseFileNumber: {
            jurisdictionCode: "TA069",
            caseFileNumber: "TA069-001",
          },
        },
      }),
    );
  });

  describe("pièces : mise à jour conditionnelle", () => {
    beforeEach(() => {
      prisma.caseFileEvent.findUnique.mockResolvedValue({ id: 90001 } as never);
      prisma.fileFamilyType.upsert.mockResolvedValue({ code: "FAM", label: "Requête" } as never);
    });

    const client = () =>
      fakeTelerecoursClient({
        getCaseFileDetail: vi.fn().mockResolvedValue(caseFileDetailFixture()),
        getCaseFileAttachedFiles: vi.fn().mockResolvedValue(page([attachedFileFixture()])),
      });

    it("crée une nouvelle pièce avec ses horodatages", async () => {
      await enrichCaseFile(prisma, client(), "TA069-001", "TA069", true);

      const data = prisma.attachedFile.create.mock.calls[0][0].data;
      expect(data.createdAt).toBeInstanceOf(Date);
      expect(data.updatedAt).toBe(data.createdAt);
      expect(data.telerecoursUpdatedAt).toBe(data.createdAt);
    });

    it("n'écrit pas une pièce dont les données Télérecours sont inchangées", async () => {
      prisma.attachedFile.findUnique.mockResolvedValue(storedPiece() as never);

      await enrichCaseFile(prisma, client(), "TA069-001", "TA069", true);

      expect(prisma.attachedFile.create).not.toHaveBeenCalled();
      expect(prisma.attachedFile.update).not.toHaveBeenCalled();
    });

    it("met à jour une pièce modifiée et horodate telerecoursUpdatedAt", async () => {
      prisma.attachedFile.findUnique.mockResolvedValue(
        storedPiece({ fileTypeLabel: "Ancien libellé" }) as never,
      );

      await enrichCaseFile(prisma, client(), "TA069-001", "TA069", true);

      const data = prisma.attachedFile.update.mock.calls[0][0].data;
      expect(data).toMatchObject({ fileTypeLabel: "Mémoire" });
      expect(data.telerecoursUpdatedAt).toBeInstanceOf(Date);
      expect(data.updatedAt).toBe(data.telerecoursUpdatedAt);
      expect(data).not.toHaveProperty("dahliaName");
    });
  });

  describe("--update-piece-name / --force-update-piece-name", () => {
    beforeEach(() => {
      prisma.caseFileEvent.findUnique.mockResolvedValue({ id: 90001 } as never);
      prisma.fileFamilyType.upsert.mockResolvedValue({ code: "FAM", label: "Requête" } as never);
    });

    const client = () =>
      fakeTelerecoursClient({
        getCaseFileDetail: vi.fn().mockResolvedValue(caseFileDetailFixture()),
        getCaseFileAttachedFiles: vi
          .fn()
          .mockResolvedValue(page([attachedFileFixture({ fileName: "P_34_requete.pdf" })])),
      });

    // Stored pièce identical to the scraped one, except for its Dahlia name.
    function named(dahliaName: string | null) {
      prisma.attachedFile.findUnique.mockResolvedValue(
        storedPiece({ fileName: "P_34_requete.pdf", dahliaName }) as never,
      );
    }

    // Whether the history holds a user rename of the pièce.
    function renamedByUser(value: boolean) {
      prisma.fieldChange.findFirst.mockResolvedValue((value ? { id: 1 } : null) as never);
    }

    const renamedTo = () =>
      prisma.attachedFile.update.mock.calls.map((call) => call[0].data.dahliaName);

    it("ne touche pas dahliaName sans le flag", async () => {
      named(null);
      await enrichCaseFile(prisma, client(), "TA069-001", "TA069", true);
      expect(prisma.attachedFile.update).not.toHaveBeenCalled();
      expect(prisma.fieldChange.create).not.toHaveBeenCalled();
    });

    it("nomme une pièce sans nom et historise le renommage (origine scraper)", async () => {
      named(null);
      await enrichCaseFile(prisma, client(), "TA069-001", "TA069", true, false, true);

      expect(prisma.$transaction).toHaveBeenCalledOnce();
      expect(renamedTo()).toEqual(["034 requete"]);
      expect(prisma.fieldChange.create).toHaveBeenCalledWith({
        data: {
          jurisdictionCode: "TA069",
          model: "AttachedFile",
          modelId: "ENC-001",
          field: "dahliaName",
          previousValue: null,
          newValue: "034 requete",
          origin: "scraper",
          changedAt: expect.any(Date),
        },
      });
    });

    it("nomme aussi une pièce nouvellement créée", async () => {
      await enrichCaseFile(prisma, client(), "TA069-001", "TA069", true, false, true);
      expect(prisma.attachedFile.create).toHaveBeenCalledOnce();
      expect(renamedTo()).toEqual(["034 requete"]);
    });

    it("n'écrase jamais un nom saisi sans --force-update-piece-name", async () => {
      named("Nom saisi");
      await enrichCaseFile(prisma, client(), "TA069-001", "TA069", true, false, true);
      expect(prisma.attachedFile.update).not.toHaveBeenCalled();
      expect(prisma.fieldChange.findFirst).not.toHaveBeenCalled();
    });

    it("--force-update-piece-name renomme une pièce nommée par un script ou le scraper", async () => {
      named("00034 requete");
      renamedByUser(false);
      await enrichCaseFile(prisma, client(), "TA069-001", "TA069", true, false, false, true);
      expect(prisma.fieldChange.findFirst).toHaveBeenCalledWith({
        where: {
          jurisdictionCode: "TA069",
          model: "AttachedFile",
          modelId: "ENC-001",
          field: "dahliaName",
          origin: "user",
        },
        select: { id: true },
      });
      expect(renamedTo()).toEqual(["034 requete"]);
    });

    it("--force-update-piece-name préserve une pièce renommée par un utilisateur", async () => {
      named("Nom saisi");
      renamedByUser(true);
      await enrichCaseFile(prisma, client(), "TA069-001", "TA069", true, false, false, true);
      expect(prisma.attachedFile.update).not.toHaveBeenCalled();
      expect(prisma.fieldChange.create).not.toHaveBeenCalled();
    });

    it("n'écrit rien quand le nom dérivé est déjà le nom actuel", async () => {
      named("034 requete");
      renamedByUser(false);
      await enrichCaseFile(prisma, client(), "TA069-001", "TA069", true, false, false, true);
      expect(prisma.attachedFile.update).not.toHaveBeenCalled();
    });
  });

  describe("--force", () => {
    function clientReturning(eventIds: number[], fileIds: string[]) {
      return fakeTelerecoursClient({
        getCaseFileDetail: vi.fn().mockResolvedValue(caseFileDetailFixture()),
        getCaseFileMeasures: vi
          .fn()
          .mockResolvedValue(page(eventIds.map((id) => eventFixture({ id })))),
        getCaseFileAttachedFiles: vi
          .fn()
          .mockResolvedValue(
            page(fileIds.map((encodedFileId) => attachedFileFixture({ encodedFileId }))),
          ),
      });
    }

    beforeEach(() => {
      prisma.caseFileEvent.findUnique.mockResolvedValue({ id: 90001 } as never);
      prisma.fileFamilyType.upsert.mockResolvedValue({ code: "REQ", label: "Requête" } as never);
      prisma.attachedFile.findMany.mockResolvedValue([]);
      prisma.attachedFile.deleteMany.mockResolvedValue({ count: 0 });
      prisma.caseFileEvent.deleteMany.mockResolvedValue({ count: 0 });
    });

    it("supprime l'historique des pièces supprimées (pas de clé étrangère)", async () => {
      prisma.attachedFile.findMany.mockResolvedValue([{ encodedFileId: "ENC-OLD" }] as never);

      await enrichCaseFile(
        prisma,
        clientReturning([90001], ["ENC-1"]),
        "TA069-001",
        "TA069",
        true,
        true,
      );

      expect(prisma.fieldChange.deleteMany).toHaveBeenCalledWith({
        where: { jurisdictionCode: "TA069", model: "AttachedFile", modelId: { in: ["ENC-OLD"] } },
      });
    });

    it("ne supprime rien sans --force", async () => {
      await enrichCaseFile(prisma, clientReturning([90001], ["ENC-1"]), "TA069-001", "TA069", true);

      expect(prisma.attachedFile.deleteMany).not.toHaveBeenCalled();
      expect(prisma.caseFileEvent.deleteMany).not.toHaveBeenCalled();
    });

    it("supprime les pièces puis les événements du dossier absents de Télérecours", async () => {
      await enrichCaseFile(
        prisma,
        clientReturning([90001], ["ENC-1"]),
        "TA069-001",
        "TA069",
        true,
        true,
      );

      const key = { jurisdictionCode: "TA069", caseFileNumber: "TA069-001" };
      expect(prisma.attachedFile.deleteMany).toHaveBeenCalledWith({
        where: { ...key, encodedFileId: { notIn: ["ENC-1"] } },
      });
      // An event still referenced by a kept attached file is kept (FK).
      expect(prisma.caseFileEvent.deleteMany).toHaveBeenCalledWith({
        where: { ...key, id: { notIn: [90001] }, attachedFiles: { none: {} } },
      });
      expect(prisma.attachedFile.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
        prisma.caseFileEvent.deleteMany.mock.invocationCallOrder[0],
      );
    });

    it("ne supprime pas quand la récupération Télérecours échoue", async () => {
      const client = fakeTelerecoursClient({
        getCaseFileDetail: vi.fn().mockResolvedValue(caseFileDetailFixture()),
        getCaseFileAttachedFiles: vi.fn().mockRejectedValue(new Error("502")),
      });

      await expect(
        enrichCaseFile(prisma, client, "TA069-001", "TA069", true, true),
      ).rejects.toThrow("502");
      expect(prisma.attachedFile.deleteMany).not.toHaveBeenCalled();
      expect(prisma.caseFileEvent.deleteMany).not.toHaveBeenCalled();
    });
  });
});
