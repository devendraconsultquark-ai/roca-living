import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8008/api/v1',
  withCredentials: true,
});

// Response interceptor to handle authorization issues and general API errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    if (status === 401) {
      // Redirect to login if not already on a public page (login, forgot-password, reset-password)
      const publicPaths = ['/login', '/forgot-password', '/reset-password'];
      const isPublicPath = publicPaths.some(path => window.location.pathname.includes(path));
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
