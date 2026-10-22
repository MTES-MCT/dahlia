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
  it("zero-pads the leading number to 5 digits and replaces underscores", () => {
    expect(pieceNameFromFileName("034_memoire_en_defense.pdf")).toBe("00034 memoire en defense");
    expect(pieceNameFromFileName("34-_requete_introductive.PDF")).toBe(
      "00034 requete introductive",
    );
    expect(pieceNameFromFileName("100034_piece.pdf")).toBe("100034 piece");
  });

  it("normalizes every leading number", () => {
    expect(pieceNameFromFileName("20261021_34_requête.pdf")).toBe("20261021 00034 requête");
  });

  it("drops a P_ prefix before the number", () => {
    expect(pieceNameFromFileName("P_34_requete.pdf")).toBe("00034 requete");
    expect(pieceNameFromFileName("P_20261021_34_requete.pdf")).toBe("20261021 00034 requete");
  });

  it("keeps names without leading number, only replacing underscores", () => {
    expect(pieceNameFromFileName("requete_introductive.pdf")).toBe("requete introductive");
    expect(pieceNameFromFileName("note_annexe.odt")).toBe("note annexe.odt");
  });

  it("drops piece prefixes (PJ, P, Piece, piece n°) before the number", () => {
    expect(pieceNameFromFileName("PJ5_Mail_OPAC_20180329.pdf")).toBe("00005 Mail OPAC 20180329");
    expect(pieceNameFromFileName("1141718428_P12_-_COPIE_TITRE.pdf")).toBe(
      "1141718428 00012 COPIE TITRE",
    );
    expect(pieceNameFromFileName("41818856_piece_n_4_Attestation.pdf")).toBe(
      "41818856 00004 Attestation",
    );
    expect(pieceNameFromFileName("1118543015_Piece_33_Commandement.pdf")).toBe(
      "1118543015 00033 Commandement",
    );
    expect(pieceNameFromFileName("Pièce n°3 bail.pdf")).toBe("00003 bail");
    expect(pieceNameFromFileName("Pièce_3.pdf")).toBe("00003");
  });

  it("keeps leading dates as text", () => {
    expect(pieceNameFromFileName("2025-01-17_Requete_DALO_1146530602.pdf")).toBe(
      "2025-01-17 Requete DALO 1146530602",
    );
    expect(pieceNameFromFileName("100764654_18_05_18_memoire.pdf")).toBe(
      "100764654 18 05 18 memoire",
    );
    expect(pieceNameFromFileName("001_21.01.2025_rejet.pdf")).toBe("00001 21.01.2025 rejet");
  });

  it("collapses repeated underscores into a single space", () => {
    expect(pieceNameFromFileName("015_Moisissures__ds_les_sanitaires__1159052506.pdf")).toBe(
      "00015 Moisissures ds les sanitaires 1159052506",
    );
  });

  it("handles a number alone and empty names", () => {
    expect(pieceNameFromFileName("034.pdf")).toBe("00034");
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
    expect(prisma.attachedFile.upsert).toHaveBeenCalledOnce();
    // lastProducer derived from the "Réception mémoire" event (actor 1001).
    expect(prisma.caseFile.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lastProducerId: 1001 }) }),
    );
  });

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

    expect(prisma.attachedFile.upsert).not.toHaveBeenCalled();
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
    expect(prisma.attachedFile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ jurisdictionCode: "TA069", caseFileNumber: "TA069-001" }),
      }),
    );
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

  describe("--update-piece-name", () => {
    beforeEach(() => {
      prisma.caseFileEvent.findUnique.mockResolvedValue({ id: 90001 } as never);
      prisma.fileFamilyType.upsert.mockResolvedValue({ code: "REQ", label: "Requête" } as never);
    });

    const client = () =>
      fakeTelerecoursClient({
        getCaseFileDetail: vi.fn().mockResolvedValue(caseFileDetailFixture()),
        getCaseFileAttachedFiles: vi
          .fn()
          .mockResolvedValue(page([attachedFileFixture({ fileName: "P_34_requete.pdf" })])),
      });

    it("ne touche pas dahliaName sans le flag", async () => {
      await enrichCaseFile(prisma, client(), "TA069-001", "TA069", true);
      expect(prisma.attachedFile.updateMany).not.toHaveBeenCalled();
    });

    it("renseigne dahliaName uniquement s'il est nul ou vide", async () => {
      await enrichCaseFile(prisma, client(), "TA069-001", "TA069", true, false, true);
      expect(prisma.attachedFile.updateMany).toHaveBeenCalledWith({
        where: {
          jurisdictionCode: "TA069",
          encodedFileId: expect.any(String),
          OR: [{ dahliaName: null }, { dahliaName: "" }],
        },
        data: { dahliaName: "00034 requete" },
      });
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
      prisma.attachedFile.deleteMany.mockResolvedValue({ count: 0 });
      prisma.caseFileEvent.deleteMany.mockResolvedValue({ count: 0 });
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
