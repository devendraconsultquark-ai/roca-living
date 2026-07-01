import React from 'react';

export const Pagination = ({
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  totalItems = 0,
  pageSize = 10,
  itemLabel = '',
}) => {
  if (totalPages <= 0) return null;

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  const btnBaseClass = "w-8 h-8 rounded-card text-brand-primary/50 hover:text-brand-primary hover:bg-gray-50 transition-colors duration-150 cursor-pointer text-xs flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none";
  const btnActiveClass = "w-8 h-8 border border-status-info text-status-info rounded-card flex items-center justify-center text-xs font-bold bg-transparent select-none disabled:pointer-events-none";

  if (itemLabel) {
    return (
      <div className="border-t border-gray-50 pt-4 mt-4 flex justify-between items-center select-none text-xs-portal text-gray-400 font-bold">
        <span>Showing {startItem} to {endItem} of {totalItems} {itemLabel}</span>
        <div className="flex items-center gap-1.5">
          <button 
            onClick={() => currentPage > 1 && onPageChange(currentPage - 1)} 
            disabled={currentPage === 1} 
            className={btnBaseClass}
          >
            &lt;
          </button>
          {pages.map((p) => {
            const isActive = p === currentPage;
            return (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                disabled={isActive}
                className={isActive ? btnActiveClass : btnBaseClass}
              >
                {p}
              </button>
            );
          })}
          <button 
            onClick={() => currentPage < totalPages && onPageChange(currentPage + 1)} 
            disabled={currentPage === totalPages} 
            className={btnBaseClass}
          >
            &gt;
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-gray-50 pt-4 mt-4 flex justify-center items-center gap-1.5 select-none">
      <button 
        onClick={() => currentPage > 1 && onPageChange(currentPage - 1)} 
        disabled={currentPage === 1} 
        className={btnBaseClass}
      >
        &lt;
      </button>
      {pages.map((p) => {
        const isActive = p === currentPage;
        return (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            disabled={isActive}
            className={isActive ? btnActiveClass : btnBaseClass}
          >
            {p}
          </button>
        );
      })}
      <button 
        onClick={() => currentPage < totalPages && onPageChange(currentPage + 1)} 
        disabled={currentPage === totalPages} 
        className={btnBaseClass}
      >
        &gt;
      </button>
    </div>
  );
};
