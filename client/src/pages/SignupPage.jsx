import React from 'react';
import { Link } from 'react-router-dom';
import { useSignup } from '../hooks/useSignup';
import { Input } from '../components/UI/Input';
import { Button } from '../components/UI/Button';
import { UserPlus } from 'lucide-react';

export const SignupPage = () => {
  const {
    form,
    error,
    fieldErrors,
    isLoading,
    handleChange,
    handleSignup,
    setFieldErrors
  } = useSignup();

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center py-16 px-4 font-sans text-left">
      <div className="w-full max-w-2xl text-left">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-10 py-8 text-left">
            <Link to="/">
              <img 
                src={`${import.meta.env.BASE_URL}images/logo.png`} 
                alt="ROCA Living" 
                className="h-8 mb-4 object-contain cursor-pointer" 
              />
            </Link>
            <h1 className="text-2xl font-light text-white mb-1">Create Your Account</h1>
            <p className="text-slate-400 text-sm">Join the ROCA Living landlord partner portal</p>
          </div>

          {error && (
            <div className="mx-10 mt-6 p-3 bg-status-danger/10 border border-status-danger/20 rounded-lg text-status-danger text-xs font-semibold">
              {error}
            </div>
          )}

          <form onSubmit={handleSignup} className="p-8 sm:p-10 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Full Name */}
              <Input
                label="Full Name"
                id="name"
                name="name"
                type="text"
                value={form.name}
                error={fieldErrors.name}
                onChange={e => {
                  handleChange(e);
                  if (fieldErrors.name) setFieldErrors(prev => ({ ...prev, name: '' }));
                }}
                required
                placeholder="e.g. John Doe"
                className="text-left font-sans"
              />

              {/* Email Address */}
              <Input
                label="Email Address"
                id="email"
                name="email"
                type="email"
                value={form.email}
                error={fieldErrors.email}
                onChange={e => {
                  handleChange(e);
                  if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: '' }));
                }}
                required
                placeholder="name@example.com"
                className="text-left font-sans"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Phone Number */}
              <Input
                label="Phone Number"
                id="phone"
                name="phone"
                type="text"
                value={form.phone}
                error={fieldErrors.phone}
                onChange={e => {
                  handleChange(e);
                  if (fieldErrors.phone) setFieldErrors(prev => ({ ...prev, phone: '' }));
                }}
                required
                placeholder="e.g. 07123456789"
                className="text-left font-sans"
              />

              {/* Home Address */}
              <Input
                label="Home Address"
                id="address"
                name="address"
                type="text"
                value={form.address}
                error={fieldErrors.address}
                onChange={e => {
                  handleChange(e);
                  if (fieldErrors.address) setFieldErrors(prev => ({ ...prev, address: '' }));
                }}
                required
                placeholder="e.g. 14 High Street, Manchester, M1 1AD"
                className="text-left font-sans"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Password */}
              <Input
                label="Password"
                id="password"
                name="password"
                type="password"
                value={form.password}
                error={fieldErrors.password}
                onChange={e => {
                  handleChange(e);
                  if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: '' }));
                }}
                required
                placeholder="Min 8 characters"
                className="text-left font-sans"
              />

              {/* Confirm Password */}
              <Input
                label="Confirm Password"
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={form.confirmPassword}
                onChange={handleChange}
                required
                placeholder="••••••••"
                className="text-left font-sans"
              />
            </div>

            {/* Terms */}
            <div className="flex items-start gap-3 pt-1 text-left">
              <input
                type="checkbox"
                id="agreeToTerms"
                name="agreeToTerms"
                checked={form.agreeToTerms}
                onChange={handleChange}
                className="mt-0.5 w-4 h-4 accent-brand-accent flex-shrink-0 cursor-pointer"
              />
              <label htmlFor="agreeToTerms" className="text-sm text-slate-600 leading-relaxed cursor-pointer select-none">
                I agree to the{" "}
                <Link to="/terms-and-conditions" className="text-brand-accent font-semibold hover:underline">
                  Terms &amp; Conditions
                </Link>
              </label>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              variant="primary"
              fullWidth
              icon={UserPlus}
              iconPosition="right"
              className="py-4 px-6 rounded-xl shadow-lg flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-wider transition-all duration-300"
            >
              {isLoading ? "Creating account…" : "Create Account"}
            </Button>

            <p className="text-center text-sm text-slate-500 pt-2">
              Already have an account?{" "}
              <Link to="/login" className="text-brand-accent font-bold hover:underline">Sign In</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};
