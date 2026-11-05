import { useMemo, useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/UI/Button';
import { Skeleton } from '../components/UI/Skeleton';
import { InfoTip } from '../components/UI/InfoTip';
import { Dropdown } from '../components/UI/Dropdown';
import { SearchInput } from '../components/UI/DesignKit';
import { TenantStatementModal } from '../components/UI/TenantStatementModal';
import { AllStatementsTable } from '../components/UI/AllStatementsTable';
import { useAllStatements } from '../hooks/useAllStatements';
import { TYPE_LABEL } from '../utilities/statementTypes';

const STATUS_LABEL = { draft: 'Draft', sent: 'Sent', paid: 'Paid' };

// Every landlord statement in one list (single source of truth): Roca Living
// (Generate Statement), Rent Cycle ("Make Statement") and Historic (before
// Roca Living). Search + Type + Status, like the other list pages. The
// Generate Statement form itself is unchanged.
export const Statements = () => {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const { rows, error, reload } = useAllStatements();

  const shown = useMemo(() => {
    if (!rows) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter((r) => (!type || r.type === type)
      && (!status || r.status === status)
      && (!q || [r.statement_number, r.landlord_name, r.flat, r.tenant_name].some((v) => String(v || '').toLowerCase().includes(q))));
  }, [rows, search, type, status]);

  const count = (key, value) => (rows ? rows.filter((r) => r[key] === value).length : 0);

  return (
    <div className="py-6 max-w-[1440px] mx-auto px-8 flex flex-col gap-6 font-sans text-brand-primary">
      {/* Page actions (title lives in the layout header) */}
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={() => navigate('/statements/approved')} icon={FileSpreadsheet}>
          Statement from approved rent
        </Button>
        <Button variant="primary" onClick={() => setShowModal(true)} icon={FileSpreadsheet}>
          Generate Statement
        </Button>
      </div>

      <div className="card-bg border border-card-border rounded-card shadow-premium p-4 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-end gap-3 flex-wrap">
          <SearchInput value={search} onChange={setSearch} placeholder="Search statement no., landlord, flat or tenant…" className="w-full md:w-96" />
          <div className="w-full md:w-56">
            <Dropdown
              id="statement-type"
              placeholder="All Statement Types"
              clearable
              options={Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label: `${label} (${count('type', value)})` }))}
              value={type}
              onChange={(v) => setType(v || '')}
            />
          </div>
          <div className="w-full md:w-44">
            <Dropdown
              id="statement-status"
              placeholder="All Statuses"
              clearable
              options={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label: `${label} (${count('status', value)})` }))}
              value={status}
              onChange={(v) => setStatus(v || '')}
            />
          </div>
          <span className="md:ml-auto text-xs text-status-muted inline-flex items-center gap-1.5 md:pb-2.5">
            {shown ? `${shown.length} of ${rows.length} statements` : ''}
            <InfoTip text="Roca Living = made with Generate Statement. Rent Cycle = made with Make Statement on the Rent Cycle page. Historic = made before Roca Living took over (read-only). The same list feeds the landlord, property and portal pages." />
          </span>
        </div>

        {rows === null ? (
          <div className="space-y-4 py-4">
            <Skeleton radius="bar" className="h-10 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : error ? (
          <div className="border border-status-danger/15 bg-status-danger-bg rounded-card p-6 text-center text-status-danger font-semibold">{error}</div>
        ) : (
          <AllStatementsTable
            rows={shown}
            onChanged={reload}
            emptyText={search || type || status ? 'No statements match these filters.' : 'No statements yet.'}
          />
        )}
      </div>

      {showModal && <TenantStatementModal onClose={() => setShowModal(false)} onGenerated={reload} />}
    </div>
  );
};
