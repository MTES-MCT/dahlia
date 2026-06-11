import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryDeadlineCell } from './memory-deadline-cell';

// formatDateFr lives in the data-access module, which imports the Prisma client:
// mock it so importing the component does not instantiate a real client.
vi.mock('@/app/lib/prisma', () => ({ prisma: {} }));

describe('MemoryDeadlineCell', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-09T10:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('ne rend rien quand la date est nulle', () => {
    const { container } = render(<MemoryDeadlineCell date={null} />);

    expect(container.innerHTML).toBe('');
  });

  it('affiche la date formatee sans badge quand elle est lointaine', () => {
    render(<MemoryDeadlineCell date={new Date('2026-08-01T13:00:00')} />);

    expect(screen.getByText('01/08/2026')).toBeTruthy();
    expect(screen.queryByText('Urgent')).toBeNull();
    expect(screen.queryByText('Passé')).toBeNull();
  });

  it('affiche le badge "Urgent" quand la date est dans les deux prochaines semaines', () => {
    render(<MemoryDeadlineCell date={new Date('2026-06-15T13:00:00')} />);

    expect(screen.getByText('15/06/2026')).toBeTruthy();
    expect(screen.getByText('Urgent')).toBeTruthy();
  });

  it('affiche le badge "Passé" quand la date est anterieure a aujourd\'hui', () => {
    render(<MemoryDeadlineCell date={new Date('2026-06-01T13:00:00')} />);

    expect(screen.getByText('01/06/2026')).toBeTruthy();
    expect(screen.getByText('Passé')).toBeTruthy();
  });

  it('considere une date juste a la limite des deux semaines comme non urgente', () => {
    // today (2026-06-09) + 14 days = 2026-06-23 → not strictly inferior, so no badge.
    render(<MemoryDeadlineCell date={new Date('2026-06-23T00:00:00')} />);

    expect(screen.queryByText('Urgent')).toBeNull();
    expect(screen.queryByText('Passé')).toBeNull();
  });
});
