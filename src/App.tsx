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
import CalendarPage from '@/pages/Calendar'
import MessagesPage from '@/pages/Messages'
import ClausesPage from '@/pages/Clauses'
import StampDutyPage from '@/pages/StampDuty'
import ECourtsPage from '@/pages/ECourts'
import IntakePage from '@/pages/Intake'

function RoleRedirect() {
  const { user, role, loading } = useAuth()

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-[#0E0E0E] gap-3">
      <div className="w-6 h-6 border border-[#C9A84C] border-t-transparent animate-spin" />
      <p className="text-[11px] text-[rgba(250,247,240,0.4)]" style={{ fontFamily: 'DM Mono, monospace' }}>LOADING…</p>
    </div>
  )
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

        {/* Public intake form (no auth required) */}
        <Route path="/intake/:formId" element={<IntakePage />} />

        {/* Role-based redirect after login */}
        <Route path="/home" element={<RoleRedirect />} />

        {/* Advocate routes — wrapped in AppLayout (auth guard + advocate sidebar) */}
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/draft/notice" element={<DraftNoticePage />} />
          <Route path="/draft/contract" element={<DraftContractPage />} />
          <Route path="/review/contract" element={<ReviewContractPage />} />
          <Route path="/draft/title-report" element={<TitleReportPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/clients" element={<ManageClientsPage />} />
          <Route path="/clauses" element={<ClausesPage />} />
          <Route path="/stamp-duty" element={<StampDutyPage />} />
          <Route path="/ecourts" element={<ECourtsPage />} />
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
