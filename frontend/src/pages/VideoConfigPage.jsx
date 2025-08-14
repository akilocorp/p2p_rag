import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/apiClient';
import { FaRobot, FaUpload, FaTrash, FaFile, FaVideo, FaQuestionCircle } from 'react-icons/fa';

const FileUpload = ({ onFileChange, initialFiles }) => {
  const [files, setFiles] = useState(initialFiles || []);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setFiles(initialFiles || []);
  }, [initialFiles]);

  const handleDragEnter = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const newFiles = Array.from(e.dataTransfer.files);
    const updatedFiles = [...files, ...newFiles];
    setFiles(updatedFiles);
    onFileChange(updatedFiles);
  };

  const handleFileChange = (e) => {
    const newFiles = Array.from(e.target.files);
    const updatedFiles = [...files, ...newFiles];
    setFiles(updatedFiles);
    onFileChange(updatedFiles);
  };

  const handleRemoveFile = (fileName) => {
    const updatedFiles = files.filter(file => file.name !== fileName);
    setFiles(updatedFiles);
    onFileChange(updatedFiles);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">Knowledge Base Documents</label>
      <div
        className={`mt-1 flex flex-col items-center justify-center px-6 pt-8 pb-8 border-2 border-dashed rounded-xl transition-all duration-200 cursor-pointer ${
          isDragging 
            ? 'border-indigo-500 bg-indigo-500/10' 
            : 'border-gray-600 hover:border-indigo-500 bg-gray-800/50'
        }`}
        onClick={() => fileInputRef.current.click()}
        onDragEnter={handleDragEnter}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="text-center">
          <FaUpload className={`mx-auto text-2xl mb-3 ${isDragging ? 'text-indigo-400' : 'text-gray-500'}`} />
          <p className={`text-sm ${isDragging ? 'text-indigo-400' : 'text-gray-400'}`}>
            {isDragging ? 'Drop files here' : 'Drag & drop files or click to browse'}
          </p>
          <p className="text-xs text-gray-500 mt-1">Supports: TXT, PDF, DOCX, MD</p>
        </div>
      </div>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        multiple
        className="hidden"
        accept=".txt,.pdf,.md,.docx"
      />
      {files.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-300 mb-2">Selected files:</h4>
          <ul className="space-y-2">
            {files.map((file, index) => (
              <li key={index} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-indigo-500/10 rounded-md text-indigo-400">
                    <FaFile className="text-sm" />
                  </div>
                  <span className="text-sm text-white truncate max-w-xs">{file.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveFile(file.name)}
                  className="text-gray-400 hover:text-red-400 transition-colors p-1"
                >
                  <FaTrash className="text-sm" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const VideoConfigPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    bot_name: '',
    collection_name: '',
    is_public: false,
    mode: 'Standard',
    duration: 5,
    guidance_scale: 0.5,
    negative_prompt: [],
    use_advanced_template: false,
    instructions: ''
  });
  const [promptMode, setPromptMode] = useState('instructions');
  const [files, setFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Predefined negative prompt options
  const negativePromptOptions = [
    'Blurry',
    'Cartoonish',
    'Unrealistic',
    'Grainy',
    'Noisy',
    'Low contrast',
    'Distorted',
    'Pixelated',
    'Overexposed',
    'Underexposed',
    'Motion blur',
    'Artifacts'
  ];

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handlePromptModeChange = (mode) => {
    setPromptMode(mode);
    setFormData(prev => ({
      ...prev,
      use_advanced_template: mode === 'advanced'
    }));
  };

  const handleNegativePromptChange = (option) => {
    setFormData(prev => ({
      ...prev,
      negative_prompt: prev.negative_prompt.includes(option)
        ? prev.negative_prompt.filter(item => item !== option)
        : [...prev.negative_prompt, option]
    }));
  };

  const handleFileChange = (newFiles) => {
    setFiles(newFiles);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    // Basic validation
    if (!formData.bot_name.trim()) {
      setError('Configuration name is required');
      setIsSubmitting(false);
      return;
    }
    if (!formData.collection_name.trim()) {
      setError('Collection name is required');
      setIsSubmitting(false);
      return;
    }
    if (promptMode === 'instructions' && !formData.instructions.trim()) {
      setError('Instructions are required when not using advanced template');
      setIsSubmitting(false);
      return;
    }

    try {
      const formDataToSend = new FormData();
      
      // Add config data as JSON string
      formDataToSend.append('config', JSON.stringify(formData));
      
      // Add files
      files.forEach(file => {
        formDataToSend.append('files', file);
      });

      const response = await apiClient.post('/video_config', formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.status === 201) {
        navigate('/config_list');
      }
    } catch (error) {
      console.error('Error creating video config:', error);
      setError(error.response?.data?.error || 'An error occurred while creating the configuration');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400">
              <FaVideo className="text-2xl" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Video Generation Config</h1>
              <p className="text-gray-400">Create AI-powered videos from your knowledge base</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Configuration */}
          <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center">
              <FaRobot className="mr-3 text-purple-400" />
              Basic Configuration
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Configuration Name *
                </label>
                <input
                  type="text"
                  name="bot_name"
                  value={formData.bot_name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="e.g., Mitochondria Video Generator"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Collection Name *
                </label>
                <input
                  type="text"
                  name="collection_name"
                  value={formData.collection_name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="e.g., biology_knowledge_base"
                  required
                />
              </div>
            </div>

            <div className="mt-6">
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  name="is_public"
                  checked={formData.is_public}
                  onChange={handleInputChange}
                  className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500"
                />
                <span className="text-sm text-gray-300">Make this configuration public</span>
              </label>
            </div>
          </div>

          {/* Instructions vs Advanced Template */}
          <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
            <h2 className="text-xl font-semibold text-white mb-6">Video Generation Instructions</h2>
            
            <div className="flex items-center bg-gray-700/50 rounded-lg p-1 w-full md:w-auto mb-6">
              <button
                type="button"
                onClick={() => handlePromptModeChange('instructions')}
                className={`px-4 py-2 text-sm font-medium rounded-md w-1/2 transition-colors duration-200 ${
                  promptMode === 'instructions' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-gray-600'
                }`}
              >
                Instructions
              </button>
              <button
                type="button"
                onClick={() => handlePromptModeChange('advanced')}
                className={`px-4 py-2 text-sm font-medium rounded-md w-1/2 transition-colors duration-200 ${
                  promptMode === 'advanced' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-gray-600'
                }`}
              >
                Advanced Template
              </button>
            </div>

            {promptMode === 'instructions' ? (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Video Generation Instructions
                </label>
                <div className="mb-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <FaQuestionCircle className="text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-300">
                      <p className="font-medium mb-1">Available Variables:</p>
                      <p><code className="bg-blue-500/20 px-1 rounded">{'{{context}}'}</code> - Retrieved knowledge base content</p>
                      <p><code className="bg-blue-500/20 px-1 rounded">{'{{query}}'}</code> - User's input query</p>
                    </div>
                  </div>
                </div>
                <textarea
                  name="instructions"
                  value={formData.instructions}
                  onChange={handleInputChange}
                  rows={6}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Create a video showing {{context}} based on the query: {{query}}. Make it educational and visually engaging with clear demonstrations of concepts and processes."
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center space-x-2 mb-4">
                  <FaVideo className="text-purple-400" />
                  <span className="font-medium text-purple-400">Advanced Video Generation Template</span>
                </div>
                
                <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                  <p className="text-sm text-purple-300 mb-3">
                    <strong>Advanced Template:</strong> Uses an optimized prompt that automatically converts your knowledge base content into visual scenes and video descriptions.
                  </p>
                  <div className="text-xs text-purple-200 bg-purple-500/5 p-3 rounded border-l-2 border-purple-400">
                    <p><strong>How it works:</strong></p>
                    <p>• Retrieves relevant content from your documents</p>
                    <p>• Converts text knowledge into visual scene descriptions</p>
                    <p>• Creates contextually appropriate video prompts</p>
                    <p>• Optimized for educational and informative video generation</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Video Parameters */}
          <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
            <h2 className="text-xl font-semibold text-white mb-6">Video Parameters</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Generation Mode
                </label>
                <select
                  name="mode"
                  value={formData.mode}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="Standard">Standard (720p)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Duration (seconds)
                </label>
                <select
                  name="duration"
                  value={formData.duration}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value={5}>5 seconds</option>
                  <option value={10}>10 seconds</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Guidance Scale ({formData.guidance_scale})
                </label>
                <input
                  type="range"
                  name="guidance_scale"
                  min="0"
                  max="1"
                  step="0.1"
                  value={formData.guidance_scale}
                  onChange={handleInputChange}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>0.0 (Creative)</span>
                  <span>1.0 (Precise)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Negative Prompt Checklist */}
          <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
            <h2 className="text-xl font-semibold text-white mb-4">Negative Prompts</h2>
            <p className="text-sm text-gray-400 mb-4">Select unwanted elements to exclude from video generation:</p>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {negativePromptOptions.map((option) => (
                <label key={option} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.negative_prompt.includes(option)}
                    onChange={() => handleNegativePromptChange(option)}
                    className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-300">{option}</span>
                </label>
              ))}
            </div>
            
            {formData.negative_prompt.length > 0 && (
              <div className="mt-4 p-3 bg-gray-700/50 rounded-lg">
                <p className="text-xs text-gray-400 mb-1">Selected negative prompts:</p>
                <p className="text-sm text-gray-300">{formData.negative_prompt.join(', ')}</p>
              </div>
            )}
          </div>

          {/* File Upload */}
          <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
            <h2 className="text-xl font-semibold text-white mb-6">Knowledge Base</h2>
            <FileUpload onFileChange={handleFileChange} initialFiles={files} />
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => navigate('/config_list')}
              className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <FaVideo />
                  <span>Create Video Config</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VideoConfigPage;
