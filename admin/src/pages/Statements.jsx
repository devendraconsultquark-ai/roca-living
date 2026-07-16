import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Download, Calendar, Plus, Trash2, Send, CheckCircle2 } from 'lucide-react';
import { DataTable } from '../components/UI/DataTable';
import { Button } from '../components/UI/Button';
import { Input } from '../components/UI/Input';
import { DatePicker } from '../components/UI/DatePicker';
import { Dropdown } from '../components/UI/Dropdown';
import { useToast } from '../components/UI/ToastContext';
import api from '../utilities/api';

export const Statements = () => {
  const [statements, setStatements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Modal & Form State
  const [showModal, setShowModal] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  
  const { addToast } = useToast();
 
  // Autofill states
  const [propertiesList, setPropertiesList] = useState([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [loadingAutofill, setLoadingAutofill] = useState(false);

  // Form Fields
  const [landlordId, setLandlordId] = useState(null); // local landlord user id from autofill — drives statement attribution
  const [landlordName, setLandlordName] = useState('');
  const [landlordAddress, setLandlordAddress] = useState('');
  const [statementNumber, setStatementNumber] = useState('');
  const [nrlNumber, setNrlNumber] = useState('');
  const [landlordRef, setLandlordRef] = useState('');
  const [propertyRef, setPropertyRef] = useState('');

  // Source tracking — which DB did the selected property come from
  const [propertySource, setPropertySource] = useState('local');   // 'local' | 'em'
  const [propertySourceId, setPropertySourceId] = useState(null);  // original property_id in source DB
  
  const [propertyName, setPropertyName] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [tenancyType, setTenancyType] = useState('Assured Periodic Tenancy (APT)');
  const [tenancyStartDate, setTenancyStartDate] = useState('');
  
  // Income
  const [rentReceived, setRentReceived] = useState('');
  const [voidPeriodCredit, setVoidPeriodCredit] = useState('');
  
  // Expenditure
  const [expInvoiceNo, setExpInvoiceNo] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [setupRebate, setSetupRebate] = useState('');

  // Summary
  const [previousBalance, setPreviousBalance] = useState('');

  const fetchStatements = async () => {
    setLoading(true);
    try {
      const response = await api.get('/statements');
      const formatted = (response.data?.data || []).map((s) => {
        // Real money out of the statement: expense deductions + NRL withholding.
        // (The mgmt_fee/letting-fee columns are always 0 in this statement format.)
        const totalDeductions = parseFloat(s.deductions || 0) + parseFloat(s.nrl_withheld || 0);

        const periodStartStr = s.period_start ? new Date(s.period_start).toLocaleDateString('en-GB') : '';
        const periodEndStr = s.period_end ? new Date(s.period_end).toLocaleDateString('en-GB') : '';

        return {
          id: s.id,
          statement_reference: s.statement_reference || `STM-${s.id}`,
          landlord: s.landlord_name || 'Landlord',
          period: `${periodStartStr} - ${periodEndStr}`,
          date: s.generated_at ? new Date(s.generated_at).toLocaleDateString('en-GB') : '-',
          invoiced: parseFloat(s.gross_rent || 0),
          fees: totalDeductions,
          payout: parseFloat(s.net_paid || 0),
          rawStatus: (s.status || 'draft').toLowerCase(),
          status: s.status ? s.status.charAt(0).toUpperCase() + s.status.slice(1) : 'Draft'
        };
      });
      setStatements(formatted);
      setError(null);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Error loading statements');
      setStatements([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatements();
  }, []);

  const fetchAutofillMetadata = async () => {
    setLoadingAutofill(true);
    try {
      const response = await api.get('/statements/autofill-metadata');
      if (response.data && response.data.success) {
        setPropertiesList(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching autofill metadata:', err);
      addToast('Failed to load property list for autofill', 'error');
    } finally {
      setLoadingAutofill(false);
    }
  };

  useEffect(() => {
    if (showModal) {
      fetchAutofillMetadata();
    }
  }, [showModal]);

  const handlePropertyChange = (val) => {
    setSelectedPropertyId(val);
    if (!val) return;
    const prop = propertiesList.find(p => `${p.source}_${p.property_id}` === val);
    if (prop) {
      // Track source DB and original property id
      setPropertySource(prop.source || 'local');
      setPropertySourceId(prop.property_id || null);

      // Autofill form fields from whichever DB the property came from
      setLandlordId(prop.landlord_id || null);
      setLandlordName(prop.landlord_name || '');
      setLandlordAddress(prop.landlord_address || '');
      setStatementNumber(prop.statement_number || '');
      setNrlNumber(prop.nrl_number || '');
      setLandlordRef(prop.landlord_reference || '');
      setPropertyRef(prop.property_reference || '');
      setPropertyName(prop.property_address || '');
      setTenantName(prop.tenant_name || '');
      setTenancyType(prop.tenancy_type || 'Assured Periodic Tenancy (APT)');
      setTenancyStartDate(prop.tenancy_start_date || '');
      setRentReceived(prop.rent_received || '');
    }
  };

  // Real-time calculations
  const rentReceivedVal = parseFloat(rentReceived) || 0;
  const voidCreditVal = parseFloat(voidPeriodCredit) || 0;
  const totalIncome = rentReceivedVal + voidCreditVal;

  const expAmountVal = parseFloat(expAmount) || 0;
  const setupRebateVal = parseFloat(setupRebate) || 0;
  const totalExpenditure = Math.max(0, expAmountVal - setupRebateVal);

  const prevBalanceVal = parseFloat(previousBalance) || 0;
  const netIncome = totalIncome - totalExpenditure;
  const newBalance = prevBalanceVal + netIncome;

  const handleDownload = async (id, landlord) => {
    try {
      addToast(`Preparing download for Statement #${id}...`, 'info');
      const response = await api.get(`/statements/${id}/pdf`, {
        responseType: 'blob',
        skipInterceptorError: true
      });
      // Check if server returned an error disguised as blob (e.g. JSON error in blob form)
      const contentType = response.headers?.['content-type'] || '';
      if (!contentType.includes('application/pdf')) {
        // Try to read error message from blob
        const text = await response.data.text();
        let msg = 'Failed to download statement PDF';
        try { msg = JSON.parse(text)?.message || msg; } catch {}
        addToast(msg, 'error');
        return;
      }
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `RL_STMT_${id}_${(landlord || 'statement').replace(/\s+/g, '_')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      addToast(`Downloaded Statement successfully`, 'success');
    } catch (err) {
      console.error(err);
      let msg = 'Failed to download statement PDF';
      // err.response.data may be a Blob for blob requests
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          msg = JSON.parse(text)?.message || msg;
        } catch {}
      } else {
        msg = err.response?.data?.message || err.message || msg;
      }
      addToast(msg, 'error');
    }
  };

  const handleStatusChange = async (row, newStatus) => {
    try {
      await api.patch(`/statements/${row.id}/status`, { status: newStatus });
      addToast(`Statement ${row.statement_reference} marked as ${newStatus}`, 'success');
      fetchStatements();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to update statement status', 'error');
    }
  };

  const handleGenerateStatementsSubmit = async (e) => {
    e.preventDefault();
    if (!landlordName || !statementNumber) {
      addToast('Please fill in required fields', 'warning');
      return;
    }
    if (!startDate || !endDate) {
      addToast('Period start and end dates are required', 'warning');
      return;
    }

    setModalLoading(true);
    try {
      const payload = {
        source: propertySource,
        source_property_id: propertySourceId,
        landlord_id: landlordId,
        landlord_name: landlordName,
        landlord_address: landlordAddress,
        statement_number: statementNumber,
        nrl_number: nrlNumber,
        landlord_reference: landlordRef,
        property_reference: propertyRef,
        property_address: propertyName,
        tenant_name: tenantName,
        tenancy_type: tenancyType,
        tenancy_start_date: tenancyStartDate,
        period_start: startDate,
        period_end: endDate,
        rent_received: rentReceivedVal,
        void_period_credit: voidCreditVal,
        exp_invoice_no: expInvoiceNo,
        exp_amount: expAmountVal,
        setup_rebate: setupRebateVal,
        previous_balance: prevBalanceVal,
        net_paid: netIncome
      };

      await api.post('/statements/generate', payload);

      addToast(`Statement ${statementNumber} created successfully`, 'success');
      setShowModal(false);
      resetForm();
      fetchStatements();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || 'Failed to generate statement';
      addToast(msg, 'error');
    } finally {
      setModalLoading(false);
    }
  };

  const resetForm = () => {
    setStartDate('');
    setEndDate('');
    setSelectedPropertyId('');
    setPropertySource('local');
    setPropertySourceId(null);
    setLandlordId(null);
    setLandlordName('');
    setLandlordAddress('');
    setStatementNumber('');
    setNrlNumber('');
    setLandlordRef('');
    setPropertyRef('');
    setPropertyName('');
    setTenantName('');
    setTenancyType('Assured Periodic Tenancy (APT)');
    setTenancyStartDate('');
    setRentReceived('');
    setVoidPeriodCredit('');
    setExpInvoiceNo('');
    setExpAmount('');
    setSetupRebate('');
    setPreviousBalance('');
  };

  const columns = [
    { header: 'Statement Reference', accessor: 'statement_reference', sortable: true },
    { header: 'Landlord', accessor: 'landlord', sortable: true },
    { header: 'Billing Period', accessor: 'period', sortable: true },
    { header: 'Issue Date', accessor: 'date', sortable: true },
    { 
      header: 'Rent Invoiced', 
      accessor: 'invoiced', 
      align: 'right', 
      sortable: true,
      renderCell: (row) => `£${row.invoiced.toFixed(2)}`
    },
    {
      header: 'Deductions',
      accessor: 'fees',
      align: 'right',
      sortable: true,
      renderCell: (row) => `-£${row.fees.toFixed(2)}`
    },
    { 
      header: 'Net Payout', 
      accessor: 'payout', 
      align: 'right', 
      sortable: true,
      renderCell: (row) => (
        <span className="font-bold text-[#1A1A1A]">
          £{row.payout.toFixed(2)}
        </span>
      )
    },
    {
      header: 'Payout Status',
      accessor: 'status',
      renderCell: (row) => {
        let style = 'bg-status-warning/10 text-status-warning border-status-warning/20';
        if (row.status === 'Paid') {
          style = 'bg-status-success/10 text-status-success border-status-success/20';
        } else if (row.status === 'Sent') {
          style = 'bg-brand-accent/10 text-brand-accent border-brand-accent/20';
        }
        return (
          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${style}`}>
            {row.status}
          </span>
        );
      }
    },
    {
      header: 'Actions',
      accessor: 'id',
      renderCell: (row) => (
        <div className="flex items-center gap-1">
          {row.rawStatus === 'draft' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleStatusChange(row, 'sent')}
              icon={Send}
            >
              Mark Sent
            </Button>
          )}
          {(row.rawStatus === 'draft' || row.rawStatus === 'sent') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleStatusChange(row, 'paid')}
              icon={CheckCircle2}
            >
              Mark Paid
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDownload(row.id, row.landlord)}
            icon={Download}
          >
            PDF
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="py-6 max-w-7xl mx-auto px-4 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#1A1A1A]">Landlord Statements Library</h2>
          <p className="text-sm text-gray-500 mt-1">Audit, export, and review statements issued to landlord partners.</p>
        </div>
        <Button 
          variant="primary" 
          onClick={() => setShowModal(true)}
          icon={FileSpreadsheet}
          className="shadow-sm"
        >
          Generate Statements
        </Button>
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
          <DataTable columns={columns} data={statements} />
        )}
      </div>

      {/* Statement Generation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-brand-primary/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl border border-border-color overflow-hidden my-8">
            <div className="bg-brand-primary text-white p-5 font-bold flex items-center gap-2 select-none shrink-0">
              <Calendar size={18} />
              <span>Generate Landlord Statement</span>
            </div>

            <form onSubmit={handleGenerateStatementsSubmit} className="p-6 flex flex-col gap-6 max-h-[80vh] overflow-y-auto">
              {/* Select Property for Autofill */}
              <div className="bg-[#1F3A5F]/5 p-4 rounded-xl border border-[#1F3A5F]/10 flex flex-col gap-3">
                <Dropdown
                  label="Select Property for Autofill"
                  id="propertySelect"
                  options={propertiesList.map(p => ({
                    value: `${p.source}_${p.property_id}`,
                    label: p.display_name
                  }))}
                  value={selectedPropertyId}
                  onChange={handlePropertyChange}
                  placeholder={loadingAutofill ? "Loading properties..." : "Search and select a property to autofill..."}
                  searchable
                  clearable
                  disabled={loadingAutofill}
                />
                <p className="text-xs text-[#1F3A5F] italic">
                  Selecting a property will automatically populate landlord, reference, property, and tenant details.
                </p>
              </div>

              {/* Warning: EM property with no landlord data */}
              {propertySource === 'em' && !landlordName && (
                <div className="flex gap-3 items-start bg-amber-50 border border-amber-300 rounded-xl p-4">
                  <span className="text-amber-500 mt-0.5 shrink-0 text-lg">⚠️</span>
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Landlord details not found in external database</p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      This EM property has no linked landlord record. Please fill in the <strong>Landlord Name</strong>, <strong>Landlord Address</strong>, and <strong>NRL Number</strong> manually below.
                    </p>
                  </div>
                </div>
              )}

              {/* Section 1: Landlord & Reference Details */}
              <div className="border-b pb-4 border-gray-100">
                <h3 className="font-semibold text-brand-primary mb-3 text-sm">Landlord & References Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input 
                    label="Landlord / Company Name *"
                    id="landlordName"
                    required
                    value={landlordName}
                    onChange={(e) => { setLandlordName(e.target.value); setLandlordId(null); }}
                    placeholder="e.g. Mr Rob Belema & Geertje Adrianntje Hogenes"
                  />
                  <Input 
                    label="Landlord Address"
                    id="landlordAddress"
                    value={landlordAddress}
                    onChange={(e) => setLandlordAddress(e.target.value)}
                    placeholder="e.g. Jollenmakersweg 26, Oostzaan, 1511 DA"
                  />
                  <Input 
                    label="Statement Number *"
                    id="statementNumber"
                    required
                    value={statementNumber}
                    onChange={(e) => setStatementNumber(e.target.value)}
                    placeholder="e.g. PH_19_0001"
                  />
                  <Input 
                    label="NRL Number"
                    id="nrlNumber"
                    value={nrlNumber}
                    onChange={(e) => setNrlNumber(e.target.value)}
                    placeholder="e.g. RB: NL945003 / GAH: NL945014"
                  />
                  <Input 
                    label="Landlord Reference"
                    id="landlordRef"
                    value={landlordRef}
                    onChange={(e) => setLandlordRef(e.target.value)}
                    placeholder="e.g. RL_LR_PH_19"
                  />
                  <Input 
                    label="Property Reference"
                    id="propertyRef"
                    value={propertyRef}
                    onChange={(e) => setPropertyRef(e.target.value)}
                    placeholder="e.g. PH-19"
                  />
                </div>
              </div>

              {/* Section 2: Property & Tenant Details */}
              <div className="border-b pb-4 border-gray-100">
                <h3 className="font-semibold text-brand-primary mb-3 text-sm">Property & Tenant Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input 
                    label="Property Details / Address"
                    id="propertyName"
                    value={propertyName}
                    onChange={(e) => setPropertyName(e.target.value)}
                    placeholder="e.g. Apartment 19, Parsons House"
                  />
                  <Input 
                    label="Tenant Name"
                    id="tenantName"
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    placeholder="e.g. Ms Kirsty Scott"
                  />
                  <Input 
                    label="Tenancy Type"
                    id="tenancyType"
                    value={tenancyType}
                    onChange={(e) => setTenancyType(e.target.value)}
                    placeholder="e.g. Assured Periodic Tenancy (APT)"
                  />
                  <DatePicker 
                    label="Tenancy Start Date"
                    id="tenancyStartDate"
                    value={tenancyStartDate}
                    onChange={(val) => setTenancyStartDate(val)}
                  />
                </div>
              </div>

              {/* Section 3: Billing Period */}
              <div className="border-b pb-4 border-gray-100">
                <h3 className="font-semibold text-brand-primary mb-3 text-sm">Billing Period</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <DatePicker 
                    label="Statement Period Start"
                    id="startDate"
                    required
                    value={startDate}
                    onChange={(val) => setStartDate(val)}
                  />
                  <DatePicker 
                    label="Statement Period End"
                    id="endDate"
                    required
                    value={endDate}
                    onChange={(val) => setEndDate(val)}
                  />
                </div>
              </div>

              {/* Section 4: Income details */}
              <div className="border-b pb-4 border-gray-100">
                <h3 className="font-semibold text-brand-primary mb-3 text-sm">Income</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input 
                    label="Rent Received (£)"
                    id="rentReceived"
                    type="number"
                    step="0.01"
                    value={rentReceived}
                    onChange={(e) => setRentReceived(e.target.value)}
                    placeholder="0.00"
                  />
                  <Input 
                    label="Void Period Rent Credit (£)"
                    id="voidPeriodCredit"
                    type="number"
                    step="0.01"
                    value={voidPeriodCredit}
                    onChange={(e) => setVoidPeriodCredit(e.target.value)}
                    placeholder="0.00"
                  />
                  <div className="md:col-span-2">
                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-500 h-10 flex items-center justify-between">
                      <span>Total Income:</span>
                      <span className="font-bold text-sm text-[#1A1A1A]">£{totalIncome.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 5: Expenditure details */}
              <div className="border-b pb-4 border-gray-100">
                <h3 className="font-semibold text-brand-primary mb-3 text-sm">Expenditure</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input 
                    label="Expenditure Invoice Number"
                    id="expInvoiceNo"
                    value={expInvoiceNo}
                    onChange={(e) => setExpInvoiceNo(e.target.value)}
                    placeholder="e.g. PH_19_0001"
                  />
                  <Input 
                    label="Expenditure Amount (£)"
                    id="expAmount"
                    type="number"
                    step="0.01"
                    value={expAmount}
                    onChange={(e) => setExpAmount(e.target.value)}
                    placeholder="0.00"
                  />
                  <Input 
                    label="Tenancy Set up Rebate (£)"
                    id="setupRebate"
                    type="number"
                    step="0.01"
                    value={setupRebate}
                    onChange={(e) => setSetupRebate(e.target.value)}
                    placeholder="0.00"
                  />
                  <div className="flex items-end">
                    <div className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-500 h-10 flex items-center justify-between">
                      <span>Total Expenditure:</span>
                      <span className="font-bold text-sm text-[#1A1A1A]">£{totalExpenditure.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 6: Summary & Payout Balance */}
              <div className="bg-brand-primary/5 border border-brand-accent/20 rounded-xl p-4 flex flex-col md:flex-row justify-between gap-4">
                <div className="flex-1">
                  <Input 
                    label="Balance from Previous Statement (£)"
                    id="previousBalance"
                    type="number"
                    step="0.01"
                    value={previousBalance}
                    onChange={(e) => setPreviousBalance(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                
                <div className="w-full md:w-64 flex flex-col gap-2 justify-center border-t md:border-t-0 md:border-l border-gray-200 pt-3 md:pt-0 md:pl-4">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Previous Balance:</span>
                    <span>£{prevBalanceVal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Net Period Income:</span>
                    <span>£{netIncome.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 mt-1 font-bold text-sm text-brand-primary">
                    <span>Payment / New Balance:</span>
                    <span>£{newBalance.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex justify-end gap-3 shrink-0">
                <Button 
                  type="button" 
                  variant="secondary" 
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
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
                  {modalLoading ? 'Generating...' : 'Generate Statement'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
