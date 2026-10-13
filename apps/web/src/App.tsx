import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ToastProvider } from './components/ui';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { RequireAnonymous, RequireAuth, RequirePermission, RequireRole } from './auth/guards';
import { AppLayout } from './components/layout/AppLayout';
import { homeRouteFor } from './components/layout/nav';

import { LoginPage } from './pages/auth/LoginPage';
import { CompanyRoutes, ClientRoutes } from './portals/routes';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { OrdersPage } from './pages/orders/OrdersPage';
import { DriversPage } from './pages/drivers/DriversPage';
import { MapPage } from './pages/map/MapPage';
import { SupportPage } from './pages/support/SupportPage';
import { KnowledgePage } from './pages/knowledge/KnowledgePage';
import { RecruitmentPage } from './pages/recruitment/RecruitmentPage';
import { JobsPage } from './pages/recruitment/JobsPage';
import { CandidatesPage } from './pages/recruitment/CandidatesPage';
import { UsersPage } from './pages/users/UsersPage';
import { SettingsPage } from './pages/settings/SettingsPage';
import { AdminDashboardPage } from './pages/platform/AdminDashboardPage';
import { AdminCompaniesPage } from './pages/platform/AdminCompaniesPage';
import { CustomersPage } from './pages/customers/CustomersPage';
import { CatalogPage } from './pages/catalog/CatalogPage';
import { DriverDashboardPage } from './pages/driver/DriverDashboardPage';
import { DriverDeliveriesPage } from './pages/driver/DriverDeliveriesPage';
import { DriverProfilePage } from './pages/driver/DriverProfilePage';
import { TrackPage } from './pages/public/TrackPage';
import { NotFoundPage } from './pages/NotFoundPage';

function RedirectHome() {
  const { status, user } = useAuth();
  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-brand-500 border-t-transparent" role="status" />
      </div>
    );
  }
  return <Navigate to={status === 'authenticated' && user ? homeRouteFor(user.role) : '/login'} replace />;
}

export function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<RedirectHome />} />

              <Route
                path="/login"
                element={
                  <RequireAnonymous>
                    <LoginPage />
                  </RequireAnonymous>
                }
              />

              <Route path="/track/:token" element={<TrackPage />} />

              {/* Portails indépendants — jamais rendus dans l'AppLayout Admin. */}
              <Route path="/company/*" element={<CompanyRoutes />} />
              <Route path="/client/*" element={<ClientRoutes />} />

              <Route element={<RequireAuth />}>
                <Route element={<AppLayout />}>
                  <Route path="/dashboard" element={<DashboardPage />} />

                  <Route
                    path="/orders"
                    element={
                      <RequirePermission permission="order:read">
                        <OrdersPage />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="/drivers"
                    element={
                      <RequirePermission permission="driver:read">
                        <DriversPage />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="/map"
                    element={
                      <RequirePermission permission="map:read">
                        <MapPage />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="/support"
                    element={
                      <RequirePermission permission="support:read">
                        <SupportPage />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="/knowledge"
                    element={
                      <RequirePermission permission="knowledge:read">
                        <KnowledgePage />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="/recruitment"
                    element={
                      <RequirePermission permission="candidate:read">
                        <RecruitmentPage />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="/recruitment/jobs"
                    element={
                      <RequirePermission permission="job:read">
                        <JobsPage />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="/recruitment/candidates"
                    element={
                      <RequirePermission permission="candidate:read">
                        <CandidatesPage />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="/users"
                    element={
                      <RequirePermission permission="user:read">
                        <UsersPage />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="/settings"
                    element={
                      <RequirePermission permission="company:read">
                        <SettingsPage />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="/customers"
                    element={
                      <RequirePermission permission="customer:read">
                        <CustomersPage />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="/catalog"
                    element={
                      <RequirePermission permission="catalog:read">
                        <CatalogPage />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="/admin"
                    element={
                      <RequirePermission permission="platform:stats">
                        <AdminDashboardPage />
                      </RequirePermission>
                    }
                  />
                  <Route
                    path="/admin/companies"
                    element={
                      <RequirePermission permission="platform:manage">
                        <AdminCompaniesPage />
                      </RequirePermission>
                    }
                  />

                  <Route
                    path="/driver/dashboard"
                    element={
                      <RequireRole roles={['DRIVER']}>
                        <DriverDashboardPage />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/driver/deliveries"
                    element={
                      <RequireRole roles={['DRIVER']}>
                        <DriverDeliveriesPage />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/driver/profile"
                    element={
                      <RequireRole roles={['DRIVER']}>
                        <DriverProfilePage />
                      </RequireRole>
                    }
                  />
                </Route>
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  );
}