import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

const ProtectedRoute = ({ children }) => {
  // Check if user is authenticated
  const isAuthenticated = localStorage.getItem('jwtToken');

  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If authenticated, render the protected content
  return children ? children : <Outlet />;
};

export default ProtectedRoute;