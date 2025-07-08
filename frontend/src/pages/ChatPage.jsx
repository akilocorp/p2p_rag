import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../api/apiClient'; // Assuming you have a configured axios instance
import { marked } from 'marked'; // ✅ 1. Import the marked library

// To use this, you'll need to install marked:
// npm install marked
// or
// yarn add marked

// A component to render each chat message, now with Markdown support for AI responses
const ChatMessage = ({ message }) => {
    const { sender, text } = message;
    const isUser = sender === 'user';
    const isAI = sender === 'ai';

    // This function will convert the AI's markdown text to HTML
    const createMarkup = (markdownText) => {
        // Use marked.parse to convert markdown to HTML
        const rawMarkup = marked.parse(markdownText || '');
        // For production apps, you might want to sanitize this HTML
        // using a library like DOMPurify to prevent XSS attacks.
        return { __html: rawMarkup };
    };

    return (
        <div className={`flex items-start gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {isAI && (
                <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-sm flex-shrink-0">AI</div>
            )}
            <div className={`px-4 py-2 rounded-lg max-w-lg shadow-md ${isUser ? 'bg-indigo-600' : 'bg-gray-700'}`}>
                {isAI ? (
                    // ✅ 2. For AI messages, render the parsed HTML
                    // The 'prose' and 'prose-invert' classes from Tailwind Typography help style rendered HTML.
                    <div
                        className="prose prose-invert text-white"
                        dangerouslySetInnerHTML={createMarkup(text)}
                    />
                ) : (
                    // For user messages, continue to render plain text for security
                    <p className="text-white whitespace-pre-wrap">{text}</p>
                )}
            </div>
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
    const messagesEndRef = useRef(null);

    // Effect to fetch the configuration details
    useEffect(() => {
        const fetchConfigDetails = async () => {
            if (!configId) return;
            try {
                const response = await apiClient.get(`/config/${configId}`);
                setConfig(response.data.config);
            } catch (error) {
                console.error("Failed to fetch config details:", error);
                alert("Could not load chatbot configuration. Redirecting...");
                navigate('/config_list');
            }
        };
        fetchConfigDetails();
    }, [configId, navigate]);

    // Effect to fetch chat history
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
                    console.error("Failed to fetch chat history:", error);
                    navigate(`/chat/${configId}`);
                } finally {
                    setIsLoading(false);
                }
            } else {
                setMessages([]);
            }
        };
        fetchChatHistory();
    }, [chatId, configId, navigate]);

    // Effect to scroll to the bottom of the chat on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = async () => {
        if (input.trim() && !isLoading) {
            const userMessage = { sender: 'user', text: input };
            setMessages(prev => [...prev, userMessage]);
            const currentInput = input;
            setInput('');
            setIsLoading(true);

            try {
                let currentChatId = chatId;
                // If this is the first message of a new chat, generate an ID
                if (!currentChatId) {
                    currentChatId = crypto.randomUUID();
                    // Navigate to the new URL immediately so the backend has the correct chatId
                    navigate(`/chat/${configId}/${currentChatId}`, { replace: true });
                }

                // ✅ OPTIMIZATION: The POST request is now cleaner.
                // The backend gets configId and chatId from the URL params.
                const response = await apiClient.post(`/chat/${configId}/${currentChatId}`, {
                    input: currentInput,
                });

                const aiResponse = { sender: 'ai', text: response.data.response };
                setMessages(prev => [...prev, aiResponse]);

            } catch (error) {
                console.error("Error sending message:", error);
                const errorMessage = { sender: 'ai', text: "Sorry, I encountered an error. Please try again." };
                setMessages(prev => [...prev, errorMessage]);
            } finally {
                setIsLoading(false);
            }
        }
    };

    if (!config) {
        return <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">Loading Chatbot...</div>;
    }

    return (
        <div className="flex flex-col h-screen bg-gray-900 text-white">
            <header className="p-4 bg-gray-800 shadow-md flex items-center justify-between">
                <h1 className="text-xl font-bold text-indigo-400">{config.bot_name || 'Chat'}</h1>
                <button onClick={() => navigate('/config_list')} className="text-sm text-gray-400 hover:text-white">
                    &larr; Back to Configurations
                </button>
            </header>
            
            <main className="flex-1 p-4 overflow-y-auto">
                <div className="space-y-4">
                    {messages.map((msg, index) => (
                        <ChatMessage key={index} message={msg} />
                    ))}
                    {isLoading && <ChatMessage message={{ sender: 'ai', text: 'Typing...' }} />}
                    <div ref={messagesEndRef} />
                </div>
            </main>

            <footer className="p-4 bg-gray-800 border-t border-gray-700">
                <div className="flex items-center">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                        className="w-full px-4 py-2 text-white bg-gray-700 border border-gray-600 rounded-l-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Type your message..."
                        disabled={isLoading}
                    />
                    <button
                        onClick={handleSend}
                        className="px-6 py-2 font-semibold text-white bg-indigo-600 rounded-r-md hover:bg-indigo-700 disabled:opacity-50"
                        disabled={isLoading || !input.trim()}
                    >
                        Send
                    </button>
                </div>
            </footer>
        </div>
    );
};

export default ChatPage;
