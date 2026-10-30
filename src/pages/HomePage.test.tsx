import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/context/AuthProvider';
import { HomePage } from '@/pages/HomePage';

describe('HomePage URL mock mode', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders fixture data without making network requests', async () => {
    window.history.replaceState({}, '', '/?mock=1');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter>
            <HomePage />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('王小明')).toBeInTheDocument();
    expect(await screen.findByText(/^\d[\d,]*$/)).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});