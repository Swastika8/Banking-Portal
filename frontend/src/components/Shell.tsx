import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { NavLink } from 'react-router-dom';
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';
import {
  LayoutDashboard,
  BarChart3,
  Sliders,
  LogOut,
  Sun,
  Moon,
  Landmark,
  HelpCircle,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Users,
} from 'lucide-react';

export const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout, theme, toggleTheme, hasPermission } = useApp();
  const [runTour, setRunTour] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Joyride Guided Tour Steps
  const tourSteps: Step[] = [
    {
      target: '#tour-search',
      content: 'Start here! Search for customers by ID, Name, or Mobile Number. Select a customer to open their active workspace.',
      placement: 'bottom',
    },
    {
      target: '#tour-customer-card',
      content: 'Once selected, the Customer Workspace displays their KYC profiles, document logs, notes, and aggregate balances.',
      placement: 'right',
    },
    {
      target: '#tour-loans-section',
      content: 'Create new Gold/Silver/Vehicle loans with custom collateral and simple/compound interest calculations.',
      placement: 'top',
    },
    {
      target: '#tour-payment-section',
      content: 'Post loan repayments (EMI, interest, penalties) or run principal-only reductions (Option A/B recalculations).',
      placement: 'top',
    },
    {
      target: '#tour-reports-link',
      content: 'Inspect loan distribution statistics, filter accounts, and export results directly to PDF/Excel formats.',
      placement: 'right',
    },
    {
      target: '#tour-masters-link',
      content: 'System Administrators can configure global parameters, edit settings, manage masters, and link RBAC roles.',
      placement: 'right',
    },
  ];

  const handleTourCallback = (data: CallBackProps) => {
    const { status } = data;
    if (([STATUS.FINISHED, STATUS.SKIPPED] as string[]).includes(status)) {
      setRunTour(false);
    }
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden flex bg-gray-50 dark:bg-black text-gray-900 dark:text-gray-100 transition-colors duration-200">
      
      {/* React Joyride Guided Tour */}
      <Joyride
        steps={tourSteps}
        run={runTour}
        continuous={true}
        showSkipButton={true}
        showProgress={true}
        callback={handleTourCallback}
        styles={{
          options: {
            primaryColor: '#C5A880',
            backgroundColor: theme === 'dark' ? '#1C1C1E' : '#FFFFFF',
            textColor: theme === 'dark' ? '#FFFFFF' : '#333333',
            arrowColor: theme === 'dark' ? '#1C1C1E' : '#FFFFFF',
          },
        }}
      />

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
      <main className="flex-1 flex flex-col min-h-screen min-w-0 overflow-x-hidden">
        <header className="h-16 border-b border-gray-200 dark:border-brand-matte-border bg-white dark:bg-brand-matte-card flex items-center justify-end px-8 transition-colors duration-300 flex-shrink-0 sticky top-0 z-20">
          <div className="flex items-center gap-4 text-xs font-semibold text-gray-500 dark:text-brand-matte-text">
            <span>Server Sync Status: <span className="text-green-500 font-bold">Online</span></span>
            <div className="h-4 w-px bg-gray-200 dark:bg-brand-matte-border" />
            <span>Timezone: <span className="font-bold">IST</span></span>
          </div>
        </header>

        {/* Content area — overflow-x-hidden prevents white gap */}
        <div className="flex-1 p-6 overflow-x-hidden w-full">
          {children}
        </div>
      </main>

      {/* Floating Guided Tour Button */}
      <button
        onClick={() => setRunTour(true)}
        className="fixed bottom-6 right-6 p-4 rounded-full bg-gradient-to-r from-brand-gold-dark to-brand-gold hover:from-brand-gold hover:to-brand-gold-light text-brand-navy shadow-2xl transition-all transform hover:-translate-y-1 active:translate-y-0 z-50 flex items-center justify-center border-2 border-white dark:border-brand-matte-card"
        title="Start Guided Tour"
      >
        <HelpCircle size={24} />
      </button>
    </div>
  );
};
