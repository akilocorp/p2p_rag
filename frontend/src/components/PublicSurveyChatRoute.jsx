import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, useParams } from 'react-router-dom';
import axios from 'axios';
import { FaSpinner } from 'react-icons/fa';

const PublicSurveyChatRoute = ({ children }) => {
  const { config_id } = useParams();
  const [isPublic, setIsPublic] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const isAuthenticated = !!localStorage.getItem('jwtToken');

  useEffect(() => {
    const checkConfig = async () => {
      if (!config_id) {
        setIsLoading(false);
        return;
      }
      try {
        // Make a direct axios request without authentication headers for survey config
        const response = await axios.get(`/api/survey_config/${config_id}`);
        setIsPublic(response.data.config.is_public);
      } catch (error) {
        console.error('Failed to fetch survey config:', error);
        // If there's an error fetching the config, assume it's private
        setIsPublic(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkConfig();
  }, [config_id]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900">
        <FaSpinner className="animate-spin text-3xl text-indigo-400 mb-4" />
        <p className="text-gray-400 text-lg">Checking survey accessibility...</p>
        <p className="text-gray-500 text-sm mt-2">Verifying if this survey is public or requires login</p>
      </div>
    );
  }

  if (isPublic || isAuthenticated) {
    return children ? children : <Outlet />;
  }

  return <Navigate to="/login" replace />;
};

export default PublicSurveyChatRoute;
