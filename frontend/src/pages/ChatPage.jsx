import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../api/apiClient';
import { marked } from 'marked';
import { FiSend, FiArrowLeft, FiLoader, FiAlertTriangle } from 'react-icons/fi';
import { RiRobot2Line, RiUser3Line } from 'react-icons/ri';
import { FaPlus, FaRobot, FaCog, FaSpinner } from 'react-icons/fa';
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
            <div className={`max-w-[80%] rounded-2xl p-4 ${isUser 
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white' 
                : 'bg-gray-800/50 backdrop-blur-sm border border-gray-700/50'}`}
            >
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
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
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
                        text: item.data.content
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
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        // Focus input on load
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

            // Add typing indicator
            setMessages(prev => [...prev, { sender: 'ai', text: '', isTyping: true }]);

            const response = await apiClient.post(`/chat/${configId}/${currentChatId}`, {
                input: currentInput,
            });

            // Remove typing indicator and add real response
            setMessages(prev => [...prev.slice(0, -1), { 
                sender: 'ai', 
                text: response.data.response 
            }]);

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
        <div className="flex flex-col h-screen bg-gradient-to-b from-gray-900 to-gray-800">
            <div className="flex-1 flex">
                <ChatSidebar configId={configId} />
                <div className="flex-1 flex flex-col">
                    <header className="p-4 bg-gray-800/50 backdrop-blur-lg border-b border-gray-700/50">
                <div className="container mx-auto flex items-center justify-between">
                    <button 
                        onClick={() => navigate('/config_list')} 
                        className="flex items-center text-gray-400 hover:text-white transition-colors"
                    >
                        <FiArrowLeft className="mr-2" />
                        <span className="hidden sm:inline">Back</span>
                    </button>
                    <div className="text-center">
                        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-500">
                            {config.bot_name}
                        </h1>
                        <p className="text-xs text-gray-400">{config.model_name}</p>
                    </div>
                    <div className="w-8"></div> {/* Spacer for balance */}
                </div>
            </header>
            
            <main className="flex-1 overflow-y-auto p-4 sm:p-6">
                <div className="container mx-auto max-w-4xl space-y-6">
                    {messages.length === 0 && !isLoading && (
                        <div className="flex flex-col items-center justify-center h-full text-center py-12">
                            <RiRobot2Line className="text-5xl text-indigo-400 mb-4" />
                            <h2 className="text-2xl font-bold text-white mb-2">How can I help you today?</h2>
                            <p className="text-gray-400 max-w-md">
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

            <footer className="p-4 bg-gray-800/50 backdrop-blur-lg border-t border-gray-700/50 ml-64">
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
                            className={`p-3 rounded-full ${isLoading || !input.trim() 
                                ? 'bg-gray-700 text-gray-500' 
                                : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700'
                            } transition-all active:scale-95`}
                        >
                            {isLoading ? <FiLoader className="animate-spin" /> : <FiSend />}
                        </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2 text-center">
                        {config.is_public ? 'Public chat • ' : 'Private chat • '}
                        Powered by {config.model_name}
                    </p>
                </div>
            </footer>
                </div>
            </div>
        </div>
    );
};

export default ChatPage;