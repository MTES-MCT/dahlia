import { beforeEach, describe, expect, it } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import {
  applyDahliaNameUpdate,
  autoDahliaName,
  hasTelerecoursChanges,
  mayAutoRename,
  pieceNameFromFileName,
  plannedAutoRename,
  type AttachedFileTelerecoursData,
} from "./attached-file-dahlia-name";

describe("mayAutoRename", () => {
  const piece = (dahliaName: string | null) => ({ dahliaName });

  it("autorise toujours une pièce sans nom", () => {
    expect(mayAutoRename(piece(null), false, false)).toBe(true);
    expect(mayAutoRename(piece(""), true, false)).toBe(true);
  });

  it("n'écrase jamais un nom sans force", () => {
    expect(mayAutoRename(piece("Nom"), false, false)).toBe(false);
  });

  it("en force, renomme une pièce nommée par le scraper, un script ou sans historique", () => {
    expect(mayAutoRename(piece("Nom"), false, true)).toBe(true);
  });

  it("en force, préserve une pièce renommée par un utilisateur", () => {
    expect(mayAutoRename(piece("Nom"), true, true)).toBe(false);
  });
});

describe("plannedAutoRename", () => {
  it("dérive le nom depuis le nom de fichier", () => {
    expect(
      plannedAutoRename({ dahliaName: null, fileName: "P_34_requete.pdf" }, false, false),
    ).toBe("034 requete");
  });

  it("ne propose rien quand le nom est inchangé ou non dérivable", () => {
    expect(
      plannedAutoRename({ dahliaName: "034 requete", fileName: "P_34_requete.pdf" }, false, true),
    ).toBeNull();
    expect(plannedAutoRename({ dahliaName: null, fileName: ".pdf" }, false, true)).toBeNull();
  });
});

describe("autoDahliaName", () => {
  const courrier = (fileName: string, fileTypeLabel = "Communication de la requête") => ({
    fileName,
    fileTypeLabel,
    fileFamilyTypeCode: "COUK",
  });

  it("remplace le code par le type de pièce sans conserver l'identifiant Télérecours", () => {
    expect(autoDahliaName(courrier("1083731924_notreq.pdf"))).toBe("Communication de la requête");
    expect(
      autoDahliaName(courrier("notpcc_1160330020.pdf", "Communication de pièces complémentaires")),
    ).toBe("Communication de pièces complémentaires");
    expect(
      autoDahliaName(
        courrier("dispada5_1172791774.pdf", "Notification d'une dispense d'audience DALO"),
      ),
    ).toBe("Notification d'une dispense d'audience DALO");
    expect(
      autoDahliaName(courrier("r611-11_1164887605.pdf", "Lettre d'information - R. 611-11-1")),
    ).toBe("Lettre d'information - R. 611-11-1");
    expect(autoDahliaName(courrier("1084203330_LETGRE.PDF", " Lettre du greffier "))).toBe(
      "Lettre du greffier",
    );
    expect(autoDahliaName(courrier("notdeci_1147950896-1.pdf", "Notification décision"))).toBe(
      "Notification décision",
    );
  });

  it("garde le nom dérivé du fichier hors courrier codé", () => {
    // Same shape, but filed by a party (family REQ): "dupont" is not a type code.
    expect(
      autoDahliaName({
        fileName: "1083731924_dupont.pdf",
        fileTypeLabel: "Requête",
        fileFamilyTypeCode: "REQ",
      }),
    ).toBe("dupont");
    // Court correspondence with a free-form name.
    expect(autoDahliaName(courrier("P_34_courrier_du_greffe.pdf"))).toBe("034 courrier du greffe");
    // No type label to fall back on.
    expect(autoDahliaName(courrier("1083731924_notreq.pdf", " "))).toBe("notreq");
    expect(autoDahliaName({ fileName: "1083731924_notreq.pdf" })).toBe("notreq");
  });
});

