import { forwardRef } from 'react';
import { classNames } from '@/lib/utils/classNames';
import { ButtonVariant } from './Button';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode | string;
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  'aria-label': string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      className,
      variant = 'default',
      size = 'md',
      isLoading = false,
      disabled,
      'aria-label': ariaLabel,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const baseStyles = 'inline-flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
    
    const variantStyles = {
      default: 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800',
      outline: 'border border-gray-300 bg-transparent hover:bg-gray-50 active:bg-gray-100',
      ghost: 'bg-transparent hover:bg-gray-100 active:bg-gray-200',
      link: 'bg-transparent hover:underline text-blue-600',
      danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
    };
    
    const sizeStyles = {
      sm: 'h-8 w-8 text-sm rounded',
      md: 'h-10 w-10 text-base rounded-md',
      lg: 'h-12 w-12 text-lg rounded-md',
    };
    
    return (
      <button
        ref={ref}
        type={type}
        className={classNames(
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        disabled={isLoading || disabled}
        aria-label={ariaLabel}
        {...props}
      >
        {isLoading ? (
          <svg
            className="animate-spin h-4 w-4 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        ) : typeof icon === 'string' ? (
          icon
        ) : (
          icon
        )}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';