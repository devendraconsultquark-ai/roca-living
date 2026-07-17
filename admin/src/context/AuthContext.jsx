import { createContext, useContext, useReducer, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utilities/api';

const AuthContext = createContext(null);

const initialState = {
  user: null,
  loading: true,
  isAuthenticated: false,
};

function authReducer(state, action) {
  switch (action.type) {
    case 'AUTH_SUCCESS':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: true,
        loading: false,
      };
    case 'AUTH_FAILURE':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        loading: false,
      };
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        loading: false,
      };
    default:
      return state;
  }
}

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await api.get('/auth/me?portal=admin');
        dispatch({ type: 'AUTH_SUCCESS', payload: response.data.data });
      } catch {
        dispatch({ type: 'AUTH_FAILURE' });
      }
    };
    checkAuth();
  }, []);

  const login = async (credentials) => {
    const response = await api.post('/auth/login', { ...credentials, portal: 'admin' });
    dispatch({ type: 'AUTH_SUCCESS', payload: response.data.data });
    return response.data;
  };

  const logout = async () => {
    await api.post('/auth/logout', { portal: 'admin' });
    dispatch({ type: 'LOGOUT' });
    navigate('/login');
  };

  // Re-fetch the user after profile mutations so the header/profile page
  // reflect saved changes without a re-login.
  const refreshUser = async () => {
    try {
      const response = await api.get('/auth/me?portal=admin');
      dispatch({ type: 'AUTH_SUCCESS', payload: response.data.data });
    } catch {
      // Keep current state — the session stays valid until an API call rejects it.
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user: state.user,
        loading: state.loading,
        isAuthenticated: state.isAuthenticated,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
