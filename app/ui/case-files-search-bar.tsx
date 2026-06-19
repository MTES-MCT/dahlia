import { SearchBar } from "@/app/ui/search-bar";

type Props = {
  // Current search query, used as the input default value.
  currentQuery: string;
  className?: string;
};

const PLACEHOLDER = 'ex. « dupont » ou « requerant:prefet defendeur:"jean dupont" »';

export function CaseFilesSearchBar({ currentQuery, className }: Props) {
  return (
    <SearchBar
      id="case-files-search"
      name="dahliaq"
      label="Rechercher"
      defaultValue={currentQuery}
      placeholder={PLACEHOLDER}
      className={className}
    />
  );
}