describe("pieceNameFromFileName : mots collés de Télérecours", () => {
  it("écrit « Inventaire automatique » en clair, quelle que soit la casse", () => {
    expect(pieceNameFromFileName("1105771952_inventaireAutomatique_803008652.pdf")).toBe(
      "Inventaire automatique",
    );
    expect(pieceNameFromFileName("inventaireAutomatique_806073205_1142998355.pdf")).toBe(
      "Inventaire automatique",
    );
    expect(pieceNameFromFileName("InventaireAutomatique_82304.pdf")).toBe(
      "Inventaire automatique 82304",
    );
    expect(pieceNameFromFileName("InventaireAutomatique.pdf")).toBe("Inventaire automatique");
  });

  it("ne touche pas un mot qui ne fait que contenir le terme", () => {
    expect(pieceNameFromFileName("monInventaireAutomatiqueBis.pdf")).toBe(
      "monInventaireAutomatiqueBis",
    );
  });
});

describe("hasTelerecoursChanges", () => {
  const data: AttachedFileTelerecoursData = {
    originalFileName: "a.pdf",
    fileName: "a.pdf",
    mimeType: "application/pdf",
    documentType: "MEMOIRE",
    subEventId: 0,
    receiptAcknowledgmentId: null,
    receiptAcknowledgmentType: null,
    fileTypeLabel: "Mémoire",
    fileFamilyTypeLabel: "Requête",
    eventCreationDate: new Date("2026-01-05T00:00:00Z"),
    caseFileNumber: "TA069-001",
    eventId: 1,
    fileFamilyTypeCode: "REQ",
  };

  it("compare les dates par valeur et ignore les champs Dahlia", () => {
    const stored = {
      ...data,
      eventCreationDate: new Date("2026-01-05T00:00:00Z"),
      dahliaName: "Nom",
      comment: "Commentaire",
    };
    expect(hasTelerecoursChanges(stored, data)).toBe(false);
  });

  it("détecte un champ Télérecours modifié", () => {
    expect(hasTelerecoursChanges(data, { ...data, fileName: "b.pdf" })).toBe(true);
    expect(
      hasTelerecoursChanges(data, { ...data, eventCreationDate: new Date("2026-01-06T00:00:00Z") }),
    ).toBe(true);
  });

  it("assimile undefined à null", () => {
    expect(
      hasTelerecoursChanges(data, {
        ...data,
        receiptAcknowledgmentId: undefined as unknown as null,
      }),
    ).toBe(false);
  });
});

describe("applyDahliaNameUpdate", () => {
  let prisma: DeepMockProxy<PrismaClient>;
  const piece = { jurisdictionCode: "TA069", encodedFileId: "ENC-1", dahliaName: "Ancien" };
  const now = new Date("2026-11-02T10:00:00Z");

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
  });

  it("met à jour la pièce et historise le renommage dans la même transaction", async () => {
    expect(await applyDahliaNameUpdate(prisma, piece, "Nouveau", "script", { now })).toBe(true);

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.attachedFile.update).toHaveBeenCalledWith({
      where: {
        jurisdictionCode_encodedFileId: { jurisdictionCode: "TA069", encodedFileId: "ENC-1" },
      },
      data: { dahliaName: "Nouveau", updatedAt: now },
    });
    expect(prisma.fieldChange.create).toHaveBeenCalledWith({
      data: {
        jurisdictionCode: "TA069",
        model: "AttachedFile",
        modelId: "ENC-1",
        field: "dahliaName",
        previousValue: "Ancien",
        newValue: "Nouveau",
        origin: "script",
        changedAt: now,
      },
    });
  });

  it("trace un nom effacé avec une nouvelle valeur vide", async () => {
    expect(await applyDahliaNameUpdate(prisma, piece, null, "user", { now })).toBe(true);
    expect(prisma.fieldChange.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ previousValue: "Ancien", newValue: "" }),
    });
  });

  it("n'historise pas un nom inchangé mais écrit les autres données", async () => {
    expect(
      await applyDahliaNameUpdate(prisma, piece, "Ancien", "user", {
        now,
        otherData: { comment: "Vu" },
      }),
    ).toBe(false);
    expect(prisma.attachedFile.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { comment: "Vu", dahliaName: "Ancien", updatedAt: now } }),
    );
    expect(prisma.fieldChange.create).not.toHaveBeenCalled();
  });
});
