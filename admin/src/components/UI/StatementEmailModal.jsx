import { useState, useEffect } from 'react';
import { Mail, X, Paperclip } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import { Skeleton } from './Skeleton';
import { useToast } from './ToastContext';
import { useConfirm } from './ConfirmContext';
import api from '../../utilities/api';

// Email draft for a statement (handover RL-006): prepared automatically,
// reviewed and edited here, then sent with the statement PDF attached.
export const StatementEmailModal = ({ statementId, onClose, onSent }) => {
  const { addToast } = useToast();
  const confirm = useConfirm();
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/statements/${statementId}/email`);
        setDraft(res.data.data);
      } catch (err) {
        addToast(err.response?.data?.message || 'Failed to load the email draft', 'error');
        onClose();
      }
    };
    load();
  }, [statementId, addToast, onClose]);

  const set = (key, value) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty(true);
  };

  const save = async (quiet = false) => {
    setSaving(true);
    try {
      await api.put(`/statements/${statementId}/email`, { to: draft.to, cc: draft.cc, subject: draft.subject, body: draft.body });
      setDirty(false);
      if (!quiet) addToast('Email draft saved', 'success');
      return true;
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to save the draft', 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const send = async () => {
    if (!draft.to.trim()) {
      addToast('Enter the recipient email address', 'error');
      return;
    }
    const ok = await confirm({
      title: draft.sent_at ? 'Send again?' : 'Send statement email',
      message: `${draft.sent_at ? `This was already emailed to ${draft.sent_to}. ` : ''}Send "${draft.subject}" with ${draft.attachment} to ${draft.to}${draft.cc ? ` (cc ${draft.cc})` : ''}?`,
      confirmText: draft.sent_at ? 'Send again' : 'Send email',
    });
    if (!ok) return;
    if (dirty && !(await save(true))) return;
    setSending(true);
    try {
      const res = await api.post(`/statements/${statementId}/send`);
      addToast(`Statement emailed to ${res.data.data.sent_to}`, 'success');
      onSent();
      onClose();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to send the email', 'error');
    } finally {
      setSending(false);
    }
  };

  const downloadAttachment = async () => {
    try {
      const res = await api.get(`/statements/${statementId}/pdf`, { responseType: 'blob', skipInterceptorError: true });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
    } catch {
      addToast('Failed to open the PDF', 'error');
    }
  };

  const busy = saving || sending;

  return (
    <div className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl border border-card-border overflow-hidden my-8">
        <div className="bg-brand-primary text-white p-5 font-bold flex items-center gap-2 select-none">
          <Mail size={18} />
          <span>Email draft{draft?.statement_number ? ` · ${draft.statement_number}` : ''}</span>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="ml-auto p-1 rounded-md text-white/80 hover:text-white hover:bg-white/10 cursor-pointer disabled:opacity-50"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
          {!draft ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (
            <>
              <p className="text-xs-portal text-status-muted">
                Prepared automatically — check it, edit anything, then send. Nothing is sent until you click Send email.
                {draft.sent_at && ` Last emailed ${new Date(draft.sent_at).toLocaleDateString('en-GB')} to ${draft.sent_to}.`}
              </p>
              <Input id="emailTo" label="To" required placeholder="landlord@example.com" value={draft.to} onChange={(e) => set('to', e.target.value)} />
              <Input id="emailCc" label="CC (optional, separate with commas)" value={draft.cc} onChange={(e) => set('cc', e.target.value)} />
              <Input id="emailSubject" label="Subject" required value={draft.subject} onChange={(e) => set('subject', e.target.value)} />
              <div>
                <label htmlFor="emailBody" className="block text-xs font-semibold text-status-muted mb-1">Message</label>
                <textarea
                  id="emailBody"
                  rows={9}
                  value={draft.body}
                  onChange={(e) => set('body', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-brand-accent bg-white resize-y"
                />
              </div>
              <button
                type="button"
                onClick={downloadAttachment}
                className="self-start flex items-center gap-2 px-3 py-2 rounded-lg border border-card-border bg-surface-hover/50 text-sm font-semibold text-brand-primary hover:bg-surface-hover cursor-pointer"
              >
                <Paperclip size={15} /> {draft.attachment}
              </button>
            </>
          )}
        </div>

        <div className="px-6 pb-6 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="button" variant="secondary" onClick={() => save()} disabled={!draft || busy || !dirty}>
            {saving ? 'Saving…' : 'Save draft'}
          </Button>
          <Button type="button" variant="primary" icon={Mail} onClick={send} disabled={!draft || busy}>
            {sending ? 'Sending…' : 'Send email'}
          </Button>
        </div>
      </div>
    </div>
  );
};
