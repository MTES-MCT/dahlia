import { fr } from "@codegouvfr/react-dsfr";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { Select } from "@codegouvfr/react-dsfr/Select";
import { DEFAULT_TAG_COLOR, TAG_COLOR_OPTIONS } from "@/app/lib/tag-colors";

export type TagFormValues = { label: string; color: string };

export const EMPTY_TAG_FORM_VALUES: TagFormValues = { label: "", color: DEFAULT_TAG_COLOR };

// Shared by the create and edit modals. Server-compatible (no "use client"),
// like `user-form-fields.tsx`.
export function TagFormFields({ values }: { values: TagFormValues }) {
  return (
    <>
      <Input
        label="Libellé"
        hintText="Obligatoire, 60 caractères maximum"
        nativeInputProps={{
          name: "label",
          required: true,
          maxLength: 60,
          autoComplete: "off",
          defaultValue: values.label,
        }}
      />

      <Select
        label="Couleur"
        nativeSelectProps={{ name: "color", defaultValue: values.color }}
        className={fr.cx("fr-mt-2w")}
      >
        {TAG_COLOR_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </>
  );
}
