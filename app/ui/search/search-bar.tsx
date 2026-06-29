import { Input } from "@codegouvfr/react-dsfr/Input";
import clsx from "clsx";

type Props = {
  // Input id (also the field's html id).
  id: string;
  // URL/form param name backing this search query.
  name: string;
  // Accessible / visible field label.
  label: string;
  // Uncontrolled default value (seeded from the URL). Parents remount via a
  // `key` so a navigation (submit, column filter, reset) re-seeds the field.
  defaultValue: string;
  placeholder?: string;
  className?: string;
};

// Shared uncontrolled `type="search"` field used by every search form. Concrete
// bars (`TableSearchBar`) wrap this with their own id / name / label / placeholder.
export function SearchBar({ id, name, label, defaultValue, placeholder, className }: Props) {
  return (
    <Input
      className={clsx(className)}
      label={label}
      nativeInputProps={{
        id,
        name,
        type: "search",
        defaultValue,
        placeholder,
      }}
    />
  );
}
