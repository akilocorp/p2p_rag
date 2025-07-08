import React, { useState } from 'react';
import LoadingSpinner from '../components/LoadingSpineer';
import { Link, Navigate } from 'react-router-dom';
import apiClient from '../api/apiClient';

const RegistrationPage = ({ navigateTo }) => {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [registrationSuccess, setRegistrationSuccess] = useState(false); // New state
   const [isLoading, setIsLoading] = useState(false);

  const validate = () => {
    // ... (validation logic remains the same as before)
    const newErrors = {};

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      newErrors.email = 'Please enter a valid email address.';
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      newErrors.password =
        'Password must be at least 8 characters long and include one uppercase, one lowercase, one number, and one special character.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setRegistrationSuccess(false);

    if (!validate()) {
      return;
    }
    setIsLoading(true);
    try {
      // Assumes the backend will send the verification email
      await apiClient.post('/auth/register', {
        email,
        username,
        password,
      });

      // Set success state to true to show the verification message
      setRegistrationSuccess(true);
      

    } catch (error) {
      console.log(error);

      setIsLoading(false)
      console.error('Registration error:', error);
      if (error.response) {
        setErrors({ form: error.response.data.error || 'An error occurred during registration.' });
      } else if (error.request) {
        setErrors({ form: 'No response from server. Please check your connection.' });
      } else {
        setErrors({ form: 'An unexpected error occurred.' });
      }
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
      <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-lg shadow-lg">
        {registrationSuccess ? (
          <div className="text-center">
            <h1 className="text-2xl font-bold text-green-400">Registration Successful!</h1>
            <p className="mt-4 text-gray-300">
              We've sent a verification link to your email address. Please check your inbox (and spam folder) to complete your registration.
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-bold text-center text-indigo-400">Create an Account</h1>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Input fields for email, username, password remain the same... */}
              <div>
                <label className="block text-sm font-medium text-gray-400">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full px-3 py-2 mt-1 text-white bg-gray-700 border ${
                    errors.email ? 'border-red-500' : 'border-gray-600'
                  } rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                  required
                />
                {errors.email && <p className="mt-2 text-sm text-red-500">{errors.email}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full px-3 py-2 mt-1 text-white bg-gray-700 border ${
                    errors.password ? 'border-red-500' : 'border-gray-600'
                  } rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                  required
                />
                {errors.password && <p className="mt-2 text-sm text-red-500">{errors.password}</p>}
              </div>
              {errors.form && <p className="text-sm text-red-500 text-center">{errors.form}</p>}
              <button type="submit" className="w-full py-3 font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500" disabled={isLoading}>
                {isLoading ? <LoadingSpinner /> : 'Register'}
              </button>
            </form>
            <p className="text-sm text-center text-gray-400">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-indigo-400 hover:underline">
                Login here
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default RegistrationPage;