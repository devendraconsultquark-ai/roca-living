import { useState, useEffect } from 'react';
import { useToast } from '../components/UI/ToastContext';
import api from '../utilities/api';

const RATING_LABELS = {
  excellent: 'Excellent',
  good: 'Good',
  satisfactory: 'Satisfactory',
  unsatisfactory: 'Unsatisfactory',
};

const mapInspection = (i) => ({
  id: i.id,
  property: i.address_line1
    ? `${i.address_line1}, ${i.city || ''}`.trim().replace(/,$/, '')
    : `Property #${i.property_id}`,
  date: i.inspected_at
    ? new Date(i.inspected_at).toLocaleDateString('en-GB')
    : '—',
  inspector: i.inspected_by || '—',
  rating: RATING_LABELS[i.rating] || i.rating || '—',
  comments: i.notes || '—',
  next_inspection_due: i.next_inspection_due || null,
});

export const useInspections = () => {
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  useEffect(() => {
    const fetchInspections = async () => {
      setLoading(true);
      try {
        const res = await api.get('/inspections/my');
        setInspections((res.data.data || []).map(mapInspection));
      } catch (err) {
        addToast(err.response?.data?.message || 'Failed to load inspections', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchInspections();
  }, []);

  const completedCount = inspections.length;

  const nextDue = inspections
    .map(i => i.next_inspection_due)
    .filter(Boolean)
    .sort()
    .at(0);

  const nextDueDisplay = nextDue
    ? new Date(nextDue).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    : 'Not scheduled';

  return {
    inspections,
    loading,
    completedCount,
    nextDueDisplay,
  };
};
