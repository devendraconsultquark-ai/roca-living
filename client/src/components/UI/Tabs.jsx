/**
 * Tabs — the canonical portal sub-tab bar (underline style).
 *
 * Replaces the hand-rolled `<button>` tab rows that were duplicated across
 * pages (Financials, PropertyDetails, …) with slightly different sizes/weights.
 * Use this everywhere so every sub-tab bar in the portal looks identical.
 *
 * @param {(string | {label: string, value: string})[]} tabs
 * @param {string} active   currently-selected value (string tab === its own value)
 * @param {(value: string) => void} onChange
 */
export const Tabs = ({ tabs = [], active, onChange, className = "" }) => {
  return (
    <div
      className={`border-b border-card-border flex items-center gap-6 overflow-x-auto no-scrollbar py-1 select-none ${className}`}
    >
      {tabs.map((tab) => {
        const value = typeof tab === "string" ? tab : tab.value;
        const label = typeof tab === "string" ? tab : tab.label;
        const isActive = active === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            className={`pb-2.5 text-sm font-semibold tracking-tight cursor-pointer whitespace-nowrap transition-all border-b-2 relative -mb-[5px] ${
              isActive
                ? "border-brand-primary text-brand-primary"
                : "border-transparent text-gray-400 hover:text-status-muted"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
};
