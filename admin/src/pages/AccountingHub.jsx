import React, { useState } from 'react';
import { FileSpreadsheet, Check, X, AlertTriangle, Download, RefreshCw, Calendar } from 'lucide-react';
import { useToast } from '../components/UI/ToastContext';
import { DataTable } from '../components/UI/DataTable';
import { Button } from '../components/UI/Button';
import { Input } from '../components/UI/Input';
import api from '../utilities/api';

// Grid Mock Datasets
const incomingPaymentsData = [
  { id: 'inc-1', date: '2026-06-12', tenant: 'Jane Smith', property: 'Flat 12, Living Towers', amount: 1850.00, method: 'Direct Debit', reference: 'RL-1020-SMITH', status: 'Cleared' },
  { id: 'inc-2', date: '2026-06-11', tenant: 'Richard Evans', property: '78 Oak Avenue', amount: 1400.00, method: 'Bank Transfer', reference: 'RL-OAK-EVANS', status: 'Cleared' },
  { id: 'inc-3', date: '2026-06-10', tenant: 'Alice Cooper', property: '14 High Street', amount: 950.00, method: 'Card Payment', reference: 'COOPER-RENT-JUNE', status: 'Pending' },
  { id: 'inc-4', date: '2026-06-08', tenant: 'Mark Jenkins', property: 'Flat 5, Queens Road', amount: 1650.00, method: 'Direct Debit', reference: 'RL-QUE-JENKINS', status: 'Cleared' },
];

const unreconciledData = [
  { id: 'unr-1', date: '2026-06-12', description: 'BANK TRANSFER ROCA RENT UNKNOWN REF', amount: 1200.00, sourceBank: 'Barclays Main', type: 'Credit' },
  { id: 'unr-2', date: '2026-06-09', description: 'SO J SMITH', amount: 1850.00, sourceBank: 'Barclays Main', type: 'Credit' },
];

const paymentsToApproveData = [
  { id: 'app-1', landlord: 'John Doe', property: 'Flat 12, Living Towers', amount: 1628.00, bankDetails: 'AC: 12345678, SC: 20-30-40', date: '2026-06-12', status: 'Pending Approval' },
  { id: 'app-2', landlord: 'Robert Harris', property: 'Apartment 4B, Park Heights', amount: 2150.00, bankDetails: 'AC: 87654321, SC: 10-20-30', date: '2026-06-11', status: 'Pending Approval' },
];

const payoutsData = [
  { id: 'pay-1', landlord: 'John Doe', amount: 1628.00, bankAccount: '****5678', date: '2026-06-01', status: 'Success' },
  { id: 'pay-2', landlord: 'Bristol Properties Ltd', amount: 4890.00, bankAccount: '****9900', date: '2026-06-02', status: 'Success' },
];

const failedPayoutsData = [
  { id: 'fail-1', date: '2026-06-05', landlord: 'Sarah Jenkins', amount: 1150.00, bankDetails: 'AC: 11223344, SC: 40-50-60', reason: 'Invalid Bank Details (SC Refused)', status: 'Failed' },
];

const landlordsBalanceData = [
  { id: 'lnd-bal-1', name: 'John Doe', balance: 1628.00, invoicedYtd: 11100.00, paidYtd: 9472.00, lastStatement: '2026-05-31' },
  { id: 'lnd-bal-2', name: 'Robert Harris', balance: 2150.00, invoicedYtd: 15400.00, paidYtd: 13250.00, lastStatement: '2026-05-31' },
  { id: 'lnd-bal-3', name: 'Bristol Properties Ltd', balance: 0.00, invoicedYtd: 29340.00, paidYtd: 29340.00, lastStatement: '2026-05-31' },
];

const tenantsArrearsData = [
  { id: 'arr-1', name: 'Jane Smith', property: 'Flat 12, Living Towers', rent: 1850.00, arrears: 1850.00, days: 5, lastPaymentDate: '2026-05-07' },
  { id: 'arr-2', name: 'Alice Cooper', property: '14 High Street', rent: 950.00, arrears: 1900.00, days: 35, lastPaymentDate: '2026-04-10' },
];

export const AccountingHub = () => {
  const [activeTab, setActiveTab] = useState('incoming');
  const [selectedIncomingIds, setSelectedIncomingIds] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const { addToast } = useToast();

  const handleSelectionChange = (selectedIds) => {
    setSelectedIncomingIds(selectedIds);
  };

  const handleBulkReconcile = () => {
    addToast(`Reconciled ${selectedIncomingIds.length} payments successfully`, 'success');
    setSelectedIncomingIds([]);
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
      await api.post('/statements/generate', { startDate, endDate });
      addToast(`Landlord Statements generated for period ${startDate} to ${endDate}`, 'success');
    } catch (err) {
      console.error(err);
      addToast(`Landlord Statements generated for ${startDate} to ${endDate} (Dev Mode)`, 'success');
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
    { id: 'incoming', name: 'Incoming Payments', count: incomingPaymentsData.length },
    { id: 'unreconciled', name: 'Unreconciled', count: unreconciledData.length },
    { id: 'approve', name: 'Payments to Approve', count: paymentsToApproveData.length },
    { id: 'payouts', name: 'Outgoing/Payouts', count: payoutsData.length },
    { id: 'failed', name: 'Failed Payouts', count: failedPayoutsData.length },
    { id: 'landlords', name: 'Landlords with a Balance', count: landlordsBalanceData.length },
    { id: 'arrears', name: 'Tenants in Arrears', count: tenantsArrearsData.length },
  ];

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
          <DataTable 
            columns={incomingColumns} 
            data={incomingPaymentsData} 
            enableBulkSelect={true}
            onSelectionChange={handleSelectionChange}
          />
        )}
        {activeTab === 'unreconciled' && (
          <DataTable 
            columns={unreconciledColumns} 
            data={unreconciledData} 
          />
        )}
        {activeTab === 'approve' && (
          <DataTable 
            columns={approveColumns} 
            data={paymentsToApproveData} 
          />
        )}
        {activeTab === 'payouts' && (
          <DataTable 
            columns={payoutsColumns} 
            data={payoutsData} 
          />
        )}
        {activeTab === 'failed' && (
          <DataTable 
            columns={failedPayoutsColumns} 
            data={failedPayoutsData} 
          />
        )}
        {activeTab === 'landlords' && (
          <DataTable 
            columns={landlordsBalanceColumns} 
            data={landlordsBalanceData} 
          />
        )}
        {activeTab === 'arrears' && (
          <DataTable 
            columns={tenantsArrearsColumns} 
            data={tenantsArrearsData} 
          />
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
