import React, { useState, useEffect } from 'react';
import { Home, CheckCircle2, AlertTriangle, Key, HelpCircle } from 'lucide-react';
import { DataTable } from '../components/UI/DataTable';
import { StatusPill } from '../components/UI/StatusPill';
import { useToast } from '../components/UI/ToastContext';
import api from '../utilities/api';

export const Properties = () => {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { addToast } = useToast();

  const fetchMyProperties = async () => {
    setLoading(true);
    try {
      const response = await api.get('/properties/my');
      const formatted = (response.data.data || []).map((p) => ({
        ...p,
        address: `${p.address_line1}${p.address_line2 ? `, ${p.address_line2}` : ''}, ${p.city} ${p.postcode}`,
        tenant: '-', // Tenant is not defined in DB schema for Phase 1
        rent: p.rent_pcm ? parseFloat(p.rent_pcm) : 0,
        status: p.status
      }));
      setProperties(formatted);
      setError(null);
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Error loading properties';
      setError(errMsg);
      addToast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyProperties();
  }, []);

  const renderCertStatus = (statusValue) => {
    if (!statusValue || statusValue === 'not_uploaded') return '-';
    const config = {
      compliant: { color: 'text-status-success', icon: CheckCircle2, text: 'Compliant' },
      expiring_soon: { color: 'text-status-warning', icon: AlertTriangle, text: 'Expiring Soon' },
      expired: { color: 'text-status-danger', icon: AlertTriangle, text: 'Expired' }
    };
    const item = config[statusValue] || { color: 'text-status-muted', icon: HelpCircle, text: statusValue };
    const Icon = item.icon;
    return (
      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${item.color}`}>
        <Icon size={13} />
        {item.text}
      </span>
    );
  };

  const columns = [
    { header: 'Property Ref', accessor: 'id', sortable: true },
    { header: 'Property Address', accessor: 'address', sortable: true },
    { header: 'Current Tenant', accessor: 'tenant', sortable: true },
    { 
      header: 'Monthly Rent', 
      accessor: 'rent', 
      align: 'right', 
      sortable: true,
      renderCell: (row) => {
        const rentVal = typeof row.rent === 'number' ? row.rent : parseFloat(row.rent);
        return rentVal !== null && rentVal !== undefined && !isNaN(rentVal) && rentVal > 0 
          ? `£${rentVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}` 
          : '-';
      }
    },
    { 
      header: 'Occupancy', 
      accessor: 'status',
      renderCell: (row) => {
        let pillStatus = 'draft';
        if (row.status === 'let') pillStatus = 'active';
        else if (row.status === 'vacant') pillStatus = 'pending';
        else if (row.status === 'onboarding') pillStatus = 'draft';
        return <StatusPill status={pillStatus} customLabel={row.status === 'let' ? 'Occupied' : row.status === 'vacant' ? 'Vacant' : 'Onboarding'} />;
      }
    },
    { 
      header: 'Gas Certificate', 
      accessor: 'gasCompliance',
      renderCell: (row) => renderCertStatus(row.gasCompliance)
    },
    { 
      header: 'EPC Safety', 
      accessor: 'epcCompliance',
      renderCell: (row) => renderCertStatus(row.epcCompliance)
    },
    { 
      header: 'EICR Electrical', 
      accessor: 'eicrCompliance',
      renderCell: (row) => renderCertStatus(row.eicrCompliance)
    },
  ];

  // Calculate gross yield (sum of rents of occupied/let properties)
  const monthlyGrossYield = properties
    .filter(p => p.status === 'let')
    .reduce((sum, p) => sum + (p.rent || 0), 0);

  // Count active warnings (expired certs)
  const complianceWarnings = properties.filter(
    p => p.gasCompliance === 'expired' || p.epcCompliance === 'expired' || p.eicrCompliance === 'expired'
  ).length;

  return (
    <div className="py-6 max-w-7xl mx-auto px-4 flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-[#1A1A1A]">My Properties</h2>
        <p className="text-sm text-gray-500 mt-1">Review active property listings, rent payouts, and regulatory safety check checklists.</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 select-none">
        <div className="bg-white p-5 rounded-2xl border border-border-color/60 shadow-sm flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Managed Units</span>
            <span className="text-xl font-bold text-[#1A1A1A] mt-0.5">{properties.length} Properties</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-brand-primary/10 text-brand-primary flex items-center justify-center shrink-0">
            <Home size={18} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-border-color/60 shadow-sm flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Monthly Gross Yield</span>
            <span className="text-xl font-bold text-status-success mt-0.5">
              £{monthlyGrossYield.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-status-success/10 text-status-success flex items-center justify-center shrink-0">
            <Key size={18} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-border-color/60 shadow-sm flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Compliance Status</span>
            <span className="text-xl font-bold text-status-warning mt-0.5">
              {complianceWarnings > 0 ? `${complianceWarnings} Attention Required` : 'Fully Compliant'}
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-status-warning/10 text-status-warning flex items-center justify-center shrink-0">
            <AlertTriangle size={18} />
          </div>
        </div>
      </div>

      {/* Grid container */}
      <div className="bg-white rounded-2xl border border-border-color/60 p-4 shadow-sm">
        {loading ? (
          <div className="space-y-4 py-4">
            <div className="h-10 bg-gray-100/80 rounded-lg animate-pulse w-full" />
            <div className="h-16 bg-gray-50/80 rounded-lg animate-pulse w-full" />
            <div className="h-16 bg-gray-50/80 rounded-lg animate-pulse w-full" />
            <div className="h-16 bg-gray-50/80 rounded-lg animate-pulse w-full" />
          </div>
        ) : error ? (
          <div className="border border-status-danger bg-status-danger/5 rounded-xl p-6 text-center text-status-danger font-semibold">
            {error}
          </div>
        ) : (
          <DataTable columns={columns} data={properties} />
        )}
      </div>
    </div>
  );
};
