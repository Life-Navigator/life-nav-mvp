import { useState, useEffect } from 'react';
import { Health, SleepData, VitalData } from '@/types/health';
import { getVitals, getHealthMetrics, getSleepData } from '@/lib/api/health';

export const useHealth = () => {
  const [healthData, setHealthData] = useState<Health | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchHealthData = async () => {
      try {
        setIsLoading(true);
        const data = await getHealthMetrics();
        setHealthData(data);
        setError(null);
      } catch (err) {
        setError(err as Error);
        setHealthData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHealthData();
  }, []);

  return { healthData, isLoading, error };
};

export const useVitals = (timeRange: string = '7d') => {
  const [vitalsData, setVitalsData] = useState<VitalData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchVitalsData = async () => {
      try {
        setIsLoading(true);
        const data = await getVitals(timeRange);
        setVitalsData(data);
        setError(null);
      } catch (err) {
        setError(err as Error);
        setVitalsData([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchVitalsData();
  }, [timeRange]);

  return { vitalsData, isLoading, error };
};

export const useSleep = (timeRange: string = '7d') => {
  const [sleepData, setSleepData] = useState<SleepData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchSleepData = async () => {
      try {
        setIsLoading(true);
        const data = await getSleepData(timeRange);
        setSleepData(data);
        setError(null);
      } catch (err) {
        setError(err as Error);
        setSleepData([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSleepData();
  }, [timeRange]);

  return { sleepData, isLoading, error };
};
