import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PendingValidation } from './pending-validation';

describe('PendingValidation', () => {
  afterEach(() => {
    cleanup();
  });

  it('affiche le titre du message de validation en attente', () => {
    render(<PendingValidation />);

    expect(screen.getByText('Compte en attente de validation')).toBeTruthy();
  });

  it('affiche la description expliquant la validation par un administrateur', () => {
    render(<PendingValidation />);

    expect(
      screen.getByText(/Un administrateur doit le valider/),
    ).toBeTruthy();
  });

  it('rend une alerte de sévérité "info"', () => {
    const { container } = render(<PendingValidation />);

    expect(container.querySelector('.fr-alert--info')).toBeTruthy();
  });
});
