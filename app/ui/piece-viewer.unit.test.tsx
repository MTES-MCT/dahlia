import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { PieceViewer } from "./piece-viewer";

describe("PieceViewer", () => {
  afterEach(() => {
    cleanup();
  });

  it("affiche une image via <img> pour un type MIME image", () => {
    render(<PieceViewer dataUrl="/data/img" mimeType="image/png" fileName="photo.png" />);

    const image = screen.getByRole("img", { name: "photo.png" });
    expect(image.getAttribute("src")).toBe("/data/img");
  });

  it("intègre les autres types via <object> avec un lien de secours", () => {
    const { container } = render(
      <PieceViewer dataUrl="/data/pdf" mimeType="application/pdf" fileName="requete.pdf" />,
    );

    expect(screen.queryByRole("img")).toBeNull();

    const object = container.querySelector("object");
    expect(object?.getAttribute("data")).toBe("/data/pdf#navpanes=0");
    expect(object?.getAttribute("type")).toBe("application/pdf");

    const fallbackLink = screen.getByRole("link", { name: /Télécharger/ });
    expect(fallbackLink.getAttribute("href")).toBe("/data/pdf");
    expect(fallbackLink.textContent).toContain("requete.pdf");
  });
});
