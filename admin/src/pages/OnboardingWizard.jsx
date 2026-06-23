import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, User, ShieldCheck, Home, ClipboardList, CalendarDays, Key } from 'lucide-react';
import { Input } from '../components/UI/Input';
import { Dropdown } from '../components/UI/Dropdown';
import { Button } from '../components/UI/Button';
import api from '../utilities/api';
import { useToast } from '../components/UI/ToastContext';


const steps = [
  { id: 1, name: 'Landlord & ToB', icon: User },
  { id: 2, name: 'KYC & Ownership', icon: ShieldCheck },
  { id: 3, name: 'Property & Compliance', icon: Home },
  { id: 4, name: 'Agent Instruction', icon: ClipboardList },
  { id: 5, name: 'Tenancy & Deposit', icon: CalendarDays },
  { id: 6, name: 'Utilities & Move-in', icon: Key },
];

export const OnboardingWizard = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [createdIds, setCreatedIds] = useState(null);
  const { addToast } = useToast();


  // Centralized onboarding form data
  const [formData, setFormData] = useState({
    // Step 1: Landlord & ToB
    landlordName: '',
    landlordEmail: '',
    landlordPhone: '',
    tobStatus: '',

    // Step 2: KYC & Ownership
    passportNumber: '',
    kycStatus: '',
    ownershipShare: '',

    // Step 3: Property & Compliance
    addressLine1: '',
    city: '',
    postcode: '',
    gasSafety: '',
    eicrStatus: '',

    // Step 4: Agent Instruction
    serviceLevel: '',
    managementFee: '',
    marketingPrice: '',

    // Step 5: Tenancy & Deposit
    tenantName: '',
    rentPrice: '',
    startDate: '',
    depositSchemeId: '',

    // Step 6: Utilities & Move-in
    utilityProvider: '',
    councilTaxBand: '',
    moveInChecklist: '',
  });

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
    if (errors[id]) setErrors((prev) => ({ ...prev, [id]: '' }));
  };

  // Dropdown onChange adapter — maps field id to a direct value setter
  const handleDropdownChange = (fieldId) => (value) => {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
    if (errors[fieldId]) setErrors((prev) => ({ ...prev, [fieldId]: '' }));
  };

  const validateStep = (step) => {
    const stepErrors = {};

    if (step === 1) {
      if (!formData.landlordName.trim()) stepErrors.landlordName = 'Landlord Name is required';
      if (!formData.landlordEmail.trim()) {
        stepErrors.landlordEmail = 'Landlord Email is required';
      } else if (!/\S+@\S+\.\S+/.test(formData.landlordEmail)) {
        stepErrors.landlordEmail = 'Please enter a valid email address';
      }
      if (!formData.landlordPhone.trim()) stepErrors.landlordPhone = 'Landlord Phone is required';
      if (!formData.tobStatus) stepErrors.tobStatus = 'ToB status selection is required';
    }

    if (step === 2) {
      if (!formData.passportNumber.trim()) stepErrors.passportNumber = 'ID / Passport Number is required';
      if (!formData.kycStatus) stepErrors.kycStatus = 'KYC check status is required';
      if (!formData.ownershipShare.trim()) {
        stepErrors.ownershipShare = 'Ownership Share % is required';
      } else {
        const num = Number(formData.ownershipShare);
        if (isNaN(num) || num < 1 || num > 100) {
          stepErrors.ownershipShare = 'Must be a percentage between 1 and 100';
        }
      }
    }

    if (step === 3) {
      if (!formData.addressLine1.trim()) stepErrors.addressLine1 = 'Address is required';
      if (!formData.city.trim()) stepErrors.city = 'Town / City is required';
      if (!formData.postcode.trim()) stepErrors.postcode = 'Postcode is required';
      if (!formData.gasSafety) stepErrors.gasSafety = 'Gas safety status is required';
      if (!formData.eicrStatus) stepErrors.eicrStatus = 'EICR status is required';
    }

    if (step === 4) {
      if (!formData.serviceLevel) stepErrors.serviceLevel = 'Service Level is required';
      if (!formData.managementFee.trim()) {
        stepErrors.managementFee = 'Management Fee % is required';
      } else {
        const num = Number(formData.managementFee);
        if (isNaN(num) || num < 0 || num > 50) {
          stepErrors.managementFee = 'Must be a valid fee percentage (0-50%)';
        }
      }
      if (!formData.marketingPrice.trim()) {
        stepErrors.marketingPrice = 'Marketing Price is required';
      } else {
        const num = Number(formData.marketingPrice);
        if (isNaN(num) || num <= 0) {
          stepErrors.marketingPrice = 'Must be a positive price amount';
        }
      }
    }

    if (step === 5) {
      if (!formData.tenantName.trim()) stepErrors.tenantName = 'Tenant Name is required';
      if (!formData.rentPrice.trim()) {
        stepErrors.rentPrice = 'Monthly Rent is required';
      } else {
        const num = Number(formData.rentPrice);
        if (isNaN(num) || num <= 0) {
          stepErrors.rentPrice = 'Must be a positive rent amount';
        }
      }
      if (!formData.startDate) stepErrors.startDate = 'Tenancy Start Date is required';
      if (!formData.depositSchemeId.trim()) stepErrors.depositSchemeId = 'TDS Deposit Scheme ID is required';
    }

    if (step === 6) {
      if (!formData.utilityProvider.trim()) stepErrors.utilityProvider = 'Utility Provider is required';
      if (!formData.councilTaxBand) stepErrors.councilTaxBand = 'Council Tax Band is required';
      if (!formData.moveInChecklist) stepErrors.moveInChecklist = 'Move-in checklist compliance is required';
    }

    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  const handleNext = async () => {
    if (validateStep(currentStep)) {
      if (currentStep < 6) {
        setCurrentStep((prev) => prev + 1);
      } else {
        setSubmitting(true);
        try {
          const res = await api.post('/onboarding', formData);
          if (res.data && res.data.success) {
            setCreatedIds(res.data.data);
            setIsSuccess(true);
          }
        } catch (error) {
          addToast(error.response?.data?.message || 'Onboarding failed', 'error');
        } finally {
          setSubmitting(false);
        }
      }
    }
  };


  const handleBack = () => {
    setErrors({});
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleReset = () => {
    setFormData({
      landlordName: '',
      landlordEmail: '',
      landlordPhone: '',
      tobStatus: '',
      passportNumber: '',
      kycStatus: '',
      ownershipShare: '',
      addressLine1: '',
      city: '',
      postcode: '',
      gasSafety: '',
      eicrStatus: '',
      serviceLevel: '',
      managementFee: '',
      marketingPrice: '',
      tenantName: '',
      rentPrice: '',
      startDate: '',
      depositSchemeId: '',
      utilityProvider: '',
      councilTaxBand: '',
      moveInChecklist: '',
    });
    setErrors({});
    setIsSuccess(false);
    setCurrentStep(1);
    setCreatedIds(null);
  };

  const progressPercent = (currentStep / 6) * 100;

  return (
    <div className="py-6 max-w-4xl mx-auto px-4">
      {/* Title */}
      <div className="mb-8 text-center sm:text-left">
        <h2 className="text-2xl font-bold text-[#1A1A1A]">New-Let Onboarding Wizard</h2>
        <p className="text-sm text-gray-500 mt-1">Complete the 6 onboarding stages to register the landlord, property, and move-in details.</p>
      </div>

      {isSuccess ? (
        <div className="bg-white border border-border-color rounded-2xl shadow-md p-8 text-center flex flex-col items-center justify-center gap-6">
          <div className="w-16 h-16 bg-status-success rounded-full flex items-center justify-center text-white shadow-lg animate-bounce">
            <Check size={32} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-[#1A1A1A]">Onboarding Completed Successfully!</h3>
            <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
              All 6 steps of compliance, business sign-off, property safety, and move-in utility checklists have been stored.
            </p>
          </div>

          <div className="bg-app-bg rounded-xl p-6 text-left w-full max-w-lg border border-border-color text-xs grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-gray-400 font-semibold">LANDLORD</p>
              <p className="font-bold text-[#1A1A1A] text-sm mt-0.5">{formData.landlordName}</p>
              <p className="text-gray-500">{formData.landlordEmail}</p>
              {createdIds && <p className="text-[10px] text-gray-400 mt-1">ID: {createdIds.landlord_id}</p>}
            </div>
            <div>
              <p className="text-gray-400 font-semibold">PROPERTY ADDRESS</p>
              <p className="font-bold text-[#1A1A1A] text-sm mt-0.5">{formData.addressLine1}</p>
              <p className="text-gray-500">{formData.city}, {formData.postcode}</p>
              {createdIds && <p className="text-[10px] text-gray-400 mt-1">ID: {createdIds.property_id}</p>}
            </div>
            <div>
              <p className="text-gray-400 font-semibold">COMPLIANCE CERTIFICATES</p>
              <p className="font-bold text-[#1A1A1A] text-sm mt-0.5">Gas: {formData.gasSafety}</p>
              <p className="text-gray-500">EICR: {formData.eicrStatus}</p>
            </div>
            <div>
              <p className="text-gray-400 font-semibold">TENANCY DETAILS</p>
              <p className="font-bold text-[#1A1A1A] text-sm mt-0.5">Tenant: {formData.tenantName}</p>
              <p className="text-gray-500">Rent: £{formData.rentPrice}/mo</p>
              {createdIds && <p className="text-[10px] text-gray-400 mt-1">Tenancy ID: {createdIds.tenancy_id}</p>}
            </div>
          </div>


          <div className="flex gap-4">
            <Button variant="secondary" onClick={() => navigate('/dashboard')}>
              Go to Dashboard
            </Button>
            <Button variant="primary" onClick={handleReset}>
              Onboard Another Property
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          
          {/* Step Progress Nodes Indicator */}
          <div className="bg-white border border-border-color rounded-2xl p-6 shadow-sm">
            <div className="relative flex justify-between items-center w-full mb-6 max-w-3xl mx-auto">
              
              {/* Connected Line Background */}
              <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200 -translate-y-1/2 z-0" />
              
              {/* Connected Line Foreground */}
              <div 
                className="absolute top-5 left-0 h-0.5 bg-brand-accent -translate-y-1/2 z-0 transition-all duration-300"
                style={{ width: `${((currentStep - 1) / 5) * 100}%` }}
              />

              {steps.map((step) => {
                const isCompleted = step.id < currentStep;
                const isActive = step.id === currentStep;

                let nodeStyle = 'bg-white border-2 border-gray-300 text-gray-400';
                if (isCompleted) {
                  nodeStyle = 'bg-status-success text-white border-status-success shadow';
                } else if (isActive) {
                  nodeStyle = 'bg-brand-accent text-white border-brand-accent shadow';
                }

                return (
                  <div key={step.id} className="relative z-10 flex flex-col items-center flex-1">
                    <button
                      type="button"
                      disabled={step.id > currentStep && !isCompleted}
                      onClick={() => setCurrentStep(step.id)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm cursor-pointer transition-all duration-300 focus:outline-none ${nodeStyle}`}
                    >
                      {isCompleted ? <Check size={16} /> : step.id}
                    </button>
                    <span 
                      className={`hidden sm:block text-[11px] font-bold mt-2 text-center select-none ${
                        isActive ? 'text-brand-accent' : isCompleted ? 'text-status-success' : 'text-gray-400'
                      }`}
                    >
                      {step.name}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Progress bar info underneath */}
            <div className="border-t border-border-color/50 pt-4 flex flex-col gap-2 max-w-3xl mx-auto">
              <div className="flex justify-between items-center text-xs font-semibold text-gray-500">
                <span>Step {currentStep} of 6: {steps[currentStep - 1].name}</span>
                <span>{Math.round(progressPercent)}% Complete</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-[6px] overflow-hidden">
                <div 
                  className="bg-brand-accent h-full rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Form Step Container */}
          <div className="bg-white border border-border-color rounded-2xl shadow-sm">
            <div className="bg-brand-primary/5 border-b border-border-color p-5 rounded-t-2xl">
              <h3 className="font-bold text-base text-[#1A1A1A] flex items-center gap-2">
                {React.createElement(steps[currentStep - 1].icon, { size: 18, className: "text-brand-accent" })}
                Stage {currentStep}: {steps[currentStep - 1].name}
              </h3>
            </div>

            <div className="p-6 md:p-8">
              {currentStep === 1 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Input
                    label="Landlord Full Name"
                    id="landlordName"
                    required
                    placeholder="e.g. John Doe"
                    value={formData.landlordName}
                    error={errors.landlordName}
                    onChange={handleChange}
                  />
                  <Input
                    label="Landlord Email Address"
                    id="landlordEmail"
                    type="email"
                    required
                    placeholder="e.g. john.doe@example.com"
                    value={formData.landlordEmail}
                    error={errors.landlordEmail}
                    onChange={handleChange}
                  />
                  <Input
                    label="Landlord Contact Phone"
                    id="landlordPhone"
                    required
                    placeholder="e.g. +44 7123 456789"
                    value={formData.landlordPhone}
                    error={errors.landlordPhone}
                    onChange={handleChange}
                  />
                  <Dropdown
                    label="Terms of Business (ToB)"
                    id="tobStatus"
                    placeholder="Select ToB status"
                    value={formData.tobStatus}
                    error={errors.tobStatus}
                    onChange={handleDropdownChange('tobStatus')}
                    options={[
                      { value: 'Signed', label: 'Signed & Executed' },
                      { value: 'Sent', label: 'Sent to Client (Pending Signature)' },
                      { value: 'Not Sent', label: 'Not Sent' },
                    ]}
                  />
                </div>
              )}

              {currentStep === 2 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Input
                    label="Passport / ID Number"
                    id="passportNumber"
                    required
                    placeholder="e.g. GBR12345678"
                    value={formData.passportNumber}
                    error={errors.passportNumber}
                    onChange={handleChange}
                  />
                  <Dropdown
                    label="KYC Verification Status"
                    id="kycStatus"
                    placeholder="Select KYC outcome"
                    value={formData.kycStatus}
                    error={errors.kycStatus}
                    onChange={handleDropdownChange('kycStatus')}
                    options={[
                      { value: 'Passed', label: 'Verified / Passed' },
                      { value: 'Pending', label: 'Documents Uploaded (Pending Review)' },
                      { value: 'Failed', label: 'Failed' },
                    ]}
                  />
                  <Input
                    label="Ownership Share (%)"
                    id="ownershipShare"
                    type="number"
                    required
                    placeholder="e.g. 100"
                    value={formData.ownershipShare}
                    error={errors.ownershipShare}
                    onChange={handleChange}
                  />
                </div>
              )}

              {currentStep === 3 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Input
                    label="Property Address Line 1"
                    id="addressLine1"
                    required
                    placeholder="e.g. Flat 12, Living Towers"
                    value={formData.addressLine1}
                    error={errors.addressLine1}
                    onChange={handleChange}
                    className="md:col-span-2"
                  />
                  <Input
                    label="Town / City"
                    id="city"
                    required
                    placeholder="e.g. London"
                    value={formData.city}
                    error={errors.city}
                    onChange={handleChange}
                  />
                  <Input
                    label="Postcode"
                    id="postcode"
                    required
                    placeholder="e.g. EC1A 1BB"
                    value={formData.postcode}
                    error={errors.postcode}
                    onChange={handleChange}
                  />
                  <Dropdown
                    label="Gas Safety Certificate (CP12)"
                    id="gasSafety"
                    placeholder="Select status"
                    value={formData.gasSafety}
                    error={errors.gasSafety}
                    onChange={handleDropdownChange('gasSafety')}
                    options={[
                      { value: 'Compliant', label: 'Compliant (Valid certificate)' },
                      { value: 'Non-Compliant', label: 'Non-Compliant (Expired / Missing)' },
                      { value: 'N/A', label: 'N/A (No gas supply at property)' },
                    ]}
                  />
                  <Dropdown
                    label="Electrical Installation Safety (EICR)"
                    id="eicrStatus"
                    placeholder="Select status"
                    value={formData.eicrStatus}
                    error={errors.eicrStatus}
                    onChange={handleDropdownChange('eicrStatus')}
                    options={[
                      { value: 'Compliant', label: 'Compliant (Satisfactory)' },
                      { value: 'Non-Compliant', label: 'Non-Compliant (Unsatisfactory / Expired)' },
                    ]}
                  />
                </div>
              )}

              {currentStep === 4 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Dropdown
                    label="Agent Service Level"
                    id="serviceLevel"
                    placeholder="Select service level"
                    value={formData.serviceLevel}
                    error={errors.serviceLevel}
                    onChange={handleDropdownChange('serviceLevel')}
                    options={[
                      { value: 'Fully Managed', label: 'Fully Managed' },
                      { value: 'Rent Collection', label: 'Rent Collection Only' },
                      { value: 'Let Only', label: 'Let Only (Tenant Find)' },
                    ]}
                  />
                  <Input
                    label="Management Fee (%)"
                    id="managementFee"
                    type="number"
                    required
                    placeholder="e.g. 12"
                    value={formData.managementFee}
                    error={errors.managementFee}
                    onChange={handleChange}
                  />
                  <Input
                    label="Monthly Marketing Rent (£)"
                    id="marketingPrice"
                    type="number"
                    required
                    placeholder="e.g. 1850"
                    value={formData.marketingPrice}
                    error={errors.marketingPrice}
                    onChange={handleChange}
                  />
                </div>
              )}

              {currentStep === 5 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Input
                    label="Tenant Full Name"
                    id="tenantName"
                    required
                    placeholder="e.g. Jane Smith"
                    value={formData.tenantName}
                    error={errors.tenantName}
                    onChange={handleChange}
                  />
                  <Input
                    label="Agreed Monthly Rent (£)"
                    id="rentPrice"
                    type="number"
                    required
                    placeholder="e.g. 1850"
                    value={formData.rentPrice}
                    error={errors.rentPrice}
                    onChange={handleChange}
                  />
                  <Input
                    label="Tenancy Start Date"
                    id="startDate"
                    type="date"
                    required
                    value={formData.startDate}
                    error={errors.startDate}
                    onChange={handleChange}
                  />
                  <Input
                    label="Deposit Scheme (TDS) Certificate ID"
                    id="depositSchemeId"
                    required
                    placeholder="e.g. TDS-998877"
                    value={formData.depositSchemeId}
                    error={errors.depositSchemeId}
                    onChange={handleChange}
                  />
                </div>
              )}

              {currentStep === 6 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Input
                    label="Utility Provider (Gas & Electric)"
                    id="utilityProvider"
                    required
                    placeholder="e.g. British Gas / Octopus"
                    value={formData.utilityProvider}
                    error={errors.utilityProvider}
                    onChange={handleChange}
                  />
                  <Dropdown
                    label="Council Tax Band"
                    id="councilTaxBand"
                    placeholder="Select band"
                    value={formData.councilTaxBand}
                    error={errors.councilTaxBand}
                    onChange={handleDropdownChange('councilTaxBand')}
                    options={[
                      { value: 'A', label: 'Band A' },
                      { value: 'B', label: 'Band B' },
                      { value: 'C', label: 'Band C' },
                      { value: 'D', label: 'Band D' },
                      { value: 'E', label: 'Band E' },
                      { value: 'F', label: 'Band F' },
                      { value: 'G', label: 'Band G' },
                      { value: 'H', label: 'Band H' },
                    ]}
                  />
                  <Dropdown
                    label="Move-in Checklist Compliance"
                    id="moveInChecklist"
                    placeholder="Select checklist verification status"
                    value={formData.moveInChecklist}
                    error={errors.moveInChecklist}
                    onChange={handleDropdownChange('moveInChecklist')}
                    options={[
                      { value: 'Completed', label: 'Completed (Keys handed, inventory signed)' },
                      { value: 'Pending', label: 'Pending Signature / Keys' },
                    ]}
                  />
                </div>
              )}
            </div>

            {/* Footer with actions */}
            <div className="bg-gray-50 border-t border-border-color px-6 py-4 flex justify-between items-center rounded-b-2xl">
              <div>
                {currentStep > 1 && (
                  <Button variant="secondary" onClick={handleBack}>
                    Back
                  </Button>
                )}
              </div>
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => navigate('/dashboard')}>
                  Cancel
                </Button>
                 <Button variant="primary" onClick={handleNext} disabled={submitting}>
                  {submitting ? 'Saving...' : (currentStep === 6 ? 'Finish & Save' : 'Save & Continue')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
