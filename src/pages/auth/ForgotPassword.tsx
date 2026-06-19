import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle, AlertCircle, Truck, Eye, EyeOff } from 'lucide-react';
import { api } from '../../lib/api';

type Step = 'email' | 'otp' | 'newPassword' | 'done';

export default function ForgotPassword() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim().toLowerCase() });
      setStep('otp');
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError('No account found with that email address.');
      } else {
        setError('Unable to send OTP. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/verify-otp', {
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
      });
      setStep('newPassword');
    } catch (err: any) {
      if (err.response?.status === 400) {
        setError('Invalid or expired OTP. Please check the code and try again.');
      } else {
        setError('Verification failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    const trimmed = newPassword.trim();
    if (trimmed.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!/[A-Z]/.test(trimmed)) {
      setError('Password must include at least one uppercase letter.');
      return;
    }
    if (!/[a-z]/.test(trimmed)) {
      setError('Password must include at least one lowercase letter.');
      return;
    }
    if (!/\d/.test(trimmed)) {
      setError('Password must include at least one number.');
      return;
    }
    if (!/[^A-Za-z0-9]/.test(trimmed)) {
      setError('Password must include at least one special character.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', {
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
        newPassword,
      });
      setStep('done');
    } catch (err: any) {
      if (err.response?.status === 400) {
        setError('Invalid or expired OTP. Please request a new one.');
      } else {
        setError('Password reset failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-darker p-6">
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-brand-blueAccent/20 blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full bg-brand-gold/10 blur-3xl" />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-6">
          <Link to="/login" className="inline-flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back to Sign In
          </Link>
        </div>

        <div className="bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl shadow-black/40">
          <div className="w-12 h-12 rounded-2xl bg-brand-gold flex items-center justify-center mb-5 shadow-lg shadow-brand-gold/20">
            <Truck size={22} className="text-brand-blueAccent" strokeWidth={2.5} />
          </div>

          {step === 'done' ? (
            <div className="text-center">
              <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
              <h2 className="text-2xl font-black text-white mb-2">Password Reset!</h2>
              <p className="text-white/60 mb-6">Your password has been successfully updated.</p>
              <Link
                to="/login"
                className="w-full inline-block bg-brand-gold hover:bg-brand-goldHover text-brand-blueAccent font-black py-3.5 rounded-xl text-base text-center transition-all"
              >
                Sign In
              </Link>
            </div>
          ) : step === 'email' ? (
            <>
              <h2 className="text-2xl font-black text-white mb-1">Forgot Password</h2>
              <p className="text-white/50 text-sm mb-8">Enter your email and we'll send you a reset code.</p>

              {error && (
                <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-400/20 rounded-xl p-4 mb-5">
                  <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}

              <form onSubmit={handleRequestOtp} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-white/70 mb-2">
                    Email Address <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      id="forgot-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@welinc.com"
                      required
                      className="w-full pl-11 pr-4 py-3 text-base bg-white/[0.06] border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold/50 transition-all"
                    />
                  </div>
                </div>
                <button
                  id="forgot-submit"
                  type="submit"
                  disabled={loading}
                  className="w-full bg-brand-gold hover:bg-brand-goldHover text-brand-blueAccent font-black py-3.5 rounded-xl text-base transition-all cursor-pointer disabled:opacity-60"
                >
                  {loading ? 'Sending OTP...' : 'Send Reset Code'}
                </button>
              </form>
            </>
          ) : step === 'otp' ? (
            <>
              <h2 className="text-2xl font-black text-white mb-1">Enter Reset Code</h2>
              <p className="text-white/50 text-sm mb-2">
                A 6-digit code was sent to <span className="text-brand-gold">{email}</span>.
              </p>
              <button
                type="button"
                onClick={() => { setStep('email'); setError(''); setOtp(''); }}
                className="text-xs text-white/40 hover:text-white/70 transition-colors mb-6"
              >
                Wrong email? Go back
              </button>

              {error && (
                <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-400/20 rounded-xl p-4 mb-5">
                  <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}

              <form onSubmit={handleVerifyOtp} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-white/70 mb-2">
                    OTP Code <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="forgot-otp"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    required
                    className="w-full px-4 py-3 text-base tracking-widest text-center bg-white/[0.06] border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold/50 transition-all"
                  />
                </div>
                <button
                  id="forgot-verify-submit"
                  type="submit"
                  disabled={loading}
                  className="w-full bg-brand-gold hover:bg-brand-goldHover text-brand-blueAccent font-black py-3.5 rounded-xl text-base transition-all cursor-pointer disabled:opacity-60"
                >
                  {loading ? 'Verifying...' : 'Verify Code'}
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-black text-white mb-1">Set New Password</h2>
              <p className="text-white/50 text-sm mb-6">
                Choose a new secure password for <span className="text-brand-gold">{email}</span>.
              </p>

              {error && (
                <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-400/20 rounded-xl p-4 mb-5">
                  <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}

              <form onSubmit={handleVerifyAndReset} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-white/70 mb-2">
                    New Password <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="forgot-new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      required
                      minLength={8}
                      className="w-full pl-4 pr-12 py-3 text-base bg-white/[0.06] border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold/50 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 cursor-pointer transition-colors"
                    >
                      {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-white/40 mt-1.5 leading-normal">
                    Password must be at least 8 characters and contain at least one uppercase letter, one lowercase letter, one number, and one special character.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-white/70 mb-2">
                    Confirm Password <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="forgot-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat new password"
                      required
                      className="w-full pl-4 pr-12 py-3 text-base bg-white/[0.06] border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold/50 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 cursor-pointer transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <button
                  id="forgot-reset-submit"
                  type="submit"
                  disabled={loading}
                  className="w-full bg-brand-gold hover:bg-brand-goldHover text-brand-blueAccent font-black py-3.5 rounded-xl text-base transition-all cursor-pointer disabled:opacity-60"
                >
                  {loading ? 'Resetting...' : 'Reset Password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
