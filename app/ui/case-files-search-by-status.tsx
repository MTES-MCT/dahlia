import { Select } from "@codegouvfr/react-dsfr/Select";

type Props = {
  options: string[];
  // Status preselected when the `statut` param is absent from the URL (matches the page default).
  defaultStatut: string;
  // Raw `statut` param from the URL: absent → default filter; empty string → « Tous ».
  statutParam?: string;
};

// Status filter rendered as a plain field of the shared `CaseFilesSearch` form.
// It submits its value under `statut`; the actual filtering happens when the user
// clicks « Rechercher ».
export function CaseFilesSearchByStatus({ options, defaultStatut, statutParam }: Props) {
  // `statut` missing from the URL → preselect the default filter; otherwise the value
  // from the URL (empty string included, which corresponds to the explicit choice « Tous »).
  const currentStatut = statutParam === undefined ? defaultStatut : statutParam;

  return (
    <Select
      label="Statut"
      nativeSelectProps={{
        name: "statut",
        defaultValue: currentStatut,
        // Disable the browser's form-field restoration on reload/bfcache, which
        // would otherwise re-apply the previously selected value over the
        // server-rendered default (e.g. after « Ré-initialiser la recherche »).
        autoComplete: "off",
        style: { width: "auto" },
      }}
    >
      <option value="">Tous</option>
      {options.map((label) => (
        <option key={label} value={label}>
          {label}
        </option>
      ))}
    </Select>
  );
}
