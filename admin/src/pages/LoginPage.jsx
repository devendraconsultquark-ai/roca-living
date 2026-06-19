import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '../components/UI/Input';
import { Button } from '../components/UI/Button';
import { Logo } from '../components/UI/Logo';
import api from '../utilities/api';

export const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // 1. Simple frontend check for email and password
    if (email === 'admin@rocaliving.com' && password === 'admin123') {

      // 2. Create a mock user object and save it to localStorage
      const mockUser = { role: 'ADMIN', email, name: 'Admin User' };
      localStorage.setItem('user', JSON.stringify(mockUser));

      // 3. Redirect to the dashboard
      navigate('/dashboard');
    } else {
      // 4. Show error if credentials are wrong
      setError('Login failed. Please check your credentials.');
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
            onChange={(e) => setEmail(e.target.value)}
          />

          <Input
            label="Password"
            id="password"
            type="password"
            required
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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

          <div className="text-center mt-2">
            <span className="text-xs text-status-muted">
              Secure, authorized access only.
            </span>
          </div>
        </form>
      </div>
    </div>
  );
};
