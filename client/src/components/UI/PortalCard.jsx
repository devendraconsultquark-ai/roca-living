import React from "react";

export const PortalCard = ({
  title,
  subtitle,
  headerActions,
  footerActions,
  className = "",
  children,
  noPadding = false,
}) => {
  return (
    <div
      className={`card-bg border border-card-border rounded-card shadow-premium flex flex-col justify-between overflow-hidden ${className}`}
    >
      {/* Header (optional) */}
      {(title || headerActions) && (
        <div className="px-6 pt-6 pb-2 flex items-center justify-between border-b border-card-border">
          <div className="flex flex-col">
            {title && (
              <h3 className="text-base-portal font-semibold text-text-primary tracking-tight capitalize leading-none">
                {title}
              </h3>
            )}
            {subtitle && (
              <span className="text-sm-portal text-gray-400 mt-1 leading-none">
                {subtitle}
              </span>
            )}
          </div>
          {headerActions && (
            <div className="flex items-center shrink-0">{headerActions}</div>
          )}
        </div>
      )}

      {/* Main Body content */}
      <div className={`flex-grow flex flex-col ${noPadding ? "" : "p-6"}`}>
        {children}
      </div>

      {/* Footer (optional) */}
      {footerActions && (
        <div className="px-6 pb-6 pt-2 flex items-center gap-4 border-t border-card-border mt-auto">
          {footerActions}
        </div>
      )}
    </div>
  );
};
