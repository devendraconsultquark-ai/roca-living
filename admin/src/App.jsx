import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AdminLayout } from './components/Layout/AdminLayout';
import { ToastProvider } from './components/UI/ToastContext';
import { LoginPage } from './pages/LoginPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { OnboardingWizard } from './pages/OnboardingWizard';
import { MaintenanceBoard } from './pages/MaintenanceBoard';
import { DocumentLibrary } from './pages/DocumentLibrary';
import { AccountingHub } from './pages/AccountingHub';

// Extracted Page Imports
import { Dashboard } from './pages/Dashboard';
import { Landlords } from './pages/Landlords';
import { Properties } from './pages/Properties';
import { Tenancies } from './pages/Tenancies';
import { Tenants } from './pages/Tenants';
import { Agents } from './pages/Agents';
import { Statements } from './pages/Statements';
import { Contractors } from './pages/Contractors';
import { Deposits } from './pages/Deposits';
import { Utilities } from './pages/Utilities';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { Profile } from './pages/Profile';

// Wildcard 404 handler to prevent blank pages (P6-8 recommendation)
const NotFound = () => (
  <div className="p-12 text-center bg-white rounded-lg border border-border-color">
    <h2 className="text-2xl font-bold text-status-danger mb-2">404 - Page Not Found</h2>
    <p className="text-gray-500 mb-4">The page you are looking for does not exist.</p>
    <a href="/" className="text-brand-accent hover:underline font-semibold">Return Dashboard</a>
  </div>
);

function App() {
  return (
    <ToastProvider>
      <BrowserRouter basename="/roca-living-2/admin">
        <Routes>
          {/* Public login route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Redirect base URL / to /dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Wrap all administrative routes inside our shared layout, protected by ADMIN validation */}
          <Route element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
            <Route path="/onboarding" element={<OnboardingWizard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/landlords" element={<Landlords />} />
            <Route path="/properties" element={<Properties />} />
            <Route path="/tenancies" element={<Tenancies />} />
            <Route path="/tenants" element={<Tenants />} />
            <Route path="/agents" element={<Agents />} />
            <Route path="/accounting" element={<AccountingHub />} />
            <Route path="/statements" element={<Statements />} />
            <Route path="/maintenance" element={<MaintenanceBoard />} />
            <Route path="/contractors" element={<Contractors />} />
            <Route path="/deposits" element={<Deposits />} />
            <Route path="/utilities" element={<Utilities />} />
            <Route path="/documents" element={<DocumentLibrary />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/profile" element={<Profile />} />
          </Route>

          {/* Catch-all Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;