// FILE: src/components/finance/overview/UpcomingBills.tsx

import React from "react";

// Mock data for upcoming bills
const upcomingBills = [
  { 
    id: "bill1", 
    name: "Rent", 
    amount: 2100.00, 
    dueDate: new Date(2025, 4, 10), 
    paid: false,
    recurring: true,
    category: "Housing"
  },
  { 
    id: "bill2", 
    name: "Internet", 
    amount: 79.99, 
    dueDate: new Date(2025, 4, 12), 
    paid: false,
    recurring: true,
    category: "Utilities"
  },
  { 
    id: "bill3", 
    name: "Electric Bill", 
    amount: 145.67, 
    dueDate: new Date(2025, 4, 15), 
    paid: false,
    recurring: true,
    category: "Utilities"
  },
  { 
    id: "bill4", 
    name: "Car Insurance", 
    amount: 112.50, 
    dueDate: new Date(2025, 4, 22), 
    paid: false,
    recurring: true,
    category: "Insurance"
  },
  { 
    id: "bill5", 
    name: "Phone Bill", 
    amount: 85.00, 
    dueDate: new Date(2025, 4, 28), 
    paid: false,
    recurring: true,
    category: "Utilities"
  },
];

export function UpcomingBills() {
  // Format date as "May 10"
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  
  // Calculate days until due date
  const getDaysUntil = (date: Date) => {
    const today = new Date();
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };
  
  // Sort bills by due date
  const sortedBills = [...upcomingBills].sort((a, b) => 
    a.dueDate.getTime() - b.dueDate.getTime()
  );
  
  // Calculate total upcoming bills
  const totalUpcoming = sortedBills.reduce((sum, bill) => sum + bill.amount, 0);
  
  return (
    <div className="bg-white rounded-lg shadow dark:bg-slate-800 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Upcoming Bills</h2>
        <span className="text-sm font-medium text-blue-600 dark:text-blue-400 cursor-pointer hover:underline">
          View All
        </span>
      </div>
      
      <div className="space-y-4 mb-6">
        {sortedBills.map((bill) => {
          const daysUntil = getDaysUntil(bill.dueDate);
          let statusColor = "text-yellow-500";
          if (daysUntil <= 3) statusColor = "text-red-500";
          if (daysUntil > 10) statusColor = "text-green-500";
          
          return (
            <div 
              key={bill.id}
              className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-700 last:border-none"
            >
              <div>
                <p className="font-medium">{bill.name}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{bill.category}</p>
              </div>
              <div className="text-right">
                <p className="font-medium">${bill.amount.toFixed(2)}</p>
                <p className={`text-sm ${statusColor}`}>
                  Due {formatDate(bill.dueDate)} ({daysUntil} days)
                </p>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-500 dark:text-slate-400">Total Upcoming</span>
          <span className="text-lg font-medium dark:text-white">${totalUpcoming.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}