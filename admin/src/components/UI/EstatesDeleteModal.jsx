import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { Input } from './Input';
import { Button } from './Button';
import { useToast } from './ToastContext';
import api from '../../utilities/api';

// Delete a ROCA Estates landlord or apartment from Roca Living. Typing the
// name (or unit) unlocks the button. ROCA Estates refuses records with
// payments, invoices or documents and Roca Living refuses those with lettings
// history; the reason is shown here, nothing is deleted then.
//   kind: 'landlord' | 'apartment'   rocaemId: ROCA Estates id
//   confirmWord: what to type (landlord name or unit, e.g. PH-96)
export const EstatesDeleteModal = ({ kind, rocaemId, confirmWord, onClose, onDeleted }) => {
  const { addToast } = useToast();
  const [typed, setTyped] = useState('');
  const [refusal, setRefusal] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const what = kind === 'landlord' ? 'landlord' : 'apartment';
  const matches = typed.trim().toLowerCase() === String(confirmWord).trim().toLowerCase();

  const remove = async () => {
    setDeleting(true);
    setRefusal(null);
    try {
      const res = await api.delete(`/estates/${kind === 'landlord' ? 'landlords' : 'properties'}/${rocaemId}`, { skipInterceptorError: true });
      addToast(res.data.message, 'success');
      onDeleted();
    } catch (err) {
      setRefusal(err.response?.data?.message || `Could not delete the ${what}`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl border border-card-border p-6 flex flex-col gap-4">
        <div className="flex justify-between items-start gap-3">
          <h3 className="text-lg font-bold text-brand-primary">Delete {what}?</h3>
          <button type="button" onClick={onClose} disabled={deleting} className="text-gray-400 hover:text-brand-primary cursor-pointer disabled:opacity-50" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="flex items-start gap-3 border border-status-danger/20 bg-status-danger-bg rounded-card p-4 text-sm text-brand-primary">
          <AlertTriangle size={18} className="text-status-danger shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1.5">
            <p>
              <span className="font-bold">{confirmWord}</span> is deleted in ROCA Estates and in Roca Living. This can&apos;t be undone.
            </p>
            <p className="text-[11px] text-status-muted">
              {kind === 'landlord' ? 'Landlords with any history are never deleted.' : 'Apartments with any history are never deleted.'}
            </p>
          </div>
        </div>

        <Input
          id="delete_confirm"
          label={`Type ${confirmWord} to confirm`}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
        />

        {refusal && (
          <p role="alert" className="text-sm font-semibold text-status-danger border border-status-danger/20 rounded-card p-3">
            Not deleted: {refusal}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={deleting}>Cancel</Button>
          <Button type="button" variant="danger" onClick={remove} disabled={!matches || deleting}>
            {deleting ? 'Deleting…' : `Delete ${what}`}
          </Button>
        </div>
      </div>
    </div>
  );
};
