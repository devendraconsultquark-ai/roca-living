import { useState } from 'react';
import { useToast } from '../components/UI/ToastContext';

export function useContact() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    company: '',
    email: '',
    phone: '',
    enquiryType: [],
    message: '',
    location: ''
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const { addToast } = useToast();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      setFormData(prev => {
        const currentList = prev[name] || [];
        const newList = checked
          ? [...currentList, value]
          : currentList.filter(item => item !== value);
        return { ...prev, [name]: newList };
      });
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }

    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email address is invalid';
    }
    if (!formData.phone.trim()) newErrors.phone = 'Phone number is required';
    if (!formData.message.trim()) newErrors.message = 'Message is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      addToast('Please fix validation errors', 'error');
      return;
    }

    setSubmitting(true);
    try {
      // Simulate API submit delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      addToast('Message sent successfully! We will contact you soon.', 'success');
      setFormData({
        firstName: '',
        lastName: '',
        company: '',
        email: '',
        phone: '',
        enquiryType: [],
        message: '',
        location: ''
      });
      setErrors({});
    } catch (err) {
      addToast('Failed to send message. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return { formData, handleChange, handleSubmit, submitting, errors };
}
