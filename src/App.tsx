import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Login from './pages/auth/Login';
import { SUBSYSTEMS } from './lib/subsystems';
import ForgotPassword from './pages/auth/ForgotPassword';
import { getReturnSystem, getToken } from './lib/auth';
import { ToastProvider } from './context/ToastContext';
import SessionMonitor from './components/SessionMonitor';

function PortalRootRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    // Spec 0002, AC-7: a return visit goes back to the system of the last login, read from
    // storage, never worked out from the token
    const system = getReturnSystem();
    const token = getToken();
    if (!system || !token) {
      navigate('/login', { replace: true });
      return;
    }
    window.location.href = `${SUBSYSTEMS[system].url}/login?token=${token}`;
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-darker text-slate-400 font-bold">
      Loading your workspace...
    </div>
  );
}

export default function App() {
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'welinc_token' || e.key === 'welinc_user' || e.key === 'welinc_system') {
        window.location.reload();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return (
    <ToastProvider>
      <BrowserRouter>
        <SessionMonitor />
        <Routes>
          <Route path="/" element={<PortalRootRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/portal" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
