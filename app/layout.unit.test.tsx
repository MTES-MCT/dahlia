import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Footer, type FooterProps } from "@codegouvfr/react-dsfr/Footer";
import RootLayout, { metadata } from "./layout";
import { auth } from "@/app/lib/auth";

vi.mock("@/app/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

vi.mock("@/app/lib/prisma", () => ({
  prisma: {},
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

const mockedGetSession = vi.mocked(auth.api.getSession);

// RootLayout returns the <html> element itself, which cannot be mounted in
// jsdom; we inspect the returned element tree instead of rendering it.
async function renderRootLayout() {
  return (await RootLayout({ children: null })) as ReactElement<{
    lang: string;
    children: ReactNode;
  }>;
}

function childOf<P>(node: ReactNode, type: unknown): ReactElement<P> {
  const found = Children.toArray(node).find(
    (child) => isValidElement(child) && child.type === type,
  );
  if (!isValidElement<P>(found)) {
    throw new Error("Élément introuvable dans le layout racine");
  }
  return found;
}

async function footerProps() {
  const html = await renderRootLayout();
  const body = childOf<{ children: ReactNode }>(html.props.children, "body");
  return childOf<FooterProps>(body.props.children, Footer).props;
}

describe("RootLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetSession.mockResolvedValue(null as never);
  });

  // RGAA 8.3 — the page must declare its default language.
  it("déclare la langue française sur l'élément <html>", async () => {
    const html = await renderRootLayout();

    expect(html.type).toBe("html");
    expect(html.props.lang).toBe("fr");
  });

  // RGAA 8.5/8.6 — pages get their own title, completed by the app name.
  it("expose un titre par défaut et un gabarit de titre", () => {
    expect(metadata.title).toEqual({
      default: "DAHLIA",
      template: "%s - DAHLIA",
    });
  });

  it("n'affiche pas les liens juridiques du pied de page sans administrateur", async () => {
    const props = await footerProps();

    expect(props.accessibilityLinkProps).toBeUndefined();
    expect(props.termsLinkProps).toBeUndefined();
    expect(props.bottomItems).toBeUndefined();
  });

  it("n'affiche pas les liens juridiques du pied de page pour un utilisateur non admin", async () => {
    mockedGetSession.mockResolvedValue({ user: { isAdmin: false } } as never);

    const props = await footerProps();

    expect(props.accessibilityLinkProps).toBeUndefined();
    expect(props.termsLinkProps).toBeUndefined();
    expect(props.bottomItems).toBeUndefined();
  });

  it("affiche les liens juridiques du pied de page pour un administrateur", async () => {
    mockedGetSession.mockResolvedValue({ user: { isAdmin: true } } as never);

    const props = await footerProps();

    expect(props.accessibilityLinkProps).toEqual({ href: "/declaration-accessibilite" });
    expect(props.termsLinkProps).toEqual({ href: "/mentions-legales" });
    expect(props.bottomItems).toEqual([
      {
        text: "Données personnelles",
        linkProps: { href: "/donnees-personnelles" },
      },
    ]);
  });
});
