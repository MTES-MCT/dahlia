import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CaseFilesSearchByStatus } from './case-files-search-by-status';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: vi.fn(),
}));

import { useSearchParams } from 'next/navigation';

const OPTIONS = ['En cours d\'instruction', 'Terminé', 'Recours en appel'];

// Default status preselected when `statut` is absent from the URL (one of OPTIONS).
const DEFAULT_STATUT = 'En cours d\'instruction';

function getSelect(): HTMLSelectElement {
  return screen.getByRole('combobox') as HTMLSelectElement;
}

describe('CaseFilesSearchByStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('rendu', () => {
    it('affiche une option "Tous" en premier avec une valeur vide', () => {
      vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as never);
      render(<CaseFilesSearchByStatus options={OPTIONS} defaultStatut={DEFAULT_STATUT} />);

      const options = screen.getAllByRole('option') as HTMLOptionElement[];
      expect(options[0].value).toBe('');
      expect(options[0].textContent).toBe('Tous');
    });

    it('affiche une option par libellé fourni', () => {
      vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as never);
      render(<CaseFilesSearchByStatus options={OPTIONS} defaultStatut={DEFAULT_STATUT} />);

      const options = screen.getAllByRole('option') as HTMLOptionElement[];
      expect(options).toHaveLength(OPTIONS.length + 1);
      OPTIONS.forEach((label, index) => {
        expect(options[index + 1].value).toBe(label);
        expect(options[index + 1].textContent).toBe(label);
      });
    });

    it('sélectionne le statut par défaut quand statut n\'est pas dans l\'URL', () => {
      vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as never);
      render(<CaseFilesSearchByStatus options={OPTIONS} defaultStatut={DEFAULT_STATUT} />);

      expect(getSelect().value).toBe(DEFAULT_STATUT);
    });

    it('pré-sélectionne la valeur courante de statut depuis l\'URL', () => {
      vi.mocked(useSearchParams).mockReturnValue(
        new URLSearchParams({ statut: 'Terminé' }) as never
      );
      render(<CaseFilesSearchByStatus options={OPTIONS} defaultStatut={DEFAULT_STATUT} />);

      expect(getSelect().value).toBe('Terminé');
    });
  });

  describe('comportement au changement', () => {
    it('définit statut dans l\'URL quand un libellé est sélectionné', () => {
      vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as never);
      render(<CaseFilesSearchByStatus options={OPTIONS} defaultStatut={DEFAULT_STATUT} />);

      fireEvent.change(getSelect(), { target: { value: 'En cours d\'instruction' } });

      expect(mockPush).toHaveBeenCalledTimes(1);
      const pushedUrl = mockPush.mock.calls[0][0] as string;
      expect(pushedUrl).toContain('statut=En+cours+d%27instruction');
    });

    it('force un statut vide dans l\'URL quand "Tous" est sélectionné', () => {
      vi.mocked(useSearchParams).mockReturnValue(
        new URLSearchParams({ statut: 'Terminé' }) as never
      );
      render(<CaseFilesSearchByStatus options={OPTIONS} defaultStatut={DEFAULT_STATUT} />);

      fireEvent.change(getSelect(), { target: { value: '' } });

      const pushedUrl = mockPush.mock.calls[0][0] as string;
      expect(pushedUrl).toContain('statut=');
      expect(pushedUrl).not.toContain('statut=Termin');
    });

    it('supprime le paramètre page au changement', () => {
      vi.mocked(useSearchParams).mockReturnValue(
        new URLSearchParams({ page: '3' }) as never
      );
      render(<CaseFilesSearchByStatus options={OPTIONS} defaultStatut={DEFAULT_STATUT} />);

      fireEvent.change(getSelect(), { target: { value: 'Terminé' } });

      const pushedUrl = mockPush.mock.calls[0][0] as string;
      expect(pushedUrl).not.toContain('page=');
    });

    it('conserve les autres paramètres URL existants', () => {
      vi.mocked(useSearchParams).mockReturnValue(
        new URLSearchParams({
          q: 'dupont',
          sortBy: 'caseFileNumber',
          sortOrder: 'ascending',
          page: '2',
        }) as never
      );
      render(<CaseFilesSearchByStatus options={OPTIONS} defaultStatut={DEFAULT_STATUT} />);

      fireEvent.change(getSelect(), { target: { value: 'Terminé' } });

      const pushedUrl = mockPush.mock.calls[0][0] as string;
      expect(pushedUrl).toContain('q=dupont');
      expect(pushedUrl).toContain('sortBy=caseFileNumber');
      expect(pushedUrl).toContain('sortOrder=ascending');
      expect(pushedUrl).toContain('statut=Termin%C3%A9');
      expect(pushedUrl).not.toContain('page=');
    });

    it('pousse "?statut=" quand "Tous" est sélectionné et qu\'il n\'y a aucun autre paramètre', () => {
      vi.mocked(useSearchParams).mockReturnValue(
        new URLSearchParams({ statut: 'Terminé' }) as never
      );
      render(<CaseFilesSearchByStatus options={OPTIONS} defaultStatut={DEFAULT_STATUT} />);

      fireEvent.change(getSelect(), { target: { value: '' } });

      expect(mockPush).toHaveBeenCalledWith('?statut=');
    });
  });
});
