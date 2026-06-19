import { Input } from "@codegouvfr/react-dsfr/Input";
import clsx from "clsx";

type Props = {
  // Current search query, used as the input default value.
  currentQuery: string;
  className?: string;
};

export function CaseFilesSearchBar({ currentQuery, className }: Props) {
  return (
    <Input
      className={clsx(className)}
      label="Rechercher"
      nativeInputProps={{
        id: "case-files-search",
        type: "search",
        name: "dahliaq",
        defaultValue: currentQuery,
        placeholder: 'ex. « dupont » ou « requerant:prefet defendeur:"jean dupont" »',
      }}
    />
  );
}
