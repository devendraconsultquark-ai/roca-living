import React from 'react';

/**
 * StatCard — Reusable metric summary card used across all pages.
 *
 * Props:
 *  - label      {string}          — Small all-caps label above the value (e.g. "Total Landlords")
 *  - value      {string}          — The bold hero value text (e.g. "48 Registered")
 *  - icon       {LucideIcon}      — Lucide icon component to show in the icon badge
 *  - iconColor  {string}          — Tailwind text + bg color classes for the icon badge (e.g. "text-brand-accent bg-brand-accent/10")
 *  - valueColor {string}          — Tailwind text class for the value (e.g. "text-status-success"). Defaults to text-[#1A1A1A]
 *  - className  {string}          — Optional extra classes on the card wrapper
 */
export const StatCard = ({
  label,
  value,
  icon: Icon,
  iconColor = 'text-brand-accent bg-brand-accent/10',
  valueColor = 'text-[#1A1A1A]',
  className = '',
}) => {
  return (
    <div className={`bg-white p-5 rounded-2xl border border-border-color/60 shadow-sm flex items-center justify-between select-none ${className}`}>
      {/* Left: label + value */}
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider leading-none">
          {label}
        </span>
        <span className={`text-xl font-bold mt-0.5 leading-tight ${valueColor}`}>
          {value}
        </span>
      </div>

      {/* Right: icon badge */}
      {Icon && (
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${iconColor}`}>
          <Icon size={18} />
        </div>
      )}
    </div>
  );
};
