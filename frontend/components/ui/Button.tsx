import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'dark' | 'recessed';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  children,
  disabled,
  ...props
}: ButtonProps) {
  let variantClass = 'btn-3d-gray';
  if (variant === 'primary') variantClass = 'btn-3d-amber';
  else if (variant === 'dark') variantClass = 'btn-3d-dark';
  else if (variant === 'recessed') variantClass = 'btn-recessed';

  const sizeClass =
    size === 'sm'
      ? 'px-2.5 py-1.5 text-xs'
      : size === 'lg'
      ? 'px-5 py-3 text-sm'
      : 'px-4 py-2 text-xs';

  return (
    <button
      className={`${variantClass} ${sizeClass} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}

export default Button;
