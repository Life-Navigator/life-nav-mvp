'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/buttons/Button';
import { toast } from '@/components/ui/toaster';

interface DataExportButtonProps {
  variant?: 'default' | 'outline' | 'destructive' | 'ghost' | 'link';
  className?: string;
}

export function DataExportButton({ variant = 'default', className }: DataExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  
  const handleExportData = async () => {
    setIsExporting(true);
    
    try {
      const response = await fetch('/api/user/export');
      
      if (!response.ok) {
        throw new Error('Failed to export data');
      }
      
      // Get the data
      const data = await response.json();
      
      // Convert the data to a JSON string
      const jsonString = JSON.stringify(data, null, 2);
      
      // Create a blob from the JSON string
      const blob = new Blob([jsonString], { type: 'application/json' });
      
      // Create a URL for the blob
      const url = URL.createObjectURL(blob);
      
      // Create a link element
      const link = document.createElement('a');
      link.href = url;
      link.download = 'life-navigator-data-export.json';
      
      // Append the link to the document
      document.body.appendChild(link);
      
      // Click the link
      link.click();
      
      // Remove the link from the document
      document.body.removeChild(link);
      
      // Release the URL
      URL.revokeObjectURL(url);
      
      toast({
        title: "Export Successful",
        description: "Your data has been exported successfully.",
        type: "success",
      });
    } catch (error) {
      console.error('Error exporting data:', error);
      toast({
        title: "Export Failed",
        description: "There was an error exporting your data. Please try again.",
        type: "error",
      });
    } finally {
      setIsExporting(false);
    }
  };
  
  return (
    <Button
      variant={variant}
      className={className}
      onClick={handleExportData}
      disabled={isExporting}
    >
      {isExporting ? 'Exporting...' : 'Export Data'}
    </Button>
  );
}