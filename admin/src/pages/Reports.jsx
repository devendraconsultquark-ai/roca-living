import { useState, useEffect } from 'react';
import { BarChart3, DollarSign, Home, AlertTriangle, PiggyBank } from 'lucide-react';
import { Button } from '../components/UI/Button';
import { DataTable } from '../components/UI/DataTable';
import { useToast } from '../components/UI/ToastContext';
import { Skeleton } from '../components/UI/Skeleton';
import api from '../utilities/api';

const toCsv = (rows, headers) => {
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [
    headers.map((h) => escape(h.label)).join(','),
    ...rows.map((r) => headers.map((h) => escape(r[h.key])).join(','))
  ].join('\n');
};

export const Reports = () => {
  const [pipeline, setPipeline] = useState(null);
  const [arrears, setArrears] = useState({ landlord_summary: [], overdue_schedules: [] });
  const [expiries, setExpiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      try {
        const [pipelineRes, arrearsRes, expiriesRes] = await Promise.all([
          api.get('/reports/pipeline'),
          api.get('/reports/arrears'),
          api.get('/reports/compliance-expiries'),
        ]);
        setPipeline(pipelineRes.data.data || null);
        setArrears(arrearsRes.data.data || { landlord_summary: [], overdue_schedules: [] });
        setExpiries(expiriesRes.data.data || []);
      } catch (err) {
        addToast(err.response?.data?.message || 'Failed to load reports', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExportArrears = () => {
    if (!arrears.overdue_schedules.length) {
      addToast('No overdue rent to export', 'info');
      return;
    }
    const csv = toCsv(arrears.overdue_schedules, [
      { key: 'tenancy_id', label: 'Tenancy ID' },
      { key: 'landlord_name', label: 'Landlord' },
      { key: 'property_address', label: 'Property' },
      { key: 'due_date', label: 'Due Date' },
      { key: 'amount', label: 'Amount (£)' },
    ]);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'arrears-report.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    addToast(`Exported ${arrears.overdue_schedules.length} overdue schedules to CSV`, 'success');
  };

  const occupancy = pipeline && pipeline.total_properties > 0
    ? Math.round((pipeline.let / pipeline.total_properties) * 100)
    : 0;

  const tiles = pipeline ? [
    {
      name: 'YTD Collected Rent',
      value: `£${parseFloat(pipeline.ytd_revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      change: 'Reconciled rent received this calendar year',
      type: 'success'
    },
    {
      name: 'Portfolio Occupancy Rate',
      value: `${occupancy}%`,
      icon: Home,
      change: `${pipeline.let} of ${pipeline.total_properties} units currently let`,
      type: 'success'
    },
    {
      name: 'Rent Overdue',
      value: `£${parseFloat(pipeline.rent_overdue_total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      icon: AlertTriangle,
      change: `${pipeline.rent_overdue_count} overdue schedule(s)`,
      type: pipeline.rent_overdue_count > 0 ? 'danger' : 'success'
    },
    {
      name: 'Deposits Pending Registration',
      value: `${pipeline.deposits_pending_registration}`,
      icon: PiggyBank,
      change: `${pipeline.statements_pending} draft statement(s) awaiting dispatch`,
      type: pipeline.deposits_pending_registration > 0 ? 'danger' : 'success'
    },
  ] : [];

  const arrearsColumns = [
    { header: 'Landlord', accessor: 'landlord_name', sortable: true },
    {
      header: 'Total Arrears',
      accessor: 'total_arrears',
      align: 'right',
      sortable: true,
      renderCell: (row) => (
        <span className="text-status-danger font-bold">£{parseFloat(row.total_arrears).toFixed(2)}</span>
      )
    },
    { header: 'Properties Affected', accessor: 'properties_affected', align: 'center', sortable: true },
    { header: 'Oldest Overdue', accessor: 'oldest_overdue_date', sortable: true },
  ];

  const expiriesColumns = [
    { header: 'Certificate', accessor: 'cert_type', sortable: true },
    { header: 'Property', accessor: 'property_address', sortable: true },
    { header: 'Landlord', accessor: 'landlord_name', sortable: true },
    { header: 'Expires On', accessor: 'expires_at', sortable: true },
    {
      header: 'Days Left',
      accessor: 'expires_in_days',
      align: 'center',
      sortable: true,
      renderCell: (row) => (
        <span className={`px-2 py-0.5 text-2xs font-bold rounded-sm border ${
          row.expires_in_days < 0
            ? 'bg-status-danger-bg text-status-danger border-status-danger/15'
            : row.expires_in_days <= 30
              ? 'bg-status-warning/10 text-status-warning border-status-warning/15'
              : 'bg-status-success-bg text-status-success border-status-success/15'
        }`}>
          {row.expires_in_days < 0 ? `Expired ${Math.abs(row.expires_in_days)}d ago` : `${row.expires_in_days} days`}
        </span>
      )
    },
  ];

  const renderSkeleton = () => (
    <div className="space-y-4 py-4">
      <Skeleton radius="bar" className="h-10 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );

  return (
    <div className="py-6 max-w-[1440px] mx-auto px-8 flex flex-col gap-6 font-sans text-brand-primary">
      {/* Page actions (title lives in the layout header) */}
      <div className="flex justify-end">
        <Button variant="primary" icon={BarChart3} onClick={handleExportArrears}>
          Export Arrears CSV
        </Button>
      </div>

      {/* Reports Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
          [...Array(4)].map((_, idx) => (
            <Skeleton key={idx} radius="card" className="h-28" />
          ))
        ) : (
          tiles.map((rep, idx) => {
            const Icon = rep.icon;
            return (
              <div key={idx} className="card-bg border border-card-border rounded-card shadow-premium p-6 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <span className="text-2xs font-bold text-gray-400 uppercase tracking-wider">{rep.name}</span>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    rep.type === 'success'
                      ? 'bg-status-success/10 text-status-success'
                      : rep.type === 'danger'
                        ? 'bg-status-danger/10 text-status-danger'
                        : 'bg-brand-accent/10 text-brand-accent'
                  }`}>
                    <Icon size={16} />
                  </div>
                </div>
                <div>
                  <span className="text-2xl font-black text-brand-primary tracking-tight">{rep.value}</span>
                  <p className="text-xs-portal text-gray-400 mt-1.5 font-semibold">{rep.change}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Arrears by Landlord */}
      <div className="card-bg border border-card-border rounded-card shadow-premium p-4">
        <h3 className="text-sm-portal font-bold text-brand-primary uppercase tracking-wider px-2 pt-2 pb-3 border-b border-card-border mb-3">Arrears by Landlord</h3>
        {loading ? renderSkeleton() : (
          arrears.landlord_summary.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-400 font-medium">No rent arrears — all schedules up to date.</div>
          ) : (
            <DataTable columns={arrearsColumns} data={arrears.landlord_summary} />
          )
        )}
      </div>

      {/* Compliance Expiries */}
      <div className="card-bg border border-card-border rounded-card shadow-premium p-4">
        <h3 className="text-sm-portal font-bold text-brand-primary uppercase tracking-wider px-2 pt-2 pb-3 border-b border-card-border mb-3">Compliance Expiries (Next 90 Days)</h3>
        {loading ? renderSkeleton() : (
          expiries.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-400 font-medium">No certificates expiring in the next 90 days.</div>
          ) : (
            <DataTable columns={expiriesColumns} data={expiries} />
          )
        )}
      </div>
    </div>
  );
};
