import { useState } from "react";
import {
  User,
  Mail,
  Phone,
  Shield,
  Bell,
  Trash,
  Download,
  ChevronDown,
  ChevronRight,
  KeyRound,
  Wrench,
  FileText,
  Home,
  Calendar,
  MapPin,
  Eye,
  EyeOff,
  CreditCard,
  Globe,
  Building,
  Landmark,
  FileSignature,
  Hash
} from "lucide-react";
import { useProfile } from "../hooks/useProfile";
import { Button } from "../components/UI/Button";
import { PortalCard } from "../components/UI/PortalCard";
import { Toggle as ToggleSwitch } from "../components/UI/Toggle";

export const Profile = () => {
  const {
    profileData,
    handleLogout,
    isEditing,
    setIsEditing,
    handleChange,
    handleSubmit,
    handleCancel,
    errors = {},
    loading,
    passwordData,
    setPasswordData,
    passwordLoading,
    passwordErrors = {},
    handlePasswordChange,
    setPasswordErrors,
    handleExportData,
    handleDeleteAccount,
  } = useProfile();

  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handlePasswordInputChange = (field, value) => {
    setPasswordData((prev) => ({ ...prev, [field]: value }));
    if (passwordErrors[field]) {
      setPasswordErrors((prev) => ({ ...prev, [field]: "" }));
    }
    if (
      (field === "newPassword" || field === "confirmPassword") &&
      passwordErrors.confirmPassword
    ) {
      setPasswordErrors((prev) => ({ ...prev, confirmPassword: "" }));
    }
  };

  // Switch states
  const [prefPortal, setPrefPortal] = useState(true);
  const [prefEmail, setPrefEmail] = useState(true);
  const [prefSms, setPrefSms] = useState(false);
  const [prefStatements, setPrefStatements] = useState(true);
  const [prefMaintenance, setPrefMaintenance] = useState(true);

  return (
    <div className="py-6 flex flex-col gap-6 max-w-[1440px] mx-auto px-8 font-sans text-brand-primary">
      {/* 2x2 Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 select-none">
        {/* Card 1: Account Information */}
        <PortalCard
          title="Account Information"
          headerActions={
            isEditing ? (
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs-portal font-bold text-status-muted hover:underline"
                  onClick={handleCancel}
                >
                  Cancel
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs-portal font-bold text-status-info hover:underline"
                  onClick={handleSubmit}
                  disabled={loading}
                >
                  {loading ? "Saving..." : "Save"}
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs-portal font-bold text-status-info hover:underline"
                onClick={() => setIsEditing(true)}
              >
                Edit
              </Button>
            )
          }
        >
          {/* Avatar Area */}
          <div className="flex gap-4 items-center py-2">
            <div className="w-16 h-16 rounded-full bg-surface-hover flex items-center justify-center shrink-0 border border-card-border">
              <span className="text-base-portal font-black text-brand-primary tracking-wide">
                {profileData?.name
                  ? profileData.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .substring(0, 2)
                      .toUpperCase()
                  : "L"}
              </span>
            </div>
            <div className="flex flex-col items-start gap-1">
              <span className="text-sm-portal font-black text-brand-primary">
                {profileData?.name || "Landlord"}
              </span>
              <span className="text-xs-portal text-gray-400 font-bold uppercase tracking-wider">
                Landlord
              </span>
            </div>
          </div>

          {/* Details list */}
          <div className="flex flex-col gap-3.5 mt-2 text-xs-portal">
            {profileData?.landlord_reference && (
              <div className="flex flex-col gap-1 py-1 border-b border-card-border/60">
                <div className="flex items-center gap-3">
                  <User size={13} className="text-gray-400 shrink-0" />
                  <span className="text-status-muted font-bold w-24 shrink-0">
                    Landlord ID
                  </span>
                  <span className="font-semibold text-brand-primary">
                    {profileData.landlord_reference}
                  </span>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1 py-1 border-b border-card-border/60">
              <div className="flex items-center gap-3">
                <User size={13} className="text-gray-400 shrink-0" />
                <span className="text-status-muted font-bold w-24 shrink-0">
                  Full Name
                </span>
                {isEditing ? (
                  <input
                    type="text"
                    id="name"
                    value={profileData.name}
                    onChange={handleChange}
                    className={`border rounded-[4px] px-2.5 py-1 text-brand-primary font-semibold focus:outline-none text-xs-portal flex-1 ${
                      errors.name
                        ? "border-status-danger focus:border-status-danger"
                        : "border-border-color focus:border-brand-primary"
                    }`}
                  />
                ) : (
                  <span className="font-semibold text-brand-primary">
                    {profileData?.name || "—"}
                  </span>
                )}
              </div>
              {isEditing && errors.name && (
                <span className="text-2xs text-status-danger font-bold ml-28 text-left">
                  {errors.name}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1 py-1 border-b border-card-border/60">
              <div className="flex items-center gap-3">
                <Mail size={13} className="text-gray-400 shrink-0" />
                <span className="text-status-muted font-bold w-24 shrink-0">
                  Email Address
                </span>
                {isEditing ? (
                  <input
                    type="email"
                    id="email"
                    value={profileData.email}
                    onChange={handleChange}
                    className={`border rounded-[4px] px-2.5 py-1 text-brand-primary font-semibold focus:outline-none text-xs-portal flex-1 ${
                      errors.email
                        ? "border-status-danger focus:border-status-danger"
                        : "border-border-color focus:border-brand-primary"
                    }`}
                  />
                ) : (
                  <span className="font-semibold text-brand-primary">
                    {profileData?.email || "—"}
                  </span>
                )}
              </div>
              {isEditing && errors.email && (
                <span className="text-2xs text-status-danger font-bold ml-28 text-left">
                  {errors.email}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1 py-1 border-b border-card-border/60">
              <div className="flex items-center gap-3">
                <Phone size={13} className="text-gray-400 shrink-0" />
                <span className="text-status-muted font-bold w-24 shrink-0">
                  Phone Number
                </span>
                {isEditing ? (
                  <input
                    type="text"
                    id="phone"
                    value={profileData.phone}
                    onChange={handleChange}
                    className={`border rounded-[4px] px-2.5 py-1 text-brand-primary font-semibold focus:outline-none text-xs-portal flex-1 ${
                      errors.phone
                        ? "border-status-danger focus:border-status-danger"
                        : "border-border-color focus:border-brand-primary"
                    }`}
                  />
                ) : (
                  <span className="font-semibold text-brand-primary">
                    {profileData?.phone || "—"}
                  </span>
                )}
              </div>
              {isEditing && errors.phone && (
                <span className="text-2xs text-status-danger font-bold ml-28 text-left">
                  {errors.phone}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1 py-1">
              <div className="flex items-center gap-3">
                <MapPin size={13} className="text-gray-400 shrink-0" />
                <span className="text-status-muted font-bold w-24 shrink-0">
                  Address
                </span>
                {isEditing ? (
                  <input
                    type="text"
                    id="address"
                    value={profileData.address}
                    onChange={handleChange}
                    className={`border rounded-[4px] px-2.5 py-1 text-brand-primary font-semibold focus:outline-none text-xs-portal flex-1 ${
                      errors.address
                        ? "border-status-danger focus:border-status-danger"
                        : "border-border-color focus:border-brand-primary"
                    }`}
                  />
                ) : (
                  <span className="font-semibold text-brand-primary">
                    {profileData?.address || "—"}
                  </span>
                )}
              </div>
              {isEditing && errors.address && (
                <span className="text-2xs text-status-danger font-bold ml-28 text-left">
                  {errors.address}
                </span>
              )}
            </div>
          </div>
        </PortalCard>

        {/* Card 2: Notification Preferences */}
        <PortalCard
          title="Notification Preferences"
          subtitle="Choose how you'd like to receive updates and alerts."
        >
          {/* List of Toggles */}
          <div className="flex flex-col gap-3.5 mt-2 text-xs-portal">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-status-info-bg text-status-info flex items-center justify-center shrink-0">
                  <Bell size={13} />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-brand-primary">
                    Portal Notifications
                  </span>
                  <span className="text-2xs text-gray-400 font-semibold mt-0.5">
                    Receive notifications within the portal
                  </span>
                </div>
              </div>
              <ToggleSwitch
                checked={prefPortal}
                onChange={() => setPrefPortal(!prefPortal)}
              />
            </div>

            <div className="flex items-center justify-between border-t border-card-border pt-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-status-success-bg text-status-success flex items-center justify-center shrink-0">
                  <Mail size={13} />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-brand-primary">
                    Email Notifications
                  </span>
                  <span className="text-2xs text-gray-400 font-semibold mt-0.5">
                    Receive important updates via email
                  </span>
                </div>
              </div>
              <ToggleSwitch
                checked={prefEmail}
                onChange={() => setPrefEmail(!prefEmail)}
              />
            </div>

            <div className="flex items-center justify-between border-t border-card-border pt-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                  <Mail size={13} />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-brand-primary">
                    SMS Notifications
                  </span>
                  <span className="text-2xs text-gray-400 font-semibold mt-0.5">
                    Receive urgent alerts via SMS
                  </span>
                </div>
              </div>
              <ToggleSwitch
                checked={prefSms}
                onChange={() => setPrefSms(!prefSms)}
              />
            </div>

            <div className="flex items-center justify-between border-t border-card-border pt-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center shrink-0">
                  <FileText size={13} />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-brand-primary">
                    Statement Available
                  </span>
                  <span className="text-2xs text-gray-400 font-semibold mt-0.5">
                    Get notified when new statements are ready
                  </span>
                </div>
              </div>
              <ToggleSwitch
                checked={prefStatements}
                onChange={() => setPrefStatements(!prefStatements)}
              />
            </div>

            <div className="flex items-center justify-between border-t border-card-border pt-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-status-danger-bg text-status-danger flex items-center justify-center shrink-0">
                  <Wrench size={13} />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-brand-primary">
                    Maintenance Updates
                  </span>
                  <span className="text-2xs text-gray-400 font-semibold mt-0.5">
                    Receive updates about maintenance requests
                  </span>
                </div>
              </div>
              <ToggleSwitch
                checked={prefMaintenance}
                onChange={() => setPrefMaintenance(!prefMaintenance)}
              />
            </div>
          </div>

          <Button
            variant="link"
            className="text-xs-portal font-bold text-status-info hover:underline text-left mt-4 flex items-center gap-0.5 cursor-pointer"
          >
            Manage Notification Settings <ChevronRight size={10} />
          </Button>
        </PortalCard>

        {/* Card 3: About You */}
        <PortalCard
          title="About You"
          subtitle="Tell us a bit about yourself. This helps us personalise your experience."
          headerActions={
            <Button
              variant="ghost"
              size="sm"
              className="text-xs-portal font-bold text-status-info hover:underline"
              onClick={() => {}}
            >
              Edit
            </Button>
          }
        >
          <div className="flex flex-col gap-3.5 mt-2 text-xs-portal">
            <div className="flex items-center justify-between py-2 border-b border-card-border/60">
              <div className="flex items-center gap-3">
                <User size={13} className="text-gray-400 shrink-0" />
                <span className="text-status-muted font-bold w-24 shrink-0">
                  Landlord Type
                </span>
                <div className="flex items-center gap-1 font-semibold text-brand-primary">
                  <span>Individual</span>
                  <ChevronDown size={11} className="text-gray-400 mt-0.5" />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-card-border/60">
              <div className="flex items-center gap-3">
                <Home size={13} className="text-gray-400 shrink-0" />
                <span className="text-status-muted font-bold w-24 shrink-0">
                  Portfolio Size
                </span>
                <span className="font-semibold text-brand-primary">
                  1 property
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <Calendar size={13} className="text-gray-400 shrink-0" />
                <span className="text-status-muted font-bold w-24 shrink-0">
                  Joined
                </span>
                <span className="font-semibold text-brand-primary">
                  24 April 2024
                </span>
              </div>
            </div>
          </div>
        </PortalCard>

        {/* Card 4: Payment Details */}
        <PortalCard
          title="Payment Details"
          subtitle="Your bank details for receiving payouts."
          headerActions={
            isEditing ? (
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs-portal font-bold text-status-muted hover:underline"
                  onClick={handleCancel}
                >
                  Cancel
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs-portal font-bold text-status-info hover:underline"
                  onClick={handleSubmit}
                  disabled={loading}
                >
                  {loading ? "Saving..." : "Save"}
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs-portal font-bold text-status-info hover:underline"
                onClick={() => setIsEditing(true)}
              >
                Edit
              </Button>
            )
          }
        >
          <div className="flex flex-col gap-3.5 mt-2 text-xs-portal">
            <div className="flex flex-col gap-1 py-1 border-b border-card-border/60">
              <div className="flex items-center gap-3">
                <Landmark size={13} className="text-gray-400 shrink-0" />
                <span className="text-status-muted font-bold w-24 shrink-0">
                  Bank Name
                </span>
                {isEditing ? (
                  <input
                    type="text"
                    id="bankName"
                    value={profileData.bankName}
                    onChange={handleChange}
                    className="border rounded-[4px] px-2.5 py-1 text-brand-primary font-semibold focus:outline-none text-xs-portal flex-1 border-border-color focus:border-brand-primary"
                  />
                ) : (
                  <span className="font-semibold text-brand-primary">
                    {profileData?.bankName || "—"}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1 py-1 border-b border-card-border/60">
              <div className="flex items-center gap-3">
                <User size={13} className="text-gray-400 shrink-0" />
                <span className="text-status-muted font-bold w-24 shrink-0">
                  Account Name
                </span>
                {isEditing ? (
                  <input
                    type="text"
                    id="accountName"
                    value={profileData.accountName}
                    onChange={handleChange}
                    className="border rounded-[4px] px-2.5 py-1 text-brand-primary font-semibold focus:outline-none text-xs-portal flex-1 border-border-color focus:border-brand-primary"
                  />
                ) : (
                  <span className="font-semibold text-brand-primary">
                    {profileData?.accountName || "—"}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1 py-1 border-b border-card-border/60">
              <div className="flex items-center gap-3">
                <CreditCard size={13} className="text-gray-400 shrink-0" />
                <span className="text-status-muted font-bold w-24 shrink-0">
                  Account Number
                </span>
                {isEditing ? (
                  <input
                    type="text"
                    id="accountNumber"
                    value={profileData.accountNumber}
                    onChange={handleChange}
                    className="border rounded-[4px] px-2.5 py-1 text-brand-primary font-semibold focus:outline-none text-xs-portal flex-1 border-border-color focus:border-brand-primary"
                  />
                ) : (
                  <span className="font-semibold text-brand-primary font-mono tracking-wider">
                    {profileData?.accountNumber || "—"}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1 py-1 border-b border-card-border/60">
              <div className="flex items-center gap-3">
                <Hash size={13} className="text-gray-400 shrink-0" />
                <span className="text-status-muted font-bold w-24 shrink-0">
                  Sort Code
                </span>
                {isEditing ? (
                  <input
                    type="text"
                    id="sortCode"
                    value={profileData.sortCode}
                    onChange={handleChange}
                    className="border rounded-[4px] px-2.5 py-1 text-brand-primary font-semibold focus:outline-none text-xs-portal flex-1 border-border-color focus:border-brand-primary"
                  />
                ) : (
                  <span className="font-semibold text-brand-primary font-mono tracking-wider">
                    {profileData?.sortCode || "—"}
                  </span>
                )}
              </div>
            </div>
          </div>
        </PortalCard>

        {/* Card 5: Tax & Compliance */}
        <PortalCard
          title="Tax & Compliance"
          subtitle="Your business and tax compliance details."
          headerActions={
            isEditing ? (
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs-portal font-bold text-status-muted hover:underline"
                  onClick={handleCancel}
                >
                  Cancel
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs-portal font-bold text-status-info hover:underline"
                  onClick={handleSubmit}
                  disabled={loading}
                >
                  {loading ? "Saving..." : "Save"}
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs-portal font-bold text-status-info hover:underline"
                onClick={() => setIsEditing(true)}
              >
                Edit
              </Button>
            )
          }
        >
          <div className="flex flex-col gap-3.5 mt-2 text-xs-portal">
            <div className="flex flex-col gap-1 py-1 border-b border-card-border/60">
              <div className="flex items-center gap-3">
                <Building size={13} className="text-gray-400 shrink-0" />
                <span className="text-status-muted font-bold w-24 shrink-0">
                  Company Name
                </span>
                {isEditing ? (
                  <input
                    type="text"
                    id="companyName"
                    value={profileData.companyName}
                    onChange={handleChange}
                    className="border rounded-[4px] px-2.5 py-1 text-brand-primary font-semibold focus:outline-none text-xs-portal flex-1 border-border-color focus:border-brand-primary"
                  />
                ) : (
                  <span className="font-semibold text-brand-primary">
                    {profileData?.companyName || "—"}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1 py-1 border-b border-card-border/60">
              <div className="flex items-center gap-3">
                <Globe size={13} className="text-gray-400 shrink-0" />
                <span className="text-status-muted font-bold w-24 shrink-0">
                  Overseas Landlord
                </span>
                {isEditing ? (
                  <input
                    type="checkbox"
                    id="isOverseas"
                    checked={profileData.isOverseas}
                    onChange={handleChange}
                    className="rounded text-brand-primary focus:ring-brand-primary"
                  />
                ) : (
                  <span className="font-semibold text-brand-primary">
                    {profileData?.isOverseas ? "Yes" : "No"}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1 py-1 border-b border-card-border/60">
              <div className="flex items-center gap-3">
                <FileSignature size={13} className="text-gray-400 shrink-0" />
                <span className="text-status-muted font-bold w-24 shrink-0">
                  NRL HMRC Approved
                </span>
                {isEditing ? (
                  <input
                    type="checkbox"
                    id="nrlHmrcApproved"
                    checked={profileData.nrlHmrcApproved}
                    onChange={handleChange}
                    className="rounded text-brand-primary focus:ring-brand-primary"
                  />
                ) : (
                  <span className="font-semibold text-brand-primary">
                    {profileData?.nrlHmrcApproved ? "Yes" : "No"}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1 py-1 border-b border-card-border/60">
              <div className="flex items-center gap-3">
                <Shield size={13} className="text-gray-400 shrink-0" />
                <span className="text-status-muted font-bold w-24 shrink-0">
                  HMRC Reference
                </span>
                {isEditing ? (
                  <input
                    type="text"
                    id="nrlHmrcRef"
                    value={profileData.nrlHmrcRef}
                    onChange={handleChange}
                    className="border rounded-[4px] px-2.5 py-1 text-brand-primary font-semibold focus:outline-none text-xs-portal flex-1 border-border-color focus:border-brand-primary"
                  />
                ) : (
                  <span className="font-semibold text-brand-primary">
                    {profileData?.nrlHmrcRef || "—"}
                  </span>
                )}
              </div>
            </div>
          </div>
        </PortalCard>


        {/* Card 6: Account Actions */}
        <PortalCard
          title="Account Actions"
          subtitle="Manage your account and security settings."
        >
          <div className="flex flex-col gap-3.5 mt-2 text-xs-portal">
            {isEditingPassword ? (
              <div className="flex flex-col gap-3.5 p-4 border border-card-border rounded-card bg-surface-light/30 text-left">
                <h4 className="font-bold text-xs-portal text-brand-primary uppercase tracking-wider">
                  Change Password
                </h4>

                <div className="flex flex-col gap-1">
                  <span className="text-status-muted font-bold text-2xs">
                    Current Password
                  </span>
                  <div className="relative w-full">
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      value={passwordData.currentPassword}
                      onChange={(e) =>
                        handlePasswordInputChange(
                          "currentPassword",
                          e.target.value,
                        )
                      }
                      className={`border rounded-[4px] pl-2.5 pr-10 py-1.5 text-brand-primary font-semibold focus:outline-none text-xs-portal w-full ${
                        passwordErrors.currentPassword
                          ? "border-status-danger focus:border-status-danger"
                          : "border-border-color focus:border-brand-primary"
                      }`}
                    />
                    <Button
                    variant="ghost"
                      type="button"
                      onClick={() =>
                        setShowCurrentPassword(!showCurrentPassword)
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-status-muted focus:outline-none cursor-pointer flex items-center justify-center animate-fade-in"
                    >
                      {showCurrentPassword ? (
                        <EyeOff size={14} />
                      ) : (
                        <Eye size={14} />
                      )}
                    </Button>
                  </div>
                  {passwordErrors.currentPassword && (
                    <span className="text-2xs text-status-danger font-bold text-left">
                      {passwordErrors.currentPassword}
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-status-muted font-bold text-2xs">
                    New Password
                  </span>
                  <div className="relative w-full">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={passwordData.newPassword}
                      onChange={(e) =>
                        handlePasswordInputChange("newPassword", e.target.value)
                      }
                      className={`border rounded-[4px] pl-2.5 pr-10 py-1.5 text-brand-primary font-semibold focus:outline-none text-xs-portal w-full ${
                        passwordErrors.newPassword
                          ? "border-status-danger focus:border-status-danger"
                          : "border-border-color focus:border-brand-primary"
                      }`}
                    />
                    <Button
                    variant="ghost"
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-status-muted focus:outline-none cursor-pointer flex items-center justify-center animate-fade-in"
                    >
                      {showNewPassword ? (
                        <EyeOff size={14} />
                      ) : (
                        <Eye size={14} />
                      )}
                    </Button>
                  </div>
                  {passwordErrors.newPassword && (
                    <span className="text-2xs text-status-danger font-bold text-left">
                      {passwordErrors.newPassword}
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-status-muted font-bold text-2xs">
                    Confirm Password
                  </span>
                  <div className="relative w-full">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={passwordData.confirmPassword}
                      onChange={(e) =>
                        handlePasswordInputChange(
                          "confirmPassword",
                          e.target.value,
                        )
                      }
                      className={`border rounded-[4px] pl-2.5 pr-10 py-1.5 text-brand-primary font-semibold focus:outline-none text-xs-portal w-full ${
                        passwordErrors.confirmPassword
                          ? "border-status-danger focus:border-status-danger"
                          : "border-border-color focus:border-brand-primary"
                      }`}
                    />
                    <Button
                    variant="ghost"
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-status-muted focus:outline-none cursor-pointer flex items-center justify-center animate-fade-in"
                    >
                      {showConfirmPassword ? (
                        <EyeOff size={14} />
                      ) : (
                        <Eye size={14} />
                      )}
                    </Button>
                  </div>
                  {passwordErrors.confirmPassword && (
                    <span className="text-2xs text-status-danger font-bold text-left">
                      {passwordErrors.confirmPassword}
                    </span>
                  )}
                </div>

                <div className="flex justify-end gap-2.5 mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs-portal font-bold text-status-muted hover:underline"
                    onClick={() => {
                      setIsEditingPassword(false);
                      setPasswordData({
                        currentPassword: "",
                        newPassword: "",
                        confirmPassword: "",
                      });
                      setPasswordErrors({});
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    className="text-xs-portal font-bold px-4 py-1.5 rounded-md"
                    onClick={async () => {
                      const success = await handlePasswordChange();
                      if (success) {
                        setIsEditingPassword(false);
                      }
                    }}
                    disabled={passwordLoading}
                  >
                    {passwordLoading ? "Updating..." : "Update Password"}
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className="flex items-center justify-between p-3 border border-card-border rounded-card hover:bg-surface-light/50 transition-colors cursor-pointer group"
                onClick={() => setIsEditingPassword(true)}
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-8 h-8 rounded-full bg-status-info-bg text-status-info flex items-center justify-center shrink-0">
                    <KeyRound size={13} />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-brand-primary leading-tight">
                      Change Password
                    </span>
                    <span className="text-2xs text-gray-400 font-semibold mt-0.5">
                      Update your password
                    </span>
                  </div>
                </div>
                <ChevronRight
                  size={13}
                  className="text-sidebar-text-muted group-hover:text-status-info transition-colors"
                />
              </div>
            )}

            <div
              onClick={handleExportData}
              className="flex items-center justify-between p-3 border border-card-border rounded-card hover:bg-status-info/5 transition-colors cursor-pointer group mb-2.5"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-8 h-8 rounded-full bg-status-info-bg text-status-info flex items-center justify-center shrink-0">
                  <Download size={13} />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-brand-primary leading-tight">
                    Export My Data
                  </span>
                  <span className="text-2xs text-gray-400 font-semibold mt-0.5">
                    Download a copy of your personal data (JSON)
                  </span>
                </div>
              </div>
              <ChevronRight
                size={13}
                className="text-sidebar-text-muted group-hover:text-status-info transition-colors"
              />
            </div>

            <div
              onClick={handleDeleteAccount}
              className="flex items-center justify-between p-3 border border-card-border rounded-card hover:bg-red-50/20 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-8 h-8 rounded-full bg-status-danger-bg text-status-danger flex items-center justify-center shrink-0">
                  <Trash size={13} />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-brand-primary leading-tight">
                    Delete Account
                  </span>
                  <span className="text-2xs text-gray-400 font-semibold mt-0.5">
                    Permanently delete your account and all data
                  </span>
                </div>
              </div>
              <ChevronRight
                size={13}
                className="text-sidebar-text-muted group-hover:text-status-danger transition-colors"
              />
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleLogout}
              className="text-xs-portal font-bold card-bg text-status-danger border-status-danger/20 hover:bg-status-danger/5"
            >
              Log Out
            </Button>
          </div>
        </PortalCard>
      </div>
    </div>
  );
};
