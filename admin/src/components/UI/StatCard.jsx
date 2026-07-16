import React from 'react';

/**
 * StatCard — Reusable metric summary card used across all pages.
 *
 * Visual language mirrors the landlord portal's PortalMetricCard (icon circle
 * on the left, label above the value) while keeping this component's props:
 *  - label      {string}          — Small label above the value (e.g. "Total Landlords")
 *  - value      {string}          — The bold hero value text (e.g. "48 Registered")
 *  - icon       {LucideIcon}      — Lucide icon component to show in the icon circle
 *  - iconColor  {string}          — Tailwind text + bg color classes for the icon circle (e.g. "text-brand-accent bg-brand-accent/10")
 *  - valueColor {string}          — Tailwind text class for the value. Defaults to text-brand-primary
 *  - className  {string}          — Optional extra classes on the card wrapper
 */
export const StatCard = ({
  label,
  value,
  icon: Icon,
  iconColor = 'text-brand-accent bg-brand-accent/10',
  valueColor = 'text-brand-primary',
  className = '',
}) => {
  return (
    <div className={`card-bg border border-card-border rounded-card shadow-premium p-5 flex items-center gap-4 select-none ${className}`}>
      {/* Icon Circle */}
      {Icon && (
        <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${iconColor}`}>
          <Icon size={20} />
        </div>
      )}

      {/* Details */}
      <div className="flex flex-col min-w-0">
        <span className="text-xs-portal text-gray-400 font-semibold tracking-tight truncate leading-none">
          {label}
        </span>
        <span className={`text-lg font-bold mt-2 leading-none ${valueColor}`}>
          {value}
        </span>
      </div>
    </div>
  );
};
