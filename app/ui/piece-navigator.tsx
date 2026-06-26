"use client";

import { useRouter } from "next/navigation";
import { fr } from "@codegouvfr/react-dsfr";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Select } from "@codegouvfr/react-dsfr/Select";

// One pièce in the navigator: its id, the label shown in the select, and the
// full href (route + carried query string) to navigate to it.
export type PieceOption = {
  encodedFileId: string;
  label: string;
  href: string;
};

type Props = {
  // Pièces in the same order/filter as the case-file table.
  pieces: PieceOption[];
  // Id of the pièce currently displayed (selected in the select).
  currentEncodedFileId: string;
};

// Navigate between the pièces of a case file: a select listing them in the
// table's order plus previous/next arrows. Each change pushes a full client
// navigation to the pièce route, so the whole page (viewer + métadonnées)
// re-renders server-side from the URL.
export function PieceNavigator({ pieces, currentEncodedFileId }: Props) {
  const router = useRouter();
  const currentIndex = pieces.findIndex((piece) => piece.encodedFileId === currentEncodedFileId);

  function goTo(index: number) {
    const target = pieces[index];
    // `scroll: false` keeps the viewport in place so changing pièce doesn't jump
    // back to the top of the page.
    if (target) router.push(target.href, { scroll: false });
  }

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < pieces.length - 1;
  const position = currentIndex >= 0 ? `${currentIndex + 1} / ${pieces.length}` : null;

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem" }} className={fr.cx("fr-mb-3w")}>
      <Button
        iconId="fr-icon-arrow-left-s-line"
        priority="secondary"
        title="Pièce précédente"
        disabled={!hasPrev}
        onClick={() => goTo(currentIndex - 1)}
      />
      <div style={{ flex: 1 }}>
        <Select
          label={position ? `Pièce ${position}` : "Pièce"}
          nativeSelectProps={{
            value: currentEncodedFileId,
            onChange: (event) =>
              goTo(pieces.findIndex((piece) => piece.encodedFileId === event.target.value)),
          }}
        >
          {pieces.map((piece) => (
            <option key={piece.encodedFileId} value={piece.encodedFileId}>
              {piece.label}
            </option>
          ))}
        </Select>
      </div>
      <Button
        iconId="fr-icon-arrow-right-s-line"
        priority="secondary"
        title="Pièce suivante"
        disabled={!hasNext}
        onClick={() => goTo(currentIndex + 1)}
      />
    </div>
  );
}
