import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { enrichCaseFile, findLastProducerId, leadingNumber } from "./enrich-case-file";
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

describe("leadingNumber", () => {
  it("extracts a leading digit sequence and preserves leading zeros", () => {
    expect(leadingNumber("002_facture.pdf")).toBe("002");
    expect(leadingNumber("12 - lettre.pdf")).toBe("12");
  });

  it("returns null when the file name does not start with a digit", () => {
    expect(leadingNumber("facture.pdf")).toBeNull();
    expect(leadingNumber("")).toBeNull();
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
        false,
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
        enrichCaseFile(prisma, client, "TA069-001", "TA069", true, false, true),
      ).rejects.toThrow("502");
      expect(prisma.attachedFile.deleteMany).not.toHaveBeenCalled();
      expect(prisma.caseFileEvent.deleteMany).not.toHaveBeenCalled();
    });
  });
});
