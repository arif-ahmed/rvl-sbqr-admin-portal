import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell, RequireAuth } from './components/layout/AppShell'
import CryptoKeysPage from './pages/CryptoKeysPage'
import InspectorPage from './pages/InspectorPage'
import LoginPage from './pages/LoginPage'
import NewTenantWizardPage from './pages/NewTenantWizardPage'
import TenantDetailPage from './pages/TenantDetailPage'
import TenantsPage from './pages/TenantsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        // 4xx means the query itself is bad (auth, validation, not-found) —
        // retrying just delays the error surface. Retry only 5xx/network.
        const status = (error as { status?: number }).status
        if (status !== undefined && status >= 400 && status < 500) return false
        return failureCount < 2
      },
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route path="/" element={<Navigate to="/tenants" replace />} />
            <Route path="/tenants" element={<TenantsPage />} />
            <Route path="/tenants/new" element={<NewTenantWizardPage />} />
            <Route path="/tenants/:id" element={<TenantDetailPage />} />
            <Route path="/crypto-keys" element={<CryptoKeysPage />} />
            <Route path="/inspector" element={<InspectorPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/tenants" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
