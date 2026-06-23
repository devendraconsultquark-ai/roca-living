import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '../components/UI/Input';
import { Button } from '../components/UI/Button';
import { Logo } from '../components/UI/Logo';
import { useToast } from '../components/UI/ToastContext';
import api from '../utilities/api';

export const SignupPage = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const { addToast } = useToast();

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setIsLoading(true);

    try {
      await api.post('/auth/register', {
        name,
        email,
        password,
        phone,
        address,
      });

      addToast('Registration successful! Please sign in.', 'success');
      navigate('/login');
    } catch (err) {
      console.error(err);
      
      const errorMessages = err.response?.data?.errors;
      
      if (Array.isArray(errorMessages) && errorMessages.length > 0) {
        const errorsMap = {};
        errorMessages.forEach((m) => {
          // Zod error path represents the field name
          errorsMap[m.field] = m.message;
        });
        setFieldErrors(errorsMap);
      } else {
        setError(err.response?.data?.message || 'Registration failed. Please check your inputs.');
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-app-bg px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-border-color overflow-hidden">
        {/* Header */}
        <div className="bg-brand-primary/80 text-white p-8 text-center flex flex-col items-center gap-2">
          <Logo useLogoPng={true} />
          <p className="text-xs text-white/70 mt-1">Landlord Partner Portal</p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSignup} className="p-8 flex flex-col gap-5">
          <h3 className="text-lg font-bold text-[#1A1A1A]">Create Account</h3>

          {error && (
            <div className="p-3 bg-status-danger/10 border border-status-danger/20 rounded-lg text-status-danger text-xs font-semibold">
              {error}
            </div>
          )}

          <Input
            label="Full Name"
            id="name"
            required
            placeholder="e.g. John Doe"
            value={name}
            error={fieldErrors.name}
            onChange={(e) => {
              setName(e.target.value);
              if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: '' }));
            }}
          />

          <Input
            label="Email Address"
            id="email"
            type="email"
            required
            placeholder="e.g. landlord@rocaliving.com"
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
            placeholder="Min. 8 chars, 1 uppercase, 1 lowercase, 1 special char"
            value={password}
            error={fieldErrors.password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: '' }));
            }}
          />

          <Input
            label="Phone Number"
            id="phone"
            required
            placeholder="e.g. 07123456789"
            value={phone}
            error={fieldErrors.phone}
            onChange={(e) => {
              setPhone(e.target.value);
              if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: '' }));
            }}
          />

          <Input
            label="Home Address"
            id="address"
            required
            placeholder="e.g. 14 High Street, Manchester, M1 1AD"
            value={address}
            error={fieldErrors.address}
            onChange={(e) => {
              setAddress(e.target.value);
              if (fieldErrors.address) setFieldErrors((prev) => ({ ...prev, address: '' }));
            }}
          />

          <Button
            type="submit"
            variant="primary"
            fullWidth
            disabled={isLoading}
            className="mt-2"
          >
            {isLoading ? 'Registering...' : 'Register'}
          </Button>

          <div className="text-center mt-2 flex flex-col gap-2">
            <span
              onClick={() => navigate('/login')}
              className="text-xs text-brand-accent hover:underline font-bold cursor-pointer"
            >
              Already have an account? Sign In
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
