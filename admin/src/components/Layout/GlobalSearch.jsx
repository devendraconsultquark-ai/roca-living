import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, Home, UserCheck } from 'lucide-react';
import api from '../../utilities/api';

// Header global search (design-spec pattern). The three directories are small,
// so they're fetched once on first focus and filtered client-side per keystroke.
export const GlobalSearch = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null); // { landlords, properties, tenants } | null = not fetched
  const [loading, setLoading] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const ensureData = () => {
    if (data !== null || loading) return;
    setLoading(true);
    Promise.allSettled([
      api.get('/landlords'),
      api.get('/properties'),
      api.get('/tenancies/tenants/all'),
    ])
      .then(([l, p, t]) => {
        setData({
          landlords: l.status === 'fulfilled' ? l.value.data.data || [] : [],
          properties: p.status === 'fulfilled' ? p.value.data.data || [] : [],
          tenants: t.status === 'fulfilled' ? t.value.data.data || [] : [],
        });
      })
      .finally(() => setLoading(false));
  };

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!data || q.length < 2) return null;
    const match = (...fields) => fields.some((f) => f && String(f).toLowerCase().includes(q));
    return {
      landlords: data.landlords
        .filter((l) => match(l.name, l.email, l.landlord_reference))
        .slice(0, 5),
      properties: data.properties
        .filter((p) => match(p.name, p.address_line1, p.city, p.postcode, p.property_reference))
        .slice(0, 5),
      tenants: data.tenants
        .filter((t) => match(t.name, t.email, t.address_line1))
        .slice(0, 5),
    };
  }, [data, query]);

  const goTo = (path) => {
    setOpen(false);
    setQuery('');
    navigate(path);
  };

  const hasResults =
    results && (results.landlords.length || results.properties.length || results.tenants.length);

  const section = (label, Icon, rows, rowMain, rowSub, pathFor) =>
    rows.length > 0 && (
      <div key={label}>
        <p className="px-4 pt-3 pb-1.5 text-2xs font-bold text-gray-400 uppercase tracking-wider select-none">{label}</p>
        {rows.map((row) => (
          <button
            key={`${label}-${row.id}`}
            onClick={() => goTo(pathFor(row))}
            className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-surface-light transition-colors cursor-pointer"
          >
            <span className="w-7 h-7 rounded-full bg-brand-accent/10 text-brand-accent flex items-center justify-center shrink-0">
              <Icon size={14} />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-bold text-brand-primary truncate">{rowMain(row)}</span>
              {rowSub(row) && (
                <span className="block text-2xs text-status-muted font-semibold truncate">{rowSub(row)}</span>
              )}
            </span>
          </button>
        ))}
      </div>
    );

  return (
    <div className="relative w-full" ref={boxRef}>
      <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      <input
        type="text"
        value={query}
        placeholder="Search landlords, properties, tenants..."
        onFocus={() => {
          setOpen(true);
          ensureData();
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
        className="w-full bg-white border border-card-border rounded-lg pl-10 pr-4 py-2.5 text-xs-portal font-semibold text-brand-primary placeholder:text-gray-400 focus:outline-none focus:border-brand-accent/50 focus:ring-2 focus:ring-brand-accent/15 transition-all"
      />

      {open && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full mt-2 card-bg border border-card-border rounded-card shadow-premium max-h-96 overflow-y-auto z-50 pb-2">
          {loading || data === null ? (
            <p className="text-xs text-gray-400 font-semibold px-4 py-5 text-center">Searching…</p>
          ) : !hasResults ? (
            <p className="text-xs text-gray-400 font-semibold px-4 py-5 text-center">
              No matches for “{query.trim()}”
            </p>
          ) : (
            <>
              {section('Landlords', Users, results.landlords,
                (l) => l.name,
                (l) => l.landlord_reference || l.email,
                (l) => `/landlords/${l.id}`)}
              {section('Properties', Home, results.properties,
                (p) => p.name || p.address_line1,
                (p) => [p.property_reference, p.city].filter(Boolean).join(' • '),
                (p) => `/properties/${p.id}`)}
              {section('Tenants', UserCheck, results.tenants,
                (t) => t.name,
                (t) => t.address_line1 || t.email,
                (t) => `/tenants/${t.id}`)}
            </>
          )}
        </div>
      )}
    </div>
  );
};
