import React from 'react';
import { Link, useParams } from 'react-router-dom';

const ChatSidebar = ({ sessions, configId }) => {
  const { chatId: activeChatId } = useParams(); // Get the currently active chat ID

  return (
    <aside className="w-1/4 bg-gray-800 p-4 flex flex-col">
      <h2 className="text-lg font-semibold text-white mb-4">Chat History</h2>
      
      {/* Link to start a new chat */}
      <Link
        to={`/chat/${configId}`}
        className="w-full mb-4 px-4 py-2 text-center font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
      >
        + New Chat
      </Link>
      
      <div className="flex-1 overflow-y-auto">
        <ul className="space-y-2">
          {sessions.map((session) => (
            <li key={session.session_id}>
              <Link
                to={`/chat/${configId}/${session.session_id}`}
                className={`block p-2 rounded-md truncate ${
                  session.session_id === activeChatId
                    ? 'bg-indigo-500 text-white' // Active chat style
                    : 'text-gray-300 hover:bg-gray-700' // Inactive chat style
                }`}
              >
                {session.title}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
};

export default ChatSidebar;