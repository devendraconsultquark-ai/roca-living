import React, { useState, useEffect } from 'react';
import { Download, Calendar, Plus, Trash2, Receipt } from 'lucide-react';
import { DataTable } from '../components/UI/DataTable';
import { Button } from '../components/UI/Button';
import { Input } from '../components/UI/Input';
import { DatePicker } from '../components/UI/DatePicker';
import { Dropdown } from '../components/UI/Dropdown';
import { useToast } from '../components/UI/ToastContext';
import api from '../utilities/api';

const MOCK_INVOICES = [
  {
    id: 1,
    invoice_number: 'INV_PH_19_0001',
    landlord: 'Mr Rob Belema & Geertje Adrianntje Hogenes',
    property: 'Apartment 19, Parsons House',
    period: '01/06/2026 - 30/06/2026',
    date: '14/06/2026',
    gross: 816.00,
    discounts: 816.00,
    net: 0.00,
    status: 'Sent'
  },
  {
    id: 2,
    invoice_number: 'INV_PH_33_0002',
    landlord: 'Mrs Sarah Jenkins',
    property: 'Apartment 33, Parsons House',
    period: '01/06/2026 - 30/06/2026',
    date: '15/06/2026',
    gross: 96.00,
    discounts: 0.00,
    net: 96.00,
    status: 'Draft'
  }
];

export const Invoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Modal & Form State
  const [showModal, setShowModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const { addToast } = useToast();
 
  // Autofill states
  const [propertiesList, setPropertiesList] = useState([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [loadingAutofill, setLoadingAutofill] = useState(false);

  // Form Fields
  const [landlordName, setLandlordName] = useState('');
  const [landlordAddress, setLandlordAddress] = useState('');
  const [landlordRef, setLandlordRef] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [serviceLevel, setServiceLevel] = useState('Fully Managed');
  const [propertyName, setPropertyName] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [tenancyStartDate, setTenancyStartDate] = useState('');

  // Source tracking — which DB did the selected property come from
  const [propertySource, setPropertySource] = useState('local');   // 'local' | 'em'
  const [propertySourceId, setPropertySourceId] = useState(null);  // original property_id in source DB
  
  // Line items
  const [lineItems, setLineItems] = useState([
    { description: 'Tenancy sourcing fee', cost: '', vatPercent: 0, discount: '', net: 0 }
  ]);

  const [notes, setNotes] = useState('');

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      // Stub endpoint for frontend testing; fall back to mock data
      const response = await api.get('/invoices').catch(() => ({ data: { data: MOCK_INVOICES } }));
      const formatted = (response.data?.data || MOCK_INVOICES).map((inv) => ({
        id: inv.id,
        invoice_number: inv.invoice_number || `INV_PH_${String(inv.id).padStart(4, '0')}`,
        landlord: inv.landlord || 'Landlord',
        property: inv.property || 'Property Address',
        period: inv.period || `${inv.period_month}/${inv.period_year}`,
        date: inv.date || new Date(inv.created_at).toLocaleDateString('en-GB'),
        gross: parseFloat(inv.gross || inv.total_amount || 0),
        discounts: parseFloat(inv.discounts || 0),
        net: parseFloat(inv.net || inv.total_amount || 0),
        status: inv.status ? inv.status.charAt(0).toUpperCase() + inv.status.slice(1) : 'Draft'
      }));
      setInvoices(formatted);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Error loading invoices library');
      setInvoices(MOCK_INVOICES);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
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

      // Autofill all fields from whichever DB the property came from
      setLandlordName(prop.landlord_name || '');
      setLandlordAddress(prop.landlord_address || '');
      setLandlordRef(prop.landlord_reference || '');
      setInvoiceNumber(prop.invoice_number || '');
      setPropertyName(prop.property_address || '');
      setTenantName(prop.tenant_name || '');
      setTenancyStartDate(prop.tenancy_start_date || '');
    }
  };

  // Recalculates individual item net amount
  const calculateItemNet = (cost, vatPercent, discount) => {
    const costVal = parseFloat(cost) || 0;
    const vatVal = (costVal * (parseFloat(vatPercent) || 0)) / 100;
    const discVal = parseFloat(discount) || 0;
    return Math.max(0, costVal + vatVal - discVal);
  };

  const handleLineItemChange = (index, field, value) => {
    const updated = [...lineItems];
    updated[index][field] = value;
    
    // Automatically recalculate net when values change
    const cost = field === 'cost' ? value : updated[index].cost;
    const vatPercent = field === 'vatPercent' ? value : updated[index].vatPercent;
    const discount = field === 'discount' ? value : updated[index].discount;
    updated[index].net = calculateItemNet(cost, vatPercent, discount);
    
    setLineItems(updated);
  };

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { description: '', cost: '', vatPercent: 0, discount: '', net: 0 }
    ]);
  };

  const removeLineItem = (index) => {
    if (lineItems.length === 1) return;
    setLineItems(lineItems.filter((_, idx) => idx !== index));
  };

  // Real-time totals for summary panel
  const totalGross = lineItems.reduce((sum, item) => sum + (parseFloat(item.cost) || 0), 0);
  const totalVAT = lineItems.reduce((sum, item) => sum + ((parseFloat(item.cost || 0) * (parseFloat(item.vatPercent || 0))) / 100), 0);
  const totalDiscounts = lineItems.reduce((sum, item) => sum + (parseFloat(item.discount) || 0), 0);
  const totalNet = Math.max(0, totalGross + totalVAT - totalDiscounts);

  const handleDownload = async (id, invoiceNum) => {
    try {
      addToast(`Preparing download for Invoice #${id}...`, 'info');
      const response = await api.get(`/invoices/${id}/pdf`, {
        responseType: 'blob',
        skipInterceptorError: true
      });
      // Check if server returned an error disguised as blob
      const contentType = response.headers?.['content-type'] || '';
      if (!contentType.includes('application/pdf')) {
        const text = await response.data.text();
        let msg = 'Failed to download invoice PDF';
        try { msg = JSON.parse(text)?.message || msg; } catch {}
        addToast(msg, 'error');
        return;
      }
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${invoiceNum || `INV_STMT_${id}`}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      addToast(`Downloaded Invoice successfully`, 'success');
    } catch (err) {
      console.error(err);
      let msg = 'Failed to download invoice PDF';
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

  const handleGenerateInvoiceSubmit = async (e) => {
    e.preventDefault();
    if (!landlordName || !invoiceNumber) {
      addToast('Please fill in required fields', 'warning');
      return;
    }

    setModalLoading(true);
    try {
      const payload = {
        source: propertySource,
        source_property_id: propertySourceId,
        landlord: { name: landlordName, address: landlordAddress, reference: landlordRef },
        invoice_number: invoiceNumber,
        period_start: startDate,
        period_end: endDate,
        service_level: serviceLevel,
        property: { address: propertyName },
        tenant_name: tenantName,
        tenancy_start_date: tenancyStartDate,
        line_items: lineItems.map(item => ({
          description: item.description,
          cost: item.cost,
          vat_percent: item.vatPercent,
          discount: item.discount,
          net: item.net
        })),
        total_amount: totalNet,
        notes
      };

      await api.post('/invoices/generate', payload);

      addToast(`Invoice ${invoiceNumber} created as Draft`, 'success');
      setShowModal(false);
      resetForm();
      fetchInvoices();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || 'Failed to generate invoice';
      addToast(msg, 'error');
    } finally {
      setModalLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedPropertyId('');
    setLandlordName('');
    setLandlordAddress('');
    setLandlordRef('');
    setInvoiceNumber('');
    setStartDate('');
    setEndDate('');
    setServiceLevel('Fully Managed');
    setPropertyName('');
    setTenantName('');
    setTenancyStartDate('');
    setLineItems([{ description: '', cost: '', vatPercent: 0, discount: '', net: 0 }]);
    setNotes('');
  };

  const columns = [
    { header: 'Invoice Number', accessor: 'invoice_number', sortable: true },
    { header: 'Landlord', accessor: 'landlord', sortable: true },
    { header: 'Property', accessor: 'property', sortable: true },
    { header: 'Billing Period', accessor: 'period', sortable: true },
    { header: 'Issue Date', accessor: 'date', sortable: true },
    { 
      header: 'Gross Fees', 
      accessor: 'gross', 
      align: 'right', 
      sortable: true,
      renderCell: (row) => `£${row.gross.toFixed(2)}`
    },
    { 
      header: 'Discounts', 
      accessor: 'discounts', 
      align: 'right', 
      sortable: true,
      renderCell: (row) => `-£${row.discounts.toFixed(2)}`
    },
    { 
      header: 'Net Fees Due', 
      accessor: 'net', 
      align: 'right', 
      sortable: true,
      renderCell: (row) => (
        <span className="font-bold text-[#1A1A1A]">
          £{row.net.toFixed(2)}
        </span>
      )
    },
    { 
      header: 'Status', 
      accessor: 'status',
      renderCell: (row) => {
        let style = 'bg-status-warning/10 text-status-warning border-status-warning/20';
        if (row.status === 'Paid' || row.status === 'Sent') {
          style = 'bg-status-success/10 text-status-success border-status-success/20';
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
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => handleDownload(row.id, row.invoice_number)}
          icon={Download}
        >
          Download PDF
        </Button>
      )
    }
  ];

  return (
    <div className="py-6 max-w-7xl mx-auto px-4 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#1A1A1A]">Landlord Invoices</h2>
          <p className="text-sm text-gray-500 mt-1">Audit, export, and manage service charge invoices issued to landlord partners.</p>
        </div>
        <Button 
          variant="primary" 
          onClick={() => setShowModal(true)}
          icon={Receipt}
          className="shadow-sm"
        >
          Generate Invoice
        </Button>
      </div>

      {/* Grid Table Container */}
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
          <DataTable columns={columns} data={invoices} />
        )}
      </div>

      {/* Invoice Generation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-brand-primary/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl border border-border-color overflow-hidden my-8">
            <div className="bg-brand-primary text-white p-5 font-bold flex items-center gap-2 select-none shrink-0">
              <Receipt size={18} />
              <span>Generate Landlord Invoice</span>
            </div>

            <form onSubmit={handleGenerateInvoiceSubmit} className="p-6 flex flex-col gap-6 max-h-[80vh] overflow-y-auto">
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

              {/* Section 1: Landlord & References */}
              <div className="border-b pb-4 border-gray-100">
                <h3 className="font-semibold text-brand-primary mb-3 text-sm">Landlord & References Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input 
                    label="Landlord / Company Name *"
                    id="landlordName"
                    required
                    value={landlordName}
                    onChange={(e) => setLandlordName(e.target.value)}
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
                    label="Invoice Number *"
                    id="invoiceNumber"
                    required
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="e.g. INV_PH_19_0001"
                  />
                  <Input 
                    label="Landlord Reference"
                    id="landlordRef"
                    value={landlordRef}
                    onChange={(e) => setLandlordRef(e.target.value)}
                    placeholder="e.g. RL_LR_PH_19"
                  />
                </div>
              </div>

              {/* Section 2: Property & Tenancy Details */}
              <div className="border-b pb-4 border-gray-100">
                <h3 className="font-semibold text-brand-primary mb-3 text-sm">Property & Tenancy Details</h3>
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
                  <DatePicker 
                    label="Tenancy Start Date"
                    id="tenancyStartDate"
                    value={tenancyStartDate}
                    onChange={(val) => setTenancyStartDate(val)}
                  />
                  <Dropdown
                    label="Service Level"
                    id="serviceLevel"
                    value={serviceLevel}
                    onChange={(val) => setServiceLevel(val)}
                    options={[
                      { value: 'Fully Managed', label: 'Fully Managed' },
                      { value: 'Rent Collection', label: 'Rent Collection' },
                      { value: 'Tenant Find Only', label: 'Tenant Find Only' }
                    ]}
                  />
                </div>
              </div>

              {/* Section 3: Billing Period */}
              <div className="border-b pb-4 border-gray-100">
                <h3 className="font-semibold text-brand-primary mb-3 text-sm">Billing Period</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <DatePicker 
                    label="Invoice Period Start"
                    id="startDate"
                    value={startDate}
                    onChange={(val) => setStartDate(val)}
                  />
                  <DatePicker 
                    label="Invoice Period End"
                    id="endDate"
                    value={endDate}
                    onChange={(val) => setEndDate(val)}
                  />
                </div>
              </div>

              {/* Section 4: Line Items */}
              <div className="border-b pb-4 border-gray-100">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-brand-primary text-sm">Invoice Line Items</h3>
                  <Button 
                    type="button" 
                    variant="secondary" 
                    size="sm" 
                    icon={Plus}
                    onClick={addLineItem}
                  >
                    Add Item
                  </Button>
                </div>

                <div className="space-y-3">
                  {lineItems.map((item, index) => (
                    <div key={index} className="flex flex-col md:flex-row gap-3 items-start md:items-end border-b md:border-none pb-4 md:pb-0">
                      <div className="flex-1 min-w-0 w-full">
                        <Input
                          label={index === 0 ? "Description" : ""}
                          value={item.description}
                          onChange={(e) => handleLineItemChange(index, 'description', e.target.value)}
                          placeholder="e.g. Tenant referencing / checks"
                        />
                      </div>
                      <div className="w-full md:w-28">
                        <Input
                          label={index === 0 ? "Cost (£)" : ""}
                          type="number"
                          step="0.01"
                          value={item.cost}
                          onChange={(e) => handleLineItemChange(index, 'cost', e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="w-full md:w-20">
                        <Input
                          label={index === 0 ? "VAT (%)" : ""}
                          type="number"
                          value={item.vatPercent}
                          onChange={(e) => handleLineItemChange(index, 'vatPercent', e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div className="w-full md:w-24">
                        <Input
                          label={index === 0 ? "Discount (£)" : ""}
                          type="number"
                          step="0.01"
                          value={item.discount}
                          onChange={(e) => handleLineItemChange(index, 'discount', e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="w-full md:w-28">
                        <label className="block text-xs font-semibold text-gray-500 mb-1 md:hidden">Net (£)</label>
                        <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-bold text-[#1A1A1A] h-10 flex items-center justify-end">
                          £{item.net.toFixed(2)}
                        </div>
                      </div>
                      {lineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLineItem(index)}
                          className="p-2 mb-1 text-gray-400 hover:text-status-danger cursor-pointer self-end"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 5: Summary Display */}
              <div className="bg-brand-primary/5 border border-brand-accent/20 rounded-xl p-4 flex flex-col md:flex-row justify-between gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Notes</label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-brand-accent bg-white resize-none"
                    placeholder="e.g. UK Vastgoed introductory discount applied."
                  />
                </div>
                
                <div className="w-full md:w-64 flex flex-col gap-2 justify-center border-t md:border-t-0 md:border-l border-gray-200 pt-3 md:pt-0 md:pl-4">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Total Gross:</span>
                    <span>£{totalGross.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Total VAT:</span>
                    <span>£{totalVAT.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Total Discount:</span>
                    <span className="text-status-danger">-£{totalDiscounts.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 mt-1 font-bold text-sm text-brand-primary">
                    <span>Net Fees Due:</span>
                    <span>£{totalNet.toFixed(2)}</span>
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
                  {modalLoading ? 'Generating...' : 'Generate Invoice'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
