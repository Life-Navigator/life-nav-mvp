// hooks/useConnectedServices.ts
import { useState, useEffect } from 'react';
import { fetchConnectedServices, disconnectService, refreshServices } from '../lib/api/integrations';
import { ConnectedService } from '@/types/integration';

export function useConnectedServices(category?: string) {
  const [services, setServices] = useState<ConnectedService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const loadServices = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchConnectedServices();
      
      // Filter by category if provided
      const filteredData = category 
        ? data.filter(service => service.category === category)
        : data;
        
      setServices(filteredData);
    } catch (err) {
      setError('Failed to load connected services');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadServices();
  }, [category]);
  
  const removeService = async (serviceId: string) => {
    try {
      await disconnectService(serviceId);
      setServices(services.filter(service => service.id !== serviceId));
    } catch (err) {
      setError('Failed to disconnect service');
      console.error(err);
    }
  };
  
  const refreshData = async () => {
    try {
      await refreshServices();
      await loadServices();
    } catch (err) {
      setError('Failed to refresh service data');
      console.error(err);
    }
  };
  
  return {
    services,
    loading,
    error,
    removeService,
    refreshData,
    reloadServices: loadServices,
  };
}