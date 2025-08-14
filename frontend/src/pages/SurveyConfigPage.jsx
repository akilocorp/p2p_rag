import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/apiClient';
import { FaRobot, FaUpload, FaTrash, FaFile, FaQuestionCircle } from 'react-icons/fa';

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
    const maxFileSize = 5 * 1024 * 1024 * 1024; // 5GB
    const validFiles = [];
    
    newFiles.forEach(file => {
      if (file.size > maxFileSize) {
        alert(`File ${file.name} is too large. Maximum size is 5GB.`);
      } else {
        validFiles.push(file);
      }
    });
    
    const updatedFiles = [...files, ...validFiles];
    setFiles(updatedFiles);
    onFileChange(updatedFiles);
  };

  const handleFileChange = (e) => {
    const newFiles = Array.from(e.target.files);
    const maxFileSize = 5 * 1024 * 1024 * 1024; // 5GB
    const validFiles = [];
    
    newFiles.forEach(file => {
      if (file.size > maxFileSize) {
        alert(`File ${file.name} is too large. Maximum size is 5GB.`);
      } else {
        validFiles.push(file);
      }
    });
    
    const updatedFiles = [...files, ...validFiles];
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
      <label className="block text-sm font-medium text-gray-300 mb-2">Survey Questions File</label>
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
            {isDragging ? 'Drop file here (up to 5GB)' : 'Upload survey file up to 5GB'}
          </p>
          <p className="text-xs text-gray-500 mt-1">Supports: TXT, PDF, DOCX, MD • Maximum 5GB per file</p>
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
          <h4 className="text-sm font-medium text-gray-300 mb-2">Selected file:</h4>
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

const SurveyConfigPage = () => {
  const navigate = useNavigate();
  const [promptMode, setPromptMode] = useState('instructions');
  const [config, setConfig] = useState({
    bot_name: '',
    llm_type: 'gpt-3.5-turbo',
    is_public: false,
    collection_name: '',
    files: [],
    instructions: '',
    // New survey parameters for advanced template
    survey_purpose: '',
    target_audience: '',
    creativity_rate: 3,
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setConfig(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleFileChange = (selectedFiles) => {
    setConfig({ ...config, files: selectedFiles });
  };

  const handlePromptModeChange = (mode) => {
    setPromptMode(mode);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});

    // Validate required fields
    const newErrors = {};
    if (!config.bot_name?.trim()) {
      newErrors.bot_name = 'Survey bot name is required';
    }
    if (!config.collection_name?.trim()) {
      newErrors.collection_name = 'Collection name is required';
    }
    if (promptMode === 'instructions' && !config.instructions?.trim()) {
      newErrors.instructions = 'Instructions are required when not using advanced template';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setIsLoading(false);
      return;
    }

    const formData = new FormData();

    // The backend expects a single 'config' field with a JSON string
    const configToSubmit = {
      bot_name: config.bot_name,
      llm_type: config.llm_type,
      is_public: config.is_public,
      collection_name: config.collection_name,
      config_type: 'survey'
    };

    // Add either instructions or use_advanced_template based on promptMode
    if (promptMode === 'advanced') {
      configToSubmit.use_advanced_template = true;
      // Add survey parameters for advanced template
      configToSubmit.survey_purpose = config.survey_purpose;
      configToSubmit.target_audience = config.target_audience;
      configToSubmit.creativity_rate = config.creativity_rate;
    } else {
      configToSubmit.instructions = config.instructions;
    }

    formData.append('config', JSON.stringify(configToSubmit));

    config.files.forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await apiClient.post('/survey_config', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setIsLoading(false);
      const newConfigId = response.data.data._id;
      navigate(`/survey-chat/${newConfigId}`);
    } catch (error) {
      setIsLoading(false);
      if (error.response && error.response.data && error.response.data.error) {
        setErrors({ form: error.response.data.error });
      } else {
        setErrors({ form: 'An unexpected error occurred. Please try again.' });
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-gray-800 rounded-2xl shadow-2xl shadow-indigo-500/10 overflow-hidden">
        <div className="p-8">
          <div className="flex items-center space-x-4 mb-6">
            <div className="p-3 bg-indigo-500/10 rounded-full">
              <FaQuestionCircle className="text-2xl text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Create Survey Assistant</h1>
              <p className="text-sm text-gray-400">Configure a new AI to conduct surveys.</p>
            </div>
          </div>

          {errors.form && (
            <div className="bg-red-500/20 text-red-300 p-3 rounded-lg mb-6 text-sm">
              {errors.form}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="bot_name" className="block text-sm font-medium text-gray-300 mb-2">Survey Bot Name</label>
              <input
                id="bot_name"
                type="text"
                name="bot_name"
                value={config.bot_name}
                onChange={handleChange}
                className="w-full px-4 py-3 text-white bg-gray-700/70 border border-gray-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g., Customer Feedback Bot"
                required
              />
              {errors.bot_name && <p className="mt-1 text-sm text-red-400">{errors.bot_name}</p>}
            </div>

            <div>
              <label htmlFor="llm_type" className="block text-sm font-medium text-gray-300 mb-2">Language Model</label>
              <select
                id="llm_type"
                name="llm_type"
                value={config.llm_type}
                onChange={handleChange}
                className="w-full px-4 py-3 text-white bg-gray-700/70 border border-gray-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                  <option value="deepseek-chat">Deepseek Chat</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  <option value="gpt-4">GPT-4</option>
                  <option value="qwen-turbo">Qwen Turbo</option>
              </select>
            </div>

            <div className="p-4 bg-gray-700/50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <label htmlFor="is_public" className="block text-sm font-medium text-gray-300 mb-1">
                    Public Access
                  </label>
                  <p className="text-xs text-gray-400">
                    Allow anyone with the link to participate in the survey without logging in
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    id="is_public"
                    name="is_public"
                    className="sr-only peer"
                    checked={config.is_public}
                    onChange={handleChange}
                  />
                  <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-focus:ring-2 peer-focus:ring-indigo-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
            </div>

            <div>
              <div className="flex items-center bg-gray-700/50 rounded-lg p-1 w-full md:w-auto mb-4">
                <button
                  type="button"
                  onClick={() => handlePromptModeChange('instructions')}
                  className={`px-4 py-2 text-sm font-medium rounded-md w-1/2 transition-colors duration-200 ${
                    promptMode === 'instructions' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Instructions
                </button>
                <button
                  type="button"
                  onClick={() => handlePromptModeChange('advanced')}
                  className={`px-4 py-2 text-sm font-medium rounded-md w-1/2 transition-colors duration-200 ${
                    promptMode === 'advanced' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Advanced Template
                </button>
              </div>

              {promptMode === 'instructions' ? (
                <div>
                  <label htmlFor="instructions" className="block text-sm font-medium text-gray-300 mb-2">
                    Instructions
                  </label>
                  <textarea
                    id="instructions"
                    name="instructions"
                    rows="4"
                    value={config.instructions}
                    onChange={handleChange}
                    className="w-full px-4 py-3 text-white bg-gray-700/70 border border-gray-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Example: You are a friendly survey bot. Ask questions from uploaded documents one at a time. Use ONLY questions from the context: {context}. Ask ALL questions systematically. After completion, provide a summary report with all questions and answers."
                  />
                  {errors.instructions && <p className="mt-1 text-sm text-red-400">{errors.instructions}</p>}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 mb-4">
                    <FaRobot className="text-indigo-400" />
                    <span className="font-medium text-indigo-400">Advanced Survey Template</span>
                  </div>
                  
                  <div>
                    <label htmlFor="survey_purpose" className="block text-sm font-medium text-gray-300 mb-2">
                      Survey Purpose
                    </label>
                    <input
                      id="survey_purpose"
                      name="survey_purpose"
                      type="text"
                      value={config.survey_purpose}
                      onChange={handleChange}
                      className="w-full px-4 py-3 text-white bg-gray-700/70 border border-gray-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g., gathering customer feedback, employee satisfaction survey"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="target_audience" className="block text-sm font-medium text-gray-300 mb-2">
                      Target Audience
                    </label>
                    <input
                      id="target_audience"
                      name="target_audience"
                      type="text"
                      value={config.target_audience}
                      onChange={handleChange}
                      className="w-full px-4 py-3 text-white bg-gray-700/70 border border-gray-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g., customers, employees, students, general users"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="creativity_rate" className="block text-sm font-medium text-gray-300 mb-2">
                      Creativity Rate (1-5)
                    </label>
                    <select
                      id="creativity_rate"
                      name="creativity_rate"
                      value={config.creativity_rate}
                      onChange={handleChange}
                      className="w-full px-4 py-3 text-white bg-gray-700/70 border border-gray-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value={1}>1 - Strict (Ask questions exactly as provided)</option>
                      <option value={2}>2 - Slightly Flexible (Minor rephrasing)</option>
                      <option value={3}>3 - Moderate (Conversational adaptation)</option>
                      <option value={4}>4 - Creative (Reorder and adapt questions)</option>
                      <option value={5}>5 - Highly Creative (Generate follow-up questions)</option>
                    </select>
                  </div>
                  
                  <div className="mt-3 p-3 bg-gray-800/50 rounded border-l-2 border-indigo-500">
                    <p className="text-xs text-gray-300">
                      💡 <strong>Advanced Template:</strong> Creates an interactive survey bot that adapts its questioning style based on your creativity rate and automatically extracts questions from your uploaded documents.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <FileUpload onFileChange={handleFileChange} initialFiles={config.files} />
            {errors.files && <p className="mt-1 text-sm text-red-400">{errors.files}</p>}

            <div>
              <label htmlFor="collection_name" className="block text-sm font-medium text-gray-300 mb-2">
                Collection Name
                <span className="text-xs text-red-400 ml-2">*</span>
              </label>
              <input
                id="collection_name"
                type="text"
                name="collection_name"
                value={config.collection_name}
                onChange={handleChange}
                className="w-full px-4 py-3 text-white bg-gray-700/70 border border-gray-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g., customer-feedback-2024"
                required
              />
              <p className="mt-1 text-xs text-gray-400">
                Required: Unique name for your knowledge base collection in the database.
              </p>
              {errors.collection_name && <p className="mt-1 text-sm text-red-400">{errors.collection_name}</p>}
            </div>

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
                className={`w-full py-3 px-6 rounded-lg font-medium flex items-center justify-center space-x-2 transition-all ${
                  isLoading ? 'bg-indigo-700' : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700'
                } active:scale-[0.98]`}
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>
                    <span>Saving...</span>
                  </div>
                ) : (
                  <>
                    <span>Create Survey Bot</span>
                    <FaRobot className="text-sm" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SurveyConfigPage;
