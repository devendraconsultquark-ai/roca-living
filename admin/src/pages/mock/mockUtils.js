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

// Colours are shared with the real design pages.
export { C, TONES } from '../../utilities/designTokens';
