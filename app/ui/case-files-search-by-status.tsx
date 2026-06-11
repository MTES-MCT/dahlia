"use client";

import { Select } from "@codegouvfr/react-dsfr/Select";
import { useRouter, useSearchParams } from "next/navigation";

type Props = {
  options: string[];
  // Status preselected when the `statut` param is absent from the URL (matches the page default).
  defaultStatut: string;
};

export function CaseFilesSearchByStatus({ options, defaultStatut }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // `statut` is missing from the URL → display the default filter; otherwise the value from the URL
  // (empty string included, which corresponds to the explicit choice « Tous »).
  const statutParam = searchParams.get("statut");
  const currentStatut = statutParam === null ? defaultStatut : statutParam;

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    // Force `statut=` (empty) for « Tous » to distinguish it from the absence of param,
    // which would redisplay the default filter.
    params.set("statut", value);
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `?${qs}` : "?");
  }

  return (
    <Select
      label="Statut"
      nativeSelectProps={{
        onChange: (event) => handleChange(event.target.value),
        value: currentStatut,
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
