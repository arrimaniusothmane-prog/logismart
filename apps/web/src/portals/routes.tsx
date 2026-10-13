import { Navigate, Route, Routes } from 'react-router-dom';
import './portals.css';
import { RequireCompany } from './shared/guards';

import { CompanyLayout } from './company/CompanyLayout';
import { CompanyOverviewPage } from './company/CompanyOverviewPage';
import { CompanyOrdersPage } from './company/CompanyOrdersPage';
import { CompanyOrderDetailPage } from './company/CompanyOrderDetailPage';
import { CompanyDriversPage } from './company/CompanyDriversPage';
import { CompanyDriverDetailPage } from './company/CompanyDriverDetailPage';
import { CompanyCustomersPage } from './company/CompanyCustomersPage';
import { CompanyCustomerDetailPage } from './company/CompanyCustomerDetailPage';
import { CompanyRecruitmentPage } from './company/CompanyRecruitmentPage';
import { CompanyJobsPage } from './company/CompanyJobsPage';
import { CompanyCandidatesPage } from './company/CompanyCandidatesPage';
import { CompanyCandidateDetailPage } from './company/CompanyCandidateDetailPage';
import { CompanySupportPage } from './company/CompanySupportPage';

import { ClientAuthProvider } from './client/ClientAuthContext';
import { RequireClient } from './client/guards';
import { ClientLayout } from './client/ClientLayout';
import { ClientHomePage } from './client/ClientHomePage';
import { ClientLoginPage } from './client/ClientLoginPage';
import { ClientRegisterPage } from './client/ClientRegisterPage';
import { ClientDashboardPage } from './client/ClientDashboardPage';
import { ClientOrdersPage } from './client/ClientOrdersPage';
import { ClientOrderDetailPage } from './client/ClientOrderDetailPage';
import { ClientNotificationsPage } from './client/ClientNotificationsPage';
import { ClientProfilePage } from './client/ClientProfilePage';
import { ClientSupportPage } from './client/ClientSupportPage';

/** Routes de l'espace entreprise (`/company`) — indépendantes de l'Admin. */
export function CompanyRoutes() {
  return (
    <Routes>
      <Route
        element={
          <RequireCompany>
            <CompanyLayout />
          </RequireCompany>
        }
      >
        <Route index element={<CompanyOverviewPage />} />
        <Route path="orders" element={<CompanyOrdersPage />} />
        <Route path="orders/:id" element={<CompanyOrderDetailPage />} />
        <Route path="drivers" element={<CompanyDriversPage />} />
        <Route path="drivers/:id" element={<CompanyDriverDetailPage />} />
        <Route path="customers" element={<CompanyCustomersPage />} />
        <Route path="customers/:id" element={<CompanyCustomerDetailPage />} />
        <Route path="recruitment" element={<CompanyRecruitmentPage />} />
        <Route path="recruitment/jobs" element={<CompanyJobsPage />} />
        <Route path="recruitment/candidates" element={<CompanyCandidatesPage />} />
        <Route path="recruitment/candidates/:id" element={<CompanyCandidateDetailPage />} />
        <Route path="support" element={<CompanySupportPage />} />
        <Route path="*" element={<Navigate to="/company" replace />} />
      </Route>
    </Routes>
  );
}

/** Routes de l'espace client (`/client`) — session portail dédiée. */
export function ClientRoutes() {
  return (
    <ClientAuthProvider>
      <Routes>
        <Route index element={<ClientHomePage />} />
        <Route path="login" element={<ClientLoginPage />} />
        <Route path="register" element={<ClientRegisterPage />} />

        <Route element={<RequireClient />}>
          <Route element={<ClientLayout />}>
            <Route path="dashboard" element={<ClientDashboardPage />} />
            <Route path="orders" element={<ClientOrdersPage />} />
            <Route path="orders/:id" element={<ClientOrderDetailPage />} />
            <Route path="notifications" element={<ClientNotificationsPage />} />
            <Route path="profile" element={<ClientProfilePage />} />
            <Route path="support" element={<ClientSupportPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/client" replace />} />
      </Routes>
    </ClientAuthProvider>
  );
}
