import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '../components/UI/Input';
import { Button } from '../components/UI/Button';
import { Logo } from '../components/UI/Logo';
import { useToast } from '../components/UI/ToastContext';
import api from '../utilities/api';

export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { addToast } = useToast();

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setIsLoading(true);

    try {
      const response = await api.post('/auth/forgot-password', { email, portal: 'client' });
      setSuccessMessage(response.data?.message || 'A reset link has been sent if the email is registered.');
      addToast('Password reset request submitted successfully!', 'success');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to submit request. Please try again.');
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
          <p className="text-xs text-white/70 mt-1">Landlord Partner Portal</p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleForgotPassword} className="p-8 flex flex-col gap-5">
          <h3 className="text-lg font-bold text-[#1A1A1A]">Forgot Password</h3>
          
          <p className="text-xs text-gray-500 leading-relaxed">
            Enter your registered email address below. We'll send you a link to reset your partner portal password.
          </p>

          {error && (
            <div className="p-3 bg-status-danger/10 border border-status-danger/20 rounded-lg text-status-danger text-xs font-semibold">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-status-success/10 border border-status-success/20 rounded-lg text-status-success text-xs font-semibold">
              {successMessage}
            </div>
          )}

          <Input
            label="Email Address"
            id="email"
            type="email"
            required
            placeholder="e.g. landlord@rocaliving.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <Button
            type="submit"
            variant="primary"
            fullWidth
            disabled={isLoading || !!successMessage}
            className="mt-2"
          >
            {isLoading ? 'Submitting...' : 'Send Reset Link'}
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
