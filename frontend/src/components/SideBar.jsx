import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { 
  FiMessageSquare, 
  FiPlus, 
  FiSettings, 
  FiClock,
  FiChevronRight,
  FiChevronLeft
} from 'react-icons/fi';
import { RiRobot2Line } from 'react-icons/ri';

export const ChatSidebar = ({ sessions = [], configId, isCollapsed, onClose, onToggle }) => {
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
    },
    {
      icon: <FiChevronLeft className="w-5 h-5" />,
      text: 'Configs',
      link: `/config_list`,
      active: false
      // onClick={() => navigate('/config_list')}
    },
  ];

  return (
    <aside className={`bg-gray-800/50 backdrop-blur-lg border-r border-gray-700/30 text-white h-full fixed z-[50] transition-all duration-300 overflow-y-auto ${
      isCollapsed ? 'w-20' : 'w-72'
    }`}>
      {/* Mobile close button (only shown on mobile) */}
      <button 
        className="absolute right-10 top-0 -mr-10 mt-4 p-2 rounded-full bg-gray-800/50  text-gray-400 hover:text-gray-300 transition-colors md:hidden"
        onClick={onClose}
      >
        <FiChevronLeft className="w-5 h-5" />
      </button>
      
      {/* Desktop toggle button (only shown on desktop) */}
      <button 
        className="absolute right-10 top-0 -mr-10 mt-4 p-2 rounded-full bg-gray-800/50 hover:bg-gray-700/50 text-gray-400 hover:text-gray-300 transition-colors hidden md:block"
        onClick={onToggle}
      >
        {isCollapsed ? (
          <FiChevronRight className="w-5 h-5" />
        ) : (
          <FiChevronLeft className="w-5 h-5" />
        )}
      </button>

      <div className="p-4">
        {/* Header */}
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} mb-8`}>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <RiRobot2Line className="text-indigo-400 text-xl" />
            </div>
            {!isCollapsed && (
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-500">
                ChatBot AI
              </h1>
            )}
          </div>
        </div>

        {/* Main Navigation */}
        <nav className="space-y-2 mb-8">
          {menuItems.map((item, index) => (
            <Link
              key={index}
              to={item.link}
              className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3 px-4'} py-3 rounded-xl transition-all ${
                item.active
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                  : 'hover:bg-gray-700/50 text-gray-300'
              }`}
              title={isCollapsed ? item.text : ''}
            >
              <div className={`p-1 rounded-lg ${
                item.active ? 'bg-white/20' : 'bg-gray-700/50'
              }`}>
                {React.cloneElement(item.icon, {
                  className: `${item.icon.props.className} ${
                    item.active ? 'text-white' : 'text-gray-400'
                  }`
                })}
              </div>
              {!isCollapsed && (
                <span className="text-sm font-medium">{item.text}</span>
              )}
            </Link>
          ))}
        </nav>

        {/* Recent Chats Section */}
        {!isCollapsed && (
          <div className="mb-6">
            <div className="flex items-center justify-between px-2 mb-4">
              <h2 className="flex items-center text-xs font-semibold uppercase tracking-wider text-gray-400">
                <FiClock className="mr-2" />
                Recent Chats
              </h2>
              <span className="text-xs text-gray-500">
                {sessions.length} {sessions.length === 1 ? 'chat' : 'chats'}
              </span>
            </div>

            <div className="space-y-1">
              {sessions.length > 0 ? (
                sessions.map((session) => (
                  <Link
                    key={session.session_id}
                    to={`/chat/${configId}/${session.session_id}`}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
                      activeChatId === session.session_id 
                        ? 'bg-gray-700/70 border border-gray-600/50'
                        : 'hover:bg-gray-700/30'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${
                        activeChatId === session.session_id ? 'text-white' : 'text-gray-300'
                      }`}>
                        {session.title || "New Chat"}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(session.timestamp).toLocaleString('default', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <FiChevronRight className="text-gray-500" />
                  </Link>
                ))
              ) : (
                <div className="text-center p-4">
                  <p className="text-gray-500 text-sm">No recent conversations</p>
                  <Link 
                    to={`/chat/${configId}`} 
                    className="text-indigo-400 text-xs hover:underline mt-1 inline-block"
                  >
                    Start a new chat
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {/* User Profile (Optional) */}
        <div className="mt-auto pt-4 border-t border-gray-700/50">
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3 px-2'} py-3 rounded-lg hover:bg-gray-700/30 cursor-pointer transition-colors`}>
            <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center">
              <span className="text-xs font-medium text-indigo-400">U</span>
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">User Account</p>
                <p className="text-xs text-gray-500 truncate">Free Plan</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};

export default ChatSidebar;