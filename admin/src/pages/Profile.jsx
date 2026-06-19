import React, { useState } from 'react';
import { User, Shield, Phone, Mail, Building, Save, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/UI/ToastContext';
import { Input } from '../components/UI/Input';
import { Button } from '../components/UI/Button';

export const Profile = () => {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const [profileData, setProfileData] = useState({
    name: 'Admin User',
    email: 'admin@rocaliving.com',
    phone: '+44 7911 123456',
    role: 'ADMIN',
    department: 'Operations & Support',
    office: 'London Head Office',
  });

  const handleChange = (e) => {
    const { id, value } = e.target;
    setProfileData(prev => ({ ...prev, [id]: value }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    setLoading(true);
    
    // Simulate fast offline save
    setTimeout(() => {
      setLoading(false);
      addToast('Profile updated successfully! (Mock Save)', 'success');
      localStorage.setItem('user', JSON.stringify({
        role: 'ADMIN',
        email: profileData.email,
        name: profileData.name
      }));
    }, 400);
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="py-6 max-w-4xl mx-auto px-4 flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-[#1A1A1A]">Admin Profile</h2>
        <p className="text-sm text-gray-500 mt-1">Manage your administrative user information and check system permissions.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Side: Avatar Card */}
        <div className="bg-white border border-border-color rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center text-center gap-4">
          <div className="w-24 h-24 rounded-full bg-brand-primary text-white flex items-center justify-center font-bold text-4xl shadow-md">
            A
          </div>
          <div>
            <h3 className="font-bold text-lg text-[#1A1A1A]">{profileData.name}</h3>
            <p className="text-xs text-brand-accent font-semibold uppercase tracking-wider">{profileData.role}</p>
          </div>
          <div className="w-full border-t border-border-color pt-4 flex flex-col gap-2.5 text-left text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <Building size={14} className="text-gray-400" />
              <span>{profileData.office}</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail size={14} className="text-gray-400" />
              <span>{profileData.email}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full mt-2 py-2.5 px-4 border border-status-danger/20 hover:border-status-danger/30 text-status-danger hover:bg-status-danger/5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <LogOut size={14} />
            Log Out
          </button>
        </div>

        {/* Right Side: Settings Form */}
        <form onSubmit={handleSave} className="md:col-span-2 bg-white border border-border-color rounded-2xl p-6 shadow-sm flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            <h3 className="font-bold text-sm text-gray-400 uppercase tracking-wider flex items-center gap-2 select-none">
              <User size={16} className="text-brand-accent" />
              Contact Information
            </h3>
            
            <div className="border-t border-border-color/60 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Input
                label="Full Name"
                id="name"
                required
                value={profileData.name}
                onChange={handleChange}
              />
              <Input
                label="Email Address"
                id="email"
                type="email"
                required
                value={profileData.email}
                onChange={handleChange}
              />
              <Input
                label="Contact Phone"
                id="phone"
                required
                value={profileData.phone}
                onChange={handleChange}
              />
              <Input
                label="Department"
                id="department"
                required
                value={profileData.department}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="flex flex-col gap-4 mt-2">
            <h3 className="font-bold text-sm text-gray-400 uppercase tracking-wider flex items-center gap-2 select-none">
              <Shield size={16} className="text-brand-accent" />
              System Permissions
            </h3>
            
            <div className="border-t border-border-color/60 pt-4 flex flex-col gap-3">
              <div className="flex items-center gap-3 bg-brand-primary/5 p-3 rounded-lg border border-brand-primary/10">
                <Shield className="text-brand-accent shrink-0" size={18} />
                <div>
                  <p className="text-xs font-bold text-[#1A1A1A]">Administrator Privileges Active</p>
                  <p className="text-[10px] text-gray-500">You have read and write permissions across all client files, landlord accounting logs, and platform settings.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="border-t border-border-color/60 pt-6 flex justify-end">
            <Button
              type="submit"
              variant="primary"
              icon={Save}
              disabled={loading}
            >
              {loading ? 'Saving Changes...' : 'Save Profile Details'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
