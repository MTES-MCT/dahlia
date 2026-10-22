"use client";

import { useMemo, useState, useTransition } from "react";
import clsx from "clsx";
import { fr } from "@codegouvfr/react-dsfr";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { createModal } from "@codegouvfr/react-dsfr/Modal";
import { caseFileHref, type CaseFileKey } from "@/app/lib/case-file-key";
import { pieceDisplayLabel, pieceDownloadFileName } from "@/app/lib/piece-display";
import { savePieceMetadataAction } from "@/app/(protected)/case_files/[jurisdictionCode]/[caseFileNumber]/pieces/[encodedFileId]/actions";
import { PieceViewer } from "@/app/ui/piece-viewer";
import { CaseFileTelerecoursTitle } from "@/app/ui/case-file/case-file-telerecours-title";

const pieceEditModal = createModal({
  isOpenedByDefault: false,
  id: "piece-edit-modal",
});

// One pièce as needed by the workspace. Raw editable fields are kept so labels
// can be recomputed client-side after an inline edit; `dataUrl`/`viewerMimeType`
// are precomputed on the server (the viewer only needs a URL).
export type WorkspacePiece = {
  encodedFileId: string;
  fileName: string;
  dahliaName: string | null;
  comment: string | null;
  typeLabel: string | null;
  dataUrl: string;
  viewerMimeType: string;
};

type Override = {
  dahliaName: string | null;
  comment: string | null;
};

type Props = {
  caseFileKey: CaseFileKey;
  pieces: WorkspacePiece[];
  // Pièce shown first (e.g. from "Voir la pièce" on the synthèse tab); falls
  // back to the first pièce when unknown.
  initialPieceId?: string;
};

// Parse the RFC 6266 filename out of a Content-Disposition header, if any.
function filenameFromDisposition(header: string | null): string | undefined {
  return header?.match(/filename="([^"]+)"/)?.[1];
}

export function PiecesWorkspace({ caseFileKey, pieces, initialPieceId }: Props) {
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const firstId =
    (initialPieceId && pieces.some((piece) => piece.encodedFileId === initialPieceId)
      ? initialPieceId
      : pieces[0]?.encodedFileId) ?? null;
  const [currentId, setCurrentId] = useState<string | null>(firstId);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(firstId ? [firstId] : []),
  );
  // Bumped on each "Éditer" click so the modal form remounts with fresh values.
  const [editGeneration, setEditGeneration] = useState(0);

  // Merge the server pièce with any in-memory edit so the sidebar label and the
  // detail panel reflect a save without waiting for a full page revalidation.
  const merged = useMemo(
    () => pieces.map((piece) => ({ ...piece, ...(overrides[piece.encodedFileId] ?? {}) })),
    [pieces, overrides],
  );

  const currentIndex = merged.findIndex((piece) => piece.encodedFileId === currentId);
  const current = currentIndex >= 0 ? merged[currentIndex] : null;
  const previous = currentIndex > 0 ? merged[currentIndex - 1] : null;
  const next = currentIndex >= 0 ? (merged[currentIndex + 1] ?? null) : null;

  const allSelected = pieces.length > 0 && selectedIds.size === pieces.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  function toggleOne(id: string) {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(pieces.map((p) => p.encodedFileId)));
  }

  // Clicking a pièce shows it on the right and makes its checkbox the only one selected.
  function selectPiece(id: string) {
    setCurrentId(id);
    setSelectedIds(new Set([id]));
  }

  function openEdit() {
    setEditGeneration((generation) => generation + 1);
    pieceEditModal.open();
  }

  return (
    <div className={clsx("flex", "min-h-100", "flex-1", "flex-col", "md:flex-row")}>
      <PiecesSidebar
        caseFileKey={caseFileKey}
        pieces={merged}
        currentId={currentId}
        selectedIds={selectedIds}
        allSelected={allSelected}
        someSelected={someSelected}
        onSelectPiece={selectPiece}
        onToggleOne={toggleOne}
        onToggleAll={toggleAll}
      />

      <PieceDetailPane
        piece={current}
        onPrevious={previous ? () => selectPiece(previous.encodedFileId) : undefined}
        onNext={next ? () => selectPiece(next.encodedFileId) : undefined}
        onEdit={openEdit}
      />

      <pieceEditModal.Component title="Modifier la pièce">
        {/* Mounted on the first "Éditer" click only, so the hidden modal does not
            duplicate the pièce fields in the page. */}
        {current && editGeneration > 0 && (
          <PieceEditForm
            key={`${current.encodedFileId}-${editGeneration}`}
            caseFileKey={caseFileKey}
            piece={current}
            onSaved={(id, values) => {
              setOverrides((overridden) => ({ ...overridden, [id]: values }));
              pieceEditModal.close();
            }}
          />
        )}
      </pieceEditModal.Component>
    </div>
  );
}

type MergedPiece = WorkspacePiece;

type SidebarProps = {
  className?: string;
  caseFileKey: CaseFileKey;
  pieces: MergedPiece[];
  currentId: string | null;
  selectedIds: Set<string>;
  allSelected: boolean;
  someSelected: boolean;
  onSelectPiece: (id: string) => void;
  onToggleOne: (id: string) => void;
  onToggleAll: () => void;
};

function PiecesSidebar({
  className,
  caseFileKey,
  pieces,
  currentId,
  selectedIds,
  allSelected,
  someSelected,
  onSelectPiece,
  onToggleOne,
  onToggleAll,
}: SidebarProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const count = selectedIds.size;

  function handleDownload() {
    setError(null);
    startTransition(async () => {
      try {
        const selected = pieces.filter((piece) => selectedIds.has(piece.encodedFileId));
        if (selected.length === 0) return;

        const ids = selected.map((piece) => piece.encodedFileId);
        const base = caseFileHref(caseFileKey, "/pieces");
        const url =
          selected.length === 1
            ? `${base}/${encodeURIComponent(ids[0])}/data`
            : `${base}/download?${ids.map((id) => `id=${encodeURIComponent(id)}`).join("&")}`;

        const response = await fetch(url);
        if (!response.ok) {
          setError(await response.text());
          return;
        }

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        // Single-file name comes from the (possibly just-edited) pièce, not the
        // cached Content-Disposition on GET …/data.
        anchor.download =
          selected.length === 1
            ? pieceDownloadFileName(selected[0])
            : (filenameFromDisposition(response.headers.get("Content-Disposition")) ??
              "pieces.zip");
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(objectUrl);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Erreur inconnue");
      }
    });
  }

  return (
    <div
      className={clsx(
        "flex",
        "w-full",
        "min-h-0",
        "flex-col",
        "border-r",
        "border-(--border-default-grey)",
        "md:w-1/4",
        className,
      )}
    >
      <nav
        aria-label="Liste des pièces"
        className={clsx("flex", "h-full", "min-h-0", "flex-col", "overflow-hidden")}
      >
        <div
          className={clsx(
            "flex",
            "shrink-0",
            "items-center",
            "justify-between",
            fr.cx("fr-px-2w", "fr-pt-2w", "fr-pb-1w"),
            "border-b",
            "border-(--border-default-grey)",
          )}
        >
          <div className="fr-checkbox-group fr-checkbox-group--sm">
            <input
              type="checkbox"
              id="pieces-select-all"
              checked={allSelected}
              ref={(node) => {
                if (node) node.indeterminate = someSelected;
              }}
              onChange={onToggleAll}
            />
            <label className="fr-label" htmlFor="pieces-select-all">
              Tout sélectionner
            </label>
          </div>
          <span className={clsx(fr.cx("fr-text--sm", "fr-mb-0"), "text-grey")}>
            {pieces.length} pièce{pieces.length > 1 ? "s" : ""}
          </span>
        </div>

        <ul
          className={clsx(
            fr.cx("fr-raw-list"),
            "m-0",
            "min-h-0",
            "flex-1",
            "overflow-y-auto",
            "p-0",
          )}
        >
          {pieces.map((piece) => {
            const id = piece.encodedFileId;
            const isCurrent = id === currentId;
            const label = pieceDisplayLabel(piece);
            return (
              <li key={id}>
                <div
                  className={clsx(
                    "flex",
                    "items-start",
                    "gap-2",
                    fr.cx("fr-px-2w", "fr-py-1v"),
                    isCurrent && "bg-(--background-open-blue-france)",
                  )}
                >
                  <div className="fr-checkbox-group fr-checkbox-group--sm">
                    <input
                      type="checkbox"
                      id={`piece-select-${id}`}
                      checked={selectedIds.has(id)}
                      onChange={() => onToggleOne(id)}
                    />
                    <label className="fr-label" htmlFor={`piece-select-${id}`}>
                      <span className="fr-sr-only">Sélectionner {label}</span>
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectPiece(id)}
                    aria-current={isCurrent ? "true" : undefined}
                    className={clsx(
                      "flex-1",
                      "min-w-0",
                      "border-none",
                      "p-0",
                      "cursor-pointer",
                      "bg-transparent",
                      "text-inherit",
                      "text-left",
                    )}
                  >
                    <span
                      className={clsx(
                        fr.cx("fr-text--sm", "fr-mb-0"),
                        "block",
                        "truncate",
                        isCurrent ? "font-bold" : "font-medium",
                      )}
                      title={label}
                    >
                      {label}
                    </span>
                    {piece.dahliaName && (
                      <span
                        className={clsx(
                          fr.cx("fr-text--xs", "fr-mb-0"),
                          "text-grey",
                          "block",
                          "wrap-break-word",
                        )}
                      >
                        {piece.fileName}
                      </span>
                    )}
                    {piece.typeLabel && (
                      <span className={clsx(fr.cx("fr-tag", "fr-tag--sm"), fr.cx("fr-mt-1v"))}>
                        {piece.typeLabel}
                      </span>
                    )}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <div className={clsx("shrink-0", fr.cx("fr-px-2w", "fr-py-2w"))}>
          <Button
            iconId="fr-icon-download-line"
            priority="secondary"
            onClick={handleDownload}
            disabled={count === 0 || isPending}
            className={fr.cx("fr-btn--sm")}
          >
            {isPending ? "Préparation…" : "Télécharger"}
          </Button>
          {error && (
            <Alert
              className={fr.cx("fr-mt-1w")}
              severity="error"
              small
              description={`Échec du téléchargement : ${error}`}
            />
          )}
        </div>
      </nav>
    </div>
  );
}

type DetailPaneProps = {
  piece: MergedPiece | null;
  // Undefined at either end of the list: the matching arrow is disabled.
  onPrevious?: () => void;
  onNext?: () => void;
  onEdit: () => void;
};

function PieceDetailPane({ piece, onPrevious, onNext, onEdit }: DetailPaneProps) {
  if (!piece) {
    return (
      <div className={clsx(fr.cx("fr-p-3w"), "flex-1")}>
        <p className={fr.cx("fr-text--sm")}>Aucune pièce sélectionnée.</p>
      </div>
    );
  }

  return (
    <div className={clsx("flex", "min-h-0", "min-w-0", "flex-1", "flex-col")}>
      <PieceHeader piece={piece} onPrevious={onPrevious} onNext={onNext} onEdit={onEdit} />

      <div className={clsx(fr.cx("fr-p-3w"), "flex", "min-h-0", "flex-1", "flex-col")}>
        <PieceViewer
          key={piece.encodedFileId}
          dataUrl={piece.dataUrl}
          mimeType={piece.viewerMimeType}
          fileName={pieceDownloadFileName(piece)}
        />
      </div>
    </div>
  );
}

type HeaderProps = {
  piece: MergedPiece;
  onPrevious?: () => void;
  onNext?: () => void;
  onEdit: () => void;
};

// Viewed pièce header: previous/next arrows around the DAHLIA name (Télérecours
// file name underneath), edit and new-tab actions, then the comment.
function PieceHeader({ piece, onPrevious, onNext, onEdit }: HeaderProps) {
  const label = pieceDisplayLabel(piece);
  const comment = piece.comment?.trim();

  return (
    <div
      className={clsx(
        "shrink-0",
        fr.cx("fr-px-2w", "fr-py-2w"),
        "bg-(--background-alt-blue-france)",
        "border-0",
        "border-b-2",
        "border-solid",
        "border-(--border-active-blue-france)",
      )}
    >
      <div className={clsx("flex", "items-start", "gap-3")}>
        <div className={clsx("flex", "min-w-0", "flex-1", "items-start", "gap-1")}>
          <Button
            priority="tertiary"
            size="small"
            iconId="fr-icon-arrow-left-s-line"
            title="Pièce précédente"
            onClick={onPrevious}
            disabled={!onPrevious}
          />
          <div className={clsx("min-w-0", "flex-1", fr.cx("fr-px-1v"))}>
            <h2 className={clsx(fr.cx("fr-h6", "fr-mb-0"), "wrap-anywhere")}>{label}</h2>
            <CaseFileTelerecoursTitle title={piece.fileName} displayName={label} singleLine />
          </div>
          <Button
            priority="tertiary"
            size="small"
            iconId="fr-icon-arrow-right-s-line"
            title="Pièce suivante"
            onClick={onNext}
            disabled={!onNext}
          />
        </div>

        <div className={clsx("flex", "shrink-0", "flex-col", "items-stretch", "gap-2")}>
          <Button
            size="small"
            iconId="fr-icon-edit-line"
            onClick={onEdit}
            className={clsx("w-full!", "justify-center")}
          >
            Éditer
          </Button>
          {/* `w-full!`: DSFR's unlayered `.fr-btn { width: fit-content }` beats
              Tailwind's layered utilities, and both buttons must share one width.
              DSFR appends the external-link icon to target="_blank" buttons. */}
          <Button
            priority="secondary"
            size="small"
            linkProps={{
              href: piece.dataUrl,
              target: "_blank",
              rel: "noopener noreferrer",
              title: "Afficher - nouvelle fenêtre",
            }}
            className={clsx("w-full!", "justify-center")}
          >
            Afficher
          </Button>
        </div>
      </div>

      <p
        className={clsx(
          "flex",
          "items-start",
          "gap-2",
          fr.cx("fr-mt-1w", "fr-mb-0"),
          "ml-9",
          comment
            ? "text-(--text-title-grey)"
            : clsx(fr.cx("fr-text--sm"), "text-(--text-mention-grey)"),
        )}
      >
        <span
          className={clsx(
            fr.cx("fr-icon-message-2-line", "fr-icon--sm"),
            comment && "text-(--text-action-high-blue-france)",
          )}
          aria-hidden="true"
        />
        {comment ? (
          <span className="whitespace-pre-line">
            <b>Commentaire :</b> {comment}
          </span>
        ) : (
          "Aucun commentaire"
        )}
      </p>
    </div>
  );
}

type FormProps = {
  caseFileKey: CaseFileKey;
  piece: MergedPiece;
  onSaved: (id: string, values: Override) => void;
};

function PieceEditForm({ caseFileKey, piece, onSaved }: FormProps) {
  const [dahliaName, setDahliaName] = useState(piece.dahliaName ?? piece.fileName);
  const [comment, setComment] = useState(piece.comment ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const trimmedDahliaName = dahliaName.trim();
      const dahliaNameToSave = trimmedDahliaName !== piece.fileName.trim() ? trimmedDahliaName : "";

      const result = await savePieceMetadataAction(caseFileKey, piece.encodedFileId, {
        dahliaName: dahliaNameToSave,
        comment,
      });
      if (result.ok) {
        onSaved(piece.encodedFileId, {
          dahliaName: dahliaNameToSave || null,
          comment: comment.trim() || null,
        });
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <Input
        label="Nom sur DAHLIA"
        nativeInputProps={{
          value: dahliaName,
          onChange: (event) => setDahliaName(event.target.value),
        }}
      />
      <Input
        label="Commentaire"
        hintText="Visible par les agents en charge du dossier"
        textArea
        nativeTextAreaProps={{
          value: comment,
          onChange: (event) => setComment(event.target.value),
          rows: 4,
        }}
      />
      <div className={clsx("flex", "justify-end", "gap-2")}>
        <Button
          type="button"
          priority="secondary"
          onClick={() => pieceEditModal.close()}
          disabled={isPending}
        >
          Annuler
        </Button>
        <Button type="submit" disabled={isPending} iconId="fr-icon-save-line">
          {isPending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
      {error && (
        <Alert
          className={fr.cx("fr-mt-2w")}
          severity="error"
          small
          description={`Échec de l'enregistrement : ${error}`}
        />
      )}
    </form>
  );
}
