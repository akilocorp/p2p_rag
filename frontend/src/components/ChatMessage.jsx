import React from 'react';
import { RiRobot2Line, RiUser3Line } from 'react-icons/ri';
import { FiAlertTriangle } from 'react-icons/fi';

const ChatMessage = ({ message }) => {
  const { sender, text, isError, isTyping } = message;
  const isUser = sender === 'user';
  const isAI = sender === 'ai';

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {/* Avatar/Icon */}
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center mt-1">
          {isError ? (
            <FiAlertTriangle className="text-red-400 text-sm" />
          ) : (
            <RiRobot2Line className="text-indigo-400 text-sm" />
          )}
        </div>
      )}

      {/* Message Bubble */}
      <div 
        className={`relative max-w-[85%] rounded-2xl p-4 ${
          isUser 
            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white' 
            : isError
              ? 'bg-red-900/20 border border-red-700/30 text-red-100'
              : 'bg-gray-800/50 backdrop-blur-sm border border-gray-700/30'
        } shadow-sm`}
      >
        {/* Typing indicator */}
        {isTyping ? (
          <div className="flex space-x-1.5">
            <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        ) : (
          <p className="text-white whitespace-pre-wrap">{text}</p>
        )}

        {/* Decorative corner for AI messages */}
        {isAI && !isError && (
          <div className="absolute -left-1.5 top-3 w-3 h-3 bg-gray-800/50 backdrop-blur-sm border-l border-t border-gray-700/30 transform rotate-45"></div>
        )}
      </div>

      {/* User avatar appears after message */}
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center mt-1">
          <RiUser3Line className="text-indigo-400 text-sm" />
        </div>
      )}
    </div>
  );
};

export default ChatMessage;