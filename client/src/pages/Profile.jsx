import React from 'react';
import { User, CreditCard, AlertTriangle, LogOut, Shield, Building } from 'lucide-react';
import { Input } from '../components/UI/Input';
import { Button } from '../components/UI/Button';
import { useProfile } from '../hooks/useProfile';

export const Profile = () => {
  const {
    loading,
    isEditing,
    setIsEditing,
    profileData,
    errors,
    passwordData,
    passwordLoading,
    passwordErrors,
    handleChange,
    handleSubmit,
    handleLogout,
    handlePasswordChange,
    handleCancel
  } = useProfile();

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

      {/* Contact Details Form Card */}
      <form onSubmit={handleSubmit} className="bg-white border border-border-color rounded-2xl p-6 md:p-8 shadow-sm flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center w-full">
            <h3 className="font-bold text-sm text-gray-400 uppercase tracking-wider flex items-center gap-2 select-none">
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
          
          <div className="border-t border-border-color/60 pt-4 grid grid-cols-1 md:grid-cols-2 gap-5">
            <Input
              label="Full Name"
              id="name"
              required
              value={profileData.name}
              error={errors.name}
              onChange={handleChange}
              disabled={!isEditing}
            />
            <Input
              label="Email Address"
              id="email"
              type="email"
              required
              value={profileData.email}
              error={errors.email}
              onChange={handleChange}
              disabled={!isEditing}
            />
            <Input
              label="Contact Phone"
              id="phone"
              required
              value={profileData.phone}
              error={errors.phone}
              onChange={handleChange}
              disabled={!isEditing}
            />
            <Input
              label="Registered Home Address"
              id="address"
              required
              value={profileData.address}
              error={errors.address}
              onChange={handleChange}
              disabled={!isEditing}
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
          
          {isEditing && (
            <Button
              type="submit"
              variant="primary"
              disabled={loading}
            >
              {loading ? 'Submitting Changes...' : 'Save Profile Changes'}
            </Button>
          )}
        </div>
      </form>

      {/* Company & HMRC Details Card */}
      <div className="bg-white border border-border-color rounded-2xl p-6 md:p-8 shadow-sm flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="font-bold text-sm text-gray-400 uppercase tracking-wider flex items-center gap-2 select-none">
              <Building size={16} className="text-brand-accent" />
              Company & HMRC Tax Details
            </h3>
            <p className="text-[11px] text-gray-500 mt-1">Tax statuses and company registration details are legally verified and cannot be edited directly.</p>
          </div>
          <div className="border-t border-border-color/60 pt-4 grid grid-cols-1 md:grid-cols-2 gap-5">
            <Input
              label="Company Name (Optional)"
              id="companyName"
              placeholder="e.g. Acme Properties Ltd"
              value={profileData.companyName}
              onChange={handleChange}
              disabled={true}
            />
            <Input
              label="HMRC Withholding Tax Rate (%)"
              id="nrlWithholdPct"
              type="number"
              step="0.01"
              placeholder="e.g. 20.00"
              value={profileData.nrlWithholdPct}
              onChange={handleChange}
              disabled={true}
            />
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-gray-500 uppercase select-none">Overseas Landlord Status</label>
              <div className="flex items-center gap-2 h-10 mt-1 select-none">
                <input
                  type="checkbox"
                  id="isOverseas"
                  checked={profileData.isOverseas}
                  onChange={handleChange}
                  disabled={true}
                  className="w-4 h-4 text-brand-accent border-gray-300 rounded focus:ring-brand-accent cursor-not-allowed"
                />
                <span className="text-sm font-semibold text-gray-700">I am an overseas landlord</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-gray-500 uppercase select-none">HMRC Approved</label>
              <div className="flex items-center gap-2 h-10 mt-1 select-none">
                <input
                  type="checkbox"
                  id="nrlHmrcApproved"
                  checked={profileData.nrlHmrcApproved}
                  onChange={handleChange}
                  disabled={true}
                  className="w-4 h-4 text-brand-accent border-gray-300 rounded focus:ring-brand-accent cursor-not-allowed"
                />
                <span className="text-sm font-semibold text-gray-700">HMRC approved for gross payment</span>
              </div>
            </div>
            <Input
              label="HMRC Reference Number"
              id="nrlHmrcRef"
              placeholder="e.g. NRL123456"
              value={profileData.nrlHmrcRef}
              onChange={handleChange}
              disabled={true}
            />
            <Input
              label="NRL Reference Number"
              id="nrlNumber"
              placeholder="e.g. NRL-998877"
              value={profileData.nrlNumber}
              disabled={true}
            />
          </div>
        </div>
      </div>

      {/* Bank Details Card */}
      <div className="bg-white border border-border-color rounded-2xl p-6 md:p-8 shadow-sm flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="font-bold text-sm text-gray-400 uppercase tracking-wider flex items-center gap-2 select-none">
              <CreditCard size={16} className="text-brand-accent" />
              Disbursement Bank Account Details
            </h3>
            <p className="text-[11px] text-gray-500 mt-1">Bank payment details require manual letting agent verification. Please contact support to submit modifications.</p>
          </div>
          <div className="border-t border-border-color/60 pt-4 grid grid-cols-1 md:grid-cols-2 gap-5">
            <Input
              label="Bank Name"
              id="bankName"
              placeholder="e.g. Barclays Bank"
              value={profileData.bankName}
              error={errors.bankName}
              onChange={handleChange}
              disabled={true}
            />
            <Input
              label="Account Holder Name"
              id="accountName"
              placeholder="e.g. John Doe"
              value={profileData.accountName}
              error={errors.accountName}
              onChange={handleChange}
              disabled={true}
            />
            <Input
              label="Sort Code"
              id="sortCode"
              placeholder="e.g. 20-30-40"
              value={profileData.sortCode}
              error={errors.sortCode}
              onChange={handleChange}
              disabled={true}
            />
            <Input
              label="Account Number"
              id="accountNumber"
              placeholder="e.g. 12345678"
              value={profileData.accountNumber}
              error={errors.accountNumber}
              onChange={handleChange}
              disabled={true}
            />
            <Input
              label="IBAN / BIC (Optional)"
              id="ibanBic"
              placeholder="e.g. GB12BARC20304012345678"
              value={profileData.ibanBic}
              onChange={handleChange}
              disabled={true}
            />
          </div>
        </div>
      </div>

      {/* Compliance & Account Status Card */}
      <div className="bg-white border border-border-color rounded-2xl p-6 md:p-8 shadow-sm flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <h3 className="font-bold text-sm text-gray-400 uppercase tracking-wider flex items-center gap-2 select-none">
            <Shield size={16} className="text-brand-accent" />
            Compliance & Account Verification Status
          </h3>
          <div className="border-t border-border-color/60 pt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
            {/* Row 1: KYC Details */}
            <div className="flex flex-col gap-1.5 bg-gray-50/50 border border-border-color/50 p-4 rounded-xl">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider select-none">KYC Status</span>
              <span className={`text-sm font-bold capitalize select-none ${
                profileData.kycStatus === 'passed' ? 'text-status-success' :
                profileData.kycStatus === 'failed' ? 'text-status-danger' :
                profileData.kycStatus === 'pending' ? 'text-status-warning' : 'text-gray-500'
              }`}>
                {profileData.kycStatus.replace('_', ' ')}
              </span>
            </div>
            <div className="flex flex-col gap-1.5 bg-gray-50/50 border border-border-color/50 p-4 rounded-xl">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider select-none">KYC Provider</span>
              <span className="text-sm font-bold text-gray-700 select-none">
                {profileData.kycProvider || 'N/A'}
              </span>
            </div>
            <div className="flex flex-col gap-1.5 bg-gray-50/50 border border-border-color/50 p-4 rounded-xl">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider select-none">KYC Reference</span>
              <span className="text-sm font-bold text-gray-700 select-none truncate" title={profileData.kycRef}>
                {profileData.kycRef || 'N/A'}
              </span>
            </div>
            <div className="flex flex-col gap-1.5 bg-gray-50/50 border border-border-color/50 p-4 rounded-xl">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider select-none">Sanctions Checked</span>
              <span className={`text-sm font-bold select-none ${
                profileData.sanctionsChecked ? 'text-status-success' : 'text-status-danger'
              }`}>
                {profileData.sanctionsChecked ? 'Yes' : 'No'}
              </span>
            </div>

            {/* Row 2: TOB & Ownership Details */}
            <div className="flex flex-col gap-1.5 bg-gray-50/50 border border-border-color/50 p-4 rounded-xl">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider select-none">TOB Status</span>
              <span className={`text-sm font-bold capitalize select-none ${
                profileData.tobStatus === 'signed' ? 'text-status-success' : 'text-gray-500'
              }`}>
                {profileData.tobStatus.replace('_', ' ')}
              </span>
            </div>
            <div className="flex flex-col gap-1.5 bg-gray-50/50 border border-border-color/50 p-4 rounded-xl">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider select-none">TOB Signed At</span>
              <span className="text-sm font-bold text-gray-700 select-none">
                {profileData.tobSignedAt || 'N/A'}
              </span>
            </div>
            <div className="flex flex-col gap-1.5 bg-gray-50/50 border border-border-color/50 p-4 rounded-xl">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider select-none">Ownership Confirmed</span>
              <span className={`text-sm font-bold select-none ${
                profileData.ownershipConfirmed ? 'text-status-success' : 'text-gray-500'
              }`}>
                {profileData.ownershipConfirmed ? 'Confirmed' : 'Pending Confirmation'}
              </span>
            </div>
            <div className="flex flex-col gap-1.5 bg-gray-50/50 border border-border-color/50 p-4 rounded-xl">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider select-none">Ownership Share</span>
              <span className="text-sm font-bold text-gray-700 select-none">
                {profileData.ownershipShare ? `${profileData.ownershipShare}%` : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Form */}
      <div className="bg-white border border-border-color rounded-2xl p-6 md:p-8 shadow-sm flex flex-col gap-6 mt-6">
        <form onSubmit={handlePasswordChange} className="flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            <h3 className="font-bold text-sm text-gray-400 uppercase tracking-wider flex items-center gap-2 select-none">
              <Shield size={16} className="text-brand-accent" />
              Change Password
            </h3>
            
            <div className="border-t border-border-color/60 pt-4 grid grid-cols-1 sm:grid-cols-3 gap-5">
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

          <div className="border-t border-border-color/60 pt-6 flex justify-end">
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
  );
};
