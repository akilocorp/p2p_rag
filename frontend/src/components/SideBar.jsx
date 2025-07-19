import React from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import apiClient from '../api/apiClient';
import { 
  FiMessageSquare, 
  FiPlus, 
  FiSettings, 
  FiClock,
  FiChevronRight,
  FiChevronLeft,
  FiLoader,
  FiUser,
  FiLogOut
} from 'react-icons/fi';
import { RiRobot2Line } from 'react-icons/ri';

export const ChatSidebar = ({ 
  sessions = [], 
  sessionsLoading = false,
  userInfo = null,
  userInfoLoaded = false,
  configId, 
  isCollapsed, 
  onClose, 
  onToggle,
  onNewChat 
}) => {
  const { chatId: activeChatId } = useParams();
  const navigate = useNavigate();

  const handleNewChatClick = (e) => {
    if (onNewChat) {
      e.preventDefault();
      onNewChat();
      setTimeout(() => {
        window.location.href = `/chat/${configId}`;
      }, 0);
    }
  };

  const handleLogout = async () => {
    try {
      await apiClient.post('/auth/logout');
      localStorage.removeItem('jwtToken');
      localStorage.removeItem('refreshToken');
      navigate('/login');
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  const menuItems = [
    {
      icon: <FiPlus className="w-5 h-5" />,
      text: 'New Chat',
      link: `/chat/${configId}`,
      active: activeChatId === undefined,
      onClick: handleNewChatClick
    },
    {
      icon: <FiChevronLeft className="w-5 h-5" />,
      text: 'Configs',
      link: `/config_list`,
      active: false
    },
  ];

  return (
    <aside className={`bg-gray-800/50 backdrop-blur-lg border-r border-gray-700/30 text-white h-full fixed z-[50] transition-all duration-300 overflow-y-auto ${
      isCollapsed ? 'w-20' : 'w-72'
    }`}>
      {/* Mobile close button */}
      <button 
        className="absolute right-10 top-0 -mr-10 mt-4 p-2 rounded-full bg-gray-800/50 text-gray-400 hover:text-gray-300 transition-colors md:hidden"
        onClick={onClose}
      >
        <FiChevronLeft className="w-5 h-5" />
      </button>
      
      {/* Desktop toggle button */}
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
              onClick={item.onClick}
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
              {sessionsLoading ? (
                <div className="flex items-center justify-center p-6">
                  <div className="flex flex-col items-center space-y-3">
                    <FiLoader className="animate-spin text-2xl text-indigo-400" />
                    <p className="text-gray-500 text-sm">Loading recent chats...</p>
                  </div>
                </div>
              ) : sessions.length > 0 ? (
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

        {/* User Profile */}
        <div className="mt-auto pt-4 border-t border-gray-700/50">
          {userInfoLoaded && (
            userInfo ? (
              <div className="space-y-2">
                <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3 px-2'} py-3 rounded-lg hover:bg-gray-700/30 cursor-pointer transition-colors`}>
                  <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center">
                    <FiUser className="text-indigo-400" />
                  </div>
                  {!isCollapsed && (
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{userInfo.username}</p>
                      <p className="text-xs text-gray-500 truncate">{userInfo.email || 'User Account'}</p>
                    </div>
                  )}
                </div>
                {!isCollapsed && (
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center space-x-3 px-2 py-2 rounded-lg hover:bg-red-900/30 text-gray-400 hover:text-red-400 transition-colors"
                  >
                    <FiLogOut className="text-sm" />
                    <span className="text-sm">Logout</span>
                  </button>
                )}
              </div>
            ) : (
              <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3 px-2'} py-3 rounded-lg hover:bg-gray-700/30 cursor-pointer transition-colors`}>
                <div className="w-8 h-8 rounded-full bg-gray-500/10 flex items-center justify-center">
                  <FiUser className="text-gray-400" />
                </div>
                {!isCollapsed && (
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-400 truncate">Guest User</p>
                    <p className="text-xs text-gray-500 truncate">Not logged in</p>
                  </div>
                )}
              </div>
            )
          )}
        </div>
      </div>
    </aside>
  );
};