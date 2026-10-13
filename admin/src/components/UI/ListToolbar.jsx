import { Download } from 'lucide-react';
import { Button } from './Button';

// Status tabs above a list: [{ id, label, count? }]. Same pill style as Rent Reviews.
export const ListTabs = ({ tabs, value, onChange }) => (
  <div className="flex items-center gap-1 flex-wrap">
    {tabs.map((t) => (
      <button
        key={t.id}
        type="button"
        onClick={() => onChange(t.id)}
        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
          value === t.id ? 'bg-brand-accent/10 text-brand-accent' : 'text-gray-400 hover:text-brand-primary hover:bg-surface-hover'
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
