import React, { useState } from 'react';
import api from '../utils/api';
import { useApp } from '../context/AppContext';
import { useTranslation } from '../context/I18nContext';
import { Link } from 'react-router-dom';
import { Sun, Moon, Lock, Mail, Landmark } from 'lucide-react';

export const Login: React.FC = () => {
  const { login, theme, toggleTheme } = useApp();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/login', { email, password });
      login(res.data.accessToken, res.data.refreshToken, res.data.user);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
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

      {/* Login Card */}
      <div className="w-full max-w-md bg-white dark:bg-brand-matte-card border border-gray-200 dark:border-brand-matte-border p-8 rounded-2xl shadow-2xl transition-all duration-300">
        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-full bg-brand-gold/10 text-brand-gold mb-3">
            <Landmark size={32} />
          </div>
          <h1 className="text-2xl font-bold font-display text-brand-navy dark:text-white">
            {t('loginTitle')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-brand-matte-text mt-1">
            {t('loginSubtitle')}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-500 text-sm p-3 rounded-lg mb-6 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-brand-navy/70 dark:text-brand-matte-text mb-2">
              {t('emailLabel')}
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

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-brand-navy/70 dark:text-brand-matte-text mb-2">
              {t('passwordLabel')}
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
                className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-black border border-gray-200 dark:border-brand-matte-border text-brand-navy dark:text-white rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-gold focus:border-brand-gold transition-all"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs">
            <Link
              to="/forgot-password"
              className="text-brand-gold hover:text-brand-gold-light hover:underline font-medium transition-all"
            >
              {t('forgotPasswordLink')}
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-brand-gold-dark to-brand-gold hover:from-brand-gold hover:to-brand-gold-light text-brand-navy dark:text-brand-navy-dark font-bold rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
          >
            {loading ? 'AUTHENTICATING...' : t('signInBtn').toUpperCase()}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-100 dark:border-brand-matte-border text-center">
          <p className="text-sm text-gray-500 dark:text-brand-matte-text">
            {t('noAccountText')}{' '}
            <Link
              to="/register"
              className="text-brand-gold hover:text-brand-gold-light hover:underline font-bold transition-all"
            >
              {t('registerLink')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

