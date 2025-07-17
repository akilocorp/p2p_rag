import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../api/apiClient';
import { marked } from 'marked';
import { FiSend, FiArrowLeft, FiLoader, FiAlertTriangle, FiChevronRight } from 'react-icons/fi';
import { RiRobot2Line, RiUser3Line } from 'react-icons/ri';
import { FaSpinner } from 'react-icons/fa';
import ChatSidebar from '../components/SideBar';

const ChatMessage = ({ message }) => {
  const { sender, text, isTyping } = message;
  const isUser = sender === 'user';
  const isAI = sender === 'ai';

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
        ) : isAI ? (
          <div
            className="prose prose-invert max-w-none text-gray-100"
            dangerouslySetInnerHTML={createMarkup(text)}
          />
        ) : (
          <p className="text-white whitespace-pre-wrap">{text}</p>
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
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    // Ensure we have a valid configId
    if (!configId || typeof configId !== 'string') {
      setError("Invalid configuration selected");
      return;
    }

    const fetchConfigDetails = async () => {
      try {
        const response = await apiClient.get(`/config/${configId}`);
        setConfig(response.data.config);
      } catch (error) {
        console.error("Failed to fetch config:", error);
        setError("Failed to load chatbot configuration");
      }
    };
    fetchConfigDetails();
  }, [configId]);

  useEffect(() => {
    const fetchChatHistory = async () => {
      if (chatId) {
        setIsLoading(true);
        try {
          const response = await apiClient.get(`/history/${chatId}`);
          const formattedMessages = response.data.history.map(item => ({
            sender: item.type === 'human' ? 'user' : 'ai',
            text: item.data ? item.data.content : ''
          }));
          setMessages(formattedMessages);
        } catch (error) {
          console.error("Failed to fetch history:", error);
          setError("Failed to load chat history");
        } finally {
          setIsLoading(false);
        }
      }
    };
    fetchChatHistory();
  }, [chatId]);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const response = await apiClient.get(`/chat/list/${configId}`);
        setSessions(response.data.sessions);
      } catch (error) {
        console.error("Failed to fetch sessions:", error);
      }
    };
    
    if (configId) {
      fetchSessions();
    }
  }, [configId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = { sender: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    try {
      let currentChatId = chatId;
      if (!currentChatId) {
        currentChatId = crypto.randomUUID();
        navigate(`/chat/${configId}/${currentChatId}`, { replace: true });
      }

      setMessages(prev => [...prev, { sender: 'ai', text: '', isTyping: true }]);

      const response = await apiClient.post(`/chat/${configId}/${currentChatId}`, {
        input: currentInput,
      });

      setMessages(prev => [...prev.slice(0, -1), {
        sender: 'ai',
        text: response.data.response
      }]);

      // Refresh sessions after new message
      const sessionsResponse = await apiClient.get(`/chat/list/${configId}`);
      setSessions(sessionsResponse.data.sessions);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev.slice(0, -1), {
        sender: 'ai',
        text: "Sorry, I encountered an error. Please try again."
      }]);
      setError("Message failed to send");
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

  if (!config) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="flex flex-col items-center">
          <FaSpinner className="animate-spin text-3xl text-indigo-400 mb-4" />
          <p className="text-gray-400">Loading chatbot...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-900">
      {/* Sidebar (desktop & mobile overlay) */}
      <div className="hidden md:block">
        <ChatSidebar 
          sessions={sessions} 
          configId={configId} 
          isCollapsed={isSidebarCollapsed}
          onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
      </div>
      {showSidebar && (
        <div className="fixed inset-0 z-50 bg-black/40 md:hidden">
          <div className="absolute left-0 top-0 h-full">
            <ChatSidebar 
              sessions={sessions} 
              configId={configId} 
              isCollapsed={false}
              onClose={() => setShowSidebar(false)}
            />
          </div>
        </div>
      )}

      {/* Main Chat Layout */}
      <div className={`flex-1 flex flex-col w-full transition-all duration-300 ${
        isSidebarCollapsed ? 'md:ml-20' : 'md:ml-72'
      }`}>
        <header className="p-4 bg-gray-900 backdrop-blur-lg border-b border-gray-900">
          <div className="container mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button className="md:hidden  p-2 rounded-full bg-gray-800/50 hover:bg-gray-700/50 text-gray-400 hover:text-gray-300 transition-colors" onClick={() => setShowSidebar(true)}>
                <FiChevronRight className="text-xl" />
              </button>
              
            </div>
            {/* <div className="text-center">
              <h1 className="text-xl font-bold text-indigo-400">
                {config.bot_name}
              </h1>
              <p className="text-xs text-gray-400">{config.model_name}</p>
            </div> */}
            
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="container mx-auto max-w-4xl space-y-6">
            {messages.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4 py-16 sm:py-20">
              <div className="mb-6 flex flex-col items-center">
                <RiRobot2Line className="text-6xl text-indigo-500 mb-3 animate-bounce" style={{ animationDuration: '2s' }} />
                <h2 className='text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-500 bg-clip-text text-transparent'>
                  Hey! I'm {config.bot_name}
                </h2>
                <p className="text-xs text-gray-400 mt-1 bg-gray-800 px-2 py-1 rounded-full">
                  {config.model_name}
                </p>
              </div>
              
              <h2 className="text-2xl font-bold bg-gray-500 bg-clip-text text-transparent ">
                How can I help you today?
              </h2>
              <p className="text-xs text-gray-500 mt-2 text-center">
                Ask me anything about {config.bot_name}'s knowledge base or start a conversation.
              </p>
              
             
            </div>
            )}
            {messages.map((msg, index) => (
              <ChatMessage key={index} message={msg} />
            ))}
            {isLoading && messages[messages.length - 1]?.sender !== 'ai' && (
              <ChatMessage message={{ sender: 'ai', text: '', isTyping: true }} />
            )}
            <div ref={messagesEndRef} />
          </div>
        </main>

        <footer className="p-4 bg-gray-900 backdrop-blur-lg border-t border-gray-700/50">
          <div className="container mx-auto max-w-4xl">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                className="flex-1 px-5 py-3 bg-gray-700/70 border border-gray-600/50 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white placeholder-gray-500"
                placeholder="Message..."
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className={`p-3 rounded-full ${
                  isLoading || !input.trim()
                    ? 'bg-gray-700 text-gray-500'
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700'
                } transition-all active:scale-95`}
              >
                {isLoading ? <FiLoader className="animate-spin" /> : <FiSend />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">
              {config.is_public ? 'Public chat • ' : 'Private chat • '} Powered by {config.model_name}
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default ChatPage;