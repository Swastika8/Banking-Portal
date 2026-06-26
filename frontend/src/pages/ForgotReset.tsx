import React, { useState, useRef } from 'react';
import api from '../utils/api';
import { useNavigate, Link } from 'react-router-dom';
import { Sun, Moon, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';

type Step = 'email' | 'otp' | 'reset';

export const ForgotReset: React.FC<{ mode: 'forgot' | 'reset' }> = ({ mode }) => {
  const { theme, toggleTheme } = useApp();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>(mode === 'reset' ? 'reset' : 'email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const clearMessages = () => { setError(''); setMessage(''); };

  /* ── Step 1: Send OTP ── */
  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setStep('otp');
      setMessage('OTP sent! Check your inbox (and spam folder).');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  /* ── OTP input box handler ── */
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // digits only
    const updated = [...otp];
    updated[index] = value.slice(-1); // one digit per box
    setOtp(updated);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(''));
      otpRefs.current[5]?.focus();
    }
    e.preventDefault();
  };

  /* ── Step 2: Verify OTP ── */
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    const otpString = otp.join('');
    if (otpString.length < 6) { setError('Please enter the complete 6-digit OTP.'); return; }
    setLoading(true);
    try {
      const res = await api.post('/auth/verify-otp', { email, otp: otpString });
      setResetToken(res.data.resetToken);
      setStep('reset');
      setMessage('OTP verified! Set your new password below.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid or expired OTP.');
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  /* ── Step 3: Reset Password ── */
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token: resetToken, newPassword: password });
      setMessage('Password reset successfully! Redirecting to login...');
      setTimeout(() => navigate('/login'), 2500);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Step labels ── */
  const stepTitle  = { email: 'PASSWORD RECOVERY', otp: 'VERIFY OTP',    reset: 'SET NEW PASSWORD' };
  const stepSub    = { email: 'Enter your registered email to receive an OTP', otp: `Enter the 6-digit OTP sent to ${email}`, reset: 'Choose a strong new password' };
  const stepIcon   = { email: <Mail size={32} />, otp: <ShieldCheck size={32} />, reset: <Lock size={32} /> };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-navy dark:bg-black p-4 relative overflow-hidden transition-colors duration-300">
      <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-brand-gold/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-brand-gold/10 blur-3xl pointer-events-none" />

      <button
        onClick={toggleTheme}
        className="absolute top-6 right-6 p-2 rounded-full border border-brand-gold/30 hover:border-brand-gold text-brand-gold transition-all"
      >
        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      <div className="w-full max-w-md bg-white dark:bg-brand-matte-card border border-gray-200 dark:border-brand-matte-border p-8 rounded-2xl shadow-2xl transition-all duration-300">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-full bg-brand-gold/10 text-brand-gold mb-3">
            {stepIcon[step]}
          </div>
          <h1 className="text-2xl font-bold font-display text-brand-navy dark:text-white">
            {stepTitle[step]}
          </h1>
          <p className="text-sm text-gray-500 dark:text-brand-matte-text mt-1">
            {stepSub[step]}
          </p>
        </div>

        {/* Step progress dots */}
        <div className="flex justify-center gap-2 mb-6">
          {(['email', 'otp', 'reset'] as Step[]).map((s, i) => (
            <div key={s} className={`h-1.5 rounded-full transition-all duration-300 ${
              step === s ? 'w-8 bg-brand-gold' :
              (['email','otp','reset'].indexOf(step) > i) ? 'w-4 bg-brand-gold/50' :
              'w-4 bg-gray-300 dark:bg-brand-matte-border'
            }`} />
          ))}
        </div>

        {/* Messages */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-500 text-sm p-3 rounded-lg mb-4 text-center">
            {error}
          </div>
        )}
        {message && (
          <div className="bg-green-500/10 border border-green-500/30 text-green-600 dark:text-green-400 text-sm p-3 rounded-lg mb-4 text-center">
            {message}
          </div>
        )}

        {/* ── Step 1: Email ── */}
        {step === 'email' && (
          <form onSubmit={handleSendOTP} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-brand-navy/70 dark:text-brand-matte-text mb-2">
                Registered Email
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                  <Mail size={18} />
                </span>
                <input
                  type="email" required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-brand-navy dark:text-white rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-gold focus:border-brand-gold transition-all"
                />
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-brand-gold-dark to-brand-gold hover:from-brand-gold hover:to-brand-gold-light text-brand-navy font-bold rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5 disabled:opacity-50">
              {loading ? 'SENDING OTP...' : 'SEND OTP'}
            </button>
          </form>
        )}

        {/* ── Step 2: OTP ── */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOTP} className="space-y-6">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-brand-navy/70 dark:text-brand-matte-text mb-4 text-center">
                Enter 6-Digit OTP
              </label>
              <div className="flex justify-center gap-3" onPaste={handleOtpPaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { otpRefs.current[i] = el; }}
                    type="text" inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className="w-11 h-13 text-center text-xl font-bold bg-gray-50 dark:bg-black border-2 border-gray-200 dark:border-brand-matte-border text-brand-navy dark:text-white rounded-xl focus:outline-none focus:border-brand-gold transition-all"
                    style={{ height: '52px' }}
                  />
                ))}
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-brand-gold-dark to-brand-gold hover:from-brand-gold hover:to-brand-gold-light text-brand-navy font-bold rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5 disabled:opacity-50">
              {loading ? 'VERIFYING...' : 'VERIFY OTP'}
            </button>
            <button type="button"
              onClick={() => { clearMessages(); handleSendOTP({ preventDefault: () => {} } as any); }}
              className="w-full text-sm text-brand-gold hover:underline text-center">
              Resend OTP
            </button>
          </form>
        )}

        {/* ── Step 3: New Password ── */}
        {step === 'reset' && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-brand-navy/70 dark:text-brand-matte-text mb-1">
                New Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400"><Lock size={18} /></span>
                <input type="password" required
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-brand-navy dark:text-white rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-gold focus:border-brand-gold transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-brand-navy/70 dark:text-brand-matte-text mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400"><Lock size={18} /></span>
                <input type="password" required
                  value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-brand-navy dark:text-white rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-gold focus:border-brand-gold transition-all"
                />
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-brand-gold-dark to-brand-gold hover:from-brand-gold hover:to-brand-gold-light text-brand-navy font-bold rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5 disabled:opacity-50 mt-2">
              {loading ? 'RESETTING...' : 'RESET PASSWORD'}
            </button>
          </form>
        )}

        <div className="mt-6 pt-4 border-t border-gray-100 dark:border-brand-matte-border text-center">
          <Link to="/login" className="text-sm text-brand-gold hover:text-brand-gold-light hover:underline font-bold transition-all">
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};