import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LandlordLayout } from './components/Layout/LandlordLayout';
import { ToastProvider } from './components/UI/ToastContext';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { Dashboard } from './pages/Dashboard';
import { Statements } from './pages/Statements';
import { Maintenance } from './pages/Maintenance';
import { Profile } from './pages/Profile';

// Extracted Page Imports
import { Properties } from './pages/Properties';
import { Documents } from './pages/Documents';
import { Inspections } from './pages/Inspections';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';

// Wildcard 404 handler
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
      <BrowserRouter basename="/roca-living-2/client">
        <AuthProvider>
          <Routes>
            {/* Public login route */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Redirect base URL / to /dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            {/* Wrap all landlord routes inside our shared layout, protected by LANDLORD validation */}
            <Route element={<ProtectedRoute><LandlordLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/properties" element={<Properties />} />
              <Route path="/statements" element={<Statements />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/inspections" element={<Inspections />} />
              <Route path="/maintenance" element={<Maintenance />} />
              <Route path="/profile" element={<Profile />} />
            </Route>

            {/* Catch-all Route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;