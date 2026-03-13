// STUB — shadcn/ui card placeholder
import React from 'react';
export function Card({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props}>{children}</div>;
}
export const CardHeader = Card;
export const CardContent = Card;
export const CardFooter = Card;
export const CardTitle = Card;
export const CardDescription = Card;
