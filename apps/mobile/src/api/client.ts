/**
 * Life Navigator - API Client
 *
 * Elite-level Axios configuration with interceptors, error handling,
 * automatic retries, and authentication
 */

import axios, { AxiosInstance, AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { API_CONFIG, SESSION_CONFIG } from '../utils/constants';
import { getAuthToken, refreshAuthToken, clearAuthTokens } from '../services/StorageService';

/**
 * Create Axios instance with base configuration
 */
const apiClient: AxiosInstance = axios.create({
  baseURL: API_CONFIG.baseURL,
  timeout: API_CONFIG.timeout,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

/**
 * Request interceptor to add auth token
 */
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await getAuthToken();

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Log requests in development
    if (__DEV__) {
      console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, {
        params: config.params,
        data: config.data,
      });
    }

    return config;
  },
  (error: AxiosError) => {
    console.error('[API Request Error]', error);
    return Promise.reject(error);
  }
);

/**
 * Response interceptor to handle errors and token refresh
 */
apiClient.interceptors.response.use(
  (response) => {
    // Log responses in development
    if (__DEV__) {
      console.log(`[API Response] ${response.config.method?.toUpperCase()} ${response.config.url}`, {
        status: response.status,
        data: response.data,
      });
    }

    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Log errors in development
    if (__DEV__) {
      console.error('[API Response Error]', {
        url: error.config?.url,
        status: error.response?.status,
        message: error.message,
        data: error.response?.data,
      });
    }

    // Handle 401 Unauthorized - attempt token refresh
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const newToken = await refreshAuthToken();

        if (newToken && originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Token refresh failed - clear auth and redirect to login
        await clearAuthTokens();
        // Navigate to login screen (this will be handled by navigation service)
        return Promise.reject(refreshError);
      }
    }

    // Handle network errors
    if (error.message === 'Network Error') {
      return Promise.reject({
        message: 'Network error. Please check your internet connection.',
        code: 'NETWORK_ERROR',
      });
    }

    // Handle timeout errors
    if (error.code === 'ECONNABORTED') {
      return Promise.reject({
        message: 'Request timeout. Please try again.',
        code: 'TIMEOUT_ERROR',
      });
    }

    // Extract error message from response
    const errorMessage =
      (error.response?.data as any)?.message ||
      (error.response?.data as any)?.error ||
      error.message ||
      'An unexpected error occurred';

    return Promise.reject({
      message: errorMessage,
      code: error.response?.status || 'UNKNOWN_ERROR',
      data: error.response?.data,
    });
  }
);

/**
 * Generic API request wrapper with retry logic
 */
export const apiRequest = async <T = any>(
  config: AxiosRequestConfig,
  retries: number = API_CONFIG.retryAttempts
): Promise<T> => {
  try {
    const response = await apiClient(config);
    return response.data;
  } catch (error: any) {
    // Retry logic for network/timeout errors
    if (
      retries > 0 &&
      (error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT_ERROR')
    ) {
      console.log(`[API] Retrying request (${retries} attempts left)...`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return apiRequest<T>(config, retries - 1);
    }

    throw error;
  }
};

/**
 * HTTP method helpers
 */
export const api = {
  get: <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> =>
    apiRequest<T>({ ...config, method: 'GET', url }),

  post: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> =>
    apiRequest<T>({ ...config, method: 'POST', url, data }),

  put: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> =>
    apiRequest<T>({ ...config, method: 'PUT', url, data }),

  patch: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> =>
    apiRequest<T>({ ...config, method: 'PATCH', url, data }),

  delete: <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> =>
    apiRequest<T>({ ...config, method: 'DELETE', url }),
};

export default api;
