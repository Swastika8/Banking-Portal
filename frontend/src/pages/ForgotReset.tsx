import React, { useState } from 'react';
import api from '../utils/api';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Sun, Moon, Lock, Mail, Landmark } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const ForgotReset: React.FC<{ mode: 'forgot' | 'reset' }> = ({ mode }) => {
  const { theme, toggleTheme } = useApp();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [devToken, setDevToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const token = searchParams.get('token') || '';

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setDevToken('');
    setLoading(true);

    try {
      const res = await api.post('/auth/forgot-password', { email });
      setMessage(res.data.message);
      if (res.data.resetToken) {
        setDevToken(res.data.resetToken);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error executing forgot password.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      await api.post('/auth/reset-password', {
        token,
        newPassword: password,
      });
      setMessage('Password reset successfully. You will be redirected to login shortly.');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid or expired reset token.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-navy dark:bg-black p-4 relative overflow-hidden transition-colors duration-300">
      {/* Decorative Gold Circles */}
      <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-brand-gold/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-brand-gold/10 blur-3xl pointer-events-none" />

      {/* Floating Theme Button */}
      <button
        onClick={toggleTheme}
        className="absolute top-6 right-6 p-2 rounded-full border border-brand-gold/30 hover:border-brand-gold text-brand-gold transition-all"
        aria-label="Toggle Theme"
      >
        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      {/* Recover Card */}
      <div className="w-full max-w-md bg-white dark:bg-brand-matte-card border border-gray-200 dark:border-brand-matte-border p-8 rounded-2xl shadow-2xl transition-all duration-300">
        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-full bg-brand-gold/10 text-brand-gold mb-3">
            <Landmark size={32} />
          </div>
          <h1 className="text-2xl font-bold font-display text-brand-navy dark:text-white">
            {mode === 'forgot' ? 'PASSWORD RECOVERY' : 'RESET PASSWORD'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-brand-matte-text mt-1">
            {mode === 'forgot'
              ? 'Request a secure verification reset token'
              : 'Enter your new workspace credentials'}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-500 text-sm p-3 rounded-lg mb-6 text-center">
            {error}
          </div>
        )}

        {message && (
          <div className="bg-green-500/10 border border-green-500/30 text-green-600 dark:text-green-400 text-sm p-3 rounded-lg mb-6 text-center">
            {message}
          </div>
        )}

        {devToken && (
          <div className="bg-brand-gold/10 border border-brand-gold/30 p-4 rounded-xl mb-6 text-xs text-brand-gold">
            <p className="font-bold mb-1">Dev/Simulated Recovery Link:</p>
            <p className="break-all font-mono select-all p-1.5 bg-black/30 rounded mb-2">
              http://localhost:5173/reset-password?token={devToken}
            </p>
            <Link
              to={`/reset-password?token=${devToken}`}
              className="inline-block px-3 py-1 bg-brand-gold text-brand-navy font-bold rounded hover:bg-brand-gold-light"
            >
              Go to Reset Form
            </Link>
          </div>
        )}

        {mode === 'forgot' ? (
          <form onSubmit={handleForgotSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-brand-navy/70 dark:text-brand-matte-text mb-2">
                Registered Email
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                  <Mail size={18} />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@lms.com"
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-brand-navy dark:text-white rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-gold focus:border-brand-gold transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-brand-gold-dark to-brand-gold hover:from-brand-gold hover:to-brand-gold-light text-brand-navy dark:text-brand-navy-dark font-bold rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
            >
              {loading ? 'GENERATING TOKEN...' : 'SEND RECOVERY LINK'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-brand-navy/70 dark:text-brand-matte-text mb-1">
                New Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                  <Lock size={18} />
                </span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-brand-navy dark:text-white rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-gold focus:border-brand-gold transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-brand-navy/70 dark:text-brand-matte-text mb-1">
                Confirm New Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                  <Lock size={18} />
                </span>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-brand-navy dark:text-white rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-gold focus:border-brand-gold transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !token}
              className="w-full py-3 bg-gradient-to-r from-brand-gold-dark to-brand-gold hover:from-brand-gold hover:to-brand-gold-light text-brand-navy dark:text-brand-navy-dark font-bold rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
            >
              {loading ? 'RESETTING PASSWORD...' : 'RESET PASSWORD'}
            </button>
          </form>
        )}

        <div className="mt-6 pt-4 border-t border-gray-100 dark:border-brand-matte-border text-center">
          <Link
            to="/login"
            className="text-sm text-brand-gold hover:text-brand-gold-light hover:underline font-bold transition-all"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};
