import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Check, X, AlertTriangle, Download, RefreshCw, Calendar } from 'lucide-react';
import { useToast } from '../components/UI/ToastContext';
import { DataTable } from '../components/UI/DataTable';
import { Button } from '../components/UI/Button';
import { Input } from '../components/UI/Input';
import api from '../utilities/api';

const paymentsToApproveData = [];

const failedPayoutsData = [];

export const AccountingHub = () => {
  const [activeTab, setActiveTab] = useState('incoming');
  const [selectedIncomingIds, setSelectedIncomingIds] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const { addToast } = useToast();

  // State data for API tabs
  const [incomingData, setIncomingData] = useState([]);
  const [unreconciledDataState, setUnreconciledDataState] = useState([]);
  const [approveData, setApproveData] = useState(paymentsToApproveData);
  const [payoutsDataState, setPayoutsDataState] = useState([]);
  const [failedData, setFailedData] = useState(failedPayoutsData);
  const [landlordsDataState, setLandlordsDataState] = useState([]);
  const [arrearsDataState, setArrearsDataState] = useState([]);
  
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
          bankAccount: `****${s.landlord_id}`,
          status: 'Success'
        }));
        setPayoutsDataState(formatted);
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
    addToast(`Exported ${selectedIncomingIds.length} records to CSV`, 'info');
  };

  const handleGenerateStatements = async (e) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      addToast('Please select both start and end dates', 'warning');
      return;
    }

    setModalLoading(true);
    try {
      await api.post('/statements/generate', {
        period_start: startDate,
        period_end: endDate
      });
      addToast(`Landlord Statements generated for period ${startDate} to ${endDate}`, 'success');
      if (activeTab === 'payouts' || activeTab === 'landlords') {
        fetchTabData(activeTab);
      }
    } catch (err) {
      console.error(err);
      addToast(err.response?.data?.message || 'Failed to generate landlord statements', 'error');
    } finally {
      setModalLoading(false);
      setShowModal(false);
      setStartDate('');
      setEndDate('');
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
        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
          row.status === 'Cleared' 
            ? 'bg-status-success/10 text-status-success border-status-success/20' 
            : 'bg-status-warning/10 text-status-warning border-status-warning/20'
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

  const approveColumns = [
    { header: 'Request Date', accessor: 'date', sortable: true },
    { header: 'Landlord Name', accessor: 'landlord', sortable: true },
    { header: 'Property', accessor: 'property', sortable: true },
    { 
      header: 'Amount Due', 
      accessor: 'amount', 
      align: 'right', 
      sortable: true,
      renderCell: (row) => `£${row.amount.toFixed(2)}`
    },
    { header: 'Bank Details', accessor: 'bankDetails' },
    {
      header: 'Action',
      accessor: 'id',
      renderCell: (row) => (
        <div className="flex gap-2">
          <button 
            onClick={() => addToast(`Approved payout to ${row.landlord}`, 'success')}
            className="p-1 text-status-success hover:bg-status-success/5 rounded border border-transparent hover:border-status-success/20 cursor-pointer"
            title="Approve"
          >
            <Check size={14} />
          </button>
          <button 
            onClick={() => addToast(`Rejected payout request for ${row.landlord}`, 'error')}
            className="p-1 text-status-danger hover:bg-status-danger/5 rounded border border-transparent hover:border-status-danger/20 cursor-pointer"
            title="Reject"
          >
            <X size={14} />
          </button>
        </div>
      )
    }
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
    { header: 'Target Account', accessor: 'bankAccount' },
    { 
      header: 'Status', 
      accessor: 'status',
      renderCell: (row) => (
        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full border bg-status-success/10 text-status-success border-status-success/20">
          {row.status}
        </span>
      )
    },
  ];

  const failedPayoutsColumns = [
    { header: 'Date Attempted', accessor: 'date', sortable: true },
    { header: 'Landlord Name', accessor: 'landlord', sortable: true },
    { 
      header: 'Amount', 
      accessor: 'amount', 
      align: 'right', 
      sortable: true,
      renderCell: (row) => `£${row.amount.toFixed(2)}`
    },
    { header: 'Bank Target', accessor: 'bankDetails' },
    { header: 'Fail Reason', accessor: 'reason', className: 'text-status-danger font-semibold' },
    {
      header: 'Action',
      accessor: 'id',
      renderCell: (row) => (
        <button 
          onClick={() => addToast(`Retrying transfer to ${row.landlord}...`, 'info')}
          className="px-2.5 py-1 text-[10px] font-bold rounded bg-brand-accent text-white hover:bg-brand-accent/90 cursor-pointer"
        >
          Retry
        </button>
      )
    }
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
    { id: 'approve', name: 'Payments to Approve', count: approveData.length },
    { id: 'payouts', name: 'Outgoing/Payouts', count: payoutsDataState.length },
    { id: 'failed', name: 'Failed Payouts', count: failedData.length },
    { id: 'landlords', name: 'Landlords with a Balance', count: landlordsDataState.length },
    { id: 'arrears', name: 'Tenants in Arrears', count: arrearsDataState.length },
  ];

  const renderSkeleton = () => (
    <div className="space-y-4 py-4">
      <div className="h-10 bg-gray-100/80 rounded-lg animate-pulse w-full" />
      <div className="h-16 bg-gray-50/80 rounded-lg animate-pulse w-full" />
      <div className="h-16 bg-gray-50/80 rounded-lg animate-pulse w-full" />
      <div className="h-16 bg-gray-50/80 rounded-lg animate-pulse w-full" />
    </div>
  );

  return (
    <div className="py-6 max-w-7xl mx-auto px-4 flex flex-col gap-6">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#1A1A1A]">Accounting Hub</h2>
          <p className="text-sm text-gray-500 mt-1">Manage, reconcile, and audit the financial statements and cashflows.</p>
        </div>
        
        <Button 
          variant="primary" 
          onClick={() => setShowModal(true)}
          icon={FileSpreadsheet}
          className="shadow-md shrink-0"
        >
          Generate Landlord Statements
        </Button>
      </div>

      {/* Tabs Header Navigation */}
      <div className="border-b border-border-color overflow-x-auto w-full scrollbar-none">
        <div className="flex gap-2 min-w-max pb-[1px]">
          {tabItems.map(tab => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 px-4 font-semibold text-xs sm:text-sm border-b-2 transition-all cursor-pointer focus:outline-none flex items-center gap-2 ${
                  isActive 
                    ? 'border-brand-accent text-brand-accent' 
                    : 'border-transparent text-gray-400 hover:text-[#1A1A1A] hover:border-gray-300'
                }`}
              >
                <span>{tab.name}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isActive ? 'bg-brand-accent/10 text-brand-accent' : 'bg-gray-100 text-gray-400'
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
        <div className="bg-brand-primary/5 border border-brand-accent/20 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-center gap-3 transition-all animate-fade-in">
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
      <div className="bg-white rounded-2xl shadow-sm border border-border-color p-4">
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
        {activeTab === 'approve' && (
          /* TODO: Phase 3 - Connect to real payouts approval backend */
          <DataTable 
            columns={approveColumns} 
            data={approveData} 
          />
        )}
        {activeTab === 'payouts' && (
          loading['payouts'] ? renderSkeleton() : (
            <DataTable 
              columns={payoutsColumns} 
              data={payoutsDataState} 
            />
          )
        )}
        {activeTab === 'failed' && (
          /* TODO: Phase 3 - Connect to real failed payouts backend */
          <DataTable 
            columns={failedPayoutsColumns} 
            data={failedData} 
          />
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

      {/* Statement Generation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-brand-primary/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-border-color overflow-hidden">
            <div className="bg-brand-primary text-white p-5 font-bold flex items-center gap-2 select-none">
              <Calendar size={18} />
              <span>Generate Landlord Statements</span>
            </div>

            <form onSubmit={handleGenerateStatements} className="p-6 flex flex-col gap-5">
              <p className="text-xs text-gray-500 leading-snug">
                Select the start and end dates for the statement accounting period. This will generate and dispatch statements for all landlords with active balances.
              </p>

              <Input 
                label="Accounting Period Start"
                id="startDate"
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />

              <Input 
                label="Accounting Period End"
                id="endDate"
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />

              <div className="flex justify-end gap-3 mt-2">
                <Button 
                  type="button" 
                  variant="secondary" 
                  onClick={() => {
                    setShowModal(false);
                    setStartDate('');
                    setEndDate('');
                  }}
                  disabled={modalLoading}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  variant="primary" 
                  disabled={modalLoading}
                >
                  {modalLoading ? 'Generating...' : 'Generate Statements'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
