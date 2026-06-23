import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Input } from '../components/UI/Input';
import { Button } from '../components/UI/Button';
import { Logo } from '../components/UI/Logo';
import { useToast } from '../components/UI/ToastContext';
import api from '../utilities/api';

export const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { addToast } = useToast();

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!token) {
      setError('Reset token is missing. Please request a new password reset link.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (
      password.length < 8 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      setError('Password must be at least 8 characters long, contain at least one uppercase letter, one lowercase letter, and one special character.');
      return;
    }

    setIsLoading(true);

    try {
      await api.post('/auth/reset-password', { token, password });
      addToast('Password reset successfully!', 'success');
      navigate('/login');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to reset password. The link may have expired or is invalid.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-app-bg px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-border-color overflow-hidden">
        {/* Navy Header using brand-primary */}
        <div className="bg-brand-primary/80 text-white p-8 text-center flex flex-col items-center gap-2">
          <Logo useLogoPng={true} />
          <p className="text-xs text-white/70 mt-1">Administrative Management Portal</p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleResetPassword} className="p-8 flex flex-col gap-5">
          <h3 className="text-lg font-bold text-[#1A1A1A]">Reset Password</h3>
          
          <p className="text-xs text-gray-500 leading-relaxed">
            Please enter your new password below.
          </p>

          {!token && (
            <div className="p-3 bg-status-danger/10 border border-status-danger/20 rounded-lg text-status-danger text-xs font-semibold">
              Warning: Reset token is missing from the link.
            </div>
          )}

          {error && (
            <div className="p-3 bg-status-danger/10 border border-status-danger/20 rounded-lg text-status-danger text-xs font-semibold">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-status-success/10 border border-status-success/20 rounded-lg text-status-success text-xs font-semibold">
              {successMessage} Redirecting to login...
            </div>
          )}

          <Input
            label="New Password"
            id="password"
            type="password"
            required
            placeholder="Min. 8 chars, 1 uppercase, 1 lowercase, 1 special char"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading || !!successMessage}
          />

          <Input
            label="Confirm Password"
            id="confirmPassword"
            type="password"
            required
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={isLoading || !!successMessage}
          />

          <Button
            type="submit"
            variant="primary"
            fullWidth
            disabled={isLoading || !!successMessage || !token}
            className="mt-2"
          >
            {isLoading ? 'Resetting...' : 'Reset Password'}
          </Button>

          <div className="text-center mt-2 flex flex-col gap-2">
            <span
              onClick={() => navigate('/login')}
              className="text-xs text-brand-accent hover:underline font-bold cursor-pointer"
            >
              Back to Sign In
            </span>
          </div>
        </form>
      </div>
    </div>
  );
};
