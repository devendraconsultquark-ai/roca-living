import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/UI/ToastContext';
import api from '../utilities/api';

export const useSignup = () => {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    address: '',
    agreeToTerms: false,
  });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const { addToast } = useToast();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    if (!form.agreeToTerms) {
      addToast('Please agree to the Terms & Conditions.', 'error');
      return;
    }
    if (form.password !== form.confirmPassword) {
      addToast('Passwords do not match.', 'error');
      return;
    }
    if (form.password.length < 8) {
      addToast('Password must be at least 8 characters.', 'error');
      return;
    }

    setIsLoading(true);

    try {
      await api.post('/auth/register', {
        name: form.name,
        email: form.email,
        password: form.password,
        phone: form.phone,
        address: form.address,
      });

      addToast('Registration successful! Please sign in.', 'success');
      navigate('/login');
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
        setError(err.response?.data?.message || 'Registration failed. Please check your inputs.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return {
    form,
    error,
    fieldErrors,
    isLoading,
    handleChange,
    handleSignup,
    setFieldErrors
  };
};
