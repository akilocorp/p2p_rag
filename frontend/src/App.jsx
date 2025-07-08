// import { useState } from 'react';
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link,  Navigate } from 'react-router-dom'; // <--- Make sure Navigate is here!
import './App.css'; // Assuming you still have some base CSS or will use Tailwind


// Import your page components
import RegisterPage from './pages/RegistrationPage';
import LoginPage from './pages/LoginPage';
import ConfigPage from './pages/ConfigPage';
import ChatPage from './pages/ChatPage';
import ConfigList from './pages/ConfigList';
import EmailVerificationPage from './pages/EmailVerification';


// Import the ProtectedRoute component
import ProtectedRoute from './components/ProtectedRoute'; 

function App() {
  // You might manage authentication state here or in a context
  // For now, ProtectedRoute directly checks localStorage.

  return (
    <Router>
      {/* <nav>
        <ul>
          <li><Link to="/register">Register</Link></li>
          <li><Link to="/login">Login</Link></li>
          <li><Link to="/config">Config (Protected)</Link></li>
          <li><Link to="/chat">Chat (Protected)</Link></li>
        </ul>
      </nav> */}

      <Routes>
        {/* Public Routes */}
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/verify-email" element={<EmailVerificationPage />} /> {/* ---> 2. Add the public route */}
        

        {/* Protected Routes */}
        <Route path="/chat/:configId/:chatId?" element={<ChatPage />} />

        <Route element={<ProtectedRoute />}> {/* Use ProtectedRoute as a wrapper */}
        <Route path="/config_list" element={<ConfigList />} />

          <Route path="/config" element={<ConfigPage />} />

        </Route>

        {/* Optional: Redirect from root to login if no specific route */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Catch-all for 404 Not Found */}
        <Route path="*" element={<div>404 Not Found</div>} />
      </Routes>
    </Router>
  );
}

export default App;