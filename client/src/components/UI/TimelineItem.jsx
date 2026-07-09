import React from "react";

export const TimelineItem = ({
  title,
  subTitle,
  date,
  icon: Icon,
  variant = "neutral",
  rightText,
  rightSubText,
  onClick,
  className = "",
}) => {
  const getIconColor = () => {
    switch (variant) {
      case "success":
        return "bg-emerald-50 text-emerald-600";
      case "warning":
        return "bg-amber-50 text-amber-600";
      case "danger":
        return "bg-red-50 text-red-600";
      case "info":
        return "bg-blue-50 text-blue-600";
      case "neutral":
      default:
        return "bg-surface-hover text-status-muted";
    }
  };

  return (
    <div
      onClick={onClick}
      className={`flex items-center justify-between py-3 border-b border-card-border last:border-0 gap-4 ${onClick ? "cursor-pointer hover:bg-surface-hover rounded-xl px-2 transition-all duration-150" : ""} ${className}`}
    >
      {/* Icon & Details */}
      <div className="flex items-center gap-3.5 min-w-0">
        {Icon && (
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${getIconColor()}`}
          >
            <Icon size={18} />
          </div>
        )}
        <div className="flex flex-col min-w-0 text-left">
          <span className="text-sm-portal font-bold text-text-primary truncate leading-tight">
            {title}
          </span>
          {subTitle && (
            <span className="text-xs-portal text-gray-400 mt-0.5 truncate leading-none">
              {subTitle}
            </span>
          )}
        </div>
      </div>

      {/* Date / Right details */}
      <div className="flex flex-col items-end shrink-0 text-right">
        {rightText && (
          <span className="text-xs-portal font-bold text-text-primary leading-tight">
            {rightText}
          </span>
        )}
        {rightSubText && (
          <span className="text-2xs text-gray-400 mt-0.5 leading-none font-semibold">
            {rightSubText}
          </span>
        )}
        {!rightText && date && (
          <span className="text-xs-portal text-gray-400 font-semibold leading-none">
            {date}
          </span>
        )}
      </div>
    </div>
  );
};
