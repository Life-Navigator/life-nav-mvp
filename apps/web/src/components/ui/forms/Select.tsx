import React, { forwardRef } from 'react';
import { classNames } from '@/lib/utils/classNames';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, error, ...props }, ref) => {
    return (
      <div>
        <select
          ref={ref}
          className={classNames(
            'w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 appearance-none bg-white',
            error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : '',
            className
          )}
          {...props}
        >
          {children}
        </select>
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';

// Shadcn-style sub-component stubs for compatibility
export const SelectTrigger = forwardRef<HTMLButtonElement, any>(
  ({ children, className, ...props }, ref) => (
    <button
      ref={ref}
      className={classNames('w-full rounded-md border px-3 py-2 text-left', className)}
      {...props}
    >
      {children}
    </button>
  )
);
SelectTrigger.displayName = 'SelectTrigger';

export const SelectContent = ({ children, className, ...props }: any) => (
  <div className={classNames('', className)} {...props}>
    {children}
  </div>
);

export const SelectItem = ({ children, value, className, ...props }: any) => (
  <option value={value} className={className} {...props}>
    {children}
  </option>
);

export const SelectValue = ({ placeholder, className }: any) => (
  <span className={className}>{placeholder}</span>
);
