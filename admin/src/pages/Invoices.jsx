import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Trash2, Receipt, CheckCircle2, X, FileText, Clock, PencilLine } from 'lucide-react';
import { DataTable } from '../components/UI/DataTable';
import { Button } from '../components/UI/Button';
import { Input } from '../components/UI/Input';
import { DatePicker } from '../components/UI/DatePicker';
import { Dropdown } from '../components/UI/Dropdown';
import { useToast } from '../components/UI/ToastContext';
import { useConfirm } from '../components/UI/ConfirmContext';
import { Skeleton } from '../components/UI/Skeleton';
import { ListTabs, ExportButton } from '../components/UI/ListToolbar';
import {
  PageActions, KpiRow, KpiCard, WithRail, SectionCard, Donut, QuickActions, UpcomingList,
  InfoFooter, Pill, Two, SearchInput, RowMenu, NotTracked,
} from '../components/UI/DesignKit';
import { C, gbp, shortDate, daysUntil, pct } from '../utilities/designTokens';
import api from '../utilities/api';
import { downloadCsv } from '../utilities/csv';

const money = (v) => `£${Number(v || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const Invoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('all');
  
  // Modal & Form State
  const [showModal, setShowModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const { addToast } = useToast();
  const confirm = useConfirm();
 
  // Autofill states
  const [propertiesList, setPropertiesList] = useState([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [loadingAutofill, setLoadingAutofill] = useState(false);

  // Form Fields
  const [landlordId, setLandlordId] = useState(null); // local landlord user id from autofill — drives invoice attribution
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
  
  // Line items — new rows default to the system VAT rate (admin Settings page)
  const [defaultVat, setDefaultVat] = useState(0);
  const [lineItems, setLineItems] = useState([
    { description: 'Tenancy sourcing fee', cost: '', vatPercent: 0, discount: '', net: 0 }
  ]);

  const [notes, setNotes] = useState('');

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const response = await api.get('/invoices');
      const formatted = (response.data?.data || []).map((inv) => {
        const periodStartStr = inv.period_start ? new Date(inv.period_start).toLocaleDateString('en-GB') : '';
        const periodEndStr = inv.period_end ? new Date(inv.period_end).toLocaleDateString('en-GB') : '';
        return {
          id: inv.id,
          invoice_number: inv.invoice_number || `INV-${String(inv.id).padStart(4, '0')}`,
          landlord: inv.landlord_name || 'Landlord',
          property: inv.property_address || inv.property_name || '—',
          period: periodStartStr || periodEndStr ? `${periodStartStr} - ${periodEndStr}` : '—',
          date: inv.created_at ? new Date(inv.created_at).toLocaleDateString('en-GB') : '-',
          rawDate: inv.created_at || null,
          propertyName: inv.property_name || null,
          year: inv.created_at ? new Date(inv.created_at).getFullYear() : null,
          gross: parseFloat(inv.gross || 0),
          discounts: parseFloat(inv.discounts || 0),
          net: parseFloat(inv.net || 0),
          rawStatus: (inv.status || 'draft').toLowerCase(),
          status: inv.status ? inv.status.charAt(0).toUpperCase() + inv.status.slice(1) : 'Draft'
        };
      });
      setInvoices(formatted);
      setError(null);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Error loading invoices library');
      setInvoices([]);
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
      // Prefill VAT on untouched rows from the system vatRate setting.
      api.get('/settings').then((res) => {
        const vat = parseFloat(res.data?.data?.vatRate);
        if (Number.isFinite(vat)) {
          setDefaultVat(vat);
          setLineItems((items) => items.map((item) =>
            item.cost === '' && (!item.vatPercent || item.vatPercent === 0)
              ? { ...item, vatPercent: vat }
              : item
          ));
        }
      }).catch(() => { /* prefill only — form stays usable without it */ });
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
      setLandlordId(prop.landlord_id || null);
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
      { description: '', cost: '', vatPercent: defaultVat, discount: '', net: 0 }
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

  const handleStatusChange = async (row, newStatus) => {
    try {
      await api.patch(`/invoices/${row.id}/status`, { status: newStatus });
      addToast(`Invoice ${row.invoice_number} marked as ${newStatus}`, 'success');
      fetchInvoices();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to update invoice status', 'error');
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
        landlord: { id: landlordId, name: landlordName, address: landlordAddress, reference: landlordRef },
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
    setLandlordId(null);
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

  const STATUS_TONE = { paid: 'green', sent: 'blue', draft: 'orange', voided: 'grey' };
  const columns = [
    { header: 'Invoice No.', accessor: 'invoice_number', sortable: true, renderCell: (row) => <span className="font-bold text-brand-accent whitespace-nowrap">{row.invoice_number}</span> },
    { header: 'Date', accessor: 'rawDate', sortable: true, renderCell: (row) => (row.rawDate ? shortDate(row.rawDate) : '—') },
    { header: 'Landlord', accessor: 'landlord', sortable: true, renderCell: (row) => <Two top={row.landlord} width="max-w-[170px]" /> },
    { header: 'Property', accessor: 'property', sortable: true, renderCell: (row) => <Two top={row.propertyName || row.property} bottom={row.propertyName && row.property !== row.propertyName ? row.property : null} width="max-w-[190px]" /> },
    { header: 'Period', accessor: 'period', sortable: true, renderCell: (row) => { const [from, to] = String(row.period || '').split(' - '); return to ? <Two top={from} bottom={`– ${to}`} width="max-w-[110px]" /> : row.period; } },
    {
      header: 'Amount',
      accessor: 'net',
      align: 'right',
      sortable: true,
      renderCell: (row) => (
        <Two
          top={<span className="whitespace-nowrap">{gbp(row.net)}</span>}
          bottom={row.discounts > 0 ? <span className="whitespace-nowrap">{gbp(row.gross)} − {gbp(row.discounts)}</span> : null}
        />
      ),
    },
    { header: 'Status', accessor: 'status', sortable: true, renderCell: (row) => <Pill tone={STATUS_TONE[row.rawStatus] || 'orange'}>{row.status}</Pill> },
    {
      header: 'Actions',
      accessor: 'id',
      align: 'center',
      renderCell: (row) => (
        <RowMenu
          label={`Actions for ${row.invoice_number}`}
          items={[
            row.rawStatus === 'draft' && { label: 'Mark Sent', onClick: () => handleStatusChange(row, 'sent') },
            (row.rawStatus === 'draft' || row.rawStatus === 'sent') && { label: 'Mark Paid', onClick: () => handleStatusChange(row, 'paid') },
            { label: 'Download PDF', onClick: () => handleDownload(row.id, row.invoice_number) },
            (row.rawStatus === 'draft' || row.rawStatus === 'sent') && {
              label: 'Void',
              danger: true,
              onClick: async () => {
                const ok = await confirm({
                  title: 'Void Invoice',
                  message: `Void invoice ${row.invoice_number}? A voided invoice cannot be sent or paid afterwards.`,
                  variant: 'danger',
                  confirmText: 'Void Invoice',
                });
                if (ok) handleStatusChange(row, 'voided');
              },
            },
          ]}
        />
      ),
    },
  ];

  // KPI cards (voided invoices left out) and status tabs
  const thisYear = new Date().getFullYear();
  const live = invoices.filter((i) => i.rawStatus !== 'voided');
  const sumNet = (list) => list.reduce((s, i) => s + i.net, 0);
  const invoicedYear = live.filter((i) => i.year === thisYear);
  const paidYear = invoicedYear.filter((i) => i.rawStatus === 'paid');
  const outstanding = live.filter((i) => i.rawStatus === 'sent');
  const drafts = live.filter((i) => i.rawStatus === 'draft');

  const tabs = [
    { id: 'all', label: 'All Invoices' },
    { id: 'draft', label: 'Draft' },
    { id: 'sent', label: 'Sent' },
    { id: 'paid', label: 'Paid' },
    { id: 'voided', label: 'Void' },
  ].map((t) => ({ ...t, count: t.id === 'all' ? invoices.length : invoices.filter((i) => i.rawStatus === t.id).length }));
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const visible = (tab === 'all' ? invoices : invoices.filter((i) => i.rawStatus === tab))
    .filter((i) => !q || [i.invoice_number, i.landlord, i.property, i.propertyName].some((v) => String(v || '').toLowerCase().includes(q)));
  const counts = { paid: 0, sent: 0, draft: 0, voided: 0 };
  invoices.forEach((i) => { counts[i.rawStatus] = (counts[i.rawStatus] || 0) + 1; });
  const donut = [
    { label: 'Paid', value: counts.paid, color: C.green },
    { label: 'Sent (unpaid)', value: counts.sent, color: C.blue },
    { label: 'Draft', value: counts.draft, color: C.amber },
    { label: 'Void', value: counts.voided, color: C.grey },
  ].map((d) => ({ ...d, display: `${d.value} (${pct(d.value, invoices.length)})` }));
  const byDate = [...invoices].filter((i) => i.rawDate).sort((x, y) => new Date(y.rawDate) - new Date(x.rawDate));

  const exportCsv = () => downloadCsv('invoices.csv', visible, [
    { key: 'invoice_number', label: 'Invoice Number' },
    { key: 'landlord', label: 'Landlord' },
    { key: 'property', label: 'Property' },
    { key: 'period', label: 'Billing Period' },
    { key: 'date', label: 'Issue Date' },
    { key: (r) => r.gross.toFixed(2), label: 'Gross Fees (£)' },
    { key: (r) => r.discounts.toFixed(2), label: 'Discounts (£)' },
    { key: (r) => r.net.toFixed(2), label: 'Net Fees Due (£)' },
    { key: 'status', label: 'Status' },
  ]);

  return (
    <div className="py-6 max-w-[1440px] mx-auto px-8 flex flex-col gap-6 font-sans text-brand-primary">
      <PageActions>
        <ExportButton onClick={exportCsv} disabled={loading || !visible.length} />
        <Button variant="accent" onClick={() => setShowModal(true)} icon={Receipt}>Generate Invoice</Button>
      </PageActions>

      <KpiRow>
        <KpiCard icon={FileText} tone="green" label={`Total Invoiced (${thisYear})`} value={money(sumNet(invoicedYear))} sub={`${invoicedYear.length} invoice${invoicedYear.length === 1 ? '' : 's'}`} link="View all" onClick={() => setTab('all')} loading={loading} />
        <KpiCard icon={CheckCircle2} tone="indigo" label={`Paid (${thisYear})`} value={money(sumNet(paidYear))} sub={`${paidYear.length} invoice${paidYear.length === 1 ? '' : 's'}`} link="View paid" onClick={() => setTab('paid')} loading={loading} />
        <KpiCard icon={Clock} tone="orange" label="Outstanding" value={money(sumNet(outstanding))} sub={`${outstanding.length} sent, not paid`} link="View outstanding" onClick={() => setTab('sent')} loading={loading} />
        <KpiCard icon={Clock} tone="red" label="Overdue" value={<NotTracked what="Invoice due dates" />} sub="Invoices have no due date yet" loading={loading} />
        <KpiCard icon={PencilLine} tone="blue" label="Draft" value={money(sumNet(drafts))} sub={`${drafts.length} not sent yet`} link="View draft" onClick={() => setTab('draft')} loading={loading} />
      </KpiRow>

      <WithRail
        rail={(
          <>
            <SectionCard title="Invoice Summary" action="View Report" to="/reports">
              <Donut data={donut} centre={invoices.length} sub="Total" />
            </SectionCard>
            <SectionCard title="Outstanding Invoices" action="View all" onAction={() => setTab('sent')}>
              <UpcomingList
                empty="No unpaid invoices."
                items={outstanding.slice(0, 5).map((i) => {
                  const age = i.rawDate ? -daysUntil(i.rawDate) : null;
                  return {
                    key: i.id,
                    title: `${i.invoice_number} · ${i.landlord}`,
                    sub: i.propertyName || i.property,
                    date: gbp(i.net),
                    badge: age !== null ? `${age} day${age === 1 ? '' : 's'}` : null,
                    badgeTone: age > 30 ? 'red' : 'grey',
                  };
                })}
              />
            </SectionCard>
            <QuickActions items={[
              { icon: Receipt, label: 'Create New Invoice', sub: 'Generate and send a new invoice', onClick: () => setShowModal(true) },
              { icon: FileText, label: 'Statements', sub: 'Landlord statements', to: '/statements' },
              { icon: CheckCircle2, label: 'Accounting Overview', sub: 'Payments and bank transactions', to: '/accounting' },
            ]} />
            <SectionCard title="Recent Invoice Activity">
              <UpcomingList
                empty="No invoices yet."
                items={byDate.slice(0, 3).map((i) => ({
                  key: i.id,
                  title: `${i.status}: ${i.invoice_number}`,
                  sub: i.landlord,
                  date: shortDate(i.rawDate),
                }))}
              />
            </SectionCard>
          </>
        )}
      >
        <SectionCard>
          <div className="flex items-end justify-between gap-3 flex-wrap border-b border-card-border">
            <ListTabs tabs={tabs} value={tab} onChange={setTab} />
          </div>
          <SearchInput value={search} onChange={setSearch} placeholder="Search invoices…" className="w-full md:w-96" />
          {loading ? (
            <div className="space-y-4 py-4">
              <Skeleton radius="bar" className="h-10 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : error ? (
            <div className="border border-status-danger/15 bg-status-danger-bg rounded-card p-6 text-center text-status-danger font-semibold">{error}</div>
          ) : (
            <DataTable columns={columns} data={visible} />
          )}
        </SectionCard>
      </WithRail>

      <InfoFooter text="Management fee invoices to landlords. Voided invoices are left out of the totals." onRefresh={fetchInvoices} />

      {/* Invoice Generation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl border border-card-border overflow-hidden my-8">
            <div className="bg-brand-primary text-white p-5 font-bold flex items-center gap-2 select-none shrink-0">
              <Receipt size={18} />
              <span>Generate Landlord Invoice</span>
              <button
                type="button"
                onClick={() => { setShowModal(false); resetForm(); }}
                disabled={modalLoading}
                className="ml-auto p-1 rounded-md text-white/80 hover:text-white hover:bg-white/10 cursor-pointer disabled:opacity-50"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleGenerateInvoiceSubmit} className="p-6 flex flex-col gap-6 max-h-[80vh] overflow-y-auto">
              {/* Select Property for Autofill */}
              <div className="bg-status-info-bg p-4 rounded-card border border-status-info/15 flex flex-col gap-3">
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
                <p className="text-xs-portal text-status-info italic">
                  Selecting a property will automatically populate landlord, reference, property, and tenant details.
                </p>
              </div>

              {/* Section 1: Landlord & References */}
              <div className="border-b pb-4 border-card-border">
                <h3 className="text-sm-portal font-bold text-brand-primary capitalize mb-3">Landlord & References Details</h3>
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
              <div className="border-b pb-4 border-card-border">
                <h3 className="text-sm-portal font-bold text-brand-primary capitalize mb-3">Property & Tenancy Details</h3>
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
              <div className="border-b pb-4 border-card-border">
                <h3 className="text-sm-portal font-bold text-brand-primary capitalize mb-3">Billing Period</h3>
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
              <div className="border-b pb-4 border-card-border">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm-portal font-bold text-brand-primary capitalize">Invoice Line Items</h3>
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
                        <label className="block text-xs font-semibold text-status-muted mb-1 md:hidden">Net (£)</label>
                        <div className="px-3 py-2 bg-surface-light border border-card-border rounded-lg text-sm font-bold text-brand-primary h-10 flex items-center justify-end">
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
              <div className="bg-brand-primary/5 border border-brand-accent/20 rounded-card p-4 flex flex-col md:flex-row justify-between gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-status-muted mb-1">Notes</label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-brand-accent bg-white resize-none"
                    placeholder="e.g. UK Vastgoed introductory discount applied."
                  />
                </div>
                
                <div className="w-full md:w-64 flex flex-col gap-2 justify-center border-t md:border-t-0 md:border-l border-card-border pt-3 md:pt-0 md:pl-4">
                  <div className="flex justify-between text-xs text-status-muted">
                    <span>Total Gross:</span>
                    <span>£{totalGross.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-status-muted">
                    <span>Total VAT:</span>
                    <span>£{totalVAT.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-status-muted">
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
