import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileSpreadsheet } from 'lucide-react';
import { Button } from '../components/UI/Button';
import { useToast } from '../components/UI/ToastContext';
import { ApprovedRentStatementModal } from '../components/UI/ApprovedRentStatementModal';
import { ApprovedStatementsTable } from '../components/UI/ApprovedStatementsTable';
import api from '../utilities/api';
import { InfoTip } from '../components/UI/InfoTip';

// Statements from approved rent — listed apart from the existing statements
// (which are unchanged), so the client can compare both. Day to day they are
// made and listed on Accounting → Rent Cycle.
export const ApprovedRentStatements = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [rows, setRows] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/approved-statements', { skipInterceptorError: true });
      setRows(res.data.data);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to load the statements', 'error');
      setRows([]);
    }
  }, [addToast]);

  useEffect(() => { Promise.resolve().then(load); }, [load]);

  return (
    <div className="py-6 max-w-[1440px] mx-auto px-8 flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => navigate('/statements')} className="flex items-center gap-2 text-sm font-semibold text-brand-accent hover:underline cursor-pointer">
          <ArrowLeft size={16} /> Back to statements
        </button>
        <Button variant="primary" icon={FileSpreadsheet} onClick={() => setShowModal(true)}>New statement from approved rent</Button>
      </div>

      <div className="card-bg border border-card-border rounded-card p-6 shadow-premium flex flex-col gap-4">
        <div>
          <h2 className="text-base font-bold text-brand-primary flex items-center gap-1.5">Statements from Approved Rent <InfoTip text="Made from rent approved in Rent Cycle. The usual statements are not affected." /></h2>
        </div>
        <ApprovedStatementsTable rows={rows} onChanged={load} emptyText="No statements from approved rent yet." />
      </div>

      {showModal && <ApprovedRentStatementModal onClose={() => setShowModal(false)} onCreated={load} />}
    </div>
  );
};
