"use client";

import { useMemo, useState, useTransition } from "react";
import clsx from "clsx";
import { fr } from "@codegouvfr/react-dsfr";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { pieceDisplayLabel, pieceDownloadFileName } from "@/app/lib/piece-display";
import { savePieceMetadataAction } from "@/app/(protected)/case_files/[caseFileNumber]/pieces/[encodedFileId]/actions";
import { PieceViewer } from "@/app/ui/piece-viewer";

// One pièce as needed by the workspace. Raw editable fields are kept so labels
// can be recomputed client-side after an inline edit; `dataUrl`/`viewerMimeType`
// are precomputed on the server (the viewer only needs a URL).
export type WorkspacePiece = {
  encodedFileId: string;
  number: string | null;
  fileName: string;
  dahliaName: string | null;
  comment: string | null;
  // Pièce type shown as a tag on the sidebar card (family label, falling back to
  // the file-type label). Null when neither is known.
  typeLabel: string | null;
  dataUrl: string;
  viewerMimeType: string;
};

type Override = {
  dahliaName: string | null;
  number: string | null;
  comment: string | null;
};

type Props = {
  caseFileNumber: string;
  pieces: WorkspacePiece[];
};

// Parse the RFC 6266 filename out of a Content-Disposition header, if any.
function filenameFromDisposition(header: string | null): string | undefined {
  return header?.match(/filename="([^"]+)"/)?.[1];
}

export function PiecesWorkspace({ caseFileNumber, pieces }: Props) {
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const firstId = pieces[0]?.encodedFileId ?? null;
  const [currentId, setCurrentId] = useState<string | null>(firstId);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(firstId ? [firstId] : []),
  );
  const [editing, setEditing] = useState(false);

  // Merge the server pièce with any in-memory edit so the sidebar label and the
  // detail panel reflect a save without waiting for a full page revalidation.
  const merged = useMemo(
    () => pieces.map((piece) => ({ ...piece, ...(overrides[piece.encodedFileId] ?? {}) })),
    [pieces, overrides],
  );

  const current = merged.find((piece) => piece.encodedFileId === currentId) ?? null;

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
    setEditing(false);
  }

  return (
    <div className={clsx("flex", "min-h-100", "flex-1", "flex-col", "md:flex-row")}>
      <PiecesSidebar
        caseFileNumber={caseFileNumber}
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
        editing={editing}
        onEdit={() => setEditing(true)}
        onCancel={() => setEditing(false)}
        onSaved={(id, values) => {
          setOverrides((previous) => ({ ...previous, [id]: values }));
          setEditing(false);
        }}
      />
    </div>
  );
}

type MergedPiece = WorkspacePiece;

type SidebarProps = {
  className?: string;
  caseFileNumber: string;
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
  caseFileNumber,
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
        const ids = pieces.map((piece) => piece.encodedFileId).filter((id) => selectedIds.has(id));
        if (ids.length === 0) return;

        const base = `/case_files/${encodeURIComponent(caseFileNumber)}/pieces`;
        const url =
          ids.length === 1
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
        anchor.download =
          filenameFromDisposition(response.headers.get("Content-Disposition")) ??
          (ids.length === 1 ? "piece" : "pieces.zip");
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
  className?: string;
  piece: MergedPiece | null;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSaved: (id: string, values: Override) => void;
};

function PieceDetailPane({
  className,
  piece,
  editing,
  onEdit,
  onCancel,
  onSaved,
}: DetailPaneProps) {
  return (
    <div className={clsx(fr.cx("fr-p-3w"), "flex", "min-h-0", "flex-1", "flex-col", className)}>
      {piece ? (
        <PieceDetail
          key={piece.encodedFileId}
          piece={piece}
          editing={editing}
          onEdit={onEdit}
          onCancel={onCancel}
          onSaved={onSaved}
        />
      ) : (
        <p className={fr.cx("fr-text--sm")}>Aucune pièce sélectionnée.</p>
      )}
    </div>
  );
}

type DetailProps = {
  piece: MergedPiece;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSaved: (id: string, values: Override) => void;
};

function PieceDetail({ piece, editing, onEdit, onCancel, onSaved }: DetailProps) {
  const name = piece.dahliaName ?? piece.fileName;

  return (
    <div className={clsx("flex", "h-full", "min-h-0", "flex-col")}>
      {editing ? (
        <PieceDetailForm piece={piece} onCancel={onCancel} onSaved={onSaved} />
      ) : (
        <div className={clsx("shrink-0", fr.cx("fr-mb-3w"))}>
          <div className={clsx("flex", "items-baseline", "gap-2", fr.cx("fr-mb-1w"))}>
            {piece.number && <strong>{piece.number}</strong>}
            <h2 className={fr.cx("fr-h5", "fr-mb-0")}>{name}</h2>
          </div>
          {piece.dahliaName && (
            <p className={clsx(fr.cx("fr-text--sm", "fr-mb-1w"), "text-grey", "italic")}>
              {piece.fileName}
            </p>
          )}
          {piece.comment && <p className={fr.cx("fr-mb-2w")}>{piece.comment}</p>}
          <Button
            priority="secondary"
            iconId="fr-icon-edit-line"
            onClick={onEdit}
            className={fr.cx("fr-btn--sm")}
          >
            Éditer
          </Button>
        </div>
      )}

      <div className={clsx("flex", "flex-1", "flex-col")}>
        <PieceViewer
          dataUrl={piece.dataUrl}
          mimeType={piece.viewerMimeType}
          fileName={pieceDownloadFileName(piece)}
        />
      </div>
    </div>
  );
}

type FormProps = {
  piece: MergedPiece;
  onCancel: () => void;
  onSaved: (id: string, values: Override) => void;
};

function PieceDetailForm({ piece, onCancel, onSaved }: FormProps) {
  const [dahliaName, setDahliaName] = useState(piece.dahliaName ?? piece.fileName);
  const [number, setNumber] = useState(piece.number ?? "");
  const [comment, setComment] = useState(piece.comment ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const trimmedDahliaName = dahliaName.trim();
      const dahliaNameToSave = trimmedDahliaName !== piece.fileName.trim() ? trimmedDahliaName : "";

      const result = await savePieceMetadataAction(piece.encodedFileId, {
        dahliaName: dahliaNameToSave,
        number,
        comment,
      });
      if (result.ok) {
        onSaved(piece.encodedFileId, {
          dahliaName: dahliaNameToSave || null,
          number: number.trim() || null,
          comment: comment.trim() || null,
        });
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className={clsx("shrink-0", fr.cx("fr-mb-3w"))}>
      <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters")}>
        <Input
          label="Numéro"
          nativeInputProps={{
            value: number,
            onChange: (event) => setNumber(event.target.value),
            inputMode: "numeric",
            pattern: "[0-9]*",
          }}
          className={fr.cx("fr-col-12", "fr-col-md-3", "fr-mb-1w")}
        />
        <Input
          label="Nom sur DAHLIA"
          nativeInputProps={{
            value: dahliaName,
            onChange: (event) => setDahliaName(event.target.value),
          }}
          className={fr.cx("fr-col-12", "fr-col-md-9", "fr-mb-1w")}
        />
      </div>
      <Input
        label="Commentaire"
        textArea
        nativeTextAreaProps={{
          value: comment,
          onChange: (event) => setComment(event.target.value),
          rows: 2,
        }}
        className={fr.cx("fr-mb-2w")}
      />
      <div className={clsx("flex", "gap-2")}>
        <Button type="submit" disabled={isPending} iconId="fr-icon-save-line">
          {isPending ? "Enregistrement…" : "Enregistrer"}
        </Button>
        <Button type="button" priority="secondary" onClick={onCancel} disabled={isPending}>
          Annuler
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
