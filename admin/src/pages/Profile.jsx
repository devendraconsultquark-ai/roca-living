import { useState, useEffect } from 'react';
import { User, Shield, Save, LogOut } from 'lucide-react';
import { useToast } from '../components/UI/ToastContext';
import { Input } from '../components/UI/Input';
import { Button } from '../components/UI/Button';
import { useAuth } from '../context/AuthContext';
import api from '../utilities/api';

export const Profile = () => {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const { user, logout, refreshUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [profileErrors, setProfileErrors] = useState({});

  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    phone: '',
    role: '',
    address: '',
  });

  const handleCancel = () => {
    setIsEditing(false);
    setProfileErrors({});
    if (user) {
      setProfileData(prev => ({
        ...prev,
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        role: user.role || '',
        address: user.address || '',
      }));
    }
  };

  useEffect(() => {
    if (user) {
      setProfileData(prev => ({
        ...prev,
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        role: user.role || '',
        address: user.address || '',
      }));
    }
  }, [user]);

  const handleChange = (e) => {
    const { id, value } = e.target;
    setProfileData(prev => ({ ...prev, [id]: value }));
    if (profileErrors[id]) {
      setProfileErrors(prev => ({ ...prev, [id]: '' }));
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setProfileErrors({});

    try {
      // Omit empty fields — this is a partial update, and the API rejects
      // empty strings (e.g. address has a 5-character minimum).
      const payload = {};
      ['name', 'email', 'phone', 'address'].forEach((field) => {
        if (profileData[field] !== '') payload[field] = profileData[field];
      });
      await api.patch('/auth/profile', payload, { skipInterceptorError: true });
      addToast('Profile updated successfully!', 'success');
      setIsEditing(false);
      refreshUser();
    } catch (err) {
      const errorMessages = err.response?.data?.errors;
      if (Array.isArray(errorMessages) && errorMessages.length > 0) {
        const errorsMap = {};
        errorMessages.forEach((m) => {
          errorsMap[m.field] = m.message;
        });
        setProfileErrors(errorsMap);
        addToast(err.response?.data?.message || 'Validation failed', 'error');
      } else {
        addToast(err.response?.data?.message || 'Failed to update profile', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState({});

  const handlePasswordChange = async (e) => {
    e.preventDefault();
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
      return;
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
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="py-6 max-w-[1440px] mx-auto px-8 flex flex-col gap-6 font-sans text-brand-primary">
      <div className="flex flex-col gap-6">
        {/* Settings Form */}
        <form onSubmit={handleSave} className="card-bg border border-card-border rounded-card p-6 shadow-premium flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center w-full">
              <h3 className="text-sm-portal font-bold text-brand-primary uppercase tracking-wider flex items-center gap-2 select-none">
                <User size={16} className="text-brand-accent" />
                Contact Information
              </h3>
              <button
                type="button"
                onClick={() => {
                  if (isEditing) {
                    handleCancel();
                  } else {
                    setIsEditing(true);
                  }
                }}
                className="text-xs font-bold text-brand-accent hover:text-brand-accent/80 border border-brand-accent/30 hover:border-brand-accent/50 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                {isEditing ? 'Cancel Edit' : 'Edit'}
              </button>
            </div>
            
            <div className="border-t border-card-border pt-4 grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Input
                label="Full Name"
                id="name"
                required
                value={profileData.name}
                error={profileErrors.name}
                onChange={handleChange}
                disabled={!isEditing}
              />
              <Input
                label="Email Address"
                id="email"
                type="email"
                required
                value={profileData.email}
                error={profileErrors.email}
                onChange={handleChange}
                disabled={!isEditing}
              />
              <Input
                label="Contact Phone"
                id="phone"
                required
                placeholder="e.g. 07123 456789"
                value={profileData.phone}
                error={profileErrors.phone}
                onChange={handleChange}
                disabled={!isEditing}
              />
              <Input
                label="Registered Home Address"
                id="address"
                required
                value={profileData.address}
                error={profileErrors.address}
                onChange={handleChange}
                disabled={!isEditing}
              />
            </div>
          </div>

          {/* Save and Logout Buttons */}
          <div className="border-t border-card-border pt-6 flex justify-between items-center">
            <button
              type="button"
              onClick={handleLogout}
              className="px-4 py-2.5 text-sm font-bold text-status-danger hover:bg-status-danger-bg border border-status-danger/20 hover:border-status-danger/30 rounded-lg transition-colors cursor-pointer flex items-center gap-2"
            >
              <LogOut size={16} />
              Log Out
            </button>
            
            {isEditing && (
              <Button
                type="submit"
                variant="primary"
                icon={Save}
                disabled={loading}
              >
                {loading ? 'Saving Changes...' : 'Save Profile Details'}
              </Button>
            )}
          </div>
        </form>

        {/* Change Password Form */}
        <div className="card-bg border border-card-border rounded-card p-6 shadow-premium flex flex-col gap-6">
          <form onSubmit={handlePasswordChange} className="flex flex-col gap-6">
            <div className="flex flex-col gap-4">
              <h3 className="text-sm-portal font-bold text-brand-primary uppercase tracking-wider flex items-center gap-2 select-none">
                <Shield size={16} className="text-brand-accent" />
                Change Password
              </h3>
              
              <div className="border-t border-card-border pt-4 grid grid-cols-1 sm:grid-cols-3 gap-5">
                <Input
                  label="Current Password"
                  id="currentPassword"
                  type="password"
                  required
                  value={passwordData.currentPassword}
                  error={passwordErrors.currentPassword}
                  onChange={(e) => {
                    setPasswordData({ ...passwordData, currentPassword: e.target.value });
                    if (passwordErrors.currentPassword) {
                      setPasswordErrors(prev => ({ ...prev, currentPassword: '' }));
                    }
                  }}
                />
                <Input
                  label="New Password"
                  id="newPassword"
                  type="password"
                  required
                  value={passwordData.newPassword}
                  error={passwordErrors.newPassword}
                  onChange={(e) => {
                    setPasswordData({ ...passwordData, newPassword: e.target.value });
                    if (passwordErrors.newPassword) {
                      setPasswordErrors(prev => ({ ...prev, newPassword: '' }));
                    }
                  }}
                />
                <Input
                  label="Confirm Password"
                  id="confirmPassword"
                  type="password"
                  required
                  value={passwordData.confirmPassword}
                  error={passwordErrors.confirmPassword}
                  onChange={(e) => {
                    setPasswordData({ ...passwordData, confirmPassword: e.target.value });
                    if (passwordErrors.confirmPassword) {
                      setPasswordErrors(prev => ({ ...prev, confirmPassword: '' }));
                    }
                  }}
                />
              </div>
            </div>

            <div className="border-t border-card-border pt-6 flex justify-end">
              <Button
                type="submit"
                variant="primary"
                disabled={passwordLoading}
              >
                {passwordLoading ? 'Updating Password...' : 'Update Password'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
