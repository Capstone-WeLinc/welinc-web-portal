import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Login from './pages/auth/Login';
import { SUBSYSTEMS } from './lib/subsystems';
import ForgotPassword from './pages/auth/ForgotPassword';
import { getCurrentUser, getToken } from './lib/auth';
import { ToastProvider } from './context/ToastContext';
import SessionMonitor from './components/SessionMonitor';

function PortalRootRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }

    const token = getToken();


    // Filter subsystem roles
    const subsystemRoles = (user.roles || []).filter((r) =>
      ['VRMS', 'VMMS', 'BMS'].includes(r.system.toUpperCase())
    );

    if (subsystemRoles.length === 0) {
      localStorage.clear();
      navigate('/login', { replace: true });
      return;
    }

    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    // Single system → go straight there
    if (subsystemRoles.length === 1) {
      const targetSystem = subsystemRoles[0].system.toUpperCase();
      const config = SUBSYSTEMS[targetSystem as keyof typeof SUBSYSTEMS];
      if (config) {
        window.location.href = `${config.url}/login?token=${token}`;
        return;
      }
    }

    // Multi-role: prefer VRMS for mechanics
    const vrmsRole = subsystemRoles.find((r) => r.system.toUpperCase() === 'VRMS');
    if (vrmsRole) {
      window.location.href = `${SUBSYSTEMS.VRMS.url}/login?token=${token}`;
      return;
    }

    // Fallback: first available system
    const firstSystem = subsystemRoles[0].system.toUpperCase();
    const firstConfig = SUBSYSTEMS[firstSystem as keyof typeof SUBSYSTEMS];
    if (firstConfig) {
      window.location.href = `${firstConfig.url}/login?token=${token}`;
      return;
    }

    // Last resort: portal management page
    navigate('/portal', { replace: true });
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
      if (e.key === 'welinc_token' || e.key === 'welinc_user') {
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
