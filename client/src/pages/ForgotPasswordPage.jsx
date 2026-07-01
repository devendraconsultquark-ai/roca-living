import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/UI/Button';
import { Input } from '../components/UI/Input';
import { ArrowRight } from 'lucide-react';
import { useForgotPassword } from '../hooks/useForgotPassword';

export const ForgotPasswordPage = () => {
  const {
    email,
    setEmail,
    isLoading,
    successMessage,
    error,
    handleForgotPassword,
  } = useForgotPassword();

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center py-16 px-4 font-sans text-left">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 sm:p-12">
          
          <div className="text-center mb-10">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-800 flex items-center justify-center mx-auto mb-6">
              <span className="material-symbols-outlined text-3xl">key</span>
            </div>
            <h1 className="text-2xl font-light text-slate-900 tracking-tight">Forgot Password?</h1>
            <p className="text-slate-500 font-semibold text-sm mt-2 leading-relaxed">
              Enter your email and we'll send you a secure link to reset your password.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-status-danger/10 border border-status-danger/20 rounded-lg text-status-danger text-xs font-semibold mb-5">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-status-success/10 border border-status-success/20 rounded-lg text-status-success text-xs font-semibold mb-5">
              {successMessage}
            </div>
          )}

          <form onSubmit={handleForgotPassword} className="space-y-6">
            <Input
              label="Email Address"
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
              leftIcon="mail"
              className="text-left font-sans"
            />

            <Button
              type="submit"
              variant="primary"
              fullWidth
              disabled={isLoading || !!successMessage}
              icon={ArrowRight}
              iconPosition="left"
              className="py-[16px] px-6 rounded-2xl shadow-lg uppercase tracking-widest text-xs font-bold font-sans flex items-center justify-center gap-2"
            >
              {isLoading ? "Sending…" : "Send Reset Link"}
            </Button>

            <p className="text-center text-sm font-semibold text-slate-400 pt-2">
              Wait, I remember it!{" "}
              <Link to="/login" className="text-slate-800 font-bold hover:underline">Go back to Sign In</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};
