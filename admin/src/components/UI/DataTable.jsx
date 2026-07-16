import React, { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { Dropdown } from './Dropdown';

export const DataTable = ({
  columns = [], // Array of { header, accessor, align: 'left'|'right', sortable: bool, renderCell: func }
  data = [],
  headerVariant = 'grey', // retained for API compatibility — both variants render the portal header
  enableBulkSelect = false,
  onSelectionChange = null,
  initialPageSize = 10,
  onRowClick = null,
}) => {
  const [sortField, setSortField] = useState(null);
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' or 'desc'
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // 1. Sort logic
  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedData = React.useMemo(() => {
    if (!sortField) return data;

    return [...data].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (typeof aVal === 'string') {
        return sortOrder === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [data, sortField, sortOrder]);

  // 2. Pagination logic
  const totalItems = sortedData.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedData = React.useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedData.slice(startIndex, startIndex + pageSize);
  }, [sortedData, currentPage, pageSize]);

  // 3. Selection handlers
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const newSelected = new Set(paginatedData.map(row => row.id));
      setSelectedIds(newSelected);
      if (onSelectionChange) onSelectionChange(Array.from(newSelected));
    } else {
      setSelectedIds(new Set());
      if (onSelectionChange) onSelectionChange([]);
    }
  };

  const handleSelectRow = (id) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
    if (onSelectionChange) onSelectionChange(Array.from(newSelected));
  };

  // Portal pagination button styles (mirrors the landlord portal Pagination)
  const pageBtnBase =
    'w-8 h-8 rounded-card text-brand-primary/50 hover:text-brand-primary hover:bg-surface-light transition-colors duration-150 cursor-pointer text-xs flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none';
  const pageBtnActive =
    'w-8 h-8 border border-status-info text-status-info rounded-card flex items-center justify-center text-xs font-bold bg-transparent select-none disabled:pointer-events-none';

  return (
    <div className="w-full card-bg rounded-card flex flex-col">
      <div className="overflow-x-auto w-full">
        <table className="w-full text-xs-portal text-left border-collapse">
          {/* Table Header */}
          <thead>
            <tr className="border-b border-card-border text-2xs text-gray-400 font-bold uppercase tracking-wider select-none">
              {enableBulkSelect && (
                <th className="py-3 px-2 w-12 text-center">
                  <input
                    type="checkbox"
                    onChange={handleSelectAll}
                    checked={paginatedData.length > 0 && selectedIds.size === paginatedData.length}
                    className="rounded border-card-border text-status-info focus:ring-status-info/20 cursor-pointer"
                  />
                </th>
              )}
              {columns.map((col, idx) => {
                const alignClass = col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left';
                return (
                  <th
                    key={idx}
                    className={`py-3 px-2 font-bold ${alignClass} ${col.sortable ? 'cursor-pointer select-none hover:text-brand-primary' : ''}`}
                    onClick={() => col.sortable && handleSort(col.accessor)}
                  >
                    <div className={`flex items-center gap-1.5 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start'}`}>
                      {col.header}
                      {col.sortable && sortField === col.accessor && (
                        sortOrder === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-gray-50">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (enableBulkSelect ? 1 : 0)} className="py-8 px-2 text-center text-gray-400 font-bold">
                  No records found.
                </td>
              </tr>
            ) : (
              paginatedData.map((row, rowIdx) => (
                <tr
                  key={row.id || rowIdx}
                  onClick={(e) => onRowClick && onRowClick(row, e)}
                  className={`transition-colors hover:bg-surface-light/50 ${selectedIds.has(row.id) ? 'bg-status-info-bg/40' : ''} ${onRowClick ? 'cursor-pointer' : ''}`}
                >
                  {enableBulkSelect && (
                    <td className="py-3 px-2 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.id)}
                        onChange={() => handleSelectRow(row.id)}
                        className="rounded border-card-border text-status-info focus:ring-status-info/20 cursor-pointer"
                      />
                    </td>
                  )}
                  {columns.map((col, colIdx) => {
                    const alignClass = col.align === 'right' ? 'text-right font-semibold font-mono' : col.align === 'center' ? 'text-center' : 'text-left';
                    return (
                      <td key={colIdx} className={`py-3 px-2 text-brand-primary font-medium ${alignClass}`}>
                        {col.renderCell ? col.renderCell(row) : row[col.accessor]}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Table Pagination Footer */}
      {totalPages > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between pt-4 mt-2 border-t border-card-border gap-4 select-none">
          {/* Left Side: Page Size Selector */}
          <div className="flex items-center gap-2 text-xs-portal text-gray-400 font-bold">
            <span>Show</span>
            <Dropdown
              size="sm"
              variant="default"
              className="w-16"
              value={pageSize}
              onChange={(val) => {
                setPageSize(Number(val));
                setCurrentPage(1);
              }}
              options={[
                { value: 5, label: '5' },
                { value: 10, label: '10' },
                { value: 25, label: '25' },
                { value: 50, label: '50' },
              ]}
            />
            <span>entries</span>
            <span className="ml-2">
              (Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalItems)} of {totalItems})
            </span>
          </div>

          {/* Right Side: Page Controls */}
          <div className="flex items-center gap-1.5">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              className={pageBtnBase}
            >
              &lt;
            </button>
            {Array.from({ length: totalPages }).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentPage(idx + 1)}
                disabled={currentPage === idx + 1}
                className={currentPage === idx + 1 ? pageBtnActive : pageBtnBase}
              >
                {idx + 1}
              </button>
            ))}
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              className={pageBtnBase}
            >
              &gt;
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
