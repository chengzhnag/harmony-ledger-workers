import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { resetUrlMockState } from '@/lib/url-mock';

afterEach(() => {
  cleanup();
  localStorage.clear();
  resetUrlMockState();
  window.history.replaceState({}, '', '/');
});