import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { enrichCaseFile, findLastProducerId } from "./enrich-case-file";
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

describe("enrichCaseFile", () => {
  let prisma: DeepMockProxy<PrismaClient>;

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("upserts detail, hearings, events and attached files, then sets lastProducer", async () => {
    // The attached file's event must already exist in DB for it to be linked.
    prisma.caseFileEvent.findUnique.mockResolvedValue({ id: 90001 } as never);

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
    expect(prisma.caseFileEvent.upsert).toHaveBeenCalledOnce();
    expect(prisma.attachedFile.upsert).toHaveBeenCalledOnce();
    // lastProducer derived from the "Réception mémoire" event (actor 1001).
    expect(prisma.caseFile.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { lastProducerId: 1001 } }),
    );
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
});
