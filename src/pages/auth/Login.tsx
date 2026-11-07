import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, Truck } from 'lucide-react';
import { isAxiosError } from 'axios';
import { api } from '../../lib/api';
import { getReturnSystem, logout, setSession, type SubsystemKey } from '../../lib/auth';
import { useToast } from '../../context/toast';
import { SUBSYSTEMS } from '../../lib/subsystems';

function redirectToSubsystem(systemUrl: string, token: string) {
  window.location.href = `${systemUrl}/login?token=${token}`;
}

export default function Login() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [searchParams] = useSearchParams();
  const hasShownToast = useRef(false);

  useEffect(() => {
    if (searchParams.get('logout') === 'true') {
      if (!hasShownToast.current) {
        hasShownToast.current = true;
        logout();
        showToast('Successfully logged out.', 'success');
        navigate('/login', { replace: true });
      }
    } else if (searchParams.get('inactivity') === 'true') {
      if (!hasShownToast.current) {
        hasShownToast.current = true;
        logout();
        showToast('Signed out due to inactivity.', 'info');
        navigate('/login', { replace: true });
      }
    } else if (getReturnSystem()) {
      navigate('/', { replace: true });
    }
  }, [searchParams, navigate, showToast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);

    try {
      let formattedEmail = email.trim();
      if (!formattedEmail.includes('@')) {
        formattedEmail = `${formattedEmail}@welinc.com`;
      }

      const response = await api.post('/auth/login', {
        email: formattedEmail,
        password,
      });

      // Spec 0002, AC-7: welinc-auth picks the system and says which; the portal goes there
      const { accessToken: token, system, user } = response.data as {
        accessToken: string;
        system: SubsystemKey;
        user: { id: string; email: string; roles: { role: string; system: string }[] };
      };
      const config = SUBSYSTEMS[system];
      if (!config) {
        setError('Unable to open your workspace. Please try again.');
        return;
      }

      setSession(token, system);
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
      localStorage.setItem('welinc_user', JSON.stringify({
        id: user.id,
        email: user.email || formattedEmail,
        roles: user.roles || [],
      }));

      showToast('Welcome back! Logging you in...', 'success');

      setTimeout(() => {
        redirectToSubsystem(config.url, token);
      }, 800);
    } catch (err) {
      console.error('[Login Error]', err);
      const axiosError = isAxiosError(err) ? err : undefined;
      const data = axiosError?.response?.data;
      if (data?.code === 'NO_SYSTEM_ACCESS') {
        setError('Your account has no assigned subsystem access. Contact your administrator.');
        logout();
      } else if (data?.isLocked) {
        setError('Your account is locked. Contact your Admin to unlock.');
      } else if (data?.remainingAttempts !== undefined) {
        setError(`Invalid credentials. ${data.remainingAttempts} attempts remaining.`);
      } else if (axiosError?.response?.status === 401) {
        setError('Invalid email or password.');
      } else if (axiosError?.response?.status === 400) {
        const msg = data?.message;
        setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Validation error. Please check your inputs.');
      } else {
        setError(`Unable to reach the authentication server (${err instanceof Error ? err.message : 'unknown error'}). Please try again.`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-brand-dark">
      {/* Left Pane: Brand Info */}
      <div className="hidden lg:flex flex-col w-[52%] relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(https://grazia-prod.oss-ap-southeast-1.aliyuncs.com/resources/uid_100058644/42c68fef-2874-4f.avif)`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-brand-dark/95 via-brand-blueAccent/80 to-brand-dark/95" />
        
        {/* Abstract shapes */}
        <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-brand-gold/10 blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full bg-brand-gold/5 blur-3xl translate-y-1/3 -translate-x-1/3" />

        <div className="relative z-10 flex flex-col h-full p-12 justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-brand-gold flex items-center justify-center shadow-lg shadow-brand-gold/30">
              <img
                src="https://grazia-prod.oss-ap-southeast-1.aliyuncs.com/resources/uid_100058644/296c4c4a-9502-46.jpg"
                alt="WeLinc"
                crossOrigin="anonymous"
                className="h-8 w-auto"
              />
            </div>
            <span className="text-xl font-black text-white tracking-tight">WeLinc Logistics</span>
          </div>

          <div>
            <h1 className="text-4xl xl:text-5xl font-black text-white leading-tight mb-4">
              WeLinc Logistics<br />
              <span className="text-brand-gold">Operations</span><br />
              Workspace
            </h1>
            <p className="text-white/60 text-base leading-relaxed max-w-sm">
              Centralized platform for managing logistics operations, vehicle monitoring, and maintenance schedules.
            </p>
          </div>
          <div />
        </div>
      </div>

      {/* Right Pane: Login Card */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-dark via-brand-darker to-brand-darker" />
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-brand-blueAccent/30 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-brand-blueAccent/15 blur-3xl" />

        <div className="relative z-10 w-full max-w-md">
          {/* Mobile brand header */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 rounded-xl bg-brand-gold flex items-center justify-center">
              <img
                src="https://grazia-prod.oss-ap-southeast-1.aliyuncs.com/resources/uid_100058644/296c4c4a-9502-46.jpg"
                alt="WeLinc"
                crossOrigin="anonymous"
                className="h-7 w-auto"
              />
            </div>
            <span className="text-lg font-black text-white">WeLinc Logistics</span>
          </div>

          {/* Glassmorphism panel */}
          <div className="bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl shadow-black/40">
            <div className="mb-8">
              <div className="w-12 h-12 rounded-2xl bg-brand-gold flex items-center justify-center mb-5 shadow-lg shadow-brand-gold/20">
                <Truck size={22} className="text-brand-blueAccent" strokeWidth={2.5} />
              </div>
              <h2 className="text-2xl font-black text-white mb-1">Sign In</h2>
              <p className="text-white/50 text-sm">Enter your credentials to access your workspace</p>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-400/20 rounded-xl p-4 mb-5">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-white/70 mb-2">
                  Email or Username <span className="text-red-400">*</span>
                </label>
                <input
                  id="login-email"
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@welinc.com or username"
                  required
                  autoComplete="username"
                  className="w-full px-4 py-3 text-base bg-white/[0.06] border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold/50 transition-all"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-white/70">
                    Password <span className="text-red-400">*</span>
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs text-brand-gold/80 hover:text-brand-gold transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    required
                    autoComplete="current-password"
                    className="w-full px-4 py-3 text-base bg-white/[0.06] border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold/50 transition-all pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 cursor-pointer transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                id="login-submit"
                type="submit"
                disabled={loading}
                className="w-full bg-brand-gold hover:bg-brand-goldHover text-brand-blueAccent font-black py-3.5 rounded-xl text-base transition-all cursor-pointer disabled:opacity-60 shadow-lg shadow-brand-gold/20 hover:shadow-brand-gold/30 hover:-translate-y-0.5 active:translate-y-0"
              >
                {loading ? 'Authenticating...' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
