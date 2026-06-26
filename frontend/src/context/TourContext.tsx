import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from './AppContext';
import Joyride, { Step, CallBackProps, STATUS } from 'react-joyride';

interface TourContextType {
  runTour: boolean;
  stepIndex: number;
  steps: Step[];
  startTour: () => void;
  restartTour: () => void;
  stopTour: () => void;
  setStepIndex: (index: number) => void;
  dashboardHasWorkspace: boolean;
  setDashboardHasWorkspace: (val: boolean) => void;
  triggerSelectFirstCustomer: boolean;
  setTriggerSelectFirstCustomer: (val: boolean) => void;
  isTourCompletedOnCurrentPage: boolean;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

// ── CUSTOM LUXURY THEME TOOLTIP COMPONENT ──────────────────────
interface TooltipProps {
  continuous: boolean;
  index: number;
  step: Step;
  backProps: any;
  closeProps: any;
  primaryProps: any;
  skipProps: any;
  tooltipProps: any;
  isLastStep: boolean;
  size: number;
}

const LuxuryTooltip: React.FC<TooltipProps> = ({
  index,
  step,
  backProps,
  primaryProps,
  skipProps,
  tooltipProps,
  isLastStep,
  size,
}) => {
  return (
    <div
      {...tooltipProps}
      className="max-w-md w-full bg-[#121212] border border-[#C5A880] rounded-2xl p-6 shadow-[0_12px_40px_rgba(0,0,0,0.8),0_0_15px_rgba(197,168,128,0.15)] text-white space-y-4"
    >
      {/* Header with Title & Step Count */}
      <div className="flex items-center justify-between border-b border-[#C5A880]/20 pb-3">
        <span className="text-[10px] uppercase font-bold tracking-widest text-[#C5A880]">
          Step {index + 1} of {size}
        </span>
        {step.title && (
          <h4 className="text-sm font-bold font-display text-[#C5A880] tracking-wide">
            {step.title}
          </h4>
        )}
      </div>

      {/* Content */}
      <div className="text-xs text-gray-300 leading-relaxed py-1">
        {step.content}
      </div>

      {/* Buttons */}
      <div className="flex items-center justify-between pt-3 border-t border-[#C5A880]/10 gap-3">
        {/* Skip button on the left */}
        {!isLastStep ? (
          <button
            {...skipProps}
            className="px-3 py-1.5 text-[11px] font-bold text-[#C5A880] bg-transparent border border-[#C5A880]/40 hover:border-[#C5A880] hover:bg-[#C5A880]/10 rounded-xl transition-all"
          >
            Skip
          </button>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-2">
          {/* Back button */}
          {index > 0 && (
            <button
              {...backProps}
              className="px-3 py-1.5 text-[11px] font-bold text-[#C5A880] bg-transparent border border-[#C5A880]/40 hover:border-[#C5A880] hover:bg-[#C5A880]/10 rounded-xl transition-all"
            >
              Previous
            </button>
          )}

          {/* Next / Finish button */}
          <button
            {...primaryProps}
            className="px-4 py-1.5 text-[11px] font-bold bg-[#C5A880] hover:bg-[#DCC39E] text-[#060F24] border border-[#C5A880] rounded-xl transition-all shadow-[0_4px_12px_rgba(197,168,128,0.2)]"
          >
            {isLastStep ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const TourProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, hasPermission } = useApp();
  const location = useLocation();
  const [runTour, setRunTour] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [dashboardHasWorkspace, setDashboardHasWorkspace] = useState(false);
  const [triggerSelectFirstCustomer, setTriggerSelectFirstCustomer] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);

  const routeKey = `lms_tour_completed_${location.pathname.replace(/\//g, 'root')}`;
  const isTourCompletedOnCurrentPage = localStorage.getItem(routeKey) === 'true';

  // Generate dynamic, permission-aware and role-aware steps
  useEffect(() => {
    const role = user?.role || 'Viewer';
    const currentSteps: Step[] = [];

    if (location.pathname === '/') {
      // ── DASHBOARD TOUR ───────────────────────────
      currentSteps.push({
        target: '#tour-search',
        title: 'Customer Search Workspace',
        content: role === 'Viewer'
          ? 'Search for customer profiles to view details and inspect ledgers in read-only mode.'
          : 'Search for customer profiles by ID, Name, or Mobile to open their interactive workspace.',
        placement: 'bottom',
        disableBeacon: true,
      });

      if (hasPermission('Customer Create')) {
        currentSteps.push({
          target: '#tour-add-customer',
          title: 'Register New Customers',
          content: 'Add a new customer profile into the directory, capturing demographics and basic KYC details.',
          placement: 'bottom',
          disableBeacon: true,
        });
      }

      currentSteps.push({
        target: '#tour-stats-active-loans',
        title: 'Active Approved Accounts',
        content: 'Shows the count of all loan accounts currently active and collecting interest across the institution.',
        placement: 'bottom',
        disableBeacon: true,
      });

      currentSteps.push({
        target: '#tour-stats-outstanding-principal',
        title: 'Outstanding Loan Balances',
        content: 'Tracks the total unpaid principal amount currently outstanding across all active accounts.',
        placement: 'bottom',
        disableBeacon: true,
      });

      currentSteps.push({
        target: '#tour-stats-interest-due',
        title: 'Outstanding Interest Accrued',
        content: 'Tracks total accrued interest waiting for collection, calculated in real-time by the LMS engine.',
        placement: 'bottom',
        disableBeacon: true,
      });

      currentSteps.push({
        target: '#tour-market-watch',
        title: 'Real-Time Market Watch',
        content: hasPermission('Settings View')
          ? 'Review live bullion rates. You have the access controls here to manually override rates if needed.'
          : 'Review live bullion rates. These determine maximum loan limits and collateral margins.',
        placement: 'left',
        disableBeacon: true,
      });

      if (!dashboardHasWorkspace) {
        currentSteps.push({
          target: '#tour-workspace-directory',
          title: 'Workspace Roster Directory',
          content: 'Select any customer row here to load their dedicated workspace, active accounts, note trails, and document vault.',
          placement: 'top',
          disableBeacon: true,
        });
      } else {
        currentSteps.push({
          target: '#tour-customer-card',
          title: 'Workspace Account Profile',
          content: 'Once a customer is selected, this card shows their demographic profile, address details, and active KYC verification markers.',
          placement: 'right',
          disableBeacon: true,
        });

        currentSteps.push({
          target: '#tour-loans-section',
          title: 'Credit Accounts & Approvals',
          content: role === 'Viewer'
            ? 'View current active and past credit accounts. Check interest rates, repayment status, and LTV margins.'
            : 'Create new credit plans for this client, or edit existing plans. Check status and LTV metrics.',
          placement: 'top',
          disableBeacon: true,
        });

        if (hasPermission('Loan Approve') || hasPermission('Loan Reject')) {
          currentSteps.push({
            target: '#tour-pending-approvals',
            title: 'Assess Pending Approvals',
            content: 'Review, approve, or reject pending loan requests directly. This section is restricted to managers and administrators.',
            placement: 'top',
            disableBeacon: true,
          });
        }

        if (hasPermission('Payment Create')) {
          currentSteps.push({
            target: '#tour-payments-tab',
            title: 'Post Repayments Ledger',
            content: 'Post standard repayments (EMI, prepayment) and apply allocation rules to waive or verify penalties.',
            placement: 'top',
            disableBeacon: true,
          });
        }

        currentSteps.push({
          target: '#tour-timeline-tab',
          title: 'Audit Logs Trail',
          content: 'Review chronological user action history logs to track back-office decisions and ledger audits.',
          placement: 'top',
          disableBeacon: true,
        });

        currentSteps.push({
          target: '#tour-notes-tab',
          title: 'Workspace Interactions Notes',
          content: role === 'Viewer'
            ? 'Review internal notes posted by credit officers regarding account status or verification details.'
            : 'Post client interaction logs, record verification calls, or note down credit observations.',
          placement: 'top',
          disableBeacon: true,
        });

        currentSteps.push({
          target: '#tour-documents-tab',
          title: 'KYC Document Vault',
          content: role === 'Viewer'
            ? 'Inspect verified documents, income proofs, and collateral photos.'
            : 'Securely upload verification files, income proofs, and collateral validation photos.',
          placement: 'top',
          disableBeacon: true,
        });
      }
    } else if (location.pathname === '/customers') {
      // ── CUSTOMERS TOUR ───────────────────────────
      currentSteps.push({
        target: '#tour-customers-search',
        title: 'Filter Search Directory',
        content: 'Filter the full client database instantly by typing an ID, Name, Mobile, or Email address.',
        placement: 'bottom',
        disableBeacon: true,
      });

      currentSteps.push({
        target: '#tour-customers-table',
        title: 'Customer Data Grid',
        content: 'Inspect summary information like KYC numbers, risk parameters (Low/Medium/High), occupation, and contact details.',
        placement: 'top',
        disableBeacon: true,
      });

      currentSteps.push({
        target: '#tour-customers-table',
        title: 'Drill Down to Workspace',
        content: 'Click on any customer row or the chevron icon on the right to navigate to the Dashboard with their profile pre-loaded.',
        placement: 'top',
        disableBeacon: true,
      });
    } else if (location.pathname === '/reports') {
      // ── REPORTS TOUR ─────────────────────────────
      currentSteps.push({
        target: '#tour-reports-filters',
        title: 'Report Filter Fields',
        content: 'Filter and segment loan transactions by category, status code, customer selection, outstanding ranges, and custom date brackets.',
        placement: 'top',
        disableBeacon: true,
      });

      currentSteps.push({
        target: '#tour-reports-stats',
        title: 'Portfolio Performance Metrics',
        content: 'Monitor aggregate disbursed funds, outstanding principal, accrued interest dues, and count of delinquent profiles.',
        placement: 'bottom',
        disableBeacon: true,
      });

      currentSteps.push({
        target: '#tour-reports-export',
        title: 'Auditable Document Exports',
        content: 'Export reports to CSV files or download printable PDF documents matching your filtered criteria.',
        placement: 'left',
        disableBeacon: true,
      });
    } else if (location.pathname === '/masters') {
      // ── MASTERS & SETTINGS TOUR ───────────────────
      currentSteps.push({
        target: '#tour-settings-tab',
        title: 'System-Wide Settings',
        content: 'Configure global behaviors, theme layouts, notifications, and scheduled rate updates.',
        placement: 'top',
        disableBeacon: true,
      });

      currentSteps.push({
        target: '#tour-loantypes-tab',
        title: 'Product Schemes Catalog',
        content: 'Maintain categories of credit products (Gold, Silver, Vehicle, etc.) including default interest configurations and appraisal values.',
        placement: 'top',
        disableBeacon: true,
      });

      currentSteps.push({
        target: '#tour-formulas-tab',
        title: 'Calculations & Formula Engine',
        content: 'Review and audit compound/simple interest logic equations, amortization rules, and penalty calculation constants.',
        placement: 'top',
        disableBeacon: true,
      });

      currentSteps.push({
        target: '#tour-rbac-tab',
        title: 'RBAC Permission Security',
        content: 'Manage access control list bindings. Determine which system roles (Admin, Manager, Staff, Viewer) are allowed to perform actions.',
        placement: 'top',
        disableBeacon: true,
      });

      currentSteps.push({
        target: '#tour-audits-tab',
        title: 'Global Compliance Audit Trail',
        content: 'Verify all updates, database overrides, and auth events for end-to-end transparency and accountability.',
        placement: 'top',
        disableBeacon: true,
      });

      currentSteps.push({
        target: '#tour-restore-tab',
        title: 'Data Archival & Recovery',
        content: 'Review and restore soft-deleted profiles or loan records. Available only to Admin officers.',
        placement: 'top',
        disableBeacon: true,
      });
    }

    setSteps(currentSteps);
  }, [location.pathname, user, hasPermission, dashboardHasWorkspace]);

  // Reset tour index when changing pages
  useEffect(() => {
    setRunTour(false);
    setStepIndex(0);
  }, [location.pathname]);

  const startTour = () => {
    // If on Dashboard and no workspace is open, trigger auto-selection
    if (location.pathname === '/' && !dashboardHasWorkspace) {
      setTriggerSelectFirstCustomer(true);
    }
    setStepIndex(0);
    setRunTour(true);
  };

  const restartTour = () => {
    if (location.pathname === '/' && !dashboardHasWorkspace) {
      setTriggerSelectFirstCustomer(true);
    }
    localStorage.removeItem(routeKey);
    setStepIndex(0);
    setRunTour(true);
  };

  const stopTour = () => {
    setRunTour(false);
    setStepIndex(0);
  };

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, type, index } = data;

    if (type === 'step:after') {
      setStepIndex(index + 1);
    }

    if (([STATUS.FINISHED, STATUS.SKIPPED] as string[]).includes(status)) {
      setRunTour(false);
      setStepIndex(0);
      localStorage.setItem(routeKey, 'true');
    }
  };

  return (
    <TourContext.Provider
      value={{
        runTour,
        stepIndex,
        steps,
        startTour,
        restartTour,
        stopTour,
        setStepIndex,
        dashboardHasWorkspace,
        setDashboardHasWorkspace,
        triggerSelectFirstCustomer,
        setTriggerSelectFirstCustomer,
        isTourCompletedOnCurrentPage,
      }}
    >
      {children}
      {steps.length > 0 && (
        <Joyride
          steps={steps}
          run={runTour}
          stepIndex={stepIndex}
          continuous={true}
          showSkipButton={true}
          showProgress={false}
          callback={handleJoyrideCallback}
          tooltipComponent={LuxuryTooltip as any}
          styles={{
            options: {
              zIndex: 10000,
            },
          }}
        />
      )}
    </TourContext.Provider>
  );
};

export const useTour = () => {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
};
