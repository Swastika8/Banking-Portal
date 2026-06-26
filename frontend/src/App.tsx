import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { TourProvider } from './context/TourContext';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ForgotReset } from './pages/ForgotReset';
import { Dashboard } from './pages/Dashboard';
import { Reports } from './pages/Reports';
import { Masters } from './pages/Masters';
import { Shell } from './components/Shell';
import { Customers } from './pages/Customers';

// Route protection guard
const RequireAuth: React.FC<{ children: React.ReactNode; permission?: string }> = ({
  children,
  permission,
}) => {
  const { token, loading, hasPermission } = useApp();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-navy dark:bg-black text-brand-gold font-bold">
        SYNCHRONIZING SECURE SESSION...
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (permission && !hasPermission(permission)) {
    return <Navigate to="/" replace />;
  }

  return <Shell>{children}</Shell>;
};

const AppContent: React.FC = () => {
  return (
    <Routes>
      {/* Public Pages */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotReset mode="forgot" />} />
      <Route path="/reset-password" element={<ForgotReset mode="reset" />} />

      {/* Secured Pages */}
      <Route
        path="/"
        element={
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/customers"
        element={
          <RequireAuth permission="Customer View">
            <Customers />
          </RequireAuth>
        }
      />
      <Route
        path="/reports"
        element={
          <RequireAuth permission="Report View">
            <Reports />
          </RequireAuth>
        }
      />
      <Route
        path="/masters"
        element={
          <RequireAuth permission="Settings View">
            <Masters />
          </RequireAuth>
        }
      />


      {/* Redirect all unmatched routes */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <AppProvider>
      <TourProvider>
        <AppContent />
      </TourProvider>
    </AppProvider>
  );
}

export default App;
