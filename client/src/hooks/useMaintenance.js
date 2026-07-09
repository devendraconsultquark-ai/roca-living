import { useState, useEffect } from 'react';
import { useToast } from '../components/UI/ToastContext';
import api from '../utilities/api';

export const useMaintenance = () => {
  const { addToast } = useToast();

  // Quotes / tickets awaiting approval
  const [quotes, setQuotes] = useState([]);
  const [quotesLoading, setQuotesLoading] = useState(true);

  // All landlord maintenance tickets
  const [tickets, setTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [error, setError] = useState(null);

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

  // Fetch my tickets (awaiting approval with quote)
  const fetchQuotes = async () => {
    setQuotesLoading(true);
    setTicketsLoading(true);
    try {
      const res = await api.get('/maintenance/my');
      const allTickets = res.data.data || [];
      setTickets(allTickets);
      
      // Show tickets that are awaiting_approval or newly-raised with a quote
      const quoteTickets = allTickets.filter(
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
      setError(null);
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to load maintenance tickets';
      setError(errMsg);
      addToast(errMsg, 'error');
    } finally {
      setQuotesLoading(false);
      setTicketsLoading(false);
    }
  };

  // Fetch landlord properties for form dropdown
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

  // Quote actions
  const handleQuoteAction = async (quoteId, action) => {
    try {
      if (action === 'approve') {
        await api.patch(`/maintenance/${quoteId}/approve`);
        addToast(`Quote #${quoteId} approved!`, 'success');
      } else {
        await api.patch(`/maintenance/${quoteId}/decline`);
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

  // Drag-drop handlers
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

  // Submit new issue
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

  return {
    quotes,
    quotesLoading,
    tickets,
    ticketsLoading,
    error,
    myProperties,
    property,
    setProperty,
    title,
    setTitle,
    description,
    setDescription,
    picture,
    setPicture,
    dragActive,
    errors,
    loading,
    handleQuoteAction,
    handleDrag,
    handleDrop,
    handleFileInputChange,
    handleSubmitIssue,
  };
};
