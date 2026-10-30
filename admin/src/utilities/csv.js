// CSV export used by the list pages' Export buttons.
// headers: [{ key, label }] — key is a field name or a function (row) => value.
export const toCsv = (rows, headers) => {
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const value = (r, h) => (typeof h.key === 'function' ? h.key(r) : r[h.key]);
  return [
    headers.map((h) => escape(h.label)).join(','),
    ...rows.map((r) => headers.map((h) => escape(value(r, h))).join(','))
  ].join('\n');
};

export const downloadCsv = (filename, rows, headers) => {
  // The byte-order mark makes Excel read UTF-8 (else £ shows as Â£).
  const blob = new Blob(['﻿' + toCsv(rows, headers)], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
