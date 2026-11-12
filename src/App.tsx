import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Portal from './pages/Portal';
import ForgotPassword from './pages/auth/ForgotPassword';
import { Toaster } from '@/components/ui/sonner';
import { StepUpDialog } from './pages/admin/StepUpDialog';
import { ReauthDialog } from './pages/admin/ReauthDialog';

// Only admins open the admin section, so its code loads when they do, not with the launcher
const AdminPage = lazy(() => import('./pages/admin/AdminPage'));
const admin = (
  <Suspense fallback={null}>
    <AdminPage />
  </Suspense>
);

/**
 * `/` and `/login` are the portal's front door (spec 0007): the form, the launcher, or straight
 * into your one system, chosen from the address and the SSO session.
 */
export default function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Portal />} />
          <Route path="/login" element={<Portal />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          {/* Suite spec 0013, AC-23: the admin section, one route per view */}
          <Route path="/admin" element={admin} />
          <Route path="/admin/:view" element={admin} />
          {/* AC-23 deep links: /admin/people/new and /admin/people/:id, both with ?system= */}
          <Route path="/admin/people/:id" element={admin} />
          <Route path="/portal" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      {/* AC-22: one step up dialog for every admin call that answers ADMIN_CODE_REQUIRED */}
      <StepUpDialog />
      {/* AC-14a, AC-14b: one password dialog for every write that answers REAUTH_REQUIRED */}
      <ReauthDialog />
      <Toaster />
    </>
  );
}
