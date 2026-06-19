import React from 'react';
import { Navigate } from 'react-router-dom';

export const ProtectedRoute = ({ children }) => {
  const userString = localStorage.getItem('user');
  let user = null;

  if (userString) {
    try {
      user = JSON.parse(userString);
    } catch (e) {
      console.error('Failed to parse user profile', e);
    }
  }

  // Redirect to login if profile does not exist or role is not LANDLORD
  if (!user || user.role !== 'LANDLORD') {
    return <Navigate to="/login" replace />;
  }

  return children;
};
