import { useState, useEffect } from 'react';
import { useToast } from '../components/UI/ToastContext';
import { useAuth } from '../context/AuthContext';
import api from '../utilities/api';

export const useProfile = () => {
  const { addToast } = useToast();
  const { user, logout, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [profileData, setProfileData] = useState({
    // Contact
    name: '',
    email: '',
    phone: '',
    address: '',
    landlord_reference: '',

    // Company / Overseas
    companyName: '',
    isOverseas: false,
    nrlHmrcApproved: false,
    nrlHmrcRef: '',
    nrlWithholdPct: '20.00',
    nrlNumber: '',

    // Bank
    bankName: '',
    accountName: '',
    sortCode: '',
    accountNumber: '',
    ibanBic: '',

    // Read-only Status / Verification
    kycStatus: 'not_started',
    kycProvider: 'HIPLA',
    kycRef: '',
    sanctionsChecked: false,
    tobStatus: 'not_sent',
    tobSignedAt: '',
    ownershipConfirmed: false,
    ownershipShare: '',
  });

  const handleCancel = () => {
    setIsEditing(false);
    if (user) {
      setProfileData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        address: user.address || '',
        landlord_reference: user.landlord_reference || '',
        
        companyName: user.company_name || '',
        isOverseas: !!user.is_overseas,
        nrlHmrcApproved: !!user.nrl_hmrc_approved,
        nrlHmrcRef: user.nrl_hmrc_ref || '',
        nrlWithholdPct: user.nrl_withhold_pct !== null && user.nrl_withhold_pct !== undefined ? String(user.nrl_withhold_pct) : '20.00',
        nrlNumber: user.nrl_number || '',

        bankName: user.bank_name || '',
        accountName: user.account_name || user.name || '',
        sortCode: user.sort_code || '',
        accountNumber: user.account_number || '',
        ibanBic: user.iban_bic || '',

        kycStatus: user.kyc_status || 'not_started',
        kycProvider: user.kyc_provider || 'HIPLA',
        kycRef: user.kyc_ref || '',
        sanctionsChecked: !!user.sanctions_checked,
        tobStatus: user.tob_status || 'not_sent',
        tobSignedAt: user.tob_signed_at ? new Date(user.tob_signed_at).toLocaleString('en-GB') : '',
        ownershipConfirmed: !!user.ownership_confirmed,
        ownershipShare: user.ownership_share !== null && user.ownership_share !== undefined ? String(user.ownership_share) : '',
      });
    }
  };

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState({});

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        address: user.address || '',
        landlord_reference: user.landlord_reference || '',
        
        companyName: user.company_name || '',
        isOverseas: !!user.is_overseas,
        nrlHmrcApproved: !!user.nrl_hmrc_approved,
        nrlHmrcRef: user.nrl_hmrc_ref || '',
        nrlWithholdPct: user.nrl_withhold_pct !== null && user.nrl_withhold_pct !== undefined ? String(user.nrl_withhold_pct) : '20.00',
        nrlNumber: user.nrl_number || '',

        bankName: user.bank_name || '',
        accountName: user.account_name || user.name || '',
        sortCode: user.sort_code || '',
        accountNumber: user.account_number || '',
        ibanBic: user.iban_bic || '',

        kycStatus: user.kyc_status || 'not_started',
        kycProvider: user.kyc_provider || 'HIPLA',
        kycRef: user.kyc_ref || '',
        sanctionsChecked: !!user.sanctions_checked,
        tobStatus: user.tob_status || 'not_sent',
        tobSignedAt: user.tob_signed_at ? new Date(user.tob_signed_at).toLocaleString('en-GB') : '',
        ownershipConfirmed: !!user.ownership_confirmed,
        ownershipShare: user.ownership_share !== null && user.ownership_share !== undefined ? String(user.ownership_share) : '',
      });
    }
  }, [user]);

  const handleChange = (e) => {
    const { id, value, type, checked } = e.target;
    setProfileData(prev => ({
      ...prev,
      [id]: type === 'checkbox' ? checked : value
    }));
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
    if (!profileData.address.trim()) errs.address = 'Registered Home Address is required';

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      addToast('Please fix the validation errors before saving', 'warning');
      return;
    }

    setLoading(true);
    try {
      const response = await api.patch('/auth/profile', profileData, { skipInterceptorError: true });
      addToast('Profile updated successfully!', 'success');
      setIsEditing(false);
      if (updateUser) {
        updateUser(response.data.data);
      }
    } catch (err) {
      console.error(err);
      const errorMessages = err.response?.data?.errors;
      if (Array.isArray(errorMessages) && errorMessages.length > 0) {
        const errorsMap = {};
        errorMessages.forEach((m) => {
          errorsMap[m.field] = m.message;
        });
        setErrors(errorsMap);
        addToast(err.response?.data?.message || 'Validation failed', 'error');
      } else {
        addToast(err.response?.data?.message || 'Failed to update profile', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
  };

  const handleExportData = async () => {
    try {
      const response = await api.get('/auth/export', { responseType: 'blob', skipInterceptorError: true });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'my-roca-living-data.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      addToast('Your data export has been downloaded.', 'success');
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to export data', 'error');
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      'This permanently deletes your account and ALL associated data (properties, statements, documents, transactions). This cannot be undone. Continue?'
    );
    if (!confirmed) return;
    try {
      await api.delete('/auth/account', { skipInterceptorError: true });
      addToast('Your account has been permanently deleted.', 'success');
      logout();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to delete account', 'error');
    }
  };

  const handlePasswordChange = async (e) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    const errs = {};

    if (!passwordData.currentPassword) {
      errs.currentPassword = 'Current Password is required';
    }

    if (!passwordData.newPassword) {
      errs.newPassword = 'New Password is required';
    } else {
      if (passwordData.newPassword.length < 8) {
        errs.newPassword = 'Password must be at least 8 characters long';
      } else if (!/[A-Z]/.test(passwordData.newPassword)) {
        errs.newPassword = 'Password must contain at least one uppercase letter';
      } else if (!/[a-z]/.test(passwordData.newPassword)) {
        errs.newPassword = 'Password must contain at least one lowercase letter';
      } else if (!/[^A-Za-z0-9]/.test(passwordData.newPassword)) {
        errs.newPassword = 'Password must contain at least one special character';
      }
    }

    if (!passwordData.confirmPassword) {
      errs.confirmPassword = 'Confirm Password is required';
    } else if (passwordData.newPassword !== passwordData.confirmPassword) {
      errs.confirmPassword = 'New password and confirm password do not match';
    }

    if (Object.keys(errs).length > 0) {
      setPasswordErrors(errs);
      addToast('Please fix the validation errors before saving', 'warning');
      return false;
    }

    setPasswordLoading(true);
    try {
      await api.patch('/auth/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      }, { skipInterceptorError: true });
      addToast('Password changed successfully!', 'success');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordErrors({});
      return true;
    } catch (err) {
      const errorMessages = err.response?.data?.errors;
      if (Array.isArray(errorMessages) && errorMessages.length > 0) {
        const errorsMap = {};
        errorMessages.forEach((m) => {
          errorsMap[m.field] = m.message;
        });
        setPasswordErrors(errorsMap);
        addToast(err.response?.data?.message || 'Validation failed', 'error');
      } else {
        addToast(err.response?.data?.message || 'Failed to change password', 'error');
      }
      return false;
    } finally {
      setPasswordLoading(false);
    }
  };

  return {
    loading,
    isEditing,
    setIsEditing,
    profileData,
    errors,
    passwordData,
    setPasswordData,
    passwordLoading,
    passwordErrors,
    setPasswordErrors,
    handleCancel,
    handleChange,
    handleSubmit,
    handleLogout,
    handlePasswordChange,
    handleExportData,
    handleDeleteAccount
  };
};
