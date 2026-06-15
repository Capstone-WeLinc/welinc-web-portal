import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Login, { SUBSYSTEMS } from './pages/auth/Login';
import ModuleSelection from './pages/portal/ModuleSelection';
import { getCurrentUser } from './lib/auth';

function PortalRootRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }

    // Filter subsystem roles
    const subsystemRoles = (user.roles || []).filter((r) =>
      ['VRMS', 'VMMS', 'BMS'].includes(r.system.toUpperCase())
    );

    if (subsystemRoles.length === 0) {
      const hasSharedAdmin = (user.roles || []).some(
        (r) => r.system.toUpperCase() === 'SHARED' && r.role.toUpperCase() === 'ADMIN'
      );
      if (hasSharedAdmin) {
        navigate('/portal', { replace: true });
      } else {
        localStorage.clear();
        navigate('/login', { replace: true });
      }
      return;
    }

    if (subsystemRoles.length === 1) {
      // Redirect immediately to that subsystem
      const token = localStorage.getItem('token');
      const targetSystem = subsystemRoles[0].system.toUpperCase();
      const config = SUBSYSTEMS[targetSystem as keyof typeof SUBSYSTEMS];
      if (config && token) {
        window.location.href = `${config.url}/login?token=${token}`;
        return;
      }
    }

    // Default to Portal selection page
    navigate('/portal', { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-darker text-slate-400 font-bold">
      Loading your workspace...
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PortalRootRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/portal" element={<ModuleSelection />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
