import { FiChevronRight, FiLoader, FiSend } from 'react-icons/fi';
import React, { useEffect, useRef, useState } from 'react';
import { RiRobot2Line, RiUser3Line } from 'react-icons/ri';
import { useNavigate, useParams } from 'react-router-dom';
import ChatSidebar from '../components/SideBar.jsx';
import InteractiveSurveyQuestion from '../components/InteractiveSurveyQuestion.jsx';
import { FaSpinner } from 'react-icons/fa';
import apiClient from '../api/apiClient';
import { marked } from 'marked';

const ChatMessage = ({ message, onInteractiveSubmit }) => {
  const { sender, text, isTyping, questionData } = message;
  const isUser = sender === 'user';

  const createMarkup = (markdownText) => {
    const rawMarkup = marked.parse(markdownText || '');
    return { __html: rawMarkup };
  };

  // Check if this is an interactive question from AI
  const isInteractiveQuestion = !isUser && questionData && typeof questionData === 'object';

  return (
    <div className={`flex gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
          <RiRobot2Line className="text-indigo-400 text-xl" />
        </div>
      )}
      
      {isInteractiveQuestion ? (
        <InteractiveSurveyQuestion 
          questionData={questionData} 
          onSubmit={onInteractiveSubmit}
        />
      ) : (
        <div className={`max-w-[80%] rounded-2xl p-4 ${
          isUser
            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
            : 'bg-gray-800/50 backdrop-blur-sm border border-gray-700/50'
        }`}>
          {isTyping ? (
            <div className="flex space-x-2">
              <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          ) : (
            <div
              className="prose prose-invert max-w-none text-gray-100"
              dangerouslySetInnerHTML={createMarkup(text)}
            />
          )}
        </div>
      )}
      
      {isUser && (
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
          <RiUser3Line className="text-indigo-400 text-xl" />
        </div>
      )}
    </div>
  );
};

const SurveyChatPage = () => {
  const { config_id, chat_id } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [config, setConfig] = useState(null);
  const [error, setError] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [userInfo, setUserInfo] = useState(null);
  const [userInfoLoaded, setUserInfoLoaded] = useState(false);
  const [currentChatId, setCurrentChatId] = useState(chat_id);
  const [isInitializing, setIsInitializing] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const isAuthenticated = !!localStorage.getItem('jwtToken');

  // Sync currentChatId with URL parameter
  useEffect(() => {
    setCurrentChatId(chat_id);
  }, [chat_id]);

  useEffect(() => {
    const initializeOrLoadChat = async () => {
      setIsInitializing(true);
      // Clear messages when switching chats
      setMessages([]);
      setError(null);
      
      try {
        // === SURVEY CONFIG LOADING ===
        let configResponse;
        
        // The backend survey_config endpoint handles both public and private access
        // Try with authentication if available, otherwise try without auth
        try {
          if (isAuthenticated) {
            // Try with authentication first (works for both public and private surveys)
            configResponse = await apiClient.get(`/survey_config/${config_id}`);
          } else {
            // Try without authentication (works for public surveys only)
            const axios = (await import('axios')).default;
            configResponse = await axios.get(`/api/survey_config/${config_id}`);
          }
        } catch (error) {
          // If the first attempt fails and user is authenticated, try without auth
          // This handles the case where an authenticated user tries to access a public survey
          // but there might be some auth issue
          if (isAuthenticated && (error.response?.status === 401 || error.response?.status === 403)) {
            try {
              const axios = (await import('axios')).default;
              configResponse = await axios.get(`/api/survey_config/${config_id}`);
            } catch (fallbackError) {
              throw fallbackError;
            }
          } else {
            throw error;
          }
        }
        
        setConfig(configResponse.data.config);
        
        // === SURVEY CHAT INITIALIZATION/LOADING ===
        const token = localStorage.getItem('jwtToken');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        if (currentChatId) { // Load existing chat history
          const historyResponse = await apiClient.get(`/history/${currentChatId}`, { headers });
          const formattedMessages = historyResponse.data.history.map(msg => ({
            text: msg.data.content,
            sender: msg.type === 'human' ? 'user' : 'ai',
          }));
          setMessages(formattedMessages);
        } else if (!currentChatId) { // Initialize new survey chat
          const response = await apiClient.post(`/survey-chat/${config_id}/init`, {}, { headers });
          console.log('🔍 Init response:', response.data);

          const initialMessage = response.data.response;
          const newChatId = response.data.chat_id;
          console.log('🔍 Parsed data:', { initialMessage, newChatId });

          if (initialMessage && newChatId) {
            const newMessage = { text: initialMessage, sender: 'ai' };
            console.log('🔍 Setting message:', newMessage);
            setMessages([newMessage]);
            setCurrentChatId(newChatId);
            console.log('🔍 State updated, navigating...');
            // Update URL without reloading the page
            navigate(`/survey-chat/${config_id}/${newChatId}`, { replace: true });
          } else {
            console.error('Failed to initialize chat: Backend response is missing expected keys.', {
              'received_data': response.data,
              'expected_keys': 'response and chat_id'
            });
            setError('Failed to start the survey. The server response was invalid.');
          }
        }
      } catch (err) {
        console.error('Survey chat initialization error:', err);
        
        // Handle specific error types
        if (err.response?.status === 404) {
          setError('Survey configuration not found. Please check the URL or contact the survey creator.');
        } else if (err.response?.status === 401 || err.response?.status === 403) {
          setError('You do not have permission to access this survey. Please log in or contact the survey creator.');
        } else if (err.code === 'NETWORK_ERROR' || !err.response) {
          setError('Network error. Please check your connection and try again.');
        } else {
          setError('Failed to load the survey configuration. Please try refreshing the page.');
        }
      } finally {
        setIsInitializing(false);
      }
    };

    const fetchUserInfo = async () => {
      if (isAuthenticated) {
        try {
          const response = await apiClient.get('/auth/me');
          setUserInfo(response.data);
        } catch (error) {
          console.error('Failed to fetch user info:', error);
        } finally {
          setUserInfoLoaded(true);
        }
      }
    };

    initializeOrLoadChat();
    fetchUserInfo();

    inputRef.current?.focus();
  }, [config_id, currentChatId, navigate]);

  useEffect(() => {
    // Only fetch sessions if user is authenticated
    if (!isAuthenticated) {
      setSessionsLoading(false);
      return;
    }

    const fetchSessions = async () => {
      if (!config_id) return;
      setSessionsLoading(true);
      try {
        // Use survey-specific endpoint for sessions
        const response = await apiClient.get(`/survey-chat/list/${config_id}`);
        setSessions(response.data.sessions || []);
      } catch (error) {
        console.error("Failed to fetch survey sessions:", error);
        setSessions([]);
      } finally {
        setSessionsLoading(false);
      }
    };
    fetchSessions();
  }, [config_id, messages, isAuthenticated]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading || isInitializing) return;

    const userMessage = { text: input, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('jwtToken');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

      const response = await apiClient.post(`/survey-chat/${config_id}/${currentChatId}`, 
        { input: currentInput }, 
        { headers }
      );

      // Try to parse the response as JSON for interactive questions
      let aiMessage = { text: response.data.response, sender: 'ai' };
      try {
        const jsonData = JSON.parse(response.data.response);
        if (jsonData.type && jsonData.question) {
          // This is an interactive question
          aiMessage = {
            text: '', // No text for interactive questions
            sender: 'ai',
            questionData: jsonData
          };
        }
      } catch (e) {
        // Not JSON, treat as regular text message
      }

      setMessages(prev => [...prev, aiMessage]);
    } catch (err) {
      console.error('Send message error:', err);
      setError('Failed to get a response. Please check your connection.');
      setMessages(prev => prev.slice(0, -1)); // Remove user message on error
    } finally {
      setIsLoading(false);
    }
  };

  const handleInteractiveSubmit = async (answer) => {
    if (isLoading || isInitializing) return;

    // Add user's answer to chat
    const userMessage = { text: answer, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('jwtToken');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

      const response = await apiClient.post(`/survey-chat/${config_id}/${currentChatId}`, 
        { input: answer }, 
        { headers }
      );

      // Try to parse the response as JSON for interactive questions
      let aiMessage = { text: response.data.response, sender: 'ai' };
      try {
        const jsonData = JSON.parse(response.data.response);
        if (jsonData.type && jsonData.question) {
          // This is an interactive question
          aiMessage = {
            text: '', // No text for interactive questions
            sender: 'ai',
            questionData: jsonData
          };
        }
      } catch (e) {
        // Not JSON, treat as regular text message
      }

      setMessages(prev => [...prev, aiMessage]);
    } catch (err) {
      console.error('Interactive submit error:', err);
      setError('Failed to get a response. Please check your connection.');
      setMessages(prev => prev.slice(0, -1)); // Remove user message on error
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-900 text-white font-sans">
      {/* Only show sidebar for authenticated users */}
      {isAuthenticated && (
        <ChatSidebar
          config={config}
          configId={config_id}
          sessions={sessions}
          userInfo={userInfo}
          userInfoLoaded={userInfoLoaded}
          isAuthenticated={isAuthenticated}
          currentChatId={currentChatId}
          onNewChat={() => navigate(`/survey-chat/${config_id}`)}
          isCollapsed={isSidebarCollapsed}
          onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onClose={() => setShowSidebar(false)}
          sessionsLoading={sessionsLoading}
          chatType="survey"
        />
      )}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${
        isAuthenticated && !isSidebarCollapsed ? 'md:ml-72' : 'md:ml-0'
      }`}>
        {isInitializing && (
          <div className="absolute inset-0 z-10 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center">
            <div className="flex flex-col items-center">
              <FaSpinner className="animate-spin text-3xl text-indigo-400 mb-4" />
              <p className="text-gray-400">Starting survey...</p>
            </div>
          </div>
        )}

        <header className="p-4 bg-gray-900 ">
          <div className="container mx-auto flex items-center justify-between">
            {/* Only show mobile sidebar toggle for authenticated users */}
            {isAuthenticated && (
              <button 
                disabled={isLoading || isInitializing} 
                className="md:hidden p-2 rounded-full bg-indigo-600 text-white disabled:bg-gray-500 transition-colors"
                onClick={() => setShowSidebar(true)}
              >
                <FiChevronRight className="text-xl" />
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 z-0">
          <div className="container mx-auto max-w-4xl space-y-6">
            {messages.map((msg, index) => (
              <ChatMessage key={index} message={msg} onInteractiveSubmit={handleInteractiveSubmit} />
            ))}

            {isLoading && (
              <ChatMessage message={{ sender: 'ai', isTyping: true }} />
            )}

            <div ref={messagesEndRef} />
          </div>
        </main>

        <footer className="p-4 bg-gray-900 border-t border-gray-800 z-0">
          <div className="container mx-auto max-w-4xl">
            {error && <p className="text-red-400 text-sm text-center mb-2">{error}</p>}
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                className="flex-1 px-5 py-3 bg-gray-800 border border-gray-700 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white placeholder-gray-500"
                placeholder="Type your answer..."
                disabled={isLoading || isInitializing}
              />
              <button
                onClick={handleSendMessage}
                disabled={isLoading || !input.trim() || isInitializing}
                className={`p-3 rounded-full ${
                  isLoading || !input.trim() || isInitializing
                    ? 'bg-gray-700 text-gray-500'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                } transition-all`}
              >
                {isLoading ? <FiLoader className="animate-spin" /> : <FiSend />}
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default SurveyChatPage;
