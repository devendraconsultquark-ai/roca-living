import { useMemo, useState } from 'react';
import { FileText, Image as ImageIcon, File, Eye, Download, Trash2 } from 'lucide-react';
import { ListTabs } from './ListToolbar';
import { SearchInput } from './DesignKit';
import { Dropdown } from './Dropdown';

// One document list for the landlord, property and tenant pages: search, a tab
// per category (the folder the file is in), file type and sort, grouped by
// category under "All". Rows: preview (also by clicking the name), download,
// optional delete.
// documents: [{ id, name, size, date, folder, mime_type, doc_reference }]

// Folder → category shown here, in this order. Unknown folders keep their name.
const CATEGORIES = [
  ['Landlord Documents', ['Landlord Documents', 'Landlord Compliance Documents']],
  ['Roca Living Statements', ['Statements', 'Landlord Statements']],
  ['Invoices', ['Invoices']],
  ['Statements Before Roca Living', ['Statements Before Roca Living']],
  ['Previous Agent Documents', ['Previous Agent Documents']],
  ['Tenancy Agreements & Deposits', ['Tenancy Agreements & Deposits']],
  ['Certificates', ['Property Gas & Safety Certs']],
  ['Inventories & Reports', ['Inventories & Reports']],
  ['Previous Tenancies', ['Previous Tenancies']],
];
const categoryOf = (folder) => CATEGORIES.find(([, folders]) => folders.includes(folder))?.[0] || folder || 'Other';
const categoryRank = (c) => { const i = CATEGORIES.findIndex(([name]) => name === c); return i === -1 ? CATEGORIES.length : i; };

const kindOf = (d) => {
  const type = d.mime_type || '';
  const ext = String(d.name || '').toLowerCase().split('.').pop();
  if (type === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
  return 'other';
};
const KIND_ICON = { pdf: FileText, image: ImageIcon, other: File };
const ukDate = (ymd) => (ymd ? ymd.split('-').reverse().join('/') : '—');

const TYPE_OPTIONS = [
  { value: 'all', label: 'All File Types' },
  { value: 'pdf', label: 'PDF' },
  { value: 'image', label: 'Images' },
  { value: 'other', label: 'Other Files' },
];
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'name', label: 'Name A–Z' },
];

const iconBtn = 'p-2 text-gray-400 rounded-lg transition-colors border border-transparent cursor-pointer';

export const DocumentList = ({ documents, onPreview, onDownload, onDelete = null, emptyText = 'No documents yet.' }) => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [kind, setKind] = useState('all');
  const [sort, setSort] = useState('newest');

  const docs = useMemo(() => documents.map((d) => ({ ...d, category: categoryOf(d.folder), kind: kindOf(d) })), [documents]);
  const categories = useMemo(() => {
    const counts = new Map();
    for (const d of docs) counts.set(d.category, (counts.get(d.category) || 0) + 1);
    return [...counts].sort((a, b) => categoryRank(a[0]) - categoryRank(b[0]) || a[0].localeCompare(b[0]));
  }, [docs]);

  const q = search.trim().toLowerCase();
  const shown = docs
    .filter((d) => (category === 'all' || d.category === category)
      && (kind === 'all' || d.kind === kind)
      && (!q || `${d.name} ${d.doc_reference || ''}`.toLowerCase().includes(q)))
    .sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name)
      : sort === 'oldest' ? String(a.date).localeCompare(String(b.date)) || a.id - b.id
        : String(b.date).localeCompare(String(a.date)) || b.id - a.id));
  // Under "All", one heading per category.
  const groups = category === 'all'
    ? categories.map(([c]) => [c, shown.filter((d) => d.category === c)]).filter(([, list]) => list.length)
    : [[null, shown]];
  const filtered = q || kind !== 'all' || category !== 'all';

  if (!documents.length) return <p className="text-sm text-status-muted py-6 text-center">{emptyText}</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search name or reference…" className="w-full md:flex-1" />
        <div className="flex gap-3">
          <Dropdown id="doc-type-filter" size="sm" options={TYPE_OPTIONS} value={kind} onChange={setKind} className="w-40" />
          <Dropdown id="doc-sort" size="sm" options={SORT_OPTIONS} value={sort} onChange={setSort} className="w-40" />
        </div>
      </div>
      {categories.length > 1 && (
        <div className="border-b border-card-border">
          <ListTabs
            tabs={[{ id: 'all', label: 'All', count: docs.length }, ...categories.map(([c, n]) => ({ id: c, label: c, count: n }))]}
            value={category}
            onChange={setCategory}
          />
        </div>
      )}

      {shown.length === 0 ? (
        <div className="text-sm text-status-muted py-6 text-center">
          No documents match.{' '}
          {filtered && (
            <button type="button" className="font-bold text-brand-accent hover:underline cursor-pointer"
              onClick={() => { setSearch(''); setKind('all'); setCategory('all'); }}>
              Clear Filters
            </button>
          )}
        </div>
      ) : groups.map(([title, list]) => (
        <div key={title || 'list'} className="flex flex-col gap-2">
          {title && (
            <h4 className="text-xs font-bold text-status-muted uppercase tracking-wide flex items-center gap-2">
              {title} <span className="text-gray-400 font-semibold normal-case">({list.length})</span>
            </h4>
          )}
          {list.map((d) => {
            const Icon = KIND_ICON[d.kind];
            return (
              <div key={d.id} className="flex items-center gap-3 p-3 bg-surface-light/50 border border-card-border rounded-card hover:bg-surface-light transition-colors">
                <span className="card-bg p-2 rounded-lg border border-card-border text-brand-accent shrink-0"><Icon size={16} /></span>
                <div className="min-w-0 flex-1">
                  <button type="button" onClick={() => onPreview(d)} title="Preview document"
                    className="block max-w-full text-left text-sm font-bold text-brand-primary hover:text-brand-accent hover:underline truncate cursor-pointer">
                    {d.name}
                  </button>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-2xs text-gray-400 font-semibold mt-0.5">
                    {d.doc_reference && <span className="bg-surface-hover px-1.5 py-0.5 rounded text-brand-primary">{d.doc_reference}</span>}
                    <span>Uploaded {ukDate(d.date)}</span>
                    <span>·</span>
                    <span>{d.size}</span>
                    {category === 'all' && !title && <><span>·</span><span>{d.category}</span></>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" onClick={() => onPreview(d)} className={`${iconBtn} hover:text-brand-accent hover:bg-brand-accent/5 hover:border-brand-accent/10`} title="Preview document" aria-label="Preview document">
                    <Eye size={16} />
                  </button>
                  <button type="button" onClick={() => onDownload(d)} className={`${iconBtn} hover:text-brand-accent hover:bg-brand-accent/5 hover:border-brand-accent/10`} title="Download document" aria-label="Download document">
                    <Download size={16} />
                  </button>
                  {onDelete && (
                    <button type="button" onClick={() => onDelete(d)} className={`${iconBtn} hover:text-status-danger hover:bg-status-danger/5 hover:border-status-danger/10`} title="Delete document" aria-label="Delete document">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};
