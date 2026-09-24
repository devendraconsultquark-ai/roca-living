import axios from 'axios';

// Exported for the few flows that need a real browser navigation to the API
// rather than an XHR — e.g. the Xero OAuth handshake, which must leave the SPA.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:9009/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// Request interceptor to specify portal context
api.interceptors.request.use(
  (config) => {
    config.headers['X-Portal-Name'] = 'admin';
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle authorization issues and general API errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    if (status === 401) {
      // Redirect to login if not already on a public page (login, forgot-password, reset-password)
      const publicPaths = ['/login', '/forgot-password', '/reset-password'];
      const cleanPath = window.location.pathname.replace(/\/+$/, '') || '/';
      const isPublicPath = publicPaths.some(path => cleanPath === path || cleanPath.endsWith(path));
      if (!isPublicPath) {
        window.location.href = '/login';
      }
    } else if (!error.config?.skipInterceptorError) {
      // Dispatch custom event for all other errors
      const errorMessage = error.response?.data?.message || 'Error occurred';
      window.dispatchEvent(
        new CustomEvent('api-error', {
          detail: {
            message: errorMessage,
            type: 'error',
          },
        })
      );
    }

    return Promise.reject(error);
  }
);

export default api;
