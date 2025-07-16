import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import apiClient from '../api/apiClient';
import { FaRobot, FaUpload, FaTrash, FaInfoCircle, FaFile } from 'react-icons/fa';

const EditConfigPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [config, setConfig] = useState({
    bot_name: '',
    model_name: '',
    temperature: 0.7,
    max_tokens: 2000,
    is_public: false,
    instructions: '',
    prompt_template: '',
    collection_name: '',
    files: []
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [promptMode, setPromptMode] = useState('instructions');

  // Load config data on mount
  useEffect(() => {
    const initialConfig = location.state?.config;
    if (initialConfig) {
      setConfig({
        ...config,
        ...initialConfig,
        files: initialConfig.files || []
      });
    }
  }, [location]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === 'checkbox' ? checked : value;
    setConfig(prev => ({ ...prev, [name]: val }));
  };

  const handleFileChange = (files) => {
    setConfig(prev => ({ ...prev, files }));
  };

  const handlePromptModeChange = (mode) => {
    setPromptMode(mode);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});
    
    try {
      // Basic validation
      const newErrors = {};
      if (!config.bot_name.trim()) newErrors.bot_name = 'Chatbot name is required';
      if (!config.model_name.trim()) newErrors.model_name = 'Model name is required';
      if (promptMode === 'instructions' && !config.instructions.trim()) {
        newErrors.instructions = 'Instructions are required';
      }
      if (promptMode === 'template' && !config.prompt_template.trim()) {
        newErrors.prompt_template = 'Prompt template is required';
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        setIsLoading(false);
        return;
      }

      // Prepare request data
      const requestData = {
        bot_name: config.bot_name,
        model_name: config.model_name,
        temperature: config.temperature,
        max_tokens: config.max_tokens,
        is_public: config.is_public,
        instructions: config.instructions,
        prompt_template: config.prompt_template,
        collection_name: config.collection_name
      };

      const formData = new FormData();
      Object.entries(requestData).forEach(([key, value]) => {
        formData.append(key, value);
      });

      if (config.files && config.files.length > 0) {
        config.files.forEach(file => {
          formData.append('files', file);
        });
      }

      await apiClient.put(`/config/${config.config_id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      // Navigate back to config list with refresh flag
      navigate('/config_list', { state: { refresh: true } });
    } catch (error) {
      console.error('Error updating configuration:', error);
      setErrors({
        form: error.message || 'Failed to update configuration. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-500">
            Edit AI Assistant Configuration
          </h1>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl shadow-xl border border-gray-700/50 p-8">
          {errors.form && (
            <div className="mb-6 p-4 bg-red-900/50 rounded-xl border border-red-700/50">
              <p className="text-red-400">{errors.form}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Bot Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Bot Name</label>
              <input
                type="text"
                name="bot_name"
                value={config.bot_name}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter bot name"
              />
              {errors.bot_name && (
                <p className="mt-1 text-sm text-red-400">{errors.bot_name}</p>
              )}
            </div>

            {/* Model Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">AI Model</label>
              <select
                name="model_name"
                value={config.model_name}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="deepseek-chat">Deepseek Chat</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                <option value="qwen-turbo">Qwen Turbo</option>
              </select>
            </div>

            {/* Temperature */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Response Creativity</label>
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <input
                    type="range"
                    name="temperature"
                    value={config.temperature}
                    onChange={handleChange}
                    min="0"
                    max="2"
                    step="0.1"
                    className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                <span className="text-sm text-gray-400">{(typeof config.temperature === 'number' ? config.temperature : parseFloat(config.temperature)).toFixed(1)}</span>
              </div>
              <p className="mt-1 text-xs text-gray-400">
                Lower values make responses more deterministic and factual, higher values make them more creative and varied.
              </p>
            </div>

            {/* Max Tokens */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Max Tokens</label>
              <input
                type="number"
                name="max_tokens"
                value={config.max_tokens}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="2000"
              />
            </div>

            {/* Public/Private Toggle */}
            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  name="is_public"
                  checked={config.is_public}
                  onChange={handleChange}
                  className="w-4 h-4 text-indigo-500 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-300">Make Public</span>
              </label>
            </div>

            {/* Instructions/Prompt Template */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Prompt Mode</label>
              <div className="flex space-x-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="prompt_mode"
                    value="instructions"
                    checked={promptMode === 'instructions'}
                    onChange={() => handlePromptModeChange('instructions')}
                    className="w-4 h-4 text-indigo-500 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-300">Instructions</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="prompt_mode"
                    value="template"
                    checked={promptMode === 'template'}
                    onChange={() => handlePromptModeChange('template')}
                    className="w-4 h-4 text-indigo-500 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-300">Prompt Template</span>
                </label>
              </div>

              {promptMode === 'instructions' && (
                <textarea
                  name="instructions"
                  value={config.instructions}
                  onChange={handleChange}
                  rows="4"
                  className="w-full px-4 py-2 mt-2 bg-gray-700/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Enter instructions for the bot..."
                />
              )}

              {promptMode === 'template' && (
                <textarea
                  name="prompt_template"
                  value={config.prompt_template}
                  onChange={handleChange}
                  rows="4"
                  className="w-full px-4 py-2 mt-2 bg-gray-700/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Enter prompt template..."
                />
              )}

              {promptMode === 'instructions' && errors.instructions && (
                <p className="mt-1 text-sm text-red-400">{errors.instructions}</p>
              )}
              {promptMode === 'template' && errors.prompt_template && (
                <p className="mt-1 text-sm text-red-400">{errors.prompt_template}</p>
              )}
            </div>

            {/* Collection Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Collection Name</label>
              <input
                type="text"
                name="collection_name"
                value={config.collection_name}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter collection name"
              />
            </div>

            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Knowledge Base Files</label>
              <div className="mt-1 flex flex-col items-center justify-center px-6 pt-8 pb-8 border-2 border-dashed rounded-xl transition-all duration-200 cursor-pointer hover:border-indigo-500 bg-gray-800/50">
                <div className="text-center">
                  <FaUpload className="mx-auto text-2xl mb-3 text-gray-500" />
                  <p className="text-sm text-gray-400">
                    Drag & drop files or click to browse
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Supports: TXT, PDF, DOCX, MD (Max 10MB each)</p>
                </div>
                <input
                  type="file"
                  multiple
                  onChange={(e) => handleFileChange(Array.from(e.target.files))}
                  className="hidden"
                  accept=".txt,.pdf,.md,.docx"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
               <button
                type="button"
                onClick={() => navigate(-1)}
                className="w-full py-3 px-6 rounded-lg font-medium bg-gray-600 hover:bg-gray-700 transition-all active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all active:scale-[0.98]"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditConfigPage;
