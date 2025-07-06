import React from 'react';

const ChatMessage = ({ message }) => {
  const { sender, text } = message;
  const isUser = sender === 'user';

  return (
    <div className={`flex items-start ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`px-4 py-2 rounded-lg max-w-lg ${isUser ? 'bg-indigo-600' : 'bg-gray-700'}`}>
        <p className="text-white">{text}</p>
      </div>
    </div>
  );
};

export default ChatMessage;
