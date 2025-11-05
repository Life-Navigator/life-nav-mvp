'use client';

import React, { useState, useEffect } from 'react';

interface AssetOption {
  name: string;
  value: number;
  color: string;
}

interface AssetAllocationSliderProps {
  options: AssetOption[];
  onChange: (newAllocation: AssetOption[]) => void;
  maxTotal?: number;
}

export default function AssetAllocationSlider({
  options: initialOptions,
  onChange,
  maxTotal = 100
}: AssetAllocationSliderProps) {
  const [options, setOptions] = useState<AssetOption[]>(initialOptions);
  const total = options.reduce((sum, option) => sum + option.value, 0);
  
  const handleSliderChange = (index: number, newValue: number) => {
    // Calculate the current total excluding the option being changed
    const currentTotalExcludingThis = total - options[index].value;
    
    // Ensure the new value doesn't exceed the maximum total
    const adjustedValue = Math.min(newValue, maxTotal - currentTotalExcludingThis);
    
    // Create a new options array with the adjusted value
    const newOptions = [...options];
    newOptions[index] = { ...newOptions[index], value: adjustedValue };
    
    setOptions(newOptions);
    onChange(newOptions);
  };
  
  // Format the value as a percentage with appropriate styling
  const formatPercentage = (value: number) => `${value}%`;
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h4 className="text-md font-medium text-gray-800 dark:text-gray-200">
          Asset Allocation
        </h4>
        <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
          Total: {total}%
          {total !== maxTotal && (
            <span className={`ml-2 ${total > maxTotal ? 'text-red-500' : 'text-yellow-500'}`}>
              {total > maxTotal ? 'Exceeds' : 'Below'} {maxTotal}%
            </span>
          )}
        </div>
      </div>
      
      {/* Visual representation of allocation */}
      <div className="h-8 flex rounded-lg overflow-hidden">
        {options.map((option, index) => (
          <div
            key={`bar-${option.name}`}
            className="h-full transition-all duration-300"
            style={{ 
              width: `${(option.value / maxTotal) * 100}%`,
              backgroundColor: option.color,
              minWidth: option.value > 0 ? '1%' : '0'
            }}
            title={`${option.name}: ${option.value}%`}
          />
        ))}
      </div>
      
      {/* Individual sliders */}
      <div className="space-y-6">
        {options.map((option, index) => (
          <div key={option.name} className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {option.name}
              </label>
              <span className="text-sm font-medium" style={{ color: option.color }}>
                {formatPercentage(option.value)}
              </span>
            </div>
            
            <div className="relative">
              <input
                type="range"
                min={0}
                max={maxTotal}
                value={option.value}
                onChange={(e) => handleSliderChange(index, parseInt(e.target.value, 10))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                style={{ accentColor: option.color }}
              />
              
              {/* Custom styling for better visibility */}
              <div 
                className="absolute h-2 rounded-l-lg top-0 left-0 pointer-events-none"
                style={{ 
                  width: `${(option.value / maxTotal) * 100}%`,
                  backgroundColor: option.color
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}