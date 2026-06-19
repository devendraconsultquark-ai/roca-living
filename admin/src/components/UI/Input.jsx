import React from 'react';

export const Input = React.forwardRef(({
  label,
  id,
  type = 'text',
  error = null,
  required = false,
  disabled = false,
  placeholder,
  className = '',
  ...props
}, ref) => {

  // Base input styles
  const baseInputStyles = 'w-full text-sm font-sans bg-white border rounded-[4px] py-[10px] px-3 transition-all duration-150 focus:outline-none';
  
  // Dynamic state overrides
  const stateStyles = error
    ? 'border-status-danger text-[#1A1A1A] focus:ring-2 focus:ring-status-danger/20 focus:border-status-danger'
    : disabled
      ? 'border-border-color bg-border-color/10 text-status-muted cursor-not-allowed'
      : 'border-border-color text-[#1A1A1A] focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent';

  return (
    <div className={`flex flex-col w-full ${className}`}>
      {/* Label section */}
      {label && (
        <label 
          htmlFor={id} 
          className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-0.5"
        >
          {label}
          {required && <span className="text-status-danger" aria-hidden="true">*</span>}
        </label>
      )}

      {/* Input element */}
      <input
        id={id}
        ref={ref}
        type={type}
        disabled={disabled}
        placeholder={placeholder}
        className={`${baseInputStyles} ${stateStyles}`}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />

      {/* Error Message */}
      {error && (
        <span 
          id={`${id}-error`} 
          className="text-xs text-status-danger mt-1 font-semibold"
          role="alert"
        >
          {error}
        </span>
      )}
    </div>
  );
});

Input.displayName = 'Input';