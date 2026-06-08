import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// On évite d'instancier un vrai PrismaClient (et donc d'ouvrir une connexion
// Postgres) à l'import de auth.ts : prismaAdapter se contente de garder la
// référence, un objet vide suffit pour cette suite.
vi.mock('@/app/lib/prisma', () => ({ prisma: {} }));

// getProconnectDiscovery met le document en cache au niveau du module. On
// réimporte donc le module fraîchement à chaque test pour repartir d'un cache
// vide et garder les tests indépendants de leur ordre d'exécution.
async function freshGetProconnectDiscovery() {
  vi.resetModules();
  const mod = await import('./auth');
  return mod.getProconnectDiscovery;
}

describe('getProconnectDiscovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('récupère le document de discovery via l’URL OIDC bien connue', async () => {
    const discovery = { issuer: 'https://fca.example/api/v2' };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(discovery), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const getProconnectDiscovery = await freshGetProconnectDiscovery();
    const result = await getProconnectDiscovery();

    expect(result).toEqual(discovery);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/.well-known/openid-configuration'),
    );
  });

  it('met en cache le résultat : un seul appel réseau pour plusieurs lectures', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ issuer: 'x' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const getProconnectDiscovery = await freshGetProconnectDiscovery();
    await getProconnectDiscovery();
    await getProconnectDiscovery();

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('lève une erreur explicite quand la discovery répond un statut non-2xx', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('nope', { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);

    const getProconnectDiscovery = await freshGetProconnectDiscovery();

    await expect(getProconnectDiscovery()).rejects.toThrow('503');
  });
});
