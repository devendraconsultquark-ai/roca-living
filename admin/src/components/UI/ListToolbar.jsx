import { Download } from 'lucide-react';
import { Button } from './Button';

// Status tabs above a list: [{ id, label, count? }]. Same pill style as Rent Reviews.
// Underlined tabs, as in the design (All Tenants | Former Tenants …).
export const ListTabs = ({ tabs, value, onChange }) => (
  <div className="flex items-center gap-5 flex-wrap">
    {tabs.map((t) => (
      <button
        key={t.id}
        type="button"
        onClick={() => onChange(t.id)}
        className={`pb-2 -mb-px border-b-2 text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
          value === t.id ? 'border-brand-accent text-brand-accent' : 'border-transparent text-gray-400 hover:text-brand-primary'
        }`}
      >
        {t.label}{t.count !== undefined ? ` (${t.count})` : ''}
      </button>
    ))}
  </div>
);

// Export the rows currently shown as a CSV file.
export const ExportButton = ({ onClick, disabled }) => (
  <Button variant="secondary" size="sm" icon={Download} onClick={onClick} disabled={disabled}>
    Export CSV
  </Button>
);
