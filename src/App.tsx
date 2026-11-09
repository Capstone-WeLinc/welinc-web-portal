import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Portal from './pages/Portal';
import ForgotPassword from './pages/auth/ForgotPassword';
import { Toaster } from '@/components/ui/sonner';

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
          <Route path="/portal" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </>
  );
}
