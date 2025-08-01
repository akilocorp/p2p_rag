import { FaCog, FaPlus, FaRobot, FaSpinner, FaTimes } from 'react-icons/fa';
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import UserInfo from '../components/UserInfo';
import apiClient from '../api/apiClient';

const ConfigItem = ({ config, onSelect, onEdit }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={`relative bg-gray-800/50 backdrop-blur-sm p-6 rounded-xl border border-gray-700/50 shadow-lg transition-all duration-300 ${
        isHovered ? 'border-indigo-500/50 transform -translate-y-1 shadow-indigo-500/10' : 'hover:border-gray-600'
      }`}
      onClick={() => {
        if (!config.config_id) {
          console.error('Invalid config:', config);
          return;
        }
        onSelect(config);
      }}
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
              {config.config_type === 'survey' 
                ? (config.creativity_rate ? `Creativity: ${config.creativity_rate}/5` : 'Creativity: 3/5')
                : (config.temperature ? `Temp: ${config.temperature}` : 'Default temp')
              }
            </span>
          </div>
        </div>
      </div>
      <div className="mt-4 flex justify-between items-center">
        <div>
          {config.config_type === 'survey' && (
            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
              Survey
            </span>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(config);
          }}
          className="px-3 py-1.5 text-xs font-medium bg-gray-700/60 hover:bg-gray-600 text-gray-300 hover:text-white rounded-md transition-colors flex items-center space-x-1.5"
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
  const [isLoading, setIsLoading] = useState(true);
  const [showAssistantTypeModal, setShowAssistantTypeModal] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const loadPageData = async () => {
      setIsLoading(true);
      try {
        const [normalConfigsResponse, surveyConfigsResponse] = await Promise.all([
          apiClient.get('/config_list'),
          apiClient.get('/survey_config_list')
        ]);

        const normalConfigs = normalConfigsResponse.data.configs || [];
        const surveyConfigs = surveyConfigsResponse.data.configs || [];

        setConfigs([...normalConfigs, ...surveyConfigs]);
      } catch (err) {
        console.error('Failed to load configurations:', err);
        setError('Failed to load configurations. Please try again later.');
        if (err.response?.status === 401) {
          navigate('/login');
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadPageData();
  }, [location.key, navigate]);

  const handleSelectConfig = (config) => {
    if (!config?.config_id) {
      console.error('Invalid config:', config);
      setError('Failed to select configuration');
      return;
    }

    navigate(config.config_type === 'survey' 
      ? `/survey-chat/${config.config_id}`
      : `/chat/${config.config_id}`
    );
  };

  const onEdit = (config) => {
    navigate(`/edit-config`, { 
      state: { 
        config: {
          ...config,
          _id: config._id,
          documents: config.documents || []
        }
      } 
    });
  };

  const handleCreateNew = () => setShowAssistantTypeModal(true);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* User Info positioned absolutely in the top-right corner */}
        <div className="absolute top-6 right-6 z-50">
          <UserInfo />
        </div>
        
        {/* Main content container */}
        <div className="pt-16">
          {/* Header section */}
          <div className="flex flex-col mb-12">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8">
              <div className="space-y-3">
                <h1 className="text-4xl sm:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 to-purple-400 tracking-tight">
                  AI Assistants
                </h1>
                <p className="text-gray-400/90 text-base">
                  Manage your personalized AI assistant configurations
                </p>
              </div>
              <button
                onClick={handleCreateNew}
                className="flex items-center px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/20"
              >
                <FaPlus className="mr-3 text-sm" />
                <span className="font-medium">New Assistant</span>
              </button>
            </div>
          </div>

          {/* Content area */}
          <div className="space-y-8">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-64 rounded-2xl bg-gray-900/80 border border-gray-800 backdrop-blur-sm">
                <FaSpinner className="animate-spin text-4xl text-indigo-400 mb-4" />
                <p className="text-gray-400/80">Loading your AI assistants...</p>
              </div>
            ) : error ? (
              <div className="rounded-2xl bg-red-900/30 border border-red-800/50 p-6 backdrop-blur-sm">
                <div className="flex items-start">
                  <div className="flex-shrink-0 pt-0.5">
                    <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-base font-medium text-red-100">Configuration Error</h3>
                    <p className="mt-1 text-sm text-red-200/90">{error}</p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {configs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 rounded-2xl bg-gray-900/50 border border-gray-800/50">
                    <div className="p-5 bg-gray-800/50 rounded-full mb-4">
                      <FaRobot className="text-3xl text-gray-500" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-300 mb-2">No assistants yet</h3>
                    <p className="text-gray-500 mb-6 max-w-md text-center">
                      Create your first AI assistant to get started
                    </p>
                    <button
                      onClick={handleCreateNew}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center"
                    >
                      <FaPlus className="mr-2" />
                      Create Assistant
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {configs.map((config) => (
                      <ConfigItem
                        key={config.config_id}
                        config={config}
                        onSelect={handleSelectConfig}
                        onEdit={onEdit}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Floating Action Button - Only visible when scrolling */}
        {configs.length > 0 && (
          <button
            onClick={handleCreateNew}
            className="fixed bottom-8 right-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full p-4 shadow-lg transition-all transform hover:scale-110 z-40 flex items-center justify-center"
            aria-label="Create new assistant"
            style={{ width: '56px', height: '56px' }}
          >
            <FaPlus className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Assistant Type Selection Modal */}
      {showAssistantTypeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={() => setShowAssistantTypeModal(false)}>
          <div 
            className="bg-gray-800 border border-gray-700 rounded-2xl p-8 w-full max-w-md mx-4 shadow-2xl transform transition-all duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">Create New Assistant</h2>
              <button 
                onClick={() => setShowAssistantTypeModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <FaTimes className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-gray-400 mb-6">Select the type of assistant you want to create:</p>
            
            <div className="grid grid-cols-1 gap-4">
              <button
                onClick={() => {
                  setShowAssistantTypeModal(false);
                  navigate('/config', { state: { config_type: 'normal' } });
                }}
                className="p-6 bg-gray-900/50 border border-gray-700 hover:border-indigo-500 hover:bg-gray-700 rounded-xl text-left transition-all duration-300 group flex items-start space-x-4"
              >
                <div className="p-3 bg-indigo-500/10 rounded-lg text-indigo-400 group-hover:bg-indigo-500/20 transition-colors">
                  <FaRobot className="text-xl" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Standard Assistant</h3>
                  <p className="text-sm text-gray-400 mt-1">Responds to user queries and requests</p>
                </div>
              </button>
              
              <button
                onClick={() => {
                  setShowAssistantTypeModal(false);
                  navigate('/survey-config');
                }}
                className="p-6 bg-gray-900/50 border border-gray-700 hover:border-green-500 hover:bg-gray-700 rounded-xl text-left transition-all duration-300 group flex items-start space-x-4"
              >
                <div className="p-3 bg-green-500/10 rounded-lg text-green-400 group-hover:bg-green-500/20 transition-colors">
                  <FaCog className="text-xl" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Survey Assistant</h3>
                  <p className="text-sm text-gray-400 mt-1">Initiates conversations and guides users</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfigListPage;