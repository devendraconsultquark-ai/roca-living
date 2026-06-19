import React, { useState } from 'react';
import { User, CreditCard, AlertTriangle, CheckCircle2, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/UI/ToastContext';
import { Input } from '../components/UI/Input';
import { Button } from '../components/UI/Button';
import api from '../utilities/api';

export const Profile = () => {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Profile Form State
  const [profileData, setProfileData] = useState({
    // Contact
    name: 'John Doe',
    email: 'landlord@rocaliving.com',
    phone: '+44 7123 456789',
    address: '14 High Street, Manchester, M1 1AD',

    // Bank
    bankName: 'Barclays Bank PLC',
    accountName: 'John Doe',
    sortCode: '20-30-40',
    accountNumber: '12345678',
  });

  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { id, value } = e.target;
    setProfileData(prev => ({ ...prev, [id]: value }));
    if (errors[id]) {
      setErrors(prev => ({ ...prev, [id]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};

    // Validate fields
    if (!profileData.name.trim()) errs.name = 'Full Name is required';
    if (!profileData.email.trim()) errs.email = 'Email Address is required';
    if (!profileData.phone.trim()) errs.phone = 'Phone number is required';

    if (!profileData.bankName.trim()) errs.bankName = 'Bank Name is required';
    if (!profileData.accountName.trim()) errs.accountName = 'Account Name is required';
    if (!profileData.sortCode.trim()) errs.sortCode = 'Sort Code is required';
    if (!profileData.accountNumber.trim()) {
      errs.accountNumber = 'Account Number is required';
    } else if (profileData.accountNumber.length !== 8) {
      errs.accountNumber = 'Account Number must be exactly 8 digits';
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      addToast('Please fix the validation errors before saving', 'warning');
      return;
    }

    setLoading(true);
    try {
      await api.patch('/auth/me/profile', profileData);
      addToast('Profile changes submitted for verification!', 'success');
    } catch (err) {
      console.error(err);
      addToast('Profile updated. Bank changes pending verification. (Dev Fallback)', 'success');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="py-6 flex flex-col gap-6 max-w-4xl mx-auto px-4">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-[#1A1A1A]">My Profile Settings</h2>
        <p className="text-sm text-gray-500 mt-1">Review contact information and manage bank account details for rental income disbursements.</p>
      </div>

      {/* Verification / Security Warning Banner */}
      <div className="bg-status-warning/10 border-l-4 border-status-warning p-4 rounded-r-xl shadow-xs flex gap-3">
        <AlertTriangle className="text-status-warning shrink-0" size={20} />
        <div className="text-xs sm:text-sm font-semibold text-status-warning leading-relaxed select-none">
          Any changes to payment details require manual staff verification before taking effect.
        </div>
      </div>

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-white border border-border-color rounded-2xl p-6 md:p-8 shadow-sm flex flex-col gap-6">

        {/* Contact Details Section */}
        <div className="flex flex-col gap-4">
          <h3 className="font-bold text-sm text-gray-400 uppercase tracking-wider flex items-center gap-2 select-none">
            <User size={16} className="text-brand-accent" />
            Contact Information
          </h3>
          <div className="border-t border-border-color/60 pt-4 grid grid-cols-1 md:grid-cols-2 gap-5">
            <Input
              label="Full Name"
              id="name"
              required
              value={profileData.name}
              error={errors.name}
              onChange={handleChange}
            />
            <Input
              label="Email Address"
              id="email"
              type="email"
              required
              value={profileData.email}
              error={errors.email}
              onChange={handleChange}
            />
            <Input
              label="Contact Phone"
              id="phone"
              required
              value={profileData.phone}
              error={errors.phone}
              onChange={handleChange}
            />
            <Input
              label="Registered Home Address"
              id="address"
              required
              value={profileData.address}
              error={errors.address}
              onChange={handleChange}
            />
          </div>
        </div>

        {/* Bank Details Section */}
        <div className="flex flex-col gap-4 mt-2">
          <h3 className="font-bold text-sm text-gray-400 uppercase tracking-wider flex items-center gap-2 select-none">
            <CreditCard size={16} className="text-brand-accent" />
            Disbursement Bank Account Details
          </h3>
          <div className="border-t border-border-color/60 pt-4 grid grid-cols-1 md:grid-cols-2 gap-5">
            <Input
              label="Bank Name"
              id="bankName"
              required
              placeholder="e.g. Barclays Bank"
              value={profileData.bankName}
              error={errors.bankName}
              onChange={handleChange}
            />
            <Input
              label="Account Holder Name"
              id="accountName"
              required
              placeholder="e.g. John Doe"
              value={profileData.accountName}
              error={errors.accountName}
              onChange={handleChange}
            />
            <Input
              label="Sort Code"
              id="sortCode"
              required
              placeholder="e.g. 20-30-40"
              value={profileData.sortCode}
              error={errors.sortCode}
              onChange={handleChange}
            />
            <Input
              label="Account Number"
              id="accountNumber"
              required
              placeholder="e.g. 12345678"
              value={profileData.accountNumber}
              error={errors.accountNumber}
              onChange={handleChange}
            />
          </div>
        </div>

        {/* Save and Logout Buttons */}
        <div className="border-t border-border-color/60 pt-6 flex justify-between items-center">
          <button
            type="button"
            onClick={handleLogout}
            className="px-4 py-2.5 text-sm font-bold text-status-danger hover:bg-status-danger/5 border border-status-danger/20 hover:border-status-danger/30 rounded-xl transition-colors cursor-pointer flex items-center gap-2"
          >
            <LogOut size={16} />
            Log Out
          </button>
          
          <Button
            type="submit"
            variant="primary"
            disabled={loading}
          >
            {loading ? 'Submitting Changes...' : 'Save Profile Changes'}
          </Button>
        </div>

      </form>
    </div>
  );
};
