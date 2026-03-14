// STUB — shadcn/ui dialog placeholder
import React from 'react';

interface DialogProps extends React.PropsWithChildren {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface DialogTriggerProps extends React.PropsWithChildren {
  asChild?: boolean;
}

interface DialogContentProps extends React.PropsWithChildren {
  className?: string;
}

export function Dialog({ children }: DialogProps) {
  return <>{children}</>;
}
export function DialogTrigger({ children }: DialogTriggerProps) {
  return <>{children}</>;
}
export function DialogContent({ children }: DialogContentProps) {
  return <>{children}</>;
}
export function DialogHeader({ children }: React.PropsWithChildren) {
  return <>{children}</>;
}
export function DialogTitle({ children }: React.PropsWithChildren) {
  return <>{children}</>;
}
export function DialogDescription({ children }: React.PropsWithChildren) {
  return <>{children}</>;
}
export function DialogFooter({ children }: React.PropsWithChildren) {
  return <>{children}</>;
}
export function DialogClose({ children, asChild }: DialogTriggerProps) {
  return <>{children}</>;
}
