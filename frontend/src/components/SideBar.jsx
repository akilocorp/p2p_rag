import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { FiMessageSquare, FiPlus, FiSettings, FiLogOut } from 'react-icons/fi';

const ChatSidebar = ({ sessions = [], configId }) => {
  const { chatId: activeChatId } = useParams();

  const menuItems = [
    {
      icon: <FiMessageSquare className="w-5 h-5" />,
      text: 'Chat History',
      link: `/chat/${configId}`,
      active: activeChatId === undefined
    },
    {
      icon: <FiPlus className="w-5 h-5" />,
      text: 'New Chat',
      link: `/chat/${configId}`,
      active: false
    },
    {
      icon: <FiSettings className="w-5 h-5" />,
      text: 'Settings',
      link: `/settings/${configId}`,
      active: false
    }
  ];

  return (
    <>
      <aside className="w-1/4 md:w-64 bg-gray-800 text-white transition-all duration-300 fixed h-full overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-xl font-bold">ChatBot</h1>
            <FiLogOut className="w-6 h-6 cursor-pointer hover:text-red-500" />
          </div>

          <nav className="space-y-1">
            {menuItems.map((item, index) => (
              <Link
                key={index}
                to={item.link}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors duration-200 ${
                  item.active
                    ? 'bg-indigo-600'
                    : 'hover:bg-gray-700'
                }`}
              >
                {item.icon}
                <span className="text-sm font-medium">{item.text}</span>
              </Link>
            ))}
          </nav>

          <div className="mt-8">
            <h2 className="px-4 text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">
              Recent Chats
            </h2>
            <div className="space-y-1">
              {sessions.length > 0 ? (
                sessions.map((session) => (
                  <Link
                    key={session.session_id}
                    to={`/chat/${configId}/${session.session_id}`}
                    className={`flex items-center px-4 py-3 rounded-lg transition-colors duration-200 ${
                      activeChatId === session.session_id ? 'bg-indigo-600' : 'hover:bg-gray-700'
                    }`}
                  >
                    <span className="flex-1 text-sm truncate">{session.title}</span>
                    <span className="ml-2 text-xs text-gray-400">
                      {new Date(session.timestamp).toLocaleDateString()}
                    </span>
                  </Link>
                ))
              ) : (
                <div className="px-4 py-3 text-gray-400">
                  No recent chats yet
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default ChatSidebar;