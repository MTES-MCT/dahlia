import { describe, expect, it } from "vitest";
import { getMemoryDeadlineSource } from "@/app/lib/case-files-dashboard-columns";

const productionDeadlineDate = new Date(2024, 5, 15);
const convocationDate = new Date(2024, 6, 1);

describe("getMemoryDeadlineSource", () => {
  it("retourne CLOTURE_INSTRUCTION quand une date de production et le type correspondant sont définis", () => {
    expect(
      getMemoryDeadlineSource({
        productionDeadlineDate,
        productionDeadlineType: "CLOTURE_INSTRUCTION",
        lastHearing: null,
      }),
    ).toBe("CLOTURE_INSTRUCTION");
  });

  it("retourne MISE_EN_DEMEURE_DE_PRODUIRE quand une date de production et le type correspondant sont définis", () => {
    expect(
      getMemoryDeadlineSource({
        productionDeadlineDate,
        productionDeadlineType: "MISE_EN_DEMEURE_DE_PRODUIRE",
        lastHearing: null,
      }),
    ).toBe("MISE_EN_DEMEURE_DE_PRODUIRE");
  });

  it("retourne hearing quand seule la date de convocation d'audience est définie", () => {
    expect(
      getMemoryDeadlineSource({
        productionDeadlineDate: null,
        productionDeadlineType: null,
        lastHearing: { convocationDate },
      }),
    ).toBe("hearing");
  });

  it("retourne null quand aucune date n'est définie", () => {
    expect(
      getMemoryDeadlineSource({
        productionDeadlineDate: null,
        productionDeadlineType: null,
        lastHearing: null,
      }),
    ).toBeNull();
  });

  it("retourne null quand l'audience n'a pas de date de convocation", () => {
    expect(
      getMemoryDeadlineSource({
        productionDeadlineDate: null,
        productionDeadlineType: null,
        lastHearing: { convocationDate: null },
      }),
    ).toBeNull();
  });

  it("priorise la date de production sur l'audience quand les deux sont définies", () => {
    expect(
      getMemoryDeadlineSource({
        productionDeadlineDate,
        productionDeadlineType: "CLOTURE_INSTRUCTION",
        lastHearing: { convocationDate },
      }),
    ).toBe("CLOTURE_INSTRUCTION");
  });

  it("retombe sur hearing quand une date de production est définie sans type reconnu", () => {
    expect(
      getMemoryDeadlineSource({
        productionDeadlineDate,
        productionDeadlineType: null,
        lastHearing: { convocationDate },
      }),
    ).toBe("hearing");
  });
});
