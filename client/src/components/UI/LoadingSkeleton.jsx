import React from 'react';

/**
 * Shared Loading Skeleton screen using Tailwind's pulse animation.
 * @param {object} props
 * @param {number} props.lines - Number of rows to display (default: 4)
 * @param {string} props.className - Custom outer classes
 */
export const LoadingSkeleton = ({ lines = 4, className = '' }) => {
  const rows = Array.from({ length: Math.max(1, lines - 1) });
  
  return (
    <div className={`space-y-4 py-4 w-full ${className}`}>
      {/* Header bar placeholder */}
      <div className="h-10 bg-gray-100/80 rounded-lg animate-pulse w-full" />
      {/* List item row placeholders */}
      {rows.map((_, idx) => (
        <div 
          key={idx} 
          className="h-16 bg-gray-50/80 rounded-lg animate-pulse w-full" 
        />
      ))}
    </div>
  );
};
