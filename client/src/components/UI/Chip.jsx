/**
 * Chip — a filter / choice pill (toggleable). The canonical replacement for the
 * hand-rolled filter-pill `<button>`s (e.g. Properties "Filter by" row).
 *
 * These are NOT call-to-action buttons — do not use <Button> for them. Chips
 * represent a selectable option in a filter/segment group.
 *
 * @param {boolean} active  whether this chip is the selected one
 * @param {() => void} onClick
 */
export const Chip = ({
  children,
  active = false,
  onClick,
  className = "",
  ...props
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-3.5 py-1.5 rounded-md text-xs-portal font-bold tracking-tight cursor-pointer transition-all duration-150 shrink-0 ${
        active
          ? "bg-status-info text-white"
          : "card-bg hover:bg-surface-light border border-card-border text-brand-primary"
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
