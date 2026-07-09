import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export const ProtectedRoute = ({ children }) => {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app-bg">
        <div className="w-12 h-12 border-4 border-brand-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Redirect to login if profile does not exist or role is not LANDLORD
  if (!isAuthenticated || !user || user.role !== "LANDLORD") {
    return <Navigate to="/login" replace />;
  }

  return children;
};
