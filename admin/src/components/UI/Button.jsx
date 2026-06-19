import React from 'react';

export const Button = ({
  children,
  variant = 'primary', // primary, secondary, danger, ghost
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
  const baseStyles = 'inline-flex items-center justify-center tracking-wide rounded-[6px] cursor-pointer transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-accent focus:ring-offset-2 disabled:cursor-not-allowed disabled:pointer-events-none';

  // 2. Styles for different variants matching the Design System
  const variantStyles = {
    primary: 'bg-brand-accent text-white hover:bg-brand-accent-hover font-bold',
    secondary: 'bg-white border border-border-color text-[#1A1A1A] hover:bg-app-bg font-semibold',
    danger: 'bg-status-danger text-white hover:bg-status-danger/90 font-bold',
    ghost: 'bg-transparent text-brand-accent hover:bg-brand-accent/5 font-semibold',
    disabled: 'bg-border-color text-[#888888] border-transparent font-normal'
  };

  // 3. Spacing scales — §7.1: CTA Button 14px/700 bold label
  const sizeStyles = {
    sm: 'text-[11px] py-1.5 px-3 gap-1.5 uppercase',
    md: 'text-[14px] py-[10px] px-5 gap-2 uppercase', // Matches spec: 10px vertical / 20px horizontal padding (px-5 = 20px)
    lg: 'text-[14px] py-3 px-6 gap-2.5'
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
      {Icon && iconPosition === 'left' && <Icon size={size === 'sm' ? 14 : 16} className="shrink-0" />}
      
      {children}
      
      {/* Icon placed right */}
      {Icon && iconPosition === 'right' && <Icon size={size === 'sm' ? 14 : 16} className="shrink-0" />}
    </button>
  );
};