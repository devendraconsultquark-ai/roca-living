import React, { useState } from 'react';
import { Settings as SettingsIcon, Save } from 'lucide-react';
import { useToast } from '../components/UI/ToastContext';
import { Input } from '../components/UI/Input';
import { Button } from '../components/UI/Button';

export const Settings = () => {
  const { addToast } = useToast();
  const [agencyFee, setAgencyFee] = useState('12.0');
  const [depositSchemeNum, setDepositSchemeNum] = useState('TDS-ROCA-5001');
  const [vatRate, setVatRate] = useState('20.0');

  const handleSave = (e) => {
    e.preventDefault();
    addToast('System settings saved successfully!', 'success');
  };

  return (
    <div className="py-6 max-w-4xl mx-auto px-4 flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-[#1A1A1A]">System Settings</h2>
        <p className="text-sm text-gray-500 mt-1">Configure global fee values, deposit parameters, and client templates.</p>
      </div>

      {/* Settings Form */}
      <form onSubmit={handleSave} className="bg-white border border-border-color/60 rounded-2xl p-6 md:p-8 shadow-sm flex flex-col gap-6">

        {/* Billing Section */}
        <div className="flex flex-col gap-4">
          <h3 className="font-bold text-sm text-gray-400 uppercase tracking-wider flex items-center gap-2 select-none">
            <SettingsIcon size={16} className="text-brand-accent" />
            Financial Settings
          </h3>
          <div className="border-t border-border-color/60 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Input
              label="Standard Management Commission Fee (%)"
              id="agencyFee"
              required
              value={agencyFee}
              onChange={(e) => setAgencyFee(e.target.value)}
            />
            <Input
              label="Value Added Tax (VAT) rate (%)"
              id="vatRate"
              required
              value={vatRate}
              onChange={(e) => setVatRate(e.target.value)}
            />
          </div>
        </div>

        {/* Deposit scheme parameters */}
        <div className="flex flex-col gap-4 mt-2">
          <h3 className="font-bold text-sm text-gray-400 uppercase tracking-wider flex items-center gap-2 select-none">
            <SettingsIcon size={16} className="text-brand-accent" />
            Deposit Protection Settings
          </h3>
          <div className="border-t border-border-color/60 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Input
              label="Tenancy Deposit Scheme (TDS) Agency ID"
              id="depositSchemeNum"
              required
              value={depositSchemeNum}
              onChange={(e) => setDepositSchemeNum(e.target.value)}
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="border-t border-border-color/60 pt-6 flex justify-end">
          <Button
            type="submit"
            variant="primary"
            icon={Save}
          >
            Save Settings
          </Button>
        </div>

      </form>
    </div>
  );
};
