import { useState } from 'react';
import { useToast } from '../components/UI/ToastContext';
import api from '../utilities/api';

export const useForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');
  const { addToast } = useToast();

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setIsLoading(true);

    try {
      // Align portal to 'landlord' for correct scope mapping
      const response = await api.post('/auth/forgot-password', { email, portal: 'landlord' });
      setSuccessMessage(response.data?.message || 'A reset link has been sent if the email is registered.');
      addToast('Password reset request submitted successfully!', 'success');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to submit request. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    email,
    setEmail,
    isLoading,
    successMessage,
    error,
    handleForgotPassword,
  };
};
