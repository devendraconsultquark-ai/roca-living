import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save } from 'lucide-react';
import { useToast } from '../components/UI/ToastContext';
import { Input } from '../components/UI/Input';
import { Button } from '../components/UI/Button';
import api from '../utilities/api';

export const Settings = () => {
  const { addToast } = useToast();
  const [agencyFee, setAgencyFee] = useState('12.0');
  const [depositSchemeNum, setDepositSchemeNum] = useState('TDS-ROCA-5001');
  const [vatRate, setVatRate] = useState('20.0');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await api.get('/settings');
        if (response.data?.success && response.data?.data) {
          const { agencyFee, depositSchemeNum, vatRate } = response.data.data;
          if (agencyFee !== undefined) setAgencyFee(agencyFee);
          if (depositSchemeNum !== undefined) setDepositSchemeNum(depositSchemeNum);
          if (vatRate !== undefined) setVatRate(vatRate);
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
        addToast('Failed to load settings from server', 'error');
      }
    };
    fetchSettings();
  }, [addToast]);

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await api.post('/settings', {
        agencyFee,
        vatRate,
        depositSchemeNum
      });
      if (response.data?.success) {
        addToast('System settings saved successfully!', 'success');
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
      addToast(err.response?.data?.message || 'Failed to save settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-6 max-w-[1440px] mx-auto px-8 flex flex-col gap-6 font-sans text-brand-primary">
      {/* Settings Form (title lives in the layout header) */}
      <form onSubmit={handleSave} className="card-bg border border-card-border rounded-card p-6 md:p-8 shadow-premium flex flex-col gap-6">

        {/* Billing Section */}
        <div className="flex flex-col gap-4">
          <h3 className="text-sm-portal font-bold text-brand-primary uppercase tracking-wider flex items-center gap-2 select-none">
            <SettingsIcon size={16} className="text-brand-accent" />
            Financial Settings
          </h3>
          <div className="border-t border-card-border pt-4 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Input
              label="Standard Management Commission Fee (%)"
              id="agencyFee"
              required
              value={agencyFee}
              onChange={(e) => setAgencyFee(e.target.value)}
              disabled={loading}
            />
            <Input
              label="Value Added Tax (VAT) rate (%)"
              id="vatRate"
              required
              value={vatRate}
              onChange={(e) => setVatRate(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        {/* Deposit scheme parameters */}
        <div className="flex flex-col gap-4 mt-2">
          <h3 className="text-sm-portal font-bold text-brand-primary uppercase tracking-wider flex items-center gap-2 select-none">
            <SettingsIcon size={16} className="text-brand-accent" />
            Deposit Protection Settings
          </h3>
          <div className="border-t border-card-border pt-4 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Input
              label="Tenancy Deposit Scheme (TDS) Agency ID"
              id="depositSchemeNum"
              required
              value={depositSchemeNum}
              onChange={(e) => setDepositSchemeNum(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="border-t border-card-border pt-6 flex justify-end">
          <Button
            type="submit"
            variant="primary"
            icon={Save}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>

      </form>
    </div>
  );
};
