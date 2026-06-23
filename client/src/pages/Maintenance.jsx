import React, { useState, useEffect } from 'react';
import { Wrench, Upload, Check, X, CheckCircle2 } from 'lucide-react';
import { useToast } from '../components/UI/ToastContext';
import { Input } from '../components/UI/Input';
import { Dropdown } from '../components/UI/Dropdown';
import { Button } from '../components/UI/Button';
import api from '../utilities/api';

export const Maintenance = () => {
  const { addToast } = useToast();

  // Quotes / tickets awaiting approval
  const [quotes, setQuotes] = useState([]);
  const [quotesLoading, setQuotesLoading] = useState(true);

  // Properties for the report form dropdown
  const [myProperties, setMyProperties] = useState([]);

  // Form state
  const [property, setProperty] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [picture, setPicture] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  // ─── Fetch my tickets (awaiting approval with quote) ───────────────────────
  const fetchQuotes = async () => {
    setQuotesLoading(true);
    try {
      const res = await api.get('/maintenance/my');
      const tickets = res.data.data || [];
      // Show tickets that are awaiting_approval or newly-raised with a quote
      const quoteTickets = tickets.filter(
        t => (t.status === 'awaiting_approval' || t.status === 'new' || t.status === 'triaged')
          && t.quote_amount !== null
          && parseFloat(t.quote_amount) > 0
          && !t.landlord_approved
      );
      setQuotes(quoteTickets.map(t => ({
        id: t.id,
        property: t.address_line1 ? `${t.address_line1}, ${t.city || ''}`.trim().replace(/,$/, '') : `Property #${t.property_id}`,
        description: t.description,
        cost: parseFloat(t.quote_amount),
        contractor: t.contractor_company || '—',
        status: 'Pending Approval',
      })));
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to load maintenance tickets', 'error');
    } finally {
      setQuotesLoading(false);
    }
  };

  // ─── Fetch landlord properties for form dropdown ──────────────────────────
  const fetchMyProperties = async () => {
    try {
      const res = await api.get('/properties/my');
      setMyProperties((res.data.data || []).map(p => ({
        value: p.id,
        label: `${p.address_line1}, ${p.city}`,
      })));
    } catch {
      // non-blocking
    }
  };

  useEffect(() => {
    fetchQuotes();
    fetchMyProperties();
  }, []);

  // ─── Quote actions ────────────────────────────────────────────────────────
  const handleQuoteAction = async (quoteId, action) => {
    try {
      if (action === 'approve') {
        await api.patch(`/maintenance/${quoteId}/approve`);
        addToast(`Quote #${quoteId} approved!`, 'success');
      } else {
        await api.patch(`/maintenance/${quoteId}/status`, { status: 'cancelled' });
        addToast(`Quote #${quoteId} declined.`, 'info');
      }
      // Update local state
      setQuotes(prev =>
        prev.map(q => q.id === quoteId ? { ...q, status: action === 'approve' ? 'Approved' : 'Declined' } : q)
      );
    } catch (err) {
      addToast(err.response?.data?.message || `Failed to ${action} quote`, 'error');
    }
  };

  // ─── Drag-drop handlers ───────────────────────────────────────────────────
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setPicture({ name: file.name, raw: file });
      addToast(`Image "${file.name}" added`, 'info');
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPicture({ name: file.name, raw: file });
      addToast(`Image "${file.name}" added`, 'info');
    }
  };

  // ─── Submit new issue ─────────────────────────────────────────────────────
  const handleSubmitIssue = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!property) errs.property = 'Please select a property';
    if (!title.trim()) errs.title = 'Please enter a title';
    if (!description.trim()) errs.description = 'Please describe the issue';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setErrors({});
    setLoading(true);

    try {
      await api.post('/maintenance', {
        property_id: property,
        urgency: 'routine',
        title: title.trim(),
        description: description.trim(),
      });
      addToast('Maintenance ticket reported successfully!', 'success');
      setProperty('');
      setTitle('');
      setDescription('');
      setPicture(null);
      fetchQuotes();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to submit issue', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-6 flex flex-col gap-8 max-w-7xl mx-auto px-4">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-[#1A1A1A]">Maintenance Board</h2>
        <p className="text-sm text-gray-500 mt-1">Report new issues and approve quotes for repairs.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left Pane: Report Form */}
        <div className="lg:col-span-1 bg-white border border-border-color rounded-2xl shadow-sm p-6 flex flex-col gap-5">
          <h3 className="font-bold text-sm text-gray-400 uppercase tracking-wider mb-1 select-none">Report Issue</h3>

          <form onSubmit={handleSubmitIssue} className="flex flex-col gap-5">
            <Dropdown
              label="Select Property"
              id="property"
              placeholder="Choose property"
              value={property}
              error={errors.property}
              onChange={(val) => setProperty(val)}
              options={myProperties}
              searchable
            />

            <Input
              label="Title"
              id="issue-title"
              required
              placeholder="e.g. Boiler not heating"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              error={errors.title}
            />

            <div className="flex flex-col w-full">
              <label htmlFor="description" className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-0.5">
                Issue Description <span className="text-status-danger">*</span>
              </label>
              <textarea
                id="description"
                rows={4}
                required
                placeholder="e.g. Boiler is leaking water from the bottom valve and radiator heat is fluctuating."
                className={`w-full text-sm font-sans bg-white border border-border-color rounded-lg py-2.5 px-3 transition-all focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent ${
                  errors.description ? 'border-status-danger focus:ring-status-danger/20 focus:border-status-danger' : ''
                }`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              {errors.description && (
                <span className="text-xs text-status-danger mt-1 font-semibold" role="alert">
                  {errors.description}
                </span>
              )}
            </div>

            {/* Picture Upload Box */}
            <div className="flex flex-col w-full">
              <span className="text-xs font-semibold text-gray-500 mb-1 select-none">Upload Picture (Optional)</span>

              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`w-full border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition-all min-h-[120px] relative ${
                  dragActive
                    ? 'border-brand-accent bg-brand-accent/5'
                    : picture
                      ? 'border-status-success bg-status-success/5 animate-pulse'
                      : 'border-border-color hover:border-brand-accent bg-white'
                }`}
              >
                <input
                  type="file"
                  id="image-upload"
                  accept="image/*"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                  onChange={handleFileInputChange}
                />

                {picture ? (
                  <div className="flex flex-col items-center gap-1.5">
                    <CheckCircle2 className="text-status-success" size={20} />
                    <p className="text-xs font-bold text-[#1A1A1A] max-w-[200px] truncate">{picture.name}</p>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); setPicture(null); }}
                      className="text-[10px] text-status-danger hover:underline font-bold z-30 cursor-pointer"
                    >
                      Change image
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1.5 select-none">
                    <Upload className="text-brand-accent" size={18} />
                    <p className="text-[11px] font-bold text-gray-500">
                      Drag image here or <span className="text-brand-accent hover:underline">browse</span>
                    </p>
                  </div>
                )}
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              fullWidth
              disabled={loading}
              className="mt-1"
            >
              {loading ? 'Submitting...' : 'Report Repair Issue'}
            </Button>
          </form>
        </div>

        {/* Right Pane: Quote Approvals */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          <h3 className="font-bold text-sm text-gray-400 uppercase tracking-wider mb-1 select-none">Repair Quotes Requiring Approval</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {quotesLoading ? (
              <>
                <div className="h-48 bg-gray-50 rounded-2xl border border-border-color animate-pulse" />
                <div className="h-48 bg-gray-50 rounded-2xl border border-border-color animate-pulse" />
              </>
            ) : (
              <>
                {quotes.map(quote => {
                  const isPending = quote.status === 'Pending Approval';
                  return (
                    <div
                      key={quote.id}
                      className="bg-white border border-border-color rounded-2xl shadow-sm flex flex-col overflow-hidden hover:shadow-md transition-shadow"
                    >
                      <div className="bg-brand-primary/5 p-4 border-b border-border-color flex justify-between items-center select-none">
                        <span className="text-xs font-bold text-brand-accent">{quote.property}</span>
                        <span className="text-[10px] text-gray-400 font-semibold">#{quote.id}</span>
                      </div>

                      <div className="p-4 flex-grow flex flex-col gap-3">
                        <div>
                          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Job Description</p>
                          <p className="text-xs text-gray-700 font-medium leading-relaxed mt-1">
                            {quote.description}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-2 border-t border-border-color/60 pt-3">
                          <div>
                            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Contractor</p>
                            <p className="text-xs font-bold text-gray-700 mt-0.5">{quote.contractor}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Estimated Cost</p>
                            <p className="text-sm font-black text-brand-primary mt-0.5">£{quote.cost.toFixed(2)}</p>
                          </div>
                        </div>
                      </div>

                      {/* Actions Footer */}
                      <div className="bg-gray-50 border-t border-border-color px-4 py-3 flex justify-between items-center min-h-[56px]">
                        {!isPending ? (
                          <div className="w-full text-center">
                            <span className={`inline-flex items-center gap-1 text-xs font-bold ${
                              quote.status === 'Approved' ? 'text-status-success' : 'text-status-danger'
                            }`}>
                              {quote.status === 'Approved' ? <Check size={14} /> : <X size={14} />}
                              Quote {quote.status}
                            </span>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => handleQuoteAction(quote.id, 'decline')}
                              className="px-3.5 py-2 text-xs font-bold text-status-danger hover:bg-status-danger/5 rounded-lg border border-status-danger/20 hover:border-status-danger/30 transition-colors cursor-pointer"
                            >
                              Decline
                            </button>
                            <button
                              onClick={() => handleQuoteAction(quote.id, 'approve')}
                              className="px-3.5 py-2 text-xs font-bold bg-status-success text-white hover:bg-status-success/90 rounded-lg shadow-xs hover:shadow-sm transition-colors cursor-pointer"
                            >
                              Approve Quote
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
                {quotes.length === 0 && (
                  <div className="col-span-2 bg-white border border-border-color rounded-2xl p-8 text-center text-gray-400 font-medium text-xs">
                    No active quotes require your approval.
                  </div>
                )}
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
