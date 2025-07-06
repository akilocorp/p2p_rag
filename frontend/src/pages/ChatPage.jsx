import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../api/apiClient'; // Assuming you have a configured axios instance
import { formToJSON } from 'axios';

// A simple component to render each chat message
const ChatMessage = ({ message }) => {
  const { sender, text } = message;
  const isUser = sender === 'user';

  return (
    <div className={`flex items-start gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-sm">AI</div>
      )}
      <div className={`px-4 py-2 rounded-lg max-w-lg shadow-md ${isUser ? 'bg-indigo-600' : 'bg-gray-700'}`}>
        <p className="text-white whitespace-pre-wrap">{text}</p>
      </div>
    </div>
  );
};


const ChatPage = () => {
  const { configId, chatId } = useParams(); // Get configId from URL
  const navigate = useNavigate();
  
  // Generate a unique ID for this chat session on component mount
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [config, setConfig] = useState(null);
  // const [vectorStore, setVectorStore] = useState(null); // To store the bot's config
   // To store the bot's config
  const messagesEndRef = useRef(null);

  // Effect to fetch the configuration details (like bot name)
  useEffect(() => {
    const fetchConfigDetails = async () => {
      if (!configId) return;
      try {
        // You'll need an endpoint to fetch a single config by its ID
        const response = await apiClient.get(`/config/${configId}`);
        setConfig(response.data.config);
      } catch (error) {
        console.error("Failed to fetch config details:", error);
        alert("Could not load chatbot configuration. Redirecting...");
        navigate('/configs');
      }
    };
    fetchConfigDetails();
  }, [configId, navigate]);

  // Effect to scroll to the bottom of the chat on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (input.trim() && !isLoading) {
      const userMessage = { sender: 'user', text: input };
      setMessages(prev => [...prev, userMessage]);
      setInput('');
      setIsLoading(true);


      try {
        let currentChatId=chatId
        // Send the message to your backend API
         if (!chatId){
          currentChatId = crypto.randomUUID();
          navigate(`/chat/${configId}/${currentChatId}`, { replace: true });
         }

        const response = await apiClient.post(`/chat/${configId}/${chatId}`, {
          input: input,
          config_id: configId,
          chat_id: chatId,
          temperature:config.temperature,
          model_name:config.model_name
           // Send the session ID
        });

        // Add the AI's response to the chat
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
