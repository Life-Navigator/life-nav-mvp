// FILE: src/components/finance/investment/AssetAllocation.tsx
'use client';

import React, { useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useAssetAllocation, useSectorAllocation, useGeographicAllocation } from "@/hooks/useInvestments";

interface AllocationItem {
  name: string;
  value: number;
  color: string;
}

// Default colors for allocation items
const defaultColors = [
  "#3B82F6", // Blue
  "#10B981", // Green
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#6B7280", // Gray
  "#8B5CF6", // Purple
  "#EC4899", // Pink
];

export function AssetAllocation() {
  const [allocationView, setAllocationView] = useState<"asset" | "sector" | "geographic">("asset");

  const { allocation: assetAllocation, isLoading: assetLoading } = useAssetAllocation();
  const { allocation: sectorAllocation, isLoading: sectorLoading } = useSectorAllocation();
  const { allocation: geographicAllocation, isLoading: geoLoading } = useGeographicAllocation();

  const isLoading = assetLoading || sectorLoading || geoLoading;

  // Transform allocation data to chart format with colors
  const transformData = (allocation: any[]): AllocationItem[] => {
    if (!allocation || allocation.length === 0) return [];
    return allocation.map((item, index) => ({
      name: item.name || 'Unknown',
      value: item.value || item.percentage || 0,
      color: defaultColors[index % defaultColors.length]
    }));
  };

  // Determine which data set to display based on selected view
  const getAllocationData = (): AllocationItem[] => {
    switch (allocationView) {
      case "sector":
        return transformData(sectorAllocation);
      case "geographic":
        return transformData(geographicAllocation);
      case "asset":
      default:
        return transformData(assetAllocation);
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

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow dark:bg-slate-800 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Portfolio Allocation</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <div className="md:col-span-3 h-72 flex items-center justify-center">
            <div className="animate-pulse w-48 h-48 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
          </div>
          <div className="md:col-span-2">
            <div className="animate-pulse space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (data.length === 0) {
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
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium mb-2">No Allocation Data</h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Add investments to see your portfolio allocation breakdown by asset class, sector, and geography.
          </p>
        </div>
      </div>
    );
  }

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

          {/* Show concentration warnings based on actual data */}
          {allocationView === "sector" && data.some(item => item.value > 30) && (
            <div className="mt-6 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-xs text-amber-700 dark:text-amber-400">
                <strong>Note:</strong> Some sectors exceed recommended maximum of 30%. Consider rebalancing to reduce concentration risk.
              </p>
            </div>
          )}

          {allocationView === "asset" && data.length > 0 && (
            <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-xs text-blue-700 dark:text-blue-400">
                <strong>Tip:</strong> Review your allocation periodically to ensure it matches your risk tolerance and investment goals.
              </p>
            </div>
          )}

          {allocationView === "geographic" && data.length > 0 && (
            <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-xs text-blue-700 dark:text-blue-400">
                <strong>Insight:</strong> Geographic diversification can help reduce country-specific risks in your portfolio.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
