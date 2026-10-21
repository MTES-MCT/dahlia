import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import type { CaseFileDetail } from "@/app/lib/data/case-files";
import type { RelatedCaseFileLink } from "@/app/lib/data/related-case-files";
import {
  actorFixture,
  caseFileActorFixture,
} from "@/app/lib/test-support/case-file-actors.fixture";
import { CaseFileInfoPanel } from "./case-file-info-panel";

function caseFileFixture(
  overrides: Partial<NonNullable<CaseFileDetail>> = {},
): NonNullable<CaseFileDetail> {
  return {
    jurisdictionCode: "TA069",
    caseFileNumber: "2600001",
    depositDate: new Date("2026-07-19T10:00:00.000Z"),
    caseFileActors: [
      caseFileActorFixture({
        actorId: 1,
        qualityCode: "R",
        isMainClaimant: true,
        isMainDefender: false,
        actor: actorFixture({ id: 1, firstName: "Jean", lastName: "Dupont" }),
        quality: { code: "R", name: "Requérant" },
      }),
      caseFileActorFixture({
        actorId: 3,
        qualityCode: "A",
        isMainClaimant: false,
        isMainDefender: false,
        actor: actorFixture({ id: 3, firstName: "Marie", lastName: "Martin" }),
        quality: { code: "A", name: "Avocat" },
      }),
    ],
    chamber: { name: "4e chambre" },
    lastDecisionReading: null,
    ...overrides,
  } as NonNullable<CaseFileDetail>;
}

const RELATED: RelatedCaseFileLink[] = [
  {
    accessible: true,
    key: { jurisdictionCode: "TA069", caseFileNumber: "2500010" },
    title: "M. Dupont c/ Préfet",
    displayName: null,
  },
  { accessible: false, key: { jurisdictionCode: "TA069", caseFileNumber: "2500020" } },
];

function getFacts() {
  return within(document.querySelector("dl") as HTMLElement);
}

function getSummaryItem(text: string) {
  return screen.getByText(
    (_, element) => element?.tagName === "SPAN" && element.textContent === text,
  );
}

describe("CaseFileInfoPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("est replié par défaut et affiche le résumé", () => {
    render(<CaseFileInfoPanel caseFile={caseFileFixture()} relatedCaseFiles={RELATED} />);

    const toggle = screen.getByRole("button", { name: "Afficher" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(getSummaryItem("Déposé le 19/07/2026")).toBeTruthy();
    expect(getSummaryItem("2 dossiers liés")).toBeTruthy();
  });

  it("se déplie et se replie au clic", () => {
    render(<CaseFileInfoPanel caseFile={caseFileFixture()} relatedCaseFiles={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "Afficher" }));

    const toggle = screen.getByRole("button", { name: "Replier" });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Dupont Jean")).toBeTruthy();

    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Afficher" })).toBeTruthy();
  });

  it("n'affiche que les informations renseignées", () => {
    render(<CaseFileInfoPanel caseFile={caseFileFixture()} relatedCaseFiles={[]} />);

    const facts = getFacts();
    expect(facts.getByText("Requérant")).toBeTruthy();
    expect(facts.getByText("Dupont Jean")).toBeTruthy();
    expect(facts.getByText("Avocat")).toBeTruthy();
    expect(facts.getByText("Martin Marie")).toBeTruthy();
    expect(facts.getByText("Chambre du TA")).toBeTruthy();
    expect(facts.queryByText("Défendeur")).toBeNull();
    expect(facts.queryByText("Nature de la décision")).toBeNull();
    expect(facts.queryByText("Dispositif")).toBeNull();
  });

  it("affiche la décision et son dispositif quand ils existent", () => {
    render(
      <CaseFileInfoPanel
        caseFile={caseFileFixture({
          lastDecisionReading: {
            readingDate: new Date("2026-03-03T09:30:00.000Z"),
            nature: "Jugement",
            operativePart: "Article 1er : il est enjoint au préfet de reloger M. Dupont.",
          } as NonNullable<CaseFileDetail>["lastDecisionReading"],
        })}
        relatedCaseFiles={[]}
      />,
    );

    const facts = getFacts();
    expect(facts.getByText("Décision mise à disposition le")).toBeTruthy();
    expect(facts.getByText("03/03/2026 à 10h30")).toBeTruthy();
    expect(facts.getByText("Jugement")).toBeTruthy();
    expect(facts.getByText(/il est enjoint au préfet/)).toBeTruthy();
  });

  it("masque le résumé et la liste des dossiers liés quand il n'y en a pas", () => {
    render(
      <CaseFileInfoPanel caseFile={caseFileFixture({ depositDate: null })} relatedCaseFiles={[]} />,
    );

    expect(screen.queryByText(/Déposé le/)).toBeNull();
    expect(screen.queryByText(/Dossiers liés/)).toBeNull();
  });

  it("donne un lien vers les dossiers liés accessibles uniquement", () => {
    render(<CaseFileInfoPanel caseFile={caseFileFixture()} relatedCaseFiles={RELATED} />);

    const items = screen.getAllByRole("listitem", { hidden: true });
    expect(items).toHaveLength(2);

    const accessible = within(items[0]);
    expect(accessible.getByText("M. Dupont c/ Préfet")).toBeTruthy();
    expect(
      accessible.getByRole("link", { name: "Ouvrir", hidden: true }).getAttribute("href"),
    ).toBe("/case_files/TA069/2500010");

    const locked = within(items[1]);
    expect(locked.getByText("2500020")).toBeTruthy();
    expect(locked.getByText("Dossier non accessible")).toBeTruthy();
    expect(locked.queryByRole("link", { hidden: true })).toBeNull();
    expect(
      (locked.getByRole("button", { name: "Ouvrir", hidden: true }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("affiche le libellé du dossier lié et son titre Télérecours en dessous", () => {
    render(
      <CaseFileInfoPanel
        caseFile={caseFileFixture()}
        relatedCaseFiles={[
          {
            accessible: true,
            key: { jurisdictionCode: "TA069", caseFileNumber: "2500010" },
            title: "M. Dupont c/ Préfet",
            displayName: "2500010 - Dupont Jean - Injonction",
          },
        ]}
      />,
    );

    const item = within(screen.getByRole("listitem", { hidden: true }));
    expect(item.getByText("2500010 - Dupont Jean - Injonction")).toBeTruthy();
    expect(item.getByText("M. Dupont c/ Préfet").className).toContain("italic");
    expect(item.queryByText("2500010")).toBeNull();
  });

  it("n'affiche pas le titre Télérecours quand il est identique au libellé", () => {
    render(
      <CaseFileInfoPanel
        caseFile={caseFileFixture()}
        relatedCaseFiles={[
          {
            accessible: true,
            key: { jurisdictionCode: "TA069", caseFileNumber: "2500010" },
            title: "2500010",
            displayName: null,
          },
        ]}
      />,
    );

    const item = within(screen.getByRole("listitem", { hidden: true }));
    expect(item.getAllByText("2500010")).toHaveLength(1);
  });

  it("tronque le titre Télérecours d'un dossier lié sur une seule ligne", () => {
    render(<CaseFileInfoPanel caseFile={caseFileFixture()} relatedCaseFiles={RELATED} />);

    const title = screen.getByText("M. Dupont c/ Préfet");
    expect(title.className).toContain("truncate");
    expect(title.getAttribute("title")).toBe("M. Dupont c/ Préfet");
  });
});
