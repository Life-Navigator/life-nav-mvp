'use client';

import React, { useState, useEffect } from 'react';

interface SliderInputProps {
  name: string;
  label: string;
  value: number;
  onChange: (name: string, value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  formatValue?: (value: number) => string;
  className?: string;
}

export default function SliderInput({
  name,
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  formatValue = (val) => `${val}%`,
  className = '',
}: SliderInputProps) {
  const [currentValue, setCurrentValue] = useState<number>(value || min);
  
  // Update local state when prop value changes
  useEffect(() => {
    if (value !== undefined) {
      setCurrentValue(value);
    }
  }, [value]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value, 10);
    setCurrentValue(newValue);
    onChange(name, newValue);
  };
  
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex justify-between items-center">
        <label htmlFor={name} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
        <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
          {formatValue(currentValue)}
        </span>
      </div>
      
      <div className="relative">
        <input
          type="range"
          id={name}
          name={name}
          min={min}
          max={max}
          step={step}
          value={currentValue}
          onChange={handleChange}
          className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600 dark:accent-blue-400"
        />
        
        {/* Custom styling for better visibility */}
        <div 
          className="absolute h-2 bg-blue-600 dark:bg-blue-500 rounded-l-lg top-0 left-0 pointer-events-none"
          style={{ width: `${((currentValue - min) / (max - min)) * 100}%` }}
        />
      </div>
      
      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>{formatValue(min)}</span>
        <span>{formatValue(max)}</span>
      </div>
    </div>
  );
}