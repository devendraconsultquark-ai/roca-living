import { useCallback } from 'react';
import { useToast } from '../../components/UI/ToastContext';

// Pages under development show sample data copied from the approved design
// (RL_Admin_Portal Design.pdf). Nothing on them is real or saved.
export const DUMMY_MSG = 'Under development — this page shows dummy data.';

// Every button on a mock page explains instead of acting.
export const useDummyToast = () => {
  const { addToast } = useToast();
  return useCallback(() => addToast(DUMMY_MSG, 'info'), [addToast]);
};

// Chart colours (same palette as CashflowOverview / Compliance charts)
export const C = {
  green: '#3A7D44',
  indigo: '#4F46E5',
  amber: '#E8A020',
  orange: '#F16900',
  blue: '#0A58CA',
  red: '#C62828',
  purple: '#7C3AED',
  teal: '#0E9F9A',
  pink: '#DB2777',
  grey: '#9CA3AF',
};

// Tailwind classes per tone (icon circle, pill, text)
export const TONES = {
  green: { icon: 'text-status-success bg-status-success/10', pill: 'bg-status-success-bg text-status-success', text: 'text-status-success' },
  indigo: { icon: 'text-brand-accent bg-brand-accent/10', pill: 'bg-brand-accent/10 text-brand-accent', text: 'text-brand-accent' },
  orange: { icon: 'text-status-warning bg-status-warning/10', pill: 'bg-status-warning/10 text-status-warning', text: 'text-status-warning' },
  red: { icon: 'text-status-danger bg-status-danger/10', pill: 'bg-status-danger-bg text-status-danger', text: 'text-status-danger' },
  blue: { icon: 'text-status-info bg-status-info/10', pill: 'bg-status-info-bg text-status-info', text: 'text-status-info' },
  grey: { icon: 'text-status-muted bg-surface-hover', pill: 'bg-surface-hover text-gray-500', text: 'text-gray-400' },
};
