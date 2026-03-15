import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { ClientLayout } from '@/components/layout/ClientLayout'
import { useAuth } from '@/contexts/AuthContext'

import LandingPage from '@/pages/Landing'
import LoginPage from '@/pages/Login'
import DashboardPage from '@/pages/Dashboard'
import DraftNoticePage from '@/pages/draft/Notice'
import DraftContractPage from '@/pages/draft/Contract'
import ReviewContractPage from '@/pages/review/Contract'
import TitleReportPage from '@/pages/draft/TitleReport'
import DocumentsPage from '@/pages/Documents'
import SettingsPage from '@/pages/Settings'
import ManageClientsPage from '@/pages/clients/ManageClients'
import ClientDashboardPage from '@/pages/client/Dashboard'
import ClientDocumentsPage from '@/pages/client/Documents'

function RoleRedirect() {
  const { user, role, loading } = useAuth()

  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (role === 'client') return <Navigate to="/client/dashboard" replace />
  return <Navigate to="/dashboard" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Role-based redirect after login */}
        <Route path="/home" element={<RoleRedirect />} />

        {/* Advocate routes — wrapped in AppLayout (auth guard + advocate sidebar) */}
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/draft/notice" element={<DraftNoticePage />} />
          <Route path="/draft/contract" element={<DraftContractPage />} />
          <Route path="/review/contract" element={<ReviewContractPage />} />
          <Route path="/draft/title-report" element={<TitleReportPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/clients" element={<ManageClientsPage />} />
        </Route>

        {/* Client routes — wrapped in ClientLayout (auth guard + client sidebar) */}
        <Route element={<ClientLayout />}>
          <Route path="/client/dashboard" element={<ClientDashboardPage />} />
          <Route path="/client/documents" element={<ClientDocumentsPage />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
