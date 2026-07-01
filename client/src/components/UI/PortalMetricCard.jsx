import React from 'react';

export const PortalMetricCard = ({ 
  label, 
  value, 
  subText, 
  icon: Icon, 
  variant = 'primary',
  actionText,
  actionIcon: ActionIcon = null,
  onActionClick,
  className = '' 
}) => {
  
  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return 'bg-status-success-bg text-status-success';
      case 'warning':
        return 'bg-status-warning/10 text-status-warning';
      case 'danger':
        return 'bg-status-danger-bg text-status-danger';
      case 'info':
        return 'bg-status-info-bg text-status-info';
      case 'purple':
        return 'bg-purple-50 text-purple-600';
      case 'primary':
      default:
        return 'bg-gray-100 text-gray-900';
    }
  };

  return (
    <div className={`bg-white border border-card-border rounded-card shadow-premium p-5 flex items-center gap-4 select-none ${className}`}>
      
      {/* Icon Circle */}
      {Icon && (
        <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${getVariantStyles()}`}>
          <Icon size={20} />
        </div>
      )}

      {/* Details */}
      <div className="flex flex-col min-w-0">
        <span className="text-xs-portal text-gray-400 font-semibold tracking-tight truncate leading-none">
          {label}
        </span>
        <span className="text-lg font-bold text-brand-primary mt-2 leading-none">
          {value}
        </span>
        
        {/* Render interactive action link if provided */}
        {actionText ? (
          <button 
            onClick={onActionClick}
            className="text-xs-portal font-semibold text-status-info hover:underline flex items-center gap-1 cursor-pointer mt-2 leading-none w-max"
          >
            <span>{actionText}</span>
            {ActionIcon && <ActionIcon size={11} className="shrink-0" />}
          </button>
        ) : (
          subText && (
            <span className="text-2xs text-gray-400 mt-2 truncate leading-none font-medium">
              {subText}
            </span>
          )
        )}
      </div>

    </div>
  );
};
