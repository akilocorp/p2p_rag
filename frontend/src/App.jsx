// import { useState } from 'react';
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link,  Navigate } from 'react-router-dom'; // <--- Make sure Navigate is here!
import './App.css'; // Assuming you still have some base CSS or will use Tailwind


// Import your page components
import RegisterPage from './pages/RegistrationPage';
import LoginPage from './pages/LoginPage';
import ConfigPage from './pages/ConfigPage';
import ChatPage from './pages/ChatPage';
import SurveyChatPage from './pages/SurveyChatPage';
import ConfigList from './pages/ConfigList';
import EmailVerificationPage from './pages/EmailVerification';
import SideBar from './components/SideBar'; // Import the SideBar component
import EditConfigPage from './pages/EditConfigPage';
import SurveyConfigPage from './pages/SurveyConfigPage';

// Import the ProtectedRoute component
import ProtectedRoute from './components/ProtectedRoute';
import PublicChatRoute from './components/PublicChatRoute';
import PublicSurveyChatRoute from './components/PublicSurveyChatRoute'; 

function App() {
  // You might manage authentication state here or in a context
  // For now, ProtectedRoute directly checks localStorage.

  return (
    <Router>
      <div className="min-h-screen bg-gray-900 text-white">
        <Routes>
          {/* Public Routes - No authentication required */}
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/verify-email" element={<EmailVerificationPage />} />
          <Route element={<PublicChatRoute />}>
            <Route path="/chat/:configId/:chatId?" element={<ChatPage />} />
          </Route>
          <Route element={<PublicSurveyChatRoute />}>
            <Route path="/survey-chat/:config_id" element={<SurveyChatPage />} />
            <Route path="/survey-chat/:config_id/:chat_id" element={<SurveyChatPage />} />
          </Route>
          {/* Protected Routes - Requires authentication */}
          <Route element={<ProtectedRoute />}>
            {/* Root route - Config List */}
            <Route path="/" element={
              <div className="flex flex-1">
                <div className="flex-1">
                  <Routes>
                    <Route index element={<ConfigList />} />
                  </Routes>
                </div>
              </div>
            } />
            {}
            <Route path="/config" element={<ConfigPage />} />
            <Route path="/survey-config" element={<SurveyConfigPage />} />
            <Route path="/edit-config" element={<EditConfigPage />} />
            <Route path="/config_list" element={<ConfigList />} />

          </Route>
        </Routes>
      </div>
    </Router>
  );
}

export default App;
