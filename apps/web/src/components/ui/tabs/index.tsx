'use client';

import React from 'react';

export const Tabs = ({ value, onValueChange, className, children }: any) => {
  return (
    <div className={className}>
      {React.Children.map(children, (child) => 
        React.cloneElement(child, { value, onValueChange })
      )}
    </div>
  );
};

export const TabsList = ({ className, children }: any) => {
  return <div className={className}>{children}</div>;
};

export const TabsTrigger = ({ value, children, className, disabled }: any) => {
  return (
    <button 
      className={className} 
      disabled={disabled}
    >
      {children}
    </button>
  );
};

export const TabsContent = ({ value, className, children }: any) => {
  return <div className={className}>{children}</div>;
};