'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { fr } from '@codegouvfr/react-dsfr';

type Props = {
  label: string;
  sortKey: string;
};

export function SortableColumnHeader({ label, sortKey }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentSortBy = searchParams.get('sortBy');
  const currentSortOrder = searchParams.get('sortOrder');

  const isActive = currentSortBy === sortKey;
  const ariaSortValue = isActive
    ? ((currentSortOrder ?? 'ascending') as 'ascending' | 'descending')
    : 'none';

  function handleClick() {
    const params = new URLSearchParams(searchParams.toString());
    params.set('sortBy', sortKey);
    params.set(
      'sortOrder',
      isActive && currentSortOrder === 'ascending' ? 'descending' : 'ascending'
    );
    params.delete('page');
    router.push(`?${params.toString()}`);
  }

  return (
    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
      {label}
      <button
        className={fr.cx('fr-btn--sort')}
        aria-sort={ariaSortValue}
        aria-label={`Trier par ${label}${isActive ? (ariaSortValue === 'ascending' ? ', ordre croissant' : ', ordre décroissant') : ''}`}
        onClick={handleClick}
        type="button"
      >
        {label}
      </button>
    </span>
  );
}
