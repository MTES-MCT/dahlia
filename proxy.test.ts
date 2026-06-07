import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';
import { proxy } from './proxy';

vi.mock('better-auth/cookies', () => ({
  getSessionCookie: vi.fn(),
}));

const mockedGetSessionCookie = vi.mocked(getSessionCookie);

function makeRequest(path: string): NextRequest {
  return new NextRequest(new URL(path, 'http://localhost:3000'));
}

// La redirection NextResponse.redirect expose l'URL cible dans l'en-tête `location`.
function redirectLocation(response: Response): string | null {
  return response.headers.get('location');
}

// NextResponse.next() pose l'en-tête interne `x-middleware-next: 1`.
function isNext(response: Response): boolean {
  return response.headers.get('x-middleware-next') === '1';
}

describe('proxy (contrôle d’accès)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('laisse passer les routes /api/auth sans vérifier le cookie de session', () => {
    const response = proxy(makeRequest('/api/auth/callback/proconnect'));

    expect(isNext(response)).toBe(true);
    expect(mockedGetSessionCookie).not.toHaveBeenCalled();
  });

  it.each(['/', '/connexion'])(
    'laisse passer le chemin public %s sans vérifier le cookie',
    (path) => {
      const response = proxy(makeRequest(path));

      expect(isNext(response)).toBe(true);
      expect(mockedGetSessionCookie).not.toHaveBeenCalled();
    },
  );

  it('redirige vers /connexion quand aucun cookie de session n’est présent', () => {
    mockedGetSessionCookie.mockReturnValue(null);

    const response = proxy(makeRequest('/case_files'));

    expect(response.status).toBe(307);
    expect(redirectLocation(response)).toBe('http://localhost:3000/connexion');
  });

  it('laisse passer une route protégée quand un cookie de session est présent', () => {
    mockedGetSessionCookie.mockReturnValue('session-token');

    const response = proxy(makeRequest('/case_files'));

    expect(isNext(response)).toBe(true);
    expect(mockedGetSessionCookie).toHaveBeenCalledOnce();
  });

  it('ne considère pas un sous-chemin de chemin public comme public', () => {
    // "/connexion/autre" n'est pas dans PUBLIC_PATHS (égalité stricte) → protégé.
    mockedGetSessionCookie.mockReturnValue(null);

    const response = proxy(makeRequest('/connexion/autre'));

    expect(response.status).toBe(307);
    expect(redirectLocation(response)).toBe('http://localhost:3000/connexion');
  });
});
