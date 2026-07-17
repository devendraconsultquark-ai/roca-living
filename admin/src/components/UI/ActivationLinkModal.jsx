import { useToast } from './ToastContext';
import { Button } from './Button';

// One-time set-password link handoff, shown after registering a landlord or
// regenerating a link from the detail page. No email is sent anywhere — the
// admin copies the link and shares it with the landlord directly.
export const ActivationLinkModal = ({ info, onClose }) => {
  const { addToast } = useToast();

  if (!info) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(info.link);
      addToast('Activation link copied to clipboard', 'success');
    } catch {
      addToast('Could not copy automatically — select the link and copy it manually', 'error');
    }
  };

  return (
    <div className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl mx-4 border border-card-border">
        <h3 className="text-lg font-bold text-brand-primary mb-2">Share Activation Link</h3>
        <p className="text-sm text-status-muted leading-relaxed">
          Share this one-time link with {info.name || 'the landlord'} — it lets them set their own
          password and sign in to the landlord portal. No email has been sent.
          {info.expiresAt ? ` The link is valid until ${new Date(info.expiresAt).toLocaleDateString('en-GB')}.` : ''}
        </p>
        <div className="mt-4 flex items-center gap-2">
          <input
            readOnly
            value={info.link}
            onFocus={(e) => e.target.select()}
            className="flex-1 text-xs font-mono border border-card-border rounded-lg px-3 py-2.5 bg-surface-light text-brand-primary min-w-0"
          />
          <Button type="button" variant="primary" onClick={handleCopy}>
            Copy
          </Button>
        </div>
        <div className="flex justify-end mt-5">
          <Button type="button" variant="ghost" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
};
