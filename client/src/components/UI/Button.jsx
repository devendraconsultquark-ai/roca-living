import React from 'react';

export const Button = ({
  children,
  variant = 'primary', // primary (dark), secondary, accent (orange), light (gray), danger, ghost
  size = 'md',        // sm, md, lg
  fullWidth = false,
  icon: Icon = null,
  iconPosition = 'left',
  disabled = false,
  type = 'button',
  onClick,
  className = '',
  ...props
}) => {

  // 1. Base structural styles (padding, radius, transitions)
  const baseStyles = 'inline-flex items-center justify-center tracking-tight rounded-card cursor-pointer transition-all duration-150 ease-in-out focus:outline-none disabled:cursor-not-allowed disabled:pointer-events-none select-none';

  // 2. Styles for different variants matching the Design System
  const variantStyles = {
    primary: 'bg-[#1A1A1A] text-white hover:bg-[#2D2D2D] border border-transparent font-semibold',
    dark: 'bg-[#1A1A1A] text-white hover:bg-[#2D2D2D] border border-transparent font-semibold',
    secondary: 'bg-white border border-card-border text-[#1A1A1A] hover:bg-gray-50 font-semibold',
    accent: 'bg-brand-accent text-white hover:bg-brand-accent-hover border border-transparent font-semibold',
    light: 'bg-gray-50 border border-card-border text-[#1A1A1A] hover:bg-gray-100 font-bold',
    danger: 'bg-status-danger text-white hover:bg-status-danger/90 border border-transparent font-semibold',
    ghost: 'bg-transparent hover:bg-brand-accent/5 font-semibold',
    disabled: 'bg-gray-100 text-[#888888] border-transparent font-semibold'
  };

  // 3. Spacing scales - Matches specifications without uppercase constraint
  const sizeStyles = {
    sm: 'text-xs-portal py-1.5 px-3 gap-1.5',
    md: 'text-sm-portal py-2 px-4 gap-1.5', 
    lg: 'text-base-portal py-2.5 px-6 gap-2'
  };

  // Choose the active style variants (force 'disabled' style if prop is true)
  const activeVariant = disabled ? 'disabled' : variant;
  
  // Combine all styling classes
  const classes = `
    ${baseStyles}
    ${variantStyles[activeVariant]}
    ${sizeStyles[size]}
    ${fullWidth ? 'w-full flex' : ''}
    ${className}
  `;

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
      {/* Icon placed left */}
      {Icon && iconPosition === 'left' && <Icon size={size === 'sm' ? 13 : 15} className="shrink-0 animate-in fade-in" />}
      
      <span>{children}</span>
      
      {/* Icon placed right */}
      {Icon && iconPosition === 'right' && <Icon size={size === 'sm' ? 13 : 15} className="shrink-0 animate-in fade-in" />}
    </button>
  );
};