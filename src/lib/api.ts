import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem('token');
    if (token) {
      if (!config.headers) {
        config.headers = {} as any;
      }
      (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
    }
  } catch (e) {
    console.error('[API Interceptor] Error:', e);
  }
  return config;
});
