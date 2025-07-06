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
    <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
      <div className="w-full max-w-4xl p-8 space-y-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white">Your LLM Configurations</h1>
          <button
            onClick={handleCreateNew}
            className="px-4 py-2 font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            + Create New LLM
          </button>
        </div>

        {loading && <p className="text-center">Loading configurations...</p>}
        {error && <p className="text-center text-red-400">{error}</p>}

        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {configs.length > 0 ? (
              configs.map(config => (
                <ConfigItem key={config.config_id} config={config} onSelect={handleSelectConfig} />
              ))
            ) : (
              <p className="text-center col-span-full">No configurations found. Create one to get started!</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ConfigListPage;