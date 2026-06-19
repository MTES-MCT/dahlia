import { SearchBar } from "@/app/ui/search-bar";

type Props = {
  // URL param name backing this table's search query (also used for the input id).
  name: string;
  // Accessible label / visible field label.
  label: string;
  // Uncontrolled default value (seeded from the URL). The parent remounts this
  // component via a `key` so a navigation (submit, column filter, reset) re-seeds
  // the field — mirroring the dashboard's uncontrolled search input.
  defaultValue: string;
  placeholder?: string;
  className?: string;
};

export function TableSearchBar({ name, label, defaultValue, placeholder, className }: Props) {
  return (
    <SearchBar
      id={`${name}-search`}
      name={name}
      label={label}
      defaultValue={defaultValue}
      placeholder={placeholder}
      className={className}
    />
  );
}
