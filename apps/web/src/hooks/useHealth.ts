import { useState, useEffect } from 'react';
import { format, subDays } from 'date-fns';
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
        // If API fails, use mock data for development
        const mockData = generateMockSleepData(timeRange);
        setSleepData(mockData);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSleepData();
  }, [timeRange]);

  return { sleepData, isLoading, error };
};

// Helper function to generate mock sleep data
const generateMockSleepData = (timeRange: string): SleepData[] => {
  const days = timeRange === '7d' ? 7 : 
               timeRange === '14d' ? 14 : 
               timeRange === '30d' ? 30 : 90;
  
  return Array.from({ length: days }).map((_, index) => {
    const date = subDays(new Date(), days - index - 1);
    const isWeekend = [0, 6].includes(date.getDay());
    
    // Simulate typical sleep patterns (less sleep on weekends, more variability)
    const baseHours = isWeekend ? 7 : 7.5;
    const variance = Math.random() * 2 - 1; // -1 to +1
    const duration = Math.max(4, Math.min(11, baseHours + variance));
    
    // Generate random quality but correlate somewhat with duration
    const qualityBase = 5 + (duration - 6) * 0.8; // More sleep tends to mean better quality
    const quality = Math.max(1, Math.min(10, qualityBase + (Math.random() * 2 - 1)));
    
    // Sleep stages as percentages of total duration
    const deepPercent = 0.15 + Math.random() * 0.1;
    const remPercent = 0.2 + Math.random() * 0.1;
    const lightPercent = 1 - deepPercent - remPercent;
    
    return {
      date: format(date, 'yyyy-MM-dd'),
      duration,
      quality,
      deepSleep: duration * deepPercent,
      remSleep: duration * remPercent,
      lightSleep: duration * lightPercent,
      sleepStart: format(date, 'HH:mm'),
      sleepEnd: format(date, 'HH:mm')
    };
  });
};