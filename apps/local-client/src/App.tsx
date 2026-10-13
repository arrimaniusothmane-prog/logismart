import { useEffect, useState } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { ToastProvider } from './components/ui';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { initApiConfig } from './lib/api';
import { LoginPage } from './pages/LoginPage';
import { DriverDashboardPage } from './pages/DriverDashboardPage';
import { DeliveriesPage } from './pages/DeliveriesPage';
import { ProfilePage } from './pages/ProfilePage';
import { NetworkBanner } from './components/NetworkBanner';
import { DriverLayout } from './components/DriverLayout';
import { SettingsPage } from './pages/SettingsPage';

function RedirectHome() {
  const { status, user } = useAuth();
  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-brand-500 border-t-transparent" role="status" />
      </div>
    );
  }
  if (status === 'authenticated' && user?.role === 'DRIVER') return <Navigate to="/driver/dashboard" replace />;
  return <Navigate to="/login" replace />;
}

function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-brand-500 border-t-transparent" role="status" />
      </div>
    );
  }
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

export function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initApiConfig().finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-brand-500 border-t-transparent" role="status" />
      </div>
    );
  }

  return (
    <ToastProvider>
      <AuthProvider>
        <NetworkBanner />
        <Routes>
          <Route path="/" element={<RedirectHome />} />
          <Route path="/login" element={<LoginPage />} />

          <Route element={<RequireAuth />}>
            <Route element={<DriverLayout />}>
              <Route path="/driver/dashboard" element={<DriverDashboardPage />} />
              <Route path="/driver/deliveries" element={<DeliveriesPage />} />
              <Route path="/driver/profile" element={<ProfilePage />} />
              <Route path="/driver/settings" element={<SettingsPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </ToastProvider>
  );
}
