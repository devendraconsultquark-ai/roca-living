/**
 * Toggle — the canonical on/off switch. Replaces per-page `ToggleSwitch`
 * re-implementations (e.g. Profile) so every switch in the portal is identical
 * and accessible (role="switch" + aria-checked).
 *
 * @param {boolean} checked
 * @param {() => void} onChange
 * @param {boolean} [disabled]
 */
export const Toggle = ({
  checked = false,
  onChange,
  disabled = false,
  className = "",
  ...props
}) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? "bg-status-info" : "bg-card-border"
      } ${className}`}
      {...props}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
};
