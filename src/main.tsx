import '@/lib/errorReporter';
import './i18n/config';
import { enableMapSet } from "immer";
enableMapSet();
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import { AuthProvider } from '@/context/AuthProvider';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import '@/index.css'
import { HomePage } from '@/pages/HomePage'
import { LedgersPage } from '@/pages/LedgersPage'
import { LedgerDetailPage } from '@/pages/LedgerDetailPage'
import { AnalyticsPage } from '@/pages/AnalyticsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { ContactsPage } from '@/pages/ContactsPage'
import { ContactDetailPage } from '@/pages/ContactDetailPage'
import { TimelinePage } from '@/pages/TimelinePage'
import { LoginPage } from '@/pages/LoginPage'
import { MobileLayout } from '@/components/layout/MobileLayout'
import { Toaster } from '@/components/ui/sonner';
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false }
  }
});
const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/",
    element: <ProtectedRoute><MobileLayout><HomePage /></MobileLayout></ProtectedRoute>,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/ledgers",
    element: <ProtectedRoute><MobileLayout><LedgersPage /></MobileLayout></ProtectedRoute>,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/ledgers/:ledgerId",
    element: <ProtectedRoute><MobileLayout><LedgerDetailPage /></MobileLayout></ProtectedRoute>,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/analytics",
    element: <ProtectedRoute><MobileLayout><AnalyticsPage /></MobileLayout></ProtectedRoute>,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/contacts",
    element: <ProtectedRoute><MobileLayout><ContactsPage /></MobileLayout></ProtectedRoute>,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/contacts/:contactId",
    element: <ProtectedRoute><MobileLayout><ContactDetailPage /></MobileLayout></ProtectedRoute>,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/timeline",
    element: <ProtectedRoute><MobileLayout><TimelinePage /></MobileLayout></ProtectedRoute>,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/settings",
    element: <ProtectedRoute><MobileLayout><SettingsPage /></MobileLayout></ProtectedRoute>,
    errorElement: <RouteErrorBoundary />,
  },
]);
createRoot(document.getElementById('root')!).render(
  <>
    <Toaster />
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ErrorBoundary>
            <RouterProvider router={router} />
          </ErrorBoundary>
        </AuthProvider>
      </QueryClientProvider>
    </StrictMode>
  </>,
)