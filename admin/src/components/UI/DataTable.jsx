import React, { useState } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Dropdown } from './Dropdown';

export const DataTable = ({
  columns = [], // Array of { header, accessor, align: 'left'|'right', sortable: bool, renderCell: func }
  data = [],
  headerVariant = 'grey', // 'grey' or 'navy-tint'
  enableBulkSelect = false,
  onSelectionChange = null,
  initialPageSize = 10,
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

  // Header styling variants — §7.3: Navy #1F3A5F background
  const headerClasses = {
    grey: 'bg-[#000000] text-white border-b border-border-color',
    'navy-tint': 'bg-[#000000] text-white border-b border-border-color'
  };

  return (
    <div className="w-full bg-white rounded-lg border border-border-color flex flex-col">
      <div className="overflow-x-auto w-full rounded-t-lg">
        <table className="w-full text-sm text-left border-collapse">
          {/* Table Header */}
          <thead className={headerClasses[headerVariant]}>
            <tr>
              {enableBulkSelect && (
                <th className="p-4 w-12 text-center">
                  <input 
                    type="checkbox" 
                    onChange={handleSelectAll}
                    checked={paginatedData.length > 0 && selectedIds.size === paginatedData.length}
                    className="rounded border-border-color text-brand-accent focus:ring-brand-accent/20 cursor-pointer"
                  />
                </th>
              )}
              {columns.map((col, idx) => {
                const alignClass = col.align === 'right' ? 'text-right' : 'text-left';
                return (
                  <th 
                    key={idx}
                    className={`p-4 font-bold text-[10px] uppercase tracking-wider ${alignClass} ${col.sortable ? 'cursor-pointer select-none hover:bg-white/10' : ''}`}
                    onClick={() => col.sortable && handleSort(col.accessor)}
                  >
                    <div className={`flex items-center gap-1.5 ${col.align === 'right' ? 'justify-end' : 'justify-start'}`}>
                      {col.header}
                      {col.sortable && sortField === col.accessor && (
                        sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-border-color">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (enableBulkSelect ? 1 : 0)} className="p-8 text-center text-status-muted">
                  No records found.
                </td>
              </tr>
            ) : (
              paginatedData.map((row, rowIdx) => (
                <tr 
                  key={row.id || rowIdx} 
                  className={`transition-colors odd:bg-white even:bg-[#F8F9FA] hover:bg-app-bg/40 ${selectedIds.has(row.id) ? 'bg-[#E8A020]/10' : ''}`}
                >
                  {enableBulkSelect && (
                    <td className="p-4 text-center">
                      <input 
                        type="checkbox" 
                        checked={selectedIds.has(row.id)}
                        onChange={() => handleSelectRow(row.id)}
                        className="rounded border-border-color text-brand-accent focus:ring-brand-accent/20 cursor-pointer"
                      />
                    </td>
                  )}
                  {columns.map((col, colIdx) => {
                    const alignClass = col.align === 'right' ? 'text-right font-medium tabular-nums' : 'text-left';
                    return (
                      <td key={colIdx} className={`p-4 ${alignClass}`}>
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
        <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t border-border-color bg-white gap-4 rounded-b-lg">
          {/* Left Side: Page Size Selector */}
          <div className="flex items-center gap-2 text-xs text-gray-500">
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
              className="p-1.5 border border-border-color rounded text-gray-500 hover:bg-app-bg disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: totalPages }).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentPage(idx + 1)}
                className={`px-3 py-1 border rounded text-xs font-semibold cursor-pointer ${currentPage === idx + 1 
                  ? 'bg-brand-accent text-white border-brand-accent' 
                  : 'border-border-color text-gray-500 hover:bg-app-bg'
                }`}
              >
                {idx + 1}
              </button>
            ))}
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              className="p-1.5 border border-border-color rounded text-gray-500 hover:bg-app-bg disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};