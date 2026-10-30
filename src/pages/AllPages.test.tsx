import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/context/AuthProvider';
import { api } from '@/lib/api-client';
import { AnalyticsPage } from '@/pages/AnalyticsPage';
import { ContactDetailPage } from '@/pages/ContactDetailPage';
import { ContactsPage } from '@/pages/ContactsPage';
import { FeedbackDashboardPage } from '@/pages/FeedbackDashboardPage';
import { HomePage } from '@/pages/HomePage';
import { LedgerDetailPage } from '@/pages/LedgerDetailPage';
import { LedgersPage } from '@/pages/LedgersPage';
import { LoginPage } from '@/pages/LoginPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { TimelinePage } from '@/pages/TimelinePage';

const pages = [
  { name: 'HomePage', path: '/', content: /王小明/ },
  { name: 'LedgersPage', path: '/ledgers', content: /小明婚礼/ },
  { name: 'LedgerDetailPage', path: '/ledgers/mock-ledger-1', content: /小明婚礼/ },
  { name: 'AnalyticsPage', path: '/analytics', content: /^¥[1-9][\d,]*$/ },
  { name: 'ContactsPage', path: '/contacts', content: /王小明/ },
  { name: 'FeedbackDashboardPage', path: '/admin/feedback', content: /暂无用户反馈/ },
  { name: 'ContactDetailPage', path: '/contacts/mock-contact-1', content: /王小明/ },
  { name: 'TimelinePage', path: '/timeline', content: /王小明/ },
  { name: 'SettingsPage', path: '/settings', content: /MOCK2026/ },
  { name: 'LoginPage', path: '/login', content: /^Harmony Ledger$/i },
];

class TestObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(globalThis, 'ResizeObserver', { value: TestObserver, configurable: true });
Object.defineProperty(globalThis, 'IntersectionObserver', { value: TestObserver, configurable: true });

function renderPage(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/ledgers" element={<LedgersPage />} />
            <Route path="/ledgers/:ledgerId" element={<LedgerDetailPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/contacts" element={<ContactsPage />} />
            <Route path="/admin/feedback" element={<FeedbackDashboardPage />} />
            <Route path="/contacts/:contactId" element={<ContactDetailPage />} />
            <Route path="/timeline" element={<TimelinePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe.each(pages)('$name URL Mock rendering', ({ path, content }) => {
  afterEach(() => {
    cleanup();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders page data without backend requests', async () => {
    window.history.replaceState({}, '', '/?mock=1');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    renderPage(path);

    expect(await screen.findAllByText(content)).not.toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('URL Mock route continuity', () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it('keeps API requests mocked after client navigation drops the query', async () => {
    window.history.replaceState({}, '', '/?mock=1');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const loginUser = await api<{ id: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'mock@example.com', password: 'mock-password' }),
    });
    const initialContacts = await api<Array<{ id: string }>>('/api/contacts/search?familyId=mock-family-1&q=');

    window.history.replaceState({}, '', '/contacts');
    const navigatedContacts = await api<Array<{ id: string }>>('/api/contacts/search?familyId=mock-family-1&q=');
    const ledgers = await api<Array<{ id: string }>>('/api/ledgers?familyId=mock-family-1');
    const recordPage = await api<{ records: Array<{ id: string }>; total: number }>('/api/records?familyId=mock-family-1&page=1&limit=100');

    expect(loginUser.id).toBe('mock-user-1');
    expect(initialContacts).toHaveLength(20);
    expect(navigatedContacts).toHaveLength(20);
    expect(ledgers).toHaveLength(5);
    expect(recordPage.records).toHaveLength(40);
    expect(recordPage.total).toBe(40);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});