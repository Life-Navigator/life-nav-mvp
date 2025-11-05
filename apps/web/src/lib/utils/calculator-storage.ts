/**
 * Utilities for storing calculator data in localStorage
 * Supports offline access and caching for calculator results
 */

// Constants
const STORAGE_PREFIX = 'ln_calculator_';
const CACHE_VERSION = 1;
const MAX_ITEMS = 20; // Maximum number of calculations to store per type
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Calculator types
export enum CalculatorType {
  INVESTMENT_GROWTH = 'investment_growth',
  SCENARIO_COMPARISON = 'scenario_comparison',
  ASSET_ALLOCATION = 'asset_allocation',
  LUMP_SUM_VS_DCA = 'lump_sum_vs_dca',
  HISTORICAL_RETURNS = 'historical_returns',
}

// Storage item structure
interface StorageItem<T> {
  version: number;
  timestamp: number;
  input: any;
  data: T;
}

// Storage index to track all keys for a calculator type
interface StorageIndex {
  keys: string[];
  lastUpdated: number;
}

/**
 * Generate a storage key for a specific calculation
 */
const generateStorageKey = (type: CalculatorType, input: any): string => {
  const inputHash = JSON.stringify(input);
  // Use a hash function if needed for very large inputs
  return `${STORAGE_PREFIX}${type}_${btoa(inputHash).replace(/=/g, '')}`;
};

/**
 * Get the index key for a calculator type
 */
const getIndexKey = (type: CalculatorType): string => {
  return `${STORAGE_PREFIX}${type}_index`;
};

/**
 * Get or create the storage index for a calculator type
 */
const getStorageIndex = (type: CalculatorType): StorageIndex => {
  if (!isLocalStorageAvailable()) {
    return { keys: [], lastUpdated: Date.now() };
  }
  
  try {
    const indexKey = getIndexKey(type);
    const storedIndex = localStorage.getItem(indexKey);
    
    if (storedIndex) {
      return JSON.parse(storedIndex);
    }
  } catch (error) {
    console.error('Error reading storage index:', error);
  }
  
  // Return empty index if not found or error
  return { keys: [], lastUpdated: Date.now() };
};

/**
 * Save the storage index
 */
const saveStorageIndex = (type: CalculatorType, index: StorageIndex): void => {
  if (!isLocalStorageAvailable()) return;
  
  try {
    const indexKey = getIndexKey(type);
    localStorage.setItem(indexKey, JSON.stringify({
      ...index,
      lastUpdated: Date.now()
    }));
  } catch (error) {
    console.error('Error saving storage index:', error);
  }
};

/**
 * Add a key to the storage index, maintaining the size limit
 */
const addToStorageIndex = (type: CalculatorType, key: string): void => {
  const index = getStorageIndex(type);
  
  // Remove the key if it already exists to avoid duplicates
  const filteredKeys = index.keys.filter(k => k !== key);
  
  // Add the new key to the beginning (most recent)
  const updatedKeys = [key, ...filteredKeys];
  
  // Trim to maximum size
  const trimmedKeys = updatedKeys.slice(0, MAX_ITEMS);
  
  // Remove any items that were trimmed from storage
  const keysToRemove = updatedKeys.slice(MAX_ITEMS);
  keysToRemove.forEach(k => {
    try {
      localStorage.removeItem(k);
    } catch (error) {
      console.error('Error removing old storage item:', error);
    }
  });
  
  // Save the updated index
  saveStorageIndex(type, {
    keys: trimmedKeys,
    lastUpdated: Date.now()
  });
};

/**
 * Clean up old entries in the storage
 */
const cleanupStorage = (type: CalculatorType): void => {
  const index = getStorageIndex(type);
  const now = Date.now();
  
  // Check each key and remove if too old
  const validKeys = index.keys.filter(key => {
    try {
      const item = localStorage.getItem(key);
      if (!item) return false;
      
      const parsedItem = JSON.parse(item) as StorageItem<any>;
      const isValid = now - parsedItem.timestamp < MAX_AGE_MS;
      
      if (!isValid) {
        localStorage.removeItem(key);
      }
      
      return isValid;
    } catch (error) {
      // Remove invalid items
      localStorage.removeItem(key);
      return false;
    }
  });
  
  // Update the index with only valid keys
  saveStorageIndex(type, {
    keys: validKeys,
    lastUpdated: now
  });
};

/**
 * Save calculator data to localStorage
 */
export const saveCalculatorData = <T>(
  type: CalculatorType,
  input: any,
  data: T
): boolean => {
  if (!isLocalStorageAvailable()) {
    return false;
  }
  
  try {
    // Clean up old entries periodically
    if (Math.random() < 0.1) { // 10% chance to run cleanup
      cleanupStorage(type);
    }
    
    const key = generateStorageKey(type, input);
    const storageItem: StorageItem<T> = {
      version: CACHE_VERSION,
      timestamp: Date.now(),
      input,
      data
    };
    
    localStorage.setItem(key, JSON.stringify(storageItem));
    
    // Update the index
    addToStorageIndex(type, key);
    
    return true;
  } catch (error) {
    console.error('Error saving calculator data:', error);
    return false;
  }
};

/**
 * Get calculator data from localStorage
 */
export const getCalculatorData = <T>(
  type: CalculatorType,
  input: any
): { data: T | null; timestamp: number } => {
  if (!isLocalStorageAvailable()) {
    return { data: null, timestamp: 0 };
  }
  
  try {
    const key = generateStorageKey(type, input);
    const storedItem = localStorage.getItem(key);
    
    if (!storedItem) {
      return { data: null, timestamp: 0 };
    }
    
    const parsedItem = JSON.parse(storedItem) as StorageItem<T>;
    
    // Check if the version matches the current version
    if (parsedItem.version !== CACHE_VERSION) {
      localStorage.removeItem(key);
      return { data: null, timestamp: 0 };
    }
    
    return {
      data: parsedItem.data,
      timestamp: parsedItem.timestamp
    };
  } catch (error) {
    console.error('Error getting calculator data:', error);
    return { data: null, timestamp: 0 };
  }
};

/**
 * Clear all stored data for a calculator type
 */
export const clearCalculatorData = (type: CalculatorType): boolean => {
  try {
    const index = getStorageIndex(type);
    
    // Remove all keys in the index
    index.keys.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.error('Error removing storage item:', error);
      }
    });
    
    // Reset the index
    saveStorageIndex(type, { keys: [], lastUpdated: Date.now() });
    
    return true;
  } catch (error) {
    console.error('Error clearing calculator data:', error);
    return false;
  }
};

/**
 * Get all saved calculations for a calculator type
 * Useful for offline access to show a list of saved calculations
 */
export const getAllCalculatorData = <T>(
  type: CalculatorType
): Array<{ input: any; data: T; timestamp: number }> => {
  try {
    const index = getStorageIndex(type);
    const results: Array<{ input: any; data: T; timestamp: number }> = [];
    
    index.keys.forEach(key => {
      try {
        const storedItem = localStorage.getItem(key);
        if (!storedItem) return;
        
        const parsedItem = JSON.parse(storedItem) as StorageItem<T>;
        
        results.push({
          input: parsedItem.input,
          data: parsedItem.data,
          timestamp: parsedItem.timestamp
        });
      } catch (error) {
        console.error('Error reading storage item:', error);
      }
    });
    
    return results;
  } catch (error) {
    console.error('Error getting all calculator data:', error);
    return [];
  }
};

/**
 * Check if the browser supports localStorage
 */
export const isLocalStorageAvailable = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  try {
    const test = 'test';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Get the total size of calculator data in localStorage (in bytes)
 */
export const getCalculatorStorageSize = (): number => {
  if (!isLocalStorageAvailable()) {
    return 0;
  }
  
  try {
    let totalSize = 0;
    
    for (const key in localStorage) {
      if (key.startsWith(STORAGE_PREFIX)) {
        const value = localStorage.getItem(key);
        if (value) {
          totalSize += (key.length + value.length) * 2; // Unicode characters take 2 bytes
        }
      }
    }
    
    return totalSize;
  } catch (error) {
    console.error('Error calculating storage size:', error);
    return 0;
  }
};