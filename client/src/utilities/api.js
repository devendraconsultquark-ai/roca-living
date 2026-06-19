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
      // Redirect to login if not already there
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/roca-living-2/client/login';
      }
    } else {
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
