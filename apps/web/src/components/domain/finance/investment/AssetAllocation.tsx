// FILE: src/components/finance/investment/AssetAllocation.tsx
'use client';

import React, { useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

// Mock asset allocation data
const assetAllocationData = [
  { name: "US Stocks", value: 45, color: "#3B82F6" }, // Blue
  { name: "International Stocks", value: 20, color: "#10B981" }, // Green
  { name: "Bonds", value: 15, color: "#F59E0B" }, // Amber
  { name: "Real Estate", value: 10, color: "#EF4444" }, // Red
  { name: "Cash", value: 5, color: "#6B7280" }, // Gray
  { name: "Alternatives", value: 5, color: "#8B5CF6" }, // Purple
];

// Mock sector allocation data
const sectorAllocationData = [
  { name: "Technology", value: 42, color: "#3B82F6" }, // Blue
  { name: "Healthcare", value: 15, color: "#10B981" }, // Green
  { name: "Financials", value: 12, color: "#F59E0B" }, // Amber
  { name: "Consumer Discretionary", value: 10, color: "#EF4444" }, // Red
  { name: "Industrials", value: 8, color: "#6B7280" }, // Gray
  { name: "Communication", value: 5, color: "#8B5CF6" }, // Purple
  { name: "Other Sectors", value: 8, color: "#EC4899" }, // Pink
];

// Mock geographic allocation data
const geographicAllocationData = [
  { name: "United States", value: 65, color: "#3B82F6" }, // Blue
  { name: "Europe", value: 15, color: "#10B981" }, // Green
  { name: "Asia-Pacific", value: 10, color: "#F59E0B" }, // Amber
  { name: "Emerging Markets", value: 8, color: "#EF4444" }, // Red
  { name: "Other Regions", value: 2, color: "#6B7280" }, // Gray
];

export function AssetAllocation() {
  const [allocationView, setAllocationView] = useState<"asset" | "sector" | "geographic">("asset");
  
  // Determine which data set to display based on selected view
  const getAllocationData = () => {
    switch (allocationView) {
      case "sector":
        return sectorAllocationData;
      case "geographic":
        return geographicAllocationData;
      case "asset":
      default:
        return assetAllocationData;
    }
  };
  
  const data = getAllocationData();
  
  const renderTooltip = (props: any) => {
    if (props.active && props.payload && props.payload.length) {
      const { name, value, color } = props.payload[0].payload;
      return (
        <div className="bg-white dark:bg-slate-800 p-2 border border-slate-200 dark:border-slate-700 rounded shadow-lg">
          <p className="font-medium" style={{ color }}>
            {name}: {value}%
          </p>
        </div>
      );
    }
    return null;
  };
  
  return (
    <div className="bg-white rounded-lg shadow dark:bg-slate-800 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Portfolio Allocation</h2>
        <div className="flex space-x-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
          <button
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              allocationView === "asset" 
                ? "bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm" 
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
            }`}
            onClick={() => setAllocationView("asset")}
          >
            Asset
          </button>
          <button
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              allocationView === "sector" 
                ? "bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm" 
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
            }`}
            onClick={() => setAllocationView("sector")}
          >
            Sector
          </button>
          <button
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              allocationView === "geographic" 
                ? "bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm" 
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
            }`}
            onClick={() => setAllocationView("geographic")}
          >
            Geographic
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="md:col-span-3 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}%`}
                labelLine={false}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={renderTooltip} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        <div className="md:col-span-2">
          <h3 className="font-medium mb-4">
            {allocationView === "asset" && "Asset Classes"}
            {allocationView === "sector" && "Industry Sectors"}
            {allocationView === "geographic" && "Geographic Regions"}
          </h3>
          
          <div className="space-y-3">
            {data.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div 
                    className="w-3 h-3 rounded-full mr-2" 
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm">{item.name}</span>
                </div>
                <span className="text-sm font-medium">{item.value}%</span>
              </div>
            ))}
          </div>
          
          {allocationView === "sector" && (
            <div className="mt-6 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-xs text-amber-700 dark:text-amber-400">
                <strong>Note:</strong> Technology sector (42%) exceeds recommended maximum of 30%. Consider rebalancing to reduce concentration risk.
              </p>
            </div>
          )}
          
          {allocationView === "asset" && (
            <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-xs text-blue-700 dark:text-blue-400">
                <strong>Recommendation:</strong> Your current allocation is moderately aggressive. Consider increasing bond allocation if your risk tolerance has changed.
              </p>
            </div>
          )}
          
          {allocationView === "geographic" && (
            <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-xs text-blue-700 dark:text-blue-400">
                <strong>Insight:</strong> US market exposure (65%) could be diversified with additional international investments for potential growth opportunities.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}