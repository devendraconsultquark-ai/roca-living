import React, { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LandlordLayout } from "./components/Layout/LandlordLayout";
import { ToastProvider } from "./components/UI/ToastContext";
import { ConfirmProvider } from "./components/UI/ConfirmContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import { PublicLayout } from "./components/Layout/PublicLayout";
import { PropertyProvider } from "./context/PropertyContext";
import ScrollToTop from "./components/ScrollToTop";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { LoadingSkeleton } from "./components/UI/LoadingSkeleton";

// Lazy load public website pages
const Home = lazy(() => import("./pages/Home"));
const AboutUs = lazy(() => import("./pages/AboutUs"));
const Contact = lazy(() => import("./pages/Contact"));
const OurServices = lazy(() => import("./pages/OurServices"));
const Faq = lazy(() => import("./pages/Faq"));
const Disclaimer = lazy(() => import("./pages/Disclaimer"));
const PrivacyNotice = lazy(() => import("./pages/PrivacyNotice"));
const TermsConditions = lazy(() => import("./pages/TermsConditions"));

// Lazy load auth & portal pages (named exports)
const LoginPage = lazy(() =>
  import("./pages/LoginPage").then((m) => ({ default: m.LoginPage })),
);
const SignupPage = lazy(() =>
  import("./pages/SignupPage").then((m) => ({ default: m.SignupPage })),
);
const ForgotPasswordPage = lazy(() =>
  import("./pages/ForgotPasswordPage").then((m) => ({
    default: m.ForgotPasswordPage,
  })),
);
const ResetPasswordPage = lazy(() =>
  import("./pages/ResetPasswordPage").then((m) => ({
    default: m.ResetPasswordPage,
  })),
);

const Dashboard = lazy(() =>
  import("./pages/Dashboard").then((m) => ({ default: m.Dashboard })),
);
const Properties = lazy(() =>
  import("./pages/Properties").then((m) => ({ default: m.Properties })),
);
const Statements = lazy(() =>
  import("./pages/Statements").then((m) => ({ default: m.Statements })),
);
const Documents = lazy(() =>
  import("./pages/Documents").then((m) => ({ default: m.Documents })),
);
const Inspections = lazy(() =>
  import("./pages/Inspections").then((m) => ({ default: m.Inspections })),
);
const Maintenance = lazy(() =>
  import("./pages/Maintenance").then((m) => ({ default: m.Maintenance })),
);
const Profile = lazy(() =>
  import("./pages/Profile").then((m) => ({ default: m.Profile })),
);
const Utilities = lazy(() =>
  import("./pages/Utilities").then((m) => ({ default: m.Utilities })),
);
const ComplianceOverview = lazy(() =>
  import("./pages/ComplianceOverview").then((m) => ({
    default: m.ComplianceOverview,
  })),
);
const Certificates = lazy(() =>
  import("./pages/Certificates").then((m) => ({ default: m.Certificates })),
);
const PropertyDetails = lazy(() =>
  import("./pages/PropertyDetails").then((m) => ({
    default: m.PropertyDetails,
  })),
);
const Financials = lazy(() =>
  import("./pages/Financials").then((m) => ({ default: m.Financials })),
);
const ComingSoon = lazy(() =>
  import("./pages/ComingSoon").then((m) => ({ default: m.ComingSoon })),
);
const TenancyLifecycle = lazy(() =>
  import("./pages/TenancyLifecycle").then((m) => ({
    default: m.TenancyLifecycle,
  })),
);
const Support = lazy(() =>
  import("./pages/Support").then((m) => ({ default: m.Support })),
);

// Wildcard 404 handler
const NotFound = () => (
  <div className="p-12 text-center card-bg rounded-lg border border-border-color">
    <h2 className="text-2xl font-bold text-status-danger mb-2">
      404 - Page Not Found
    </h2>
    <p className="text-gray-500 mb-4">
      The page you are looking for does not exist.
    </p>
    <a
      href="/dashboard"
      className="text-brand-accent hover:underline font-semibold"
    >
      Return Dashboard
    </a>
  </div>
);

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <ConfirmProvider>
          <BrowserRouter>
            <ScrollToTop />
            <AuthProvider>
              <Suspense fallback={<LoadingSkeleton lines={6} />}>
                <Routes>
                  {/* Public Layout wrapper for website pages */}
                  <Route element={<PublicLayout />}>
                    <Route path="/" element={<Home />} />
                    <Route path="/about-us" element={<AboutUs />} />
                    <Route path="/contact" element={<Contact />} />
                    <Route path="/services" element={<OurServices />} />
                    <Route path="/disclaimer" element={<Disclaimer />} />
                    <Route path="/faq" element={<Faq />} />
                    <Route path="/privacy" element={<PrivacyNotice />} />
                    <Route
                      path="/terms-and-conditions"
                      element={<TermsConditions />}
                    />
                  </Route>

                  {/* Public login route */}
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/signup" element={<SignupPage />} />
                  <Route
                    path="/forgot-password"
                    element={<ForgotPasswordPage />}
                  />
                  <Route
                    path="/reset-password"
                    element={<ResetPasswordPage />}
                  />

                  {/* Wrap all landlord routes inside our shared layout, protected by LANDLORD validation */}
                  <Route
                    element={
                      <ProtectedRoute>
                        <PropertyProvider>
                          <LandlordLayout />
                        </PropertyProvider>
                      </ProtectedRoute>
                    }
                  >
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/properties" element={<Properties />} />
                    <Route
                      path="/properties/:id"
                      element={<PropertyDetails />}
                    />
                    <Route path="/financials" element={<Financials />} />
                    <Route path="/statements" element={<Statements />} />
                    <Route
                      path="/compliance/overview"
                      element={<ComplianceOverview />}
                    />
                    <Route
                      path="/compliance/tenant"
                      element={<ComingSoon title="Tenant Compliance" />}
                    />
                    <Route
                      path="/compliance/landlord"
                      element={<ComingSoon title="Landlord Compliance" />}
                    />
                    <Route
                      path="/compliance/certificates"
                      element={<Certificates />}
                    />
                    <Route
                      path="/compliance/inspections"
                      element={<Inspections />}
                    />
                    <Route path="/maintenance" element={<Maintenance />} />
                    <Route path="/tenancy" element={<TenancyLifecycle />} />
                    <Route
                      path="/utilities"
                      element={<Utilities />}
                    />
                    <Route path="/documents" element={<Documents />} />
                    <Route path="/support" element={<Support />} />
                    <Route path="/profile" element={<Profile />} />
                  </Route>

                  {/* Catch-all Route */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </AuthProvider>
          </BrowserRouter>
        </ConfirmProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
