import { describe, it, expect, beforeEach, vi } from "vitest";
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
async function renderRootLayoutElement() {
  return (await RootLayout({ children: null })) as React.ReactElement<Record<string, unknown>>;
}

describe("RootLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetSession.mockResolvedValue(null as never);
  });

  // RGAA 8.3 — the page must declare its default language.
  it("déclare la langue française sur l'élément <html>", async () => {
    const html = await renderRootLayoutElement();

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
});
