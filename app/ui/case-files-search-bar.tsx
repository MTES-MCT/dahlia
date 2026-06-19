import { fr } from "@codegouvfr/react-dsfr";
import clsx from "clsx";

type Props = {
  // Current search query, used as the input default value.
  currentQuery: string;
  className?: string;
};

// Text search field (label + input) meant to be rendered inside the shared
// `CaseFilesSearch` form. It owns no form/submit button: the parent form submits
// the `dahliaq` value, which lets the browser offer previous searches on focus.
export function CaseFilesSearchBar({ currentQuery, className }: Props) {
  return (
    <div className={clsx(className)}>
      <label className={fr.cx("fr-label")} htmlFor="case-files-search">
        Rechercher
      </label>
      <input
        className={fr.cx("fr-input")}
        id="case-files-search"
        type="search"
        name="dahliaq"
        defaultValue={currentQuery}
        placeholder='ex. « dupont » ou « requerant:prefet defendeur:"jean dupont" »'
      />
    </div>
  );
}
