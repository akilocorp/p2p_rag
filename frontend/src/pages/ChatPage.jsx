import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../api/apiClient';
import { marked } from 'marked';
import { FiSend, FiLoader, FiAlertTriangle, FiChevronRight } from 'react-icons/fi';
import { RiRobot2Line, RiUser3Line } from 'react-icons/ri';
import { FaSpinner } from 'react-icons/fa';
import { ChatSidebar } from '../components/SideBar';

const ChatMessage = ({ message }) => {
  const { sender, text, isTyping } = message;
  const isUser = sender === 'user';

  const createMarkup = (markdownText) => {
    const rawMarkup = marked.parse(markdownText || '');
    return { __html: rawMarkup };
  };

  return (
    <div className={`flex gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
          <RiRobot2Line className="text-indigo-400 text-xl" />
        </div>
      )}
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
      {isUser && (
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
          <RiUser3Line className="text-indigo-400 text-xl" />
        </div>
      )}
    </div>
  );
};

const ChatPage = () => {
  const { configId, chatId } = useParams();
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
  const [isInitializing, setIsInitializing] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const handleNewChat = () => {
    setIsInitializing(true);
    setMessages([]);
    setInput('');
    setError(null);
    setTimeout(() => setIsInitializing(false), 300);
  };

  useEffect(() => {
    const fetchConfigDetails = async () => {
      if (!configId) {
        setError("Invalid configuration selected");
        setIsInitializing(false);
        return;
      }

      try {
        const response = await apiClient.get(`/config/${configId}`);
        setConfig(response.data.config);
      } catch (error) {
        console.error("Failed to fetch config:", error);
        setError("Failed to load chatbot configuration");
      } finally {
        setIsInitializing(false);
      }
    };
    fetchConfigDetails();
  }, [configId]);

  useEffect(() => {
    const fetchChatHistory = async () => {
      if (!chatId) return;
      
      setIsInitializing(true);
      try {
        const response = await apiClient.get(`/history/${chatId}`);
        const formattedMessages = response.data.history.map(item => ({
          sender: item.type === 'human' ? 'user' : 'ai',
          text: item.data?.content || ''
        }));
        setMessages(formattedMessages);
      } catch (error) {
        console.error("Failed to fetch history:", error);
        setError("Failed to load chat history");
      } finally {
        setIsInitializing(false);
      }
    };
    fetchChatHistory();
  }, [chatId]);

  useEffect(() => {
    const fetchSessions = async () => {
      if (!configId) return;
      setSessionsLoading(true);
      try {
        const response = await apiClient.get(`/chat/list/${configId}`);
        setSessions(response.data.sessions);
      } catch (error) {
        console.error("Failed to fetch sessions:", error);
      } finally {
        setSessionsLoading(false);
      }
    };
    fetchSessions();
  }, [configId, messages]);

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const response = await apiClient.get('/auth/me');
        setUserInfo(response.data);
      } catch (error) {
        console.error('Failed to fetch user info:', error);
      } finally {
        setUserInfoLoaded(true);
      }
    };
    fetchUserInfo();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isLoading || !configId) return;

    const userMessage = { sender: 'user', text: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const targetChatId = chatId || crypto.randomUUID();

      setMessages(prev => [...prev, { sender: 'ai', isTyping: true }]);

      const response = await apiClient.post(`/chat/${configId}/${targetChatId}`, {
        input: userMessage.text,
      });

      if (!chatId) {
        navigate(`/chat/${configId}/${targetChatId}`, { replace: true });
      }

      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          sender: 'ai',
          text: response.data.response
        };
        return updated;
      });

    } catch (error) {
      console.error("Chat error:", error);
      setMessages(messages);
      setInput(userMessage.text);
      setError("Failed to send message. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-6 text-center">
        <div className="p-4 bg-red-900/50 rounded-xl border border-red-700/50 max-w-md">
          <FiAlertTriangle className="mx-auto text-red-400 text-3xl mb-3" />
          <h2 className="text-xl font-medium text-white mb-2">Error</h2>
          <p className="text-gray-300 mb-4">{error}</p>
          <button
            onClick={() => navigate('/config_list')}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white"
          >
            Back to Configurations
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-900">
      {/* Sidebar */}
      <div className="hidden md:block">
        <ChatSidebar 
          sessions={sessions} 
          sessionsLoading={sessionsLoading}
          userInfo={userInfo}
          userInfoLoaded={userInfoLoaded}
          configId={configId} 
          isCollapsed={isSidebarCollapsed}
          onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onClose={() => setShowSidebar(false)}
          onNewChat={handleNewChat}
        />
      </div>

      {/* Mobile sidebar overlay */}
      {showSidebar && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden">
          <div className="absolute left-0 top-0 h-full">
            <ChatSidebar 
              sessions={sessions} 
              sessionsLoading={sessionsLoading}
              userInfo={userInfo}
              userInfoLoaded={userInfoLoaded}
              configId={configId} 
              isCollapsed={false}
              onClose={() => setShowSidebar(false)}
              onNewChat={handleNewChat}
            />
          </div>
        </div>
      )}

      {/* Main content with loading overlay */}
      <div className={`relative flex-1 flex flex-col w-full transition-all duration-300 ${
        isSidebarCollapsed ? 'md:ml-20' : 'md:ml-72'
      }`}>
        {/* Loading overlay - positioned within chat area */}
        {isInitializing && (
          <div className="absolute inset-0 z-10 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center">
            <div className="flex flex-col items-center">
              <FaSpinner className="animate-spin text-3xl text-indigo-400 mb-4" />
              <p className="text-gray-400">Loading chat...</p>
            </div>
          </div>
        )}

        <header className="p-4 bg-gray-900 border-b border-gray-800 z-0">
          <div className="container mx-auto flex items-center justify-between">
            <button 
              className="md:hidden p-2 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-400"
              onClick={() => setShowSidebar(true)}
            >
              <FiChevronRight className="text-xl" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 z-0">
          <div className="container mx-auto max-w-4xl space-y-6">
            {messages.length === 0 && !isLoading && !isInitializing && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4 py-16 sm:py-20">
                <div className="mb-6 flex flex-col items-center">
                  <RiRobot2Line className="text-6xl text-indigo-500 mb-3 animate-bounce" />
                  <h2 className='text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-500 bg-clip-text text-transparent'>
                    Hey! I'm {config?.bot_name || 'AI Assistant'}
                  </h2>
                  <p className="text-xs text-gray-400 mt-1 bg-gray-800 px-2 py-1 rounded-full">
                    {config?.model_name || 'AI Model'}
                  </p>
                </div>
                <h2 className="text-2xl font-bold bg-gray-500 bg-clip-text text-transparent">
                  How can I help you today?
                </h2>
              </div>
            )}

            {messages.map((msg, index) => (
              <ChatMessage key={index} message={msg} />
            ))}

            {isLoading && messages[messages.length - 1]?.sender !== 'ai' && (
              <ChatMessage message={{ sender: 'ai', isTyping: true }} />
            )}

            <div ref={messagesEndRef} />
          </div>
        </main>

        <footer className="p-4 bg-gray-900 border-t border-gray-800 z-0">
          <div className="container mx-auto max-w-4xl">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                className="flex-1 px-5 py-3 bg-gray-800 border border-gray-700 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white placeholder-gray-500"
                placeholder="Type your message..."
                disabled={isLoading || isInitializing}
              />
              <button
                onClick={handleSend}
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
            <p className="text-xs text-gray-500 mt-2 text-center">
              {config?.is_public ? 'Public chat' : 'Private chat'} • Powered by {config?.model_name || 'AI'}
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default ChatPage;