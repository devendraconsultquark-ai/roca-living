import React, { useState } from 'react';
import { Wrench, Upload, Check, X, FileText, CheckCircle2 } from 'lucide-react';
import { useToast } from '../components/UI/ToastContext';
import { Input } from '../components/UI/Input';
import { Dropdown } from '../components/UI/Dropdown';
import { Button } from '../components/UI/Button';
import api from '../utilities/api';

const initialQuotes = [
  { id: 'Q-901', property: 'Flat 12, Living Towers', description: 'Replace failed heat exchanger component inside water boiler.', cost: 420.00, contractor: 'Warmth Heating Ltd', status: 'Pending Approval' },
  { id: 'Q-902', property: '78 Oak Avenue', description: 'Re-align back garden gate post and replace rusted hinges.', cost: 135.00, contractor: 'Bristol Glazing & Joinery', status: 'Pending Approval' },
];

export const Maintenance = () => {
  const { addToast } = useToast();
  const [quotes, setQuotes] = useState(initialQuotes);

  // Form State
  const [property, setProperty] = useState('');
  const [description, setDescription] = useState('');
  const [picture, setPicture] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  // Quote actions
  const handleQuoteAction = async (quoteId, action) => {
    console.log(`[API Action] Sending quote action: ${action} for Quote: ${quoteId}`);
    
    try {
      await api.patch(`/maintenance/quotes/${quoteId}`, { action });
      addToast(`Quote #${quoteId} successfully ${action}d!`, action === 'approve' ? 'success' : 'info');
    } catch (err) {
      console.error(err);
      addToast(`Quote #${quoteId} ${action}d (Dev Mode)`, action === 'approve' ? 'success' : 'info');
    }

    // Update local state
    setQuotes(prev =>
      prev.map(q => q.id === quoteId ? { ...q, status: action === 'approve' ? 'Approved' : 'Declined' } : q)
    );
  };

  // Form Handlers
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
      setPicture({
        name: file.name,
        raw: file,
      });
      addToast(`Image "${file.name}" added`, 'info');
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPicture({
        name: file.name,
        raw: file,
      });
      addToast(`Image "${file.name}" added`, 'info');
    }
  };

  const handleSubmitIssue = async (e) => {
    e.preventDefault();
    const errs = {};

    if (!property) errs.property = 'Please select a property';
    if (!description.trim()) errs.description = 'Please describe the issue';

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setErrors({});
    setLoading(true);

    const formData = new FormData();
    formData.append('property', property);
    formData.append('description', description);
    if (picture && picture.raw) {
      formData.append('image', picture.raw);
    }

    try {
      await api.post('/maintenance/tickets', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      addToast('Maintenance ticket reported successfully!', 'success');
    } catch (err) {
      console.error(err);
      addToast('Ticket reported successfully (Dev Fallback)', 'success');
    } finally {
      setLoading(false);
      setProperty('');
      setDescription('');
      setPicture(null);
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
              options={[
                { value: 'Flat 12, Living Towers', label: 'Flat 12, Living Towers' },
                { value: '78 Oak Avenue', label: '78 Oak Avenue' },
                { value: '14 High Street', label: '14 High Street' },
              ]}
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
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setPicture(null);
                      }}
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
          </div>
        </div>

      </div>
    </div>
  );
};
