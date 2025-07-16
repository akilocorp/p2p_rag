import React, { useState, useEffect } from 'react';

import { useNavigate, useLocation } from 'react-router-dom';
import apiClient from '../api/apiClient';
import { FaPlus, FaRobot, FaCog, FaSpinner, FaUser, FaSignOutAlt, FaChevronDown } from 'react-icons/fa';

const ConfigItem = ({ config, onSelect, onEdit }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={`relative bg-gray-800/50 backdrop-blur-sm p-6 rounded-xl border border-gray-700/50 shadow-lg transition-all duration-300 ${
        isHovered ? 'border-indigo-500/50 transform -translate-y-1' : 'hover:border-gray-600'
      }`}
      onClick={() => onSelect(config._id)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0 p-3 bg-indigo-500/10 rounded-lg text-indigo-400">
          <FaRobot className="text-xl" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-white truncate">{config.bot_name}</h3>
          <p className="text-sm text-gray-400 mt-1">Model: {config.model_name}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {isHovered && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-xl pointer-events-none">
                <div className="px-3 py-1 text-xs font-medium bg-indigo-500/90 text-white rounded-full">
                  Click to chat
                </div>
              </div>
            )}
            <span className="px-2 py-1 text-xs rounded-full bg-gray-700/50 text-gray-300">
              {config.temperature ? `Temp: ${config.temperature}` : 'Default temp'}
            </span>
           
           
          </div>
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(config);
          }}
          className="px-2 py-1 text-xs font-medium bg-gray-700/50 text-gray-300 hover:text-gray-300 transition-colors flex items-center space-x-1"
        >
          <FaCog className="text-xs" />
          <span>Edit</span>
        </button>
      </div>
    </div>
  );
};

const ConfigListPage = () => {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [username, setUsername] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const loadPageData = async () => {
      setLoading(true);
      try {
        // Make a single API call to the optimized endpoint
        const response = await apiClient.get('/config_list');
        
        // Set both username and configs from the single response
        setUsername(response.data.username);
        setConfigs(response.data.configs);

      } catch (err) {
        console.error('Failed to load page data:', err);
        setError('Failed to load your data. Please try logging in again.');
        if (err.response?.status === 401) {
          navigate('/login');
        }
      } finally {
        setLoading(false);
      }
    };

    loadPageData();
    // The dependency array ensures this runs on mount and when navigating back (e.g., from edit page)
  }, [location.key, navigate]); // Using location.key is a reliable way to trigger refetch on navigation

  const handleSelectConfig = (configId) => {
    navigate(`/chat/${configId}`);
  };

  const onEdit = (config) => {
    // The backend sends `_id`, but the frontend components might expect `config_id`.
    // We ensure the object passed in state is consistent.
    const configForEdit = { ...config, config_id: config._id };
    navigate(`/edit-config`, { state: { config: configForEdit } });
  };

  const handleCreateNew = () => {
    navigate('/config');
  };

  const handleLogout = async () => {
    try {
      // Assuming your backend has a /logout endpoint
      await apiClient.post('/logout');
      // Clear the token from local storage
      localStorage.removeItem('jwtToken');
      // Redirect to login page, replacing the current history entry
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Logout failed:', error);
      // Handle logout error, e.g., show a notification
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8 max-w-7xl">
        <div className="flex flex-col space-y-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-500">
                Your AI Assistants
              </h1>
              <p className="text-gray-400 mt-2">
                Manage and interact with your custom LLM configurations
              </p>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={handleCreateNew}
                className="flex items-center space-x-2 px-4 py-3 font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-all active:scale-[0.98]"
              >
                <FaPlus className="text-sm" />
                <span>New Assistant</span>
              </button>

              {username && (
                <div className="relative">
                  <button 
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="flex items-center space-x-3 bg-gray-800/50 border border-gray-700/50 rounded-full px-4 py-2 focus:outline-none   transition-colors hover:border-indigo-600/70"
                  >
                    <FaUser className="text-indigo-400" />
                    <span className="font-medium text-white">{username}</span>
                    <FaChevronDown className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isDropdownOpen && (
                    <div 
                      className="absolute right-0 mt-2 w-48  border border-gray-700/50 rounded-md shadow-lg z-10 overflow-hidden transition-all duration-300 ease-in-out transform origin-top-right"
                      style={{ transform: isDropdownOpen ? 'scale(1)' : 'scale(0.95)', opacity: isDropdownOpen ? 1 : 0 }}
                    >
                      <button 
                        onClick={handleLogout}
                        className="flex items-center w-full px-4 py-3 text-sm text-left bg-gray-800/50 rounded-md text-gray-300  hover:text-white transition-colors"
                      >
                        <FaSignOutAlt className="mr-3" />
                        <span>Logout</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {loading && (
            <div className="flex flex-col items-center justify-center h-64 rounded-xl bg-gray-800/50 border border-gray-700/50">
              <FaSpinner className="animate-spin text-3xl text-indigo-400 mb-4" />
              <p className="text-gray-400">Loading your configurations...</p>
            </div>
          )}
          
          {error && (
            <div className="p-4 rounded-xl bg-red-900/50 border border-red-700/50 flex items-center">
              <div className="flex-shrink-0 text-red-400 mr-3">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-medium text-red-200">Error loading configurations</h3>
                <p className="text-sm text-red-300 mt-1">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {configs.length > 0 ? (
                configs.map(config => (
                  <ConfigItem 
                    key={config._id} 
                    config={config} 
                    onSelect={handleSelectConfig} 
                    onEdit={onEdit} 
                  />
                ))
              ) : (
                <div className="col-span-full text-center p-8 rounded-xl bg-gray-800/50 border border-gray-700/50">
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-indigo-500/10 mb-4">
                    <FaCog className="text-indigo-400 text-xl" />
                  </div>
                  <h3 className="text-lg font-medium text-white">No configurations yet</h3>
                  <p className="text-gray-400 mt-2">Get started by creating your first AI assistant</p>
                  <div className="mt-6">
                    <button
                      onClick={handleCreateNew}
                      className="inline-flex items-center px-4 py-2 font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-md hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-all"
                    >
                      Create First Assistant
                    </button>
                  </div>
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