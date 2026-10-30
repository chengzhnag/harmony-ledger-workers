import { getUrlMockUser, mockApiRequest } from '@/lib/url-mock';

const MOCK_SESSION_KEY = 'harmony_url_mock';

export function isUrlMockActive(): boolean {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false;

  const params = new URLSearchParams(window.location.search);
  if (params.has('mock')) {
    const mode = params.get('mock') || '1';
    if (mode === 'off') {
      sessionStorage.removeItem(MOCK_SESSION_KEY);
      return false;
    }
    sessionStorage.setItem(MOCK_SESSION_KEY, mode);
  }

  return sessionStorage.getItem(MOCK_SESSION_KEY) !== null;
}

export async function mockUrlApiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const url = new URL(path, window.location.origin);
  if (url.pathname === '/api/admin/feedback') {
    return [] as T;
  }
  if (url.pathname === '/api/auth/login' || url.pathname === '/api/auth/register') {
    let body: Record<string, unknown> = {};
    if (typeof init?.body === 'string') {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = {};
      }
    }
    return { ...getUrlMockUser(), name: body.name || getUrlMockUser().name } as T;
  }

  return mockApiRequest<T>(path, init);
}