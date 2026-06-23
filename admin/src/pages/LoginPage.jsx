import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '../components/UI/Input';
import { Button } from '../components/UI/Button';
import { Logo } from '../components/UI/Logo';
import { useAuth } from '../context/AuthContext';

export const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login, isAuthenticated, user } = useAuth();

  useEffect(() => {
    if (isAuthenticated && user?.role === 'ADMIN') {
      navigate('/dashboard');
    }
  }, [isAuthenticated, user, navigate]);

  const handleLogin = async (e) => {
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
    <div className="min-h-screen flex items-center justify-center bg-app-bg px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-border-color overflow-hidden">
        {/* Navy Header using brand-primary */}
        <div className="bg-brand-primary/80 text-white p-8 text-center flex flex-col items-center gap-2">
          <Logo useLogoPng={true} />
          <p className="text-xs text-white/70 mt-1">Administrative Management Portal</p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleLogin} className="p-8 flex flex-col gap-5">
          <h3 className="text-lg font-bold text-[#1A1A1A]">Sign In</h3>

          {error && (
            <div className="p-3 bg-status-danger/10 border border-status-danger/20 rounded-lg text-status-danger text-xs font-semibold">
              {error}
            </div>
          )}

          <Input
            label="Email Address"
            id="email"
            type="email"
            required
            placeholder="e.g. admin@rocaliving.com"
            value={email}
            error={fieldErrors.email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: '' }));
            }}
          />

          <Input
            label="Password"
            id="password"
            type="password"
            required
            placeholder="••••••••"
            value={password}
            error={fieldErrors.password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: '' }));
            }}
          />

          <Button
            type="submit"
            variant="primary"
            fullWidth
            disabled={isLoading}
            className="mt-2"
          >
            {isLoading ? 'Signing In...' : 'Sign In'}
          </Button>

          <div className="text-center mt-2 flex flex-col gap-2">
            <span
              onClick={() => navigate('/forgot-password')}
              className="text-xs text-brand-accent hover:underline font-bold cursor-pointer"
            >
              Forgot Password?
            </span>
            <span className="text-xs text-status-muted">
              Secure, authorized access only.
            </span>
          </div>
        </form>
      </div>
    </div>
  );
};
