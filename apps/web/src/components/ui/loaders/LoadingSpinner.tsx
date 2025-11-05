'use client';

import React from "react";

interface LoadingSpinnerProps {
  size?: "small" | "medium" | "large" | "sm" | "md" | "lg";
  className?: string;
}

export function LoadingSpinner({ size = "medium", className = "" }: LoadingSpinnerProps) {
  // Map legacy size values to new ones
  const normalizedSize = size === "sm" ? "small" : size === "md" ? "medium" : size === "lg" ? "large" : size;
  
  const sizeClasses = {
    small: "w-4 h-4",
    medium: "w-8 h-8",
    large: "w-16 h-16",
  };

  return (
    <div className={`flex justify-center items-center ${className}`}>
      <div
        className={`${sizeClasses[normalizedSize]} animate-spin rounded-full border-4 border-slate-200 border-t-blue-600 dark:border-slate-700 dark:border-t-blue-400`}
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}

export default LoadingSpinner;