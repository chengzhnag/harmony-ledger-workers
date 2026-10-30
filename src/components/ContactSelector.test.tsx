import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/context/AuthProvider';
import { AuthContext } from '@/context/AuthContext';
import { ContactSelector } from '@/components/ContactSelector';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { getUrlMockUser } from '@/lib/url-mock';

class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(globalThis, 'ResizeObserver', { value: TestResizeObserver, configurable: true });

describe('ContactSelector', () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('shows all 20 contacts and selects the last one', async () => {
    window.history.replaceState({}, '', '/?mock=1');
    const onSelect = vi.fn();

    render(
      <AuthProvider>
        <ContactSelector onSelect={onSelect} />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByRole('combobox'));

    expect(await screen.findByText('罗欣')).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(20);

    fireEvent.click(screen.getByText('罗欣'));
    expect(onSelect).toHaveBeenCalledWith({ id: 'mock-contact-20', name: '罗欣' });
  });

  it('keeps the popover list inside its modal dialog scroll boundary', async () => {
    window.history.replaceState({}, '', '/?mock=1');
    const user = getUrlMockUser();

    render(
      <AuthContext.Provider value={{
        user,
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        switchFamily: vi.fn(),
      }}>
        <Sheet open onOpenChange={() => {}}>
          <SheetContent side="bottom">
            <SheetHeader>
              <SheetTitle>联系人选择</SheetTitle>
              <SheetDescription>请选择一位联系人</SheetDescription>
            </SheetHeader>
            <ContactSelector onSelect={vi.fn()} />
          </SheetContent>
        </Sheet>
      </AuthContext.Provider>,
    );

    fireEvent.click(screen.getByRole('combobox'));

    const contactList = await screen.findByRole('listbox');
    expect(contactList).toHaveClass('overflow-y-auto', 'touch-pan-y');
    expect(contactList.closest('[role="dialog"]')).not.toBeNull();
  });
});