import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

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
  const [showPassword, setShowPassword] = useState(false);

  const isPassword = type === 'password';
  const rightPadding = isPassword ? 'pr-10' : 'pr-3';

  // Base input styles
  const baseInputStyles = `w-full text-sm font-sans bg-white border rounded-[4px] py-[10px] pl-3 ${rightPadding} transition-all duration-150 focus:outline-none`;
  
  // Dynamic state overrides
  const stateStyles = error
    ? 'border-status-danger text-[#1A1A1A] focus:ring-2 focus:ring-status-danger/20 focus:border-status-danger'
    : disabled
      ? 'border-border-color bg-border-color/10 text-status-muted cursor-not-allowed'
      : 'border-border-color text-[#1A1A1A] focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent';

  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

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

      {/* Input container with relative positioning for eye toggle */}
      <div className="relative w-full">
        <input
          id={id}
          ref={ref}
          type={inputType}
          disabled={disabled}
          placeholder={placeholder}
          className={`${baseInputStyles} ${stateStyles}`}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${id}-error` : undefined}
          {...props}
        />

        {isPassword && !disabled && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer flex items-center justify-center"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>

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