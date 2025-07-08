import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom'; // Assuming you use React Router
import apiClient from '../api/apiClient';

const EmailVerificationPage = () => {
  const [message, setMessage] = useState('Verifying your email, please wait...');
  const [isError, setIsError] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const verifyEmail = async () => {
      // Get token from the URL query string
      const query = new URLSearchParams(location.search);
      const token = query.get('token');

      if (!token) {
        setMessage('Verification token not found. Please use the link sent to your email.');
        setIsError(true);
        return;
      }

      try {
        // API call to your backend to verify the token
        const response = await apiClient.post('/auth/verify-email', { token });

        setMessage(response.data.message || 'Email verified successfully! You can now log in.');
        setIsError(false);

        // Redirect to login page after a few seconds
        setTimeout(() => {
          navigate('/login'); // Adjust the route as needed
        }, 5000);

      } catch (error) {
        setIsError(true);
        if (error.response) {
          setMessage(error.response.data.message || 'Verification failed. The link may be invalid or expired.');
        } else {
          setMessage('An error occurred during verification. Please try again later.');
        }
      }
    };

    verifyEmail();
  }, [location, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
      <div className="w-full max-w-md p-8 text-center bg-gray-800 rounded-lg shadow-lg">
        <h1 className={`text-2xl font-bold ${isError ? 'text-red-500' : 'text-green-400'}`}>
          Email Verification
        </h1>
        <p className="mt-4 text-gray-300">{message}</p>
        {!isError && (
          <p className="mt-4 text-sm text-gray-400">
            You will be redirected to the login page shortly.
          </p>
        )}
      </div>
    </div>
  );
};

export default EmailVerificationPage;