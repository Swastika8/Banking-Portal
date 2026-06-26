import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useTour } from '../context/TourContext';
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
  HelpCircle,
  RefreshCw,
} from 'lucide-react';

export const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout, theme, toggleTheme, hasPermission } = useApp();
  const { startTour, restartTour } = useTour();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showHelpPopover, setShowHelpPopover] = useState(false);

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
              <span className="font-bold text-sm tracking-wider uppercase block text-brand-navy dark:text-white truncate">
                Luxury Bank
              </span>
              <span className="text-[10px] text-brand-gold font-bold tracking-widest block uppercase">
                LMS Platform
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
            {!isCollapsed && <span className="transition-opacity duration-300">Workspace Dashboard</span>}
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
              {!isCollapsed && <span className="transition-opacity duration-300">Customers</span>}
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
              {!isCollapsed && <span className="transition-opacity duration-300">Reports Manager</span>}
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
              {!isCollapsed && <span className="transition-opacity duration-300">Masters & Settings</span>}
            </NavLink>
          )}
        </nav>

        {/* Spacer — pushes footer controls to absolute bottom */}
        <div className="flex-1" />

        {/* Sidebar Footer Controls */}
        <div className="p-4 border-t border-gray-100 dark:border-brand-matte-border space-y-2 flex-shrink-0">
          {/* Theme Toggler */}
          <button
            onClick={toggleTheme}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-gray-500 dark:text-brand-matte-text hover:bg-gray-50 dark:hover:bg-black hover:text-brand-navy dark:hover:text-white transition-all text-left ${isCollapsed ? 'justify-center px-2' : ''}`}
          >
            <div className="flex-shrink-0">
              {theme === 'dark' ? <Sun size={18} className="text-brand-gold" /> : <Moon size={18} />}
            </div>
            {!isCollapsed && <span className="transition-opacity duration-300">{theme === 'dark' ? 'Light Theme' : 'Dark Theme'}</span>}
          </button>

          {/* Logout Button */}
          <button
            onClick={logout}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-red-500 hover:bg-red-500/10 transition-all text-left font-semibold ${isCollapsed ? 'justify-center px-2' : ''}`}
          >
            <LogOut size={18} className="flex-shrink-0" />
            {!isCollapsed && <span className="transition-opacity duration-300">Sign Out</span>}
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
                <><span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />Synced</>
              )}
              {syncStatus === 'pending' && (
                <><span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />Pending ({pendingCount})</>
              )}
              {syncStatus === 'syncing' && (
                <><RefreshCw size={10} className="animate-spin flex-shrink-0" />Syncing...</>
              )}
            </button>

            <div className="h-4 w-px bg-gray-200 dark:bg-brand-matte-border" />

            {/* ── Market Connectivity Indicator ── */}
            {connectivityStatus === 'live' && (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
                <span>LMS Connected <span className="text-green-500">· Live Rates</span></span>
              </span>
            )}
            {connectivityStatus === 'cached' && (
              <span className="flex items-center gap-1.5" title={`Last live sync: ${lastSuccessfulSync?.toLocaleString() || 'unknown'}`}>
                <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                <span>LMS Connected <span className="text-amber-400">· Cached Rates</span></span>
              </span>
            )}
            {connectivityStatus === 'backend_offline' && (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                <span className="text-red-500">Backend Offline</span>
              </span>
            )}
            {connectivityStatus === 'loading' && (
              <span className="flex items-center gap-1.5">
                <RefreshCw size={10} className="animate-spin text-gray-400 flex-shrink-0" />
                <span>Connecting...</span>
              </span>
            )}

            <div className="h-4 w-px bg-gray-200 dark:bg-brand-matte-border" />
            <span>Timezone: <span className="font-bold">IST</span></span>
          </div>
        </header>

        {/* Content area — overflow-x-hidden prevents white gap */}
        <div className="flex-1 p-6 overflow-x-hidden w-full">
          {children}
        </div>
      </main>

      {/* Global Help Floating Button & Popover */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
        {showHelpPopover && (
          <div className="mb-3 bg-[#121212] border border-[#C5A880] rounded-xl p-3 shadow-[0_10px_30px_rgba(0,0,0,0.8),0_0_15px_rgba(197,168,128,0.1)] text-white w-52 flex flex-col gap-1.5 animate-fade-in z-50">
            <div className="text-[9px] uppercase font-bold text-[#C5A880] tracking-widest pb-1.5 border-b border-[#C5A880]/20 mb-1">
              LMS Help Desk
            </div>
            <button
              onClick={() => {
                startTour();
                setShowHelpPopover(false);
              }}
              className="w-full text-left py-1.5 px-2 hover:bg-[#C5A880]/10 text-[11px] font-semibold rounded-lg text-gray-200 hover:text-white transition-all"
            >
              🚀 Start/Resume Tour
            </button>
            <button
              onClick={() => {
                restartTour();
                setShowHelpPopover(false);
              }}
              className="w-full text-left py-1.5 px-2 hover:bg-[#C5A880]/10 text-[11px] font-semibold rounded-lg text-gray-200 hover:text-white transition-all"
            >
              🔄 Restart Walkthrough
            </button>
            <button
              onClick={() => setShowHelpPopover(false)}
              className="w-full text-center py-1 bg-brand-navy border border-gray-700 hover:border-gray-500 text-[9px] font-bold rounded-lg text-gray-400 hover:text-white transition-all mt-1"
            >
              Close
            </button>
          </div>
        )}
        <button
          onClick={() => setShowHelpPopover(!showHelpPopover)}
          className="w-14 h-14 bg-[#C5A880] text-[#060F24] shadow-[0_6px_24px_rgba(197,168,128,0.4),0_0_10px_rgba(197,168,128,0.2)] border border-[#C5A880]/30 hover:bg-[#DCC39E] hover:scale-105 active:scale-95 rounded-full flex items-center justify-center transition-all cursor-pointer"
          title="LMS Interactive Help & Onboarding Tour"
        >
          <HelpCircle size={28} />
        </button>
      </div>
    </div>
  );
};
