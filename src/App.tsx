import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
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
import ResetPasswordPage from '@/pages/ResetPassword'

/** Redirects lawyers who hit client-only paths, and vice-versa. */
function RoleRedirect({ role }: { role: 'lawyer' | 'client' | null }) {
  if (role === 'client') return <Navigate to="/client/dashboard" replace />
  return <Navigate to="/dashboard" replace />
}

export default function App() {
  const { isClient, isLawyer, loading } = useAuth()

  // Don't render guarded routes until auth resolves
  if (loading) return null

  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Protected — wrapped in sidebar + auth guard */}
        <Route element={<AppLayout />}>
          {/* ── Lawyer-only routes ── */}
          <Route
            path="/dashboard"
            element={isClient ? <Navigate to="/client/dashboard" replace /> : <DashboardPage />}
          />
          <Route
            path="/draft/notice"
            element={isClient ? <Navigate to="/client/dashboard" replace /> : <DraftNoticePage />}
          />
          <Route
            path="/draft/contract"
            element={isClient ? <Navigate to="/client/dashboard" replace /> : <DraftContractPage />}
          />
          <Route
            path="/review/contract"
            element={isClient ? <Navigate to="/client/dashboard" replace /> : <ReviewContractPage />}
          />
          <Route
            path="/draft/title-report"
            element={isClient ? <Navigate to="/client/dashboard" replace /> : <TitleReportPage />}
          />
          <Route
            path="/documents"
            element={isClient ? <Navigate to="/client/documents" replace /> : <DocumentsPage />}
          />
          <Route
            path="/settings"
            element={isClient ? <Navigate to="/client/dashboard" replace /> : <SettingsPage />}
          />
          <Route
            path="/clients"
            element={isClient ? <Navigate to="/client/dashboard" replace /> : <ManageClientsPage />}
          />

          {/* ── Client-only routes ── */}
          <Route
            path="/client/dashboard"
            element={isLawyer ? <Navigate to="/dashboard" replace /> : <ClientDashboardPage />}
          />
          <Route
            path="/client/documents"
            element={isLawyer ? <Navigate to="/documents" replace /> : <ClientDocumentsPage />}
          />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<RoleRedirect role={isClient ? 'client' : isLawyer ? 'lawyer' : null} />} />
      </Routes>
    </BrowserRouter>
  )
}
