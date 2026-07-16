import { useState, useEffect } from 'react';
import { FileSpreadsheet, Banknote } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/UI/ToastContext';
import { DataTable } from '../components/UI/DataTable';
import { Button } from '../components/UI/Button';
import { Input } from '../components/UI/Input';
import { Dropdown } from '../components/UI/Dropdown';
import { Skeleton } from '../components/UI/Skeleton';
import api from '../utilities/api';

export const AccountingHub = () => {
  const [activeTab, setActiveTab] = useState('incoming');
  const [selectedIncomingIds, setSelectedIncomingIds] = useState([]);
  const { addToast } = useToast();
  const navigate = useNavigate();

  // Record Rent Payment modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [tenanciesList, setTenanciesList] = useState([]);
  const [loadingTenancies, setLoadingTenancies] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const emptyPayment = { tenancy_id: '', received_at: '', amount: '', method: 'bank_transfer', reference: '', notes: '' };
  const [paymentForm, setPaymentForm] = useState(emptyPayment);

  // State data for API tabs
  const [incomingData, setIncomingData] = useState([]);
  const [unreconciledDataState, setUnreconciledDataState] = useState([]);
  const [payoutsDataState, setPayoutsDataState] = useState([]);
  const [landlordsDataState, setLandlordsDataState] = useState([]);
  const [arrearsDataState, setArrearsDataState] = useState([]);
  const [ledgerData, setLedgerData] = useState([]);
  
  const [loading, setLoading] = useState({});

  const fetchTabData = async (tab) => {
    setLoading(prev => ({ ...prev, [tab]: true }));
    try {
      if (tab === 'incoming') {
        const res = await api.get('/accounting/payments?reconciled=1');
        const formatted = (res.data.data || []).map(p => ({
          id: p.id,
          tenancy_id: p.tenancy_id,
          date: p.received_at ? new Date(p.received_at).toLocaleDateString('en-GB') : '-',
          tenant: p.tenant_name || '-',
          property: `${p.address_line1 || ''}, ${p.city || ''}`,
          amount: parseFloat(p.amount || 0),
          method: p.method || '-',
          reference: p.reference || '-',
          status: p.reconciled ? 'Cleared' : 'Pending'
        }));
        setIncomingData(formatted);
      } else if (tab === 'unreconciled') {
        const res = await api.get('/accounting/unreconciled');
        const formatted = (res.data.data || []).map(p => ({
          id: p.id,
          date: p.received_at ? new Date(p.received_at).toLocaleDateString('en-GB') : '-',
          description: p.notes || p.reference || 'RENT PAYMENT RECEIVED',
          amount: parseFloat(p.amount || 0),
          sourceBank: p.method || 'Bank Transfer',
          type: 'Credit'
        }));
        setUnreconciledDataState(formatted);
      } else if (tab === 'payouts') {
        const res = await api.get('/statements');
        const paidStatements = (res.data.data || []).filter(s => s.status === 'paid');
        const formatted = paidStatements.map(s => ({
          id: s.id,
          date: s.paid_at ? new Date(s.paid_at).toLocaleDateString('en-GB') : (s.generated_at ? new Date(s.generated_at).toLocaleDateString('en-GB') : '-'),
          landlord: s.landlord_name || 'Landlord',
          amount: parseFloat(s.net_paid || 0),
          statementRef: s.statement_reference || `STM-${s.id}`,
          status: 'Paid'
        }));
        setPayoutsDataState(formatted);
      } else if (tab === 'ledger') {
        const res = await api.get('/transactions');
        const formatted = (res.data.data || []).map(t => ({
          id: t.id,
          date: t.transaction_date ? new Date(t.transaction_date).toLocaleDateString('en-GB') : '-',
          type: (t.type || '-').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          description: t.description || '-',
          property: t.property_address ? `${t.property_address}, ${t.property_city || ''}` : '-',
          landlord: t.landlord_name || '-',
          amount: parseFloat(t.amount || 0),
          isIncome: t.type === 'rent_in',
          reconciled: !!t.reconciled,
          source: t.statement_id ? `Statement #${t.statement_id}` : (t.ticket_id ? `Ticket #${t.ticket_id}` : '-')
        }));
        setLedgerData(formatted);
      } else if (tab === 'landlords') {
        const landlordsRes = await api.get('/landlords');
        const statementsRes = await api.get('/statements');
        const landlords = landlordsRes.data.data || [];
        const statements = statementsRes.data.data || [];
        const formatted = landlords.map(l => {
          const lStatements = statements.filter(s => s.landlord_id === l.id);
          const invoicedYtd = lStatements.reduce((sum, s) => sum + parseFloat(s.gross_rent || 0), 0);
          const paidYtd = lStatements.filter(s => s.status === 'paid').reduce((sum, s) => sum + parseFloat(s.net_paid || 0), 0);
          const balance = lStatements.filter(s => s.status !== 'paid').reduce((sum, s) => sum + parseFloat(s.net_paid || 0), 0);
          const lastStmt = lStatements[0];
          const lastStatement = lastStmt ? new Date(lastStmt.generated_at).toLocaleDateString('en-GB') : '-';
          return {
            id: l.id,
            name: l.name,
            balance,
            invoicedYtd,
            paidYtd,
            lastStatement
          };
        });
        setLandlordsDataState(formatted);
      } else if (tab === 'arrears') {
        const res = await api.get('/accounting/arrears');
        const formatted = (res.data.data || []).map(a => ({
          id: a.id,
          name: a.name,
          property: a.property,
          rent: parseFloat(a.rent || 0),
          arrears: parseFloat(a.arrears || 0),
          days: a.days,
          lastPaymentDate: a.lastPaymentDate ? new Date(a.lastPaymentDate).toLocaleDateString('en-GB') : '-'
        }));
        setArrearsDataState(formatted);
      }
    } catch (err) {
      console.error(err);
      addToast(err.response?.data?.message || `Failed to fetch data for tab: ${tab}`, 'error');
    } finally {
      setLoading(prev => ({ ...prev, [tab]: false }));
    }
  };

  useEffect(() => {
    fetchTabData(activeTab);
  }, [activeTab]);

  const handleSelectionChange = (selectedIds) => {
    setSelectedIncomingIds(selectedIds);
  };

  const handleBulkReconcile = async () => {
    try {
      for (const paymentId of selectedIncomingIds) {
        const payment = incomingData.find(p => p.id === paymentId);
        if (!payment) continue;
        
        const tenancyRes = await api.get(`/tenancies/${payment.tenancy_id}`);
        const firstDueSchedule = tenancyRes.data.data.rent_schedules.find(s => s.status === 'due' || s.status === 'overdue');
        
        if (firstDueSchedule) {
          await api.patch(`/accounting/rent-payments/${paymentId}/reconcile`, {
            schedule_id: firstDueSchedule.id
          });
        }
      }
      addToast(`Reconciled ${selectedIncomingIds.length} payments successfully`, 'success');
      setSelectedIncomingIds([]);
      fetchTabData(activeTab);
    } catch (err) {
      console.error(err);
      addToast(err.response?.data?.message || 'Failed to reconcile selected payments', 'error');
    }
  };

  const handleBulkExport = () => {
    const rows = incomingData.filter(p => selectedIncomingIds.includes(p.id));
    if (rows.length === 0) {
      addToast('No payments selected to export', 'info');
      return;
    }
    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [
      ['Date', 'Tenant', 'Property', 'Amount', 'Method', 'Reference', 'Status'].map(escape).join(','),
      ...rows.map(r => [r.date, r.tenant, r.property, r.amount.toFixed(2), r.method, r.reference, r.status].map(escape).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'incoming-payments.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    addToast(`Exported ${rows.length} payments to CSV`, 'success');
  };

  const openPaymentModal = async () => {
    setShowPaymentModal(true);
    setLoadingTenancies(true);
    try {
      const res = await api.get('/tenancies?status=active');
      setTenanciesList((res.data.data || []).map(t => ({
        value: String(t.id),
        label: `${t.address_line1 || 'Property'}, ${t.city || ''} — £${parseFloat(t.rent_pcm || 0).toFixed(2)} pcm (${t.landlord_name || '-'})`
      })));
    } catch (err) {
      console.error(err);
      addToast('Failed to load tenancies', 'error');
    } finally {
      setLoadingTenancies(false);
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!paymentForm.tenancy_id || !paymentForm.received_at || !paymentForm.amount) {
      addToast('Tenancy, date received, and amount are required', 'warning');
      return;
    }
    setPaymentSaving(true);
    try {
      const res = await api.post(`/tenancies/${paymentForm.tenancy_id}/rent-payments`, {
        received_at: paymentForm.received_at,
        amount: parseFloat(paymentForm.amount),
        method: paymentForm.method,
        reference: paymentForm.reference || undefined,
        notes: paymentForm.notes || undefined
      });
      const reconciled = res.data?.data?.reconciled;
      addToast(
        reconciled
          ? 'Payment recorded and auto-matched to a rent schedule'
          : 'Payment recorded — no matching schedule found, reconcile it manually',
        reconciled ? 'success' : 'info'
      );
      setShowPaymentModal(false);
      setPaymentForm(emptyPayment);
      fetchTabData('incoming');
      fetchTabData('unreconciled');
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to record payment', 'error');
    } finally {
      setPaymentSaving(false);
    }
  };

  // Tab configurations & columns
  const incomingColumns = [
    { header: 'Date', accessor: 'date', sortable: true },
    { header: 'Tenant Name', accessor: 'tenant', sortable: true },
    { header: 'Property', accessor: 'property', sortable: true },
    { 
      header: 'Amount', 
      accessor: 'amount', 
      align: 'right', 
      sortable: true,
      renderCell: (row) => `£${row.amount.toFixed(2)}`
    },
    { header: 'Method', accessor: 'method', sortable: true },
    { header: 'Reference', accessor: 'reference', sortable: true },
    { 
      header: 'Status', 
      accessor: 'status',
      renderCell: (row) => (
        <span className={`px-2 py-0.5 text-2xs font-bold rounded-sm border ${
          row.status === 'Cleared'
            ? 'bg-status-success-bg text-status-success border-status-success/15'
            : 'bg-status-warning/10 text-status-warning border-status-warning/15'
        }`}>
          {row.status}
        </span>
      )
    },
  ];

  const unreconciledColumns = [
    { header: 'Date', accessor: 'date', sortable: true },
    { header: 'Bank Description', accessor: 'description', sortable: true },
    { 
      header: 'Amount', 
      accessor: 'amount', 
      align: 'right', 
      sortable: true,
      renderCell: (row) => `£${row.amount.toFixed(2)}`
    },
    { header: 'Target Account', accessor: 'sourceBank', sortable: true },
    { header: 'Type', accessor: 'type', sortable: true },
  ];

  const payoutsColumns = [
    { header: 'Transfer Date', accessor: 'date', sortable: true },
    { header: 'Landlord Name', accessor: 'landlord', sortable: true },
    {
      header: 'Amount Paid',
      accessor: 'amount',
      align: 'right',
      sortable: true,
      renderCell: (row) => `£${row.amount.toFixed(2)}`
    },
    { header: 'Statement Ref', accessor: 'statementRef' },
    {
      header: 'Status',
      accessor: 'status',
      renderCell: (row) => (
        <span className="px-2 py-0.5 text-2xs font-bold rounded-sm border bg-status-success-bg text-status-success border-status-success/15">
          {row.status}
        </span>
      )
    },
  ];

  const ledgerColumns = [
    { header: 'Date', accessor: 'date', sortable: true },
    { header: 'Type', accessor: 'type', sortable: true },
    { header: 'Description', accessor: 'description', sortable: true },
    { header: 'Property', accessor: 'property', sortable: true },
    { header: 'Landlord', accessor: 'landlord', sortable: true },
    {
      header: 'Amount',
      accessor: 'amount',
      align: 'right',
      sortable: true,
      renderCell: (row) => (
        <span className={row.isIncome ? 'text-status-success font-bold' : 'text-status-danger font-bold'}>
          {row.isIncome ? '' : '-'}£{row.amount.toFixed(2)}
        </span>
      )
    },
    { header: 'Source', accessor: 'source', sortable: true },
    {
      header: 'Reconciled',
      accessor: 'reconciled',
      align: 'center',
      renderCell: (row) => (
        <span className={`px-2 py-0.5 text-2xs font-bold rounded-sm border ${
          row.reconciled
            ? 'bg-status-success-bg text-status-success border-status-success/15'
            : 'bg-status-warning/10 text-status-warning border-status-warning/15'
        }`}>
          {row.reconciled ? 'Yes' : 'No'}
        </span>
      )
    },
  ];

  const landlordsBalanceColumns = [
    { header: 'Landlord', accessor: 'name', sortable: true },
    { 
      header: 'Accrued Balance', 
      accessor: 'balance', 
      align: 'right', 
      sortable: true,
      renderCell: (row) => `£${row.balance.toFixed(2)}`
    },
    { 
      header: 'Invoiced YTD', 
      accessor: 'invoicedYtd', 
      align: 'right', 
      sortable: true,
      renderCell: (row) => `£${row.invoicedYtd.toFixed(2)}`
    },
    { 
      header: 'Paid YTD', 
      accessor: 'paidYtd', 
      align: 'right', 
      sortable: true,
      renderCell: (row) => `£${row.paidYtd.toFixed(2)}`
    },
    { header: 'Last Statement Issued', accessor: 'lastStatement', sortable: true },
  ];

  const tenantsArrearsColumns = [
    { header: 'Tenant Name', accessor: 'name', sortable: true },
    { header: 'Property Address', accessor: 'property', sortable: true },
    { 
      header: 'Monthly Rent', 
      accessor: 'rent', 
      align: 'right', 
      sortable: true,
      renderCell: (row) => `£${row.rent.toFixed(2)}`
    },
    { 
      header: 'Total Arrears', 
      accessor: 'arrears', 
      align: 'right', 
      sortable: true,
      renderCell: (row) => (
        <span className="text-status-danger font-bold">
          £{row.arrears.toFixed(2)}
        </span>
      )
    },
    { header: 'Days Overdue', accessor: 'days', sortable: true },
    { header: 'Last Paid Date', accessor: 'lastPaymentDate', sortable: true },
  ];

  const tabItems = [
    { id: 'incoming', name: 'Incoming Payments', count: incomingData.length },
    { id: 'unreconciled', name: 'Unreconciled', count: unreconciledDataState.length },
    { id: 'payouts', name: 'Outgoing/Payouts', count: payoutsDataState.length },
    { id: 'landlords', name: 'Landlords with a Balance', count: landlordsDataState.length },
    { id: 'arrears', name: 'Tenants in Arrears', count: arrearsDataState.length },
    { id: 'ledger', name: 'Transactions Ledger', count: ledgerData.length },
  ];

  const renderSkeleton = () => (
    <div className="space-y-4 py-4">
      <Skeleton radius="bar" className="h-10 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );

  return (
    <div className="py-6 max-w-[1440px] mx-auto px-8 flex flex-col gap-6 font-sans text-brand-primary">

      {/* Page actions (title lives in the layout header) */}
      <div className="flex justify-end">
        <div className="flex flex-wrap gap-3 shrink-0">
          <Button
            variant="secondary"
            onClick={openPaymentModal}
            icon={Banknote}
          >
            Record Rent Payment
          </Button>
          <Button
            variant="primary"
            onClick={() => navigate('/statements')}
            icon={FileSpreadsheet}
          >
            Generate Landlord Statements
          </Button>
        </div>
      </div>

      {/* Tabs Header Navigation */}
      <div className="border-b border-card-border overflow-x-auto w-full scrollbar-none">
        <div className="flex gap-2 min-w-max pb-[1px]">
          {tabItems.map(tab => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 px-4 font-semibold text-xs sm:text-sm tracking-tight border-b-2 transition-all cursor-pointer focus:outline-none flex items-center gap-2 ${
                  isActive
                    ? 'border-brand-primary text-brand-primary'
                    : 'border-transparent text-gray-400 hover:text-status-muted'
                }`}
              >
                <span>{tab.name}</span>
                <span className={`text-2xs font-bold px-2 py-0.5 rounded-sm ${
                  isActive ? 'bg-status-info-bg text-status-info' : 'bg-surface-hover text-gray-400'
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bulk Action Banner for Incoming Payments */}
      {activeTab === 'incoming' && selectedIncomingIds.length > 0 && (
        <div className="bg-brand-primary/5 border border-brand-accent/20 rounded-card p-4 flex flex-col sm:flex-row justify-between items-center gap-3 transition-all animate-fade-in">
          <span className="text-sm font-semibold text-brand-primary">
            {selectedIncomingIds.length} payments selected
          </span>
          <div className="flex gap-3">
            <Button size="sm" variant="secondary" onClick={handleBulkExport}>
              Export Selected
            </Button>
            <Button size="sm" variant="primary" onClick={handleBulkReconcile}>
              Reconcile Selected
            </Button>
          </div>
        </div>
      )}

      {/* Tab Grid Render */}
      <div className="card-bg rounded-card shadow-premium border border-card-border p-4">
        {activeTab === 'incoming' && (
          loading['incoming'] ? renderSkeleton() : (
            <DataTable 
              columns={incomingColumns} 
              data={incomingData} 
              enableBulkSelect={true}
              onSelectionChange={handleSelectionChange}
            />
          )
        )}
        {activeTab === 'unreconciled' && (
          loading['unreconciled'] ? renderSkeleton() : (
            <DataTable 
              columns={unreconciledColumns} 
              data={unreconciledDataState} 
            />
          )
        )}
        {activeTab === 'payouts' && (
          loading['payouts'] ? renderSkeleton() : (
            <DataTable
              columns={payoutsColumns}
              data={payoutsDataState}
            />
          )
        )}
        {activeTab === 'ledger' && (
          loading['ledger'] ? renderSkeleton() : (
            <DataTable
              columns={ledgerColumns}
              data={ledgerData}
            />
          )
        )}
        {activeTab === 'landlords' && (
          loading['landlords'] ? renderSkeleton() : (
            <DataTable 
              columns={landlordsBalanceColumns} 
              data={landlordsDataState} 
            />
          )
        )}
        {activeTab === 'arrears' && (
          loading['arrears'] ? renderSkeleton() : (
            <DataTable 
              columns={tenantsArrearsColumns} 
              data={arrearsDataState} 
            />
          )
        )}
      </div>

      {/* Record Rent Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-sidebar-bg/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-card-border overflow-hidden">
            <div className="bg-brand-primary text-white p-5 font-bold flex items-center gap-2 select-none">
              <Banknote size={18} />
              <span>Record Rent Payment</span>
            </div>

            <form onSubmit={handleRecordPayment} className="p-6 flex flex-col gap-5">
              <p className="text-xs text-status-muted leading-snug">
                Log a rent payment received from a tenant. If the amount matches an outstanding schedule it is reconciled automatically.
              </p>

              <Dropdown
                label="Tenancy"
                options={tenanciesList}
                value={paymentForm.tenancy_id}
                onChange={(val) => setPaymentForm({ ...paymentForm, tenancy_id: val })}
                placeholder={loadingTenancies ? 'Loading tenancies…' : 'Select a tenancy…'}
                searchable
              />

              <Input
                label="Date Received"
                id="paymentReceivedAt"
                type="date"
                required
                value={paymentForm.received_at}
                onChange={(e) => setPaymentForm({ ...paymentForm, received_at: e.target.value })}
              />

              <Input
                label="Amount (£)"
                id="paymentAmount"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
              />

              <Dropdown
                label="Method"
                options={[
                  { value: 'bank_transfer', label: 'Bank Transfer' },
                  { value: 'standing_order', label: 'Standing Order' },
                  { value: 'card', label: 'Card' },
                  { value: 'cash', label: 'Cash' },
                  { value: 'other', label: 'Other' }
                ]}
                value={paymentForm.method}
                onChange={(val) => setPaymentForm({ ...paymentForm, method: val })}
              />

              <Input
                label="Reference (optional)"
                id="paymentReference"
                value={paymentForm.reference}
                onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
              />

              <div className="flex justify-end gap-3 mt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowPaymentModal(false);
                    setPaymentForm(emptyPayment);
                  }}
                  disabled={paymentSaving}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={paymentSaving}>
                  {paymentSaving ? 'Saving…' : 'Record Payment'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
