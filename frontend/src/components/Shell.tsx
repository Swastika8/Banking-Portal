import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useTranslation } from '../context/I18nContext';
import { Language } from '../locales/translations';
import { NavLink } from 'react-router-dom';
import { useMarketConnectivity } from '../utils/useMarketConnectivity';
import { useOfflineQueue } from '../utils/useOfflineQueue';
import {
  LayoutDashboard,
  BarChart3,
  Sliders,
  LogOut,
  Sun,
  Moon,
  Landmark,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Users,
  RefreshCw,
} from 'lucide-react';

export const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout, theme, toggleTheme, hasPermission } = useApp();
  const { t, language, setLanguage } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Live connectivity + sync status for header indicators
  const { connectivityStatus, lastSuccessfulSync } = useMarketConnectivity();
  const { syncStatus, pendingCount, flushQueue } = useOfflineQueue();

  return (
    <div className="min-h-screen w-full overflow-x-hidden flex bg-gray-50 dark:bg-black text-gray-900 dark:text-gray-100 transition-colors duration-200">

      {/* Sidebar Navigation — fixed, never scrolls with content */}
      <aside
        className={`h-screen fixed top-0 left-0 ${
          isCollapsed ? 'w-20' : 'w-64'
        } bg-white dark:bg-brand-matte-card border-r border-gray-200 dark:border-brand-matte-border flex flex-col transition-all duration-300 z-30`}
      >
        {/* Collapse toggle pinned to right edge */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute top-7 -right-3.5 w-7 h-7 bg-white dark:bg-brand-matte-card border border-gray-200 dark:border-brand-matte-border rounded-full flex items-center justify-center text-gray-500 dark:text-brand-matte-text hover:text-brand-gold cursor-pointer shadow-md z-40 transition-all duration-300"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </button>

        {/* Logo Header */}
        <div className={`p-6 border-b border-gray-100 dark:border-brand-matte-border flex items-center gap-3 flex-shrink-0 ${isCollapsed ? 'justify-center' : ''}`}>
          <div className="p-2 bg-brand-gold/10 text-brand-gold rounded-lg flex-shrink-0">
            <Landmark size={24} />
          </div>
          {!isCollapsed && (
            <div className="transition-opacity duration-300 min-w-0">
              <span className="font-bold text-xs tracking-wide leading-tight block text-brand-navy dark:text-white">
                {t('logoTitle')}
              </span>
              <span className="text-[10px] text-brand-gold font-bold tracking-widest block uppercase">
                {t('logoSubtitle')}
              </span>
            </div>
          )}
        </div>

        {/* User Status Details */}
        <div className={`p-4 mx-4 my-4 bg-gray-50 dark:bg-black border border-gray-100 dark:border-brand-matte-border rounded-xl flex items-center gap-3 flex-shrink-0 ${isCollapsed ? 'justify-center mx-2 px-2' : ''}`}>
          <div className="w-10 h-10 rounded-full bg-brand-gold flex items-center justify-center text-brand-navy font-bold text-sm flex-shrink-0">
            {user?.name.charAt(0)}
          </div>
          {!isCollapsed && (
            <div className="overflow-hidden transition-opacity duration-300 min-w-0">
              <span className="font-semibold text-xs block truncate text-brand-navy dark:text-white">
                {user?.name}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand-gold mt-0.5">
                <ShieldCheck size={10} />
                {user?.role}
              </span>
            </div>
          )}
        </div>

        {/* Menu Items */}
        <nav className="px-4 space-y-1 flex-shrink-0">
          <NavLink
            to="/"
            end
            id="tour-dashboard-link"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                isCollapsed ? 'justify-center px-2' : ''
              } ${
                isActive
                  ? 'bg-brand-gold/10 text-brand-gold border-l-4 border-brand-gold'
                  : 'text-gray-500 dark:text-brand-matte-text hover:bg-gray-50 dark:hover:bg-black hover:text-brand-navy dark:hover:text-white'
              }`
            }
          >
            <LayoutDashboard size={18} className="flex-shrink-0" />
            {!isCollapsed && <span className="transition-opacity duration-300">{t('dashboard')}</span>}
          </NavLink>

          {hasPermission('Customer View') && (
            <NavLink
              to="/customers"
              id="tour-customers-link"
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isCollapsed ? 'justify-center px-2' : ''
                } ${
                  isActive
                    ? 'bg-brand-gold/10 text-brand-gold border-l-4 border-brand-gold'
                    : 'text-gray-500 dark:text-brand-matte-text hover:bg-gray-50 dark:hover:bg-black hover:text-brand-navy dark:hover:text-white'
                }`
              }
            >
              <Users size={18} className="flex-shrink-0" />
              {!isCollapsed && <span className="transition-opacity duration-300">{t('customers')}</span>}
            </NavLink>
          )}  
          {hasPermission('Report View') && (
            <NavLink
              to="/reports"
              id="tour-reports-link"
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isCollapsed ? 'justify-center px-2' : ''
                } ${
                  isActive
                    ? 'bg-brand-gold/10 text-brand-gold border-l-4 border-brand-gold'
                    : 'text-gray-500 dark:text-brand-matte-text hover:bg-gray-50 dark:hover:bg-black hover:text-brand-navy dark:hover:text-white'
                }`
              }
            >
              <BarChart3 size={18} className="flex-shrink-0" />
              {!isCollapsed && <span className="transition-opacity duration-300">{t('reports')}</span>}
            </NavLink>
          )}

          {hasPermission('Settings View') && (
            <NavLink
              to="/masters"
              id="tour-masters-link"
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isCollapsed ? 'justify-center px-2' : ''
                } ${
                  isActive
                    ? 'bg-brand-gold/10 text-brand-gold border-l-4 border-brand-gold'
                    : 'text-gray-500 dark:text-brand-matte-text hover:bg-gray-50 dark:hover:bg-black hover:text-brand-navy dark:hover:text-white'
                }`
              }
            >
              <Sliders size={18} className="flex-shrink-0" />
              {!isCollapsed && <span className="transition-opacity duration-300">{t('masters')}</span>}
            </NavLink>
          )}
        </nav>

        {/* Spacer — pushes footer controls to absolute bottom */}
        <div className="flex-1" />

        {/* Sidebar Footer Controls */}
        <div className="p-4 border-t border-gray-100 dark:border-brand-matte-border space-y-3 flex-shrink-0">
          {/* Language Selector */}
          <div className={`flex flex-col gap-1 pb-1 ${isCollapsed ? 'items-center px-0' : 'px-2'}`}>
            {!isCollapsed && (
              <span className="text-[9px] text-gray-400 dark:text-brand-matte-text font-bold uppercase tracking-wider block">
                Language / भाषा
              </span>
            )}
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className={`bg-transparent text-xs text-gray-600 dark:text-white border border-gray-200 dark:border-brand-matte-border rounded-lg px-2 py-1.5 focus:outline-none focus:border-brand-gold ${isCollapsed ? 'w-12 text-[10px] px-1 text-center' : 'w-full'}`}
              title="Change Language"
            >
              <option value="en" className="bg-white dark:bg-brand-matte-card text-black dark:text-white">English</option>
              <option value="hi" className="bg-white dark:bg-brand-matte-card text-black dark:text-white">हिन्दी</option>
              <option value="mr" className="bg-white dark:bg-brand-matte-card text-black dark:text-white">मराठी</option>
            </select>
          </div>

          {/* Theme Toggler */}
          <button
            onClick={toggleTheme}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-gray-500 dark:text-brand-matte-text hover:bg-gray-50 dark:hover:bg-black hover:text-brand-navy dark:hover:text-white transition-all text-left ${isCollapsed ? 'justify-center px-2' : ''}`}
          >
            <div className="flex-shrink-0">
              {theme === 'dark' ? <Sun size={18} className="text-brand-gold" /> : <Moon size={18} />}
            </div>
            {!isCollapsed && <span className="transition-opacity duration-300">{theme === 'dark' ? t('lightTheme') : t('darkTheme')}</span>}
          </button>

          {/* Logout Button */}
          <button
            onClick={logout}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-red-500 hover:bg-red-500/10 transition-all text-left font-semibold ${isCollapsed ? 'justify-center px-2' : ''}`}
          >
            <LogOut size={18} className="flex-shrink-0" />
            {!isCollapsed && <span className="transition-opacity duration-300">{t('signOut')}</span>}
          </button>
        </div>
      </aside>

      {/* Invisible spacer that reserves room for the fixed sidebar */}
      <div
        className={`flex-shrink-0 transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'}`}
        aria-hidden="true"
      />

      {/* Main Workspace Frame */}
      <main className="flex-1 flex flex-col min-h-screen min-w-0 overflow-x-hidden relative">
        <header className="h-16 border-b border-gray-200 dark:border-brand-matte-border bg-white dark:bg-brand-matte-card flex items-center justify-end px-8 transition-colors duration-300 flex-shrink-0 sticky top-0 z-20">
          <div className="flex items-center gap-4 text-xs font-semibold text-gray-500 dark:text-brand-matte-text">

            {/* ── Sync Status Indicator ── */}
            <button
              onClick={() => syncStatus === 'pending' && flushQueue()}
              title={syncStatus === 'pending' ? `${pendingCount} offline change${pendingCount !== 1 ? 's' : ''} queued — click to sync now` : 'All changes synced'}
              className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-lg transition-all ${
                syncStatus === 'synced'
                  ? 'text-green-500 cursor-default'
                  : syncStatus === 'syncing'
                  ? 'text-blue-400 cursor-default'
                  : 'text-amber-400 hover:bg-amber-400/10 cursor-pointer'
              }`}
            >
              {syncStatus === 'synced' && (
                <><span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />{t('synced')}</>
              )}
              {syncStatus === 'pending' && (
                <><span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />{t('pending')} ({pendingCount})</>
              )}
              {syncStatus === 'syncing' && (
                <><RefreshCw size={10} className="animate-spin flex-shrink-0" />{t('syncing')}</>
              )}
            </button>

            <div className="h-4 w-px bg-gray-200 dark:bg-brand-matte-border" />

            {/* ── Market Connectivity Indicator ── */}
            {connectivityStatus === 'live' && (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
                <span>{t('connectedLive')}</span>
              </span>
            )}
            {connectivityStatus === 'cached' && (
              <span className="flex items-center gap-1.5" title={`Last live sync: ${lastSuccessfulSync?.toLocaleString() || 'unknown'}`}>
                <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                <span>{t('connectedCached')}</span>
              </span>
            )}
            {connectivityStatus === 'backend_offline' && (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                <span className="text-red-500">{t('backendOffline')}</span>
              </span>
            )}
            {connectivityStatus === 'loading' && (
              <span className="flex items-center gap-1.5">
                <RefreshCw size={10} className="animate-spin text-gray-400 flex-shrink-0" />
                <span>{t('connecting')}</span>
              </span>
            )}

            <div className="h-4 w-px bg-gray-200 dark:bg-brand-matte-border" />
            <span>{t('timezone')}: <span className="font-bold">{t('timezoneLabel')}</span></span>
          </div>
        </header>

        {/* Content area — overflow-x-hidden prevents white gap */}
        <div className="flex-1 p-6 overflow-x-hidden w-full">
          {children}
        </div>
      </main>
    </div>
  );
};
