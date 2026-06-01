'use client';

import { Select } from "@codegouvfr/react-dsfr/Select";
import { useRouter, useSearchParams } from 'next/navigation';

type Props = {
  options: string[];
};

export function CaseFilesSearchByStatus({ options }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentStatut = searchParams.get('statut') ?? '';

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set('statut', value);
    } else {
      params.delete('statut');
    }
    params.delete('page');
    const qs = params.toString();
    router.push(qs ? `?${qs}` : '?');
  }

  return (
    <Select
      label="État"
      nativeSelectProps={{
        onChange: event => handleChange(event.target.value),
        value: currentStatut,
        style: { width: 'auto' },
      }}
    >
      <option value="">Tous</option>
      {options.map(label => (
        <option key={label} value={label}>{label}</option>
      ))}
    </Select>
  );
}
