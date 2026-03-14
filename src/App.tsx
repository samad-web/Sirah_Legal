import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'

import LandingPage from '@/pages/Landing'
import LoginPage from '@/pages/Login'
import DashboardPage from '@/pages/Dashboard'
import DraftNoticePage from '@/pages/draft/Notice'
import DraftContractPage from '@/pages/draft/Contract'
import ReviewContractPage from '@/pages/review/Contract'
import TitleReportPage from '@/pages/draft/TitleReport'
import DocumentsPage from '@/pages/Documents'
import SettingsPage from '@/pages/Settings'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Protected — wrapped in sidebar + auth guard */}
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/draft/notice" element={<DraftNoticePage />} />
          <Route path="/draft/contract" element={<DraftContractPage />} />
          <Route path="/review/contract" element={<ReviewContractPage />} />
          <Route path="/draft/title-report" element={<TitleReportPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
