import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpineer';

// The FileUpload component remains the same
const FileUpload = ({ onFileChange, initialFiles }) => {
  const [files, setFiles] = useState(initialFiles || []);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setFiles(initialFiles || []);
  }, [initialFiles]);

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
      <label className="block text-sm font-medium text-gray-300">Upload Files for RAG</label>
      <div
        className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-600 border-dashed rounded-md cursor-pointer hover:border-indigo-500"
        onClick={() => fileInputRef.current.click()}
      >
        <div className="space-y-1 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-500" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="flex text-sm text-gray-400">
            <p className="pl-1">or drag and drop</p>
          </div>
          <p className="text-xs text-gray-500">TXT, PDF, DOCX, MD up to 10MB</p>
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
          <h4 className="text-sm font-medium text-gray-300">Uploaded files:</h4>
          <ul className="mt-2 space-y-2">
            {files.map((file, index) => (
              <li key={index} className="flex items-center justify-between p-2 bg-gray-700 rounded-md">
                <span className="text-sm text-white truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveFile(file.name)}
                  className="text-red-400 hover:text-red-600"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};


const ConfigPage = () => {
  const navigate = useNavigate();
  const [promptMode, setPromptMode] = useState('instructions');
  const [config, setConfig] = useState({
    bot_name: '',
    model_name: 'gpt-3.5-turbo',
    instructions: '',
    prompt_template: '',
    temperature: 0.7,
    rag_files: [],
    collection_name: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({}); // ---> 1. Add error state

  const handleChange = (e) => {
    const { name, value } = e.target;
    setConfig(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (files) => {
    setConfig(prev => ({ ...prev, rag_files: files }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({}); // ---> 2. Clear previous errors on a new submission

    const formData = new FormData();
    config.rag_files.forEach(file => {
      formData.append('files', file);
    });

    const configToSend = { ...config };
    delete configToSend.rag_files;

    if (promptMode === 'instructions') {
      delete configToSend.prompt_template;
    } else {
      delete configToSend.instructions;
    }

    formData.append('config', JSON.stringify(configToSend));

    try {
      const token = localStorage.getItem('jwtToken');
      if (!token) {
        setErrors({ form: "Authentication token not found. Please log in again." }); // ---> 3. Use setErrors
        setIsLoading(false); // Stop loading if there's no token
        return;
      }
      
      const response = await axios.post('http://localhost:5000/api/config', formData, { headers: { 'Authorization': `Bearer ${token}` } });
      
      console.log('Configuration saved:', response.data);
      // On success, we navigate away, so an alert isn't strictly necessary
      navigate(`/chat/${response.data.data._id}`);

    } catch (error) {
        // ---> 4. Set errors in state for any kind of failure
        console.error('Config error:', error);
        if (error.response) {
            setErrors({ form: error.response.data.error || 'An unexpected server error occurred.' });
        } else if (error.request) {
            setErrors({ form: 'No response from server. Check your network connection.' });
        } else {
            setErrors({ form: 'An error occurred while setting up the request.' });
        }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
      <div className="w-full max-w-2xl p-8 space-y-8 bg-gray-800 rounded-lg shadow-2xl">
        <h1 className="text-4xl font-bold text-center text-indigo-400">Configure Your Chatbot</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* All input fields remain the same */}
          <div>
            <label htmlFor="bot_name" className="block text-sm font-medium text-gray-300">Chatbot Name</label>
            <input id="bot_name" type="text" name="bot_name" value={config.bot_name} onChange={handleChange} className="w-full px-4 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g., My AI Assistant" />
          </div>
          <div>
            <label htmlFor="model_name" className="block text-sm font-medium text-gray-300">LLM Model</label>
            <select id="model_name" name="model_name" value={config.model_name} onChange={handleChange} className="w-full px-4 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="deepseek-chat">Deepseek Chat</option>
              <option value="gpt-3.5-turbo">GPT-3.5</option>
              <option value="qwen-turbo">Qwen Turbo</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300">Prompt Method</label>
            <div className="mt-2 flex space-x-4">
              <label className="flex items-center">
                <input type="radio" name="promptMode" value="instructions" checked={promptMode === 'instructions'} onChange={(e) => setPromptMode(e.target.value)} className="form-radio h-4 w-4 text-indigo-600 bg-gray-700 border-gray-600 focus:ring-indigo-500"/>
                <span className="ml-2 text-white">Simple (Instructions)</span>
              </label>
              <label className="flex items-center">
                <input type="radio" name="promptMode" value="template" checked={promptMode === 'template'} onChange={(e) => setPromptMode(e.target.value)} className="form-radio h-4 w-4 text-indigo-600 bg-gray-700 border-gray-600 focus:ring-indigo-500"/>
                <span className="ml-2 text-white">Advanced (Full Template)</span>
              </label>
            </div>
          </div>

          {promptMode === 'instructions' ? (
            <div>
              <label htmlFor="instructions" className="block text-sm font-medium text-gray-300">Instructions</label>
              <textarea id="instructions" name="instructions" value={config.instructions} onChange={handleChange} rows="4" className="w-full px-4 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g., You are a helpful assistant. Respond in the style of a pirate."></textarea>
            </div>
          ) : (
            <div>
              <label htmlFor="prompt_template" className="block text-sm font-medium text-gray-300">Full Prompt Template</label>
              <textarea id="prompt_template" name="prompt_template" value={config.prompt_template} onChange={handleChange} rows="6" className="w-full px-4 py-2 mt-1 font-mono text-sm text-white bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g., You are a helpful assistant. Respond to: {{query}}"></textarea>
              <p className="text-xs text-gray-500 mt-1">Use context and question as placeholders.</p>
            </div>
          )}
          
          <div>
            <label htmlFor="temperature" className="block text-sm font-medium text-gray-300">Temperature: {config.temperature}</label>
            <input id="temperature" type="range" name="temperature" min="0" max="1" step="0.1" value={config.temperature} onChange={handleChange} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
          </div>
          <FileUpload onFileChange={handleFileChange} initialFiles={config.rag_files} />
          <div>
            <label htmlFor="collection_name" className="block text-sm font-medium text-gray-300">Collection Name</label>
            <input id="collection_name" type="text" name="collection_name" value={config.collection_name} onChange={handleChange} className="w-full px-4 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g., project-docs" />
          </div>

           {/* ---> 5. Display the form error */}
           {errors.form && <div className="text-center p-2 text-red-400">{errors.form}</div>}


          <button type="submit" className="w-full py-3 mt-4 font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50" disabled={isLoading}>
            {isLoading ? <LoadingSpinner /> : 'Save Configuration & Start Chat'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ConfigPage;