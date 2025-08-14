import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../api/apiClient';
import { FaVideo, FaPlay, FaDownload, FaClock, FaExclamationTriangle, FaCheckCircle, FaSpinner } from 'react-icons/fa';

const VideoGenerationPage = () => {
  const { configId } = useParams();
  const navigate = useNavigate();
  
  const [config, setConfig] = useState(null);
  const [query, setQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Load config on component mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await apiClient.get(`/video_config/${configId}`);
        setConfig(response.data.config);
      } catch (error) {
        console.error('Error loading config:', error);
        setError('Failed to load video generation configuration');
      } finally {
        setLoading(false);
      }
    };

    if (configId) {
      loadConfig();
    }
  }, [configId]);

  const handleGenerateVideo = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsGenerating(true);
    setError('');
    setGenerationResult(null);

    try {
      const response = await apiClient.post(`/generate_video/${configId}`, {
        query: query.trim()
      });

      setGenerationResult(response.data);
    } catch (error) {
      console.error('Error generating video:', error);
      setError(error.response?.data?.message || 'An error occurred while generating the video');
      setGenerationResult(error.response?.data || null);
    } finally {
      setIsGenerating(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success':
        return <FaCheckCircle className="text-green-400" />;
      case 'failed':
        return <FaExclamationTriangle className="text-red-400" />;
      case 'timeout':
        return <FaClock className="text-yellow-400" />;
      default:
        return <FaSpinner className="text-blue-400 animate-spin" />;
    }
  };

  const getStatusMessage = (result) => {
    if (!result?.result) return '';
    
    const { status } = result.result;
    switch (status) {
      case 'success':
        return 'Video generated successfully!';
      case 'failed':
        return `Generation failed: ${result.result.reason || 'Unknown error'}`;
      case 'timeout':
        return 'Generation is taking longer than expected. Please check back later.';
      default:
        return 'Processing...';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <FaSpinner className="animate-spin text-2xl text-purple-400" />
          <span className="text-lg">Loading configuration...</span>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <FaExclamationTriangle className="text-4xl text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Configuration Not Found</h2>
          <p className="text-gray-400 mb-4">The video generation configuration could not be loaded.</p>
          <button
            onClick={() => navigate('/config_list')}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Back to Configurations
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400">
                <FaVideo className="text-2xl" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">{config.bot_name}</h1>
                <p className="text-gray-400">AI Video Generation</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/config_list')}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Back to List
            </button>
          </div>

          {/* Config Info */}
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Mode:</span>
                <span className="ml-2 text-white">{config.mode}</span>
              </div>
              <div>
                <span className="text-gray-400">Duration:</span>
                <span className="ml-2 text-white">{config.duration}s</span>
              </div>
              <div>
                <span className="text-gray-400">Guidance:</span>
                <span className="ml-2 text-white">{config.guidance_scale}</span>
              </div>
              <div>
                <span className="text-gray-400">Documents:</span>
                <span className="ml-2 text-white">{config.documents?.length || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Generation Form */}
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Generate Video</h2>
          
          <form onSubmit={handleGenerateVideo} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Describe what you want to see in the video
              </label>
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="e.g., Show the structure and function of mitochondria in a cell"
                required
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isGenerating || !query.trim()}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                {isGenerating ? (
                  <>
                    <FaSpinner className="animate-spin" />
                    <span>Generating Video...</span>
                  </>
                ) : (
                  <>
                    <FaPlay />
                    <span>Generate Video</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-8">
            <div className="flex items-center space-x-3">
              <FaExclamationTriangle className="text-red-400" />
              <p className="text-red-400">{error}</p>
            </div>
          </div>
        )}

        {/* Generation Result */}
        {generationResult && (
          <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
            <h2 className="text-xl font-semibold text-white mb-4">Generation Result</h2>
            
            {/* Status */}
            <div className="flex items-center space-x-3 mb-4">
              {getStatusIcon(generationResult.result?.status)}
              <span className="text-lg">{getStatusMessage(generationResult)}</span>
            </div>

            {/* Video Player */}
            {generationResult.result?.status === 'success' && generationResult.result?.video_url && (
              <div className="mb-6">
                <video
                  controls
                  className="w-full max-w-2xl mx-auto rounded-lg bg-black"
                  poster="/api/placeholder/800/450"
                >
                  <source src={generationResult.result.video_url} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
                
                <div className="flex justify-center mt-4">
                  <a
                    href={generationResult.result.video_url}
                    download
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                  >
                    <FaDownload />
                    <span>Download Video</span>
                  </a>
                </div>
              </div>
            )}

            {/* Generation Details */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-300 mb-2">Query</h3>
                <p className="text-sm text-gray-400 bg-gray-700/50 p-3 rounded-lg">
                  {generationResult.query}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-300 mb-2">Final Prompt</h3>
                <p className="text-sm text-gray-400 bg-gray-700/50 p-3 rounded-lg max-h-32 overflow-y-auto">
                  {generationResult.final_prompt}
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Context Documents:</span>
                  <span className="ml-2 text-white">{generationResult.context_docs_found}</span>
                </div>
                <div>
                  <span className="text-gray-400">Context Length:</span>
                  <span className="ml-2 text-white">{generationResult.context_length} chars</span>
                </div>
                {generationResult.result?.task_id && (
                  <div>
                    <span className="text-gray-400">Task ID:</span>
                    <span className="ml-2 text-white font-mono text-xs">{generationResult.result.task_id}</span>
                  </div>
                )}
              </div>

              {/* Video Parameters */}
              <div>
                <h3 className="text-sm font-medium text-gray-300 mb-2">Video Parameters</h3>
                <div className="bg-gray-700/50 p-3 rounded-lg">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Mode:</span>
                      <span className="ml-2 text-white">{generationResult.video_params?.mode}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Duration:</span>
                      <span className="ml-2 text-white">{generationResult.video_params?.duration}s</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Guidance:</span>
                      <span className="ml-2 text-white">{generationResult.video_params?.guidance_scale}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Negative:</span>
                      <span className="ml-2 text-white">{generationResult.video_params?.negative_prompt || 'None'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoGenerationPage;
