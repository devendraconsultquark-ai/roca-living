import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Input } from '../components/UI/Input';
import { Button } from '../components/UI/Button';

export const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login, isAuthenticated, user } = useAuth();

  useEffect(() => {
    if (isAuthenticated && user?.role === 'LANDLORD') {
      navigate('/dashboard');
    }
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setIsLoading(true);

    try {
      await login({ email, password });
    } catch (err) {
      console.error(err);
      
      const errorMessages = err.response?.data?.errors;
      
      if (Array.isArray(errorMessages) && errorMessages.length > 0) {
        const errorsMap = {};
        errorMessages.forEach((m) => {
          errorsMap[m.field] = m.message;
        });
        setFieldErrors(errorsMap);
      } else {
        const errorMessage = err.response?.data?.message || 'Login failed. Please check your credentials.';
        setError(errorMessage);
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 py-16 px-4 font-sans">
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[580px]">

        {/* ── Left – Login Form ─────────────────────────────── */}
        <div className="w-full md:w-1/2 p-8 sm:p-12 flex flex-col justify-center text-left">
          <div className="mb-8">
            <Link to="/">
              <img 
                src={`${import.meta.env.BASE_URL}images/logo-black.png`} 
                alt="ROCA Living" 
                className="h-8 mb-6 object-contain cursor-pointer" 
              />
            </Link>
            <h1 className="text-3xl font-light text-slate-900 mb-1">Welcome Back</h1>
            <p className="text-slate-500 text-sm">Sign in to manage your tenancy</p>
          </div>

          {error && (
            <div className="p-3 bg-status-danger/10 border border-status-danger/20 rounded-lg text-status-danger text-xs font-semibold mb-5">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <Input
              label="Email Address"
              id="email"
              type="email"
              value={email}
              error={fieldErrors.email}
              onChange={e => {
                setEmail(e.target.value);
                if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: '' }));
              }}
              placeholder="name@example.com"
              required
            />

            {/* Password */}
            <div className="flex flex-col w-full">
              <div className="flex justify-between items-end mb-1">
                <label className="text-xs font-semibold text-gray-500 flex items-center gap-0.5">
                  Password
                  <span className="text-status-danger">*</span>
                </label>
                <Link to="/forgot-password" className="text-xs text-brand-accent font-semibold hover:underline">
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                error={fieldErrors.password}
                onChange={e => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: '' }));
                }}
                placeholder="••••••••"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              variant="primary"
              fullWidth
              className="py-4 px-6 rounded-xl shadow-lg flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-wider transition-all duration-300"
            >
              {isLoading ? "Signing In..." : "Sign In"}
              <span className="material-symbols-outlined text-lg">arrow_forward</span>
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-500">
            Don't have an account?{" "}
            <Link to="/signup" className="text-brand-accent font-bold hover:underline">Create Account</Link>
          </p>

          <div className="mt-8 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-100" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Secure Access</span>
            <div className="h-px flex-1 bg-slate-100" />
          </div>
        </div>

        {/* ── Right – Brand Panel ──────────────────────────── */}
        <div className="login-right hidden md:flex w-1/2 relative bg-slate-900 overflow-hidden">
          <img
            src={`${import.meta.env.BASE_URL}images/login-hero.jpg`}
            alt="Modern apartment"
            className="absolute inset-0 w-full h-full object-cover opacity-50"
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-slate-900 via-slate-900/50 to-transparent" />
          <div className="relative z-10 p-14 flex flex-col h-full justify-end text-left">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-accent/20 border border-brand-accent/30 backdrop-blur-sm">
                <span className="w-2 h-2 rounded-full bg-brand-accent animate-pulse" />
                <span className="text-[10px] font-bold text-white uppercase tracking-widest">Resident Exclusive</span>
              </div>
              <h2 className="text-4xl font-light text-white leading-tight font-sans">Your Home,<br />Your Portal.</h2>
              <p className="text-slate-300 text-sm leading-relaxed max-w-xs font-sans">
                Manage payments, maintenance requests, documents, and more — all in one place.
              </p>
              <div className="grid grid-cols-2 gap-4 pt-4 text-left">
                {[
                  { icon: "description", title: "Documents", sub: "Lease & digital records" },
                  { icon: "payments", title: "Payments", sub: "Instant rent settlements" },
                  { icon: "engineering", title: "Maintenance", sub: "24/7 request tracking" },
                  { icon: "forum", title: "Messages", sub: "Contact management" },
                ].map(item => (
                  <div key={item.title} className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-brand-accent text-xl">{item.icon}</span>
                    <div className="text-left">
                      <p className="text-white text-xs font-bold leading-tight">{item.title}</p>
                      <p className="text-slate-400 text-[11px] leading-tight mt-0.5">{item.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
