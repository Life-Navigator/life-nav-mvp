// STUB — shadcn/ui badge placeholder
import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'destructive' | (string & {});
}

export function Badge({ children, variant, ...props }: BadgeProps) {
  return <span {...props}>{children}</span>;
}
