// src/pages/ConfigListPage.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/apiClient'; // Assuming you have a configured axios instance

// A reusable component for each item in the list
const ConfigItem = ({ config, onSelect }) => (
  <div
    className="bg-gray-700 p-4 rounded-lg shadow-md hover:bg-gray-600 cursor-pointer transition-colors"
    onClick={() => onSelect(config.config_id)} // Use a unique ID from your data
  >
    <h3 className="text-xl font-bold text-indigo-400">{config.bot_name}</h3>
    <p className="text-sm text-gray-400 mt-1">Model: {config.model_name}</p>
  </div>
);

const ConfigListPage = () => {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchConfigs = async () => {
      try {
        setLoading(true);
        // This endpoint should return a list of configs for the logged-in user.
        // The user ID is sent via the JWT, so no need to pass it here.
        const response = await apiClient.get('/config_list'); // Example: GET /api/configs
        setConfigs(response.data.configs); // Assuming the API returns { configs: [...] }
      } catch (err) {
        setError('Failed to load configurations.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchConfigs();
  }, []); // Empty dependency array ensures this runs once on mount

  const handleSelectConfig = (configId) => {
    // Navigate to the chat page, passing the selected config ID in the URL
    navigate(`/chat/${configId}`);
  };

  const handleCreateNew = () => {
    // Navigate to the configuration creation page
    navigate('/config');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col space-y-8">
          <div className="flex justify-between items-center">
            <h1 className="text-4xl font-bold text-white">Your LLM Configurations</h1>
            <button
              onClick={handleCreateNew}
              className="px-4 py-2 font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              <span className="hidden sm:inline">+ Create New LLM</span>
              <span className="sm:hidden">+ New</span>
            </button>
          </div>

          {loading && (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400"></div>
            </div>
          )}
          
          {error && (
            <div className="text-center text-red-400 p-4 rounded-lg bg-red-900/50">
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {configs.length > 0 ? (
                configs.map(config => (
                  <ConfigItem 
                    key={config.config_id} 
                    config={config} 
                    onSelect={handleSelectConfig} 
                  />
                ))
              ) : (
                <div className="col-span-full text-center p-8 bg-gray-800 rounded-lg">
                  <p className="text-gray-400 mb-4">No configurations found.</p>
                  <button
                    onClick={handleCreateNew}
                    className="px-4 py-2 font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    Create First Configuration
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConfigListPage;