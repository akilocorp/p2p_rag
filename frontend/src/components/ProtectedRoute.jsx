import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

const ProtectedRoute = ({ children }) => {
  // This line *gets* (reads) the JWT from localStorage
  const isAuthenticated = localStorage.getItem('jwtToken'); 

  if (!isAuthenticated) {
    // If no token is found, redirect to the login page
    return <Navigate to="/login" replace />;
  }

  // If a token is found, render the protected content
  return children ? children : <Outlet />;
};

export default ProtectedRoute;