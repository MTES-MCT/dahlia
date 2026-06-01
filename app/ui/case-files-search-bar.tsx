'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { SearchBar } from '@codegouvfr/react-dsfr/SearchBar';

export function CaseFilesSearchBar({ className }: { className?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.get('q') ?? '';

  function handleSearch(text: string) {
    const params = new URLSearchParams(searchParams.toString());
    const trimmed = text.trim();
    if (trimmed) {
      params.set('q', trimmed);
    } else {
      params.delete('q');
    }
    params.delete('page');
    const qs = params.toString();
    router.push(qs ? `?${qs}` : '?');
  }

  return (
    <SearchBar
      // Force le remount quand l'URL change pour rafraîchir defaultValue
      // (la SearchBar DSFR est non-contrôlée).
      key={currentQuery}
      defaultValue={currentQuery}
      label="Rechercher un dossier, un requérant ou un défendeur"
      allowEmptySearch
      onButtonClick={handleSearch}
      className={className}

      />
  );
}
