import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/apiClient';
import { FaUser, FaEnvelope, FaLock, FaEye, FaEyeSlash, FaCheckCircle, FaArrowRight } from 'react-icons/fa';

const RegistrationPage = () => {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState({
    email: false,
    username: false,
    password: false
  });

  const validate = () => {
    const newErrors = {};
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      newErrors.email = 'Please enter a valid email address.';
    }

    // Password validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      newErrors.password = 'Password must be at least 8 characters with uppercase, lowercase, number, and special character.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setRegistrationSuccess(false);

    if (!validate()) return;

    setIsLoading(true);
    try {
      await apiClient.post('/auth/register', { email, username, password });
      setRegistrationSuccess(true);
    } catch (error) {
      console.error('Registration error:', error);
      if (error.response) {
        setErrors({ form: error.response.data.error || 'Registration failed. Please try again.' });
      } else if (error.request) {
        setErrors({ form: 'No response from server. Please check your connection.' });
      } else {
        setErrors({ form: 'An unexpected error occurred.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getPasswordStrength = (password) => {
    if (password.length >= 12 && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[@$!%*?&]/.test(password)) {
      return 'strong';
    }
    if (password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password)) {
      return 'medium';
    }
    return 'weak';
  };

  const LoadingSpinner = () => (
    <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent align-[-0.125em]"></div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        {registrationSuccess ? (
          <div className="bg-gray-800/50 backdrop-blur-lg rounded-2xl shadow-xl border border-gray-700/50 p-8 sm:p-10 text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <FaCheckCircle className="text-green-400 text-3xl" />
            </div>
            <h2 className="text-2xl font-bold text-green-400 mb-2">Registration Successful!</h2>
            <p className="text-gray-300 mb-6">
              We've sent a verification link to <span className="font-medium">{email}</span>. 
              Please check your inbox (and spam folder) to complete your registration.
            </p>
            <Link 
              to="/login" 
              className="inline-flex items-center text-indigo-400 hover:text-indigo-300 font-medium transition-colors duration-200"
            >
              Go to Login <FaArrowRight className="ml-1 text-sm" />
            </Link>
          </div>
        ) : (
          <div className="bg-gray-800/50 backdrop-blur-lg rounded-2xl shadow-xl border border-gray-700/50 p-8 sm:p-10 transition-all duration-300">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-500">
                Create Account
              </h1>
              <p className="mt-2 text-gray-400">Join us to get started</p>
            </div>

            {errors.form && (
              <div className="mb-6 p-3 bg-red-900/50 border border-red-700 rounded-lg text-sm transition-opacity duration-200">
                {errors.form}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                  Email
                </label>
                <div className={`relative transition-all duration-200 ${isFocused.email ? 'ring-2 ring-indigo-500/50' : ''} rounded-lg`}>
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaEnvelope className="text-gray-500" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setIsFocused({...isFocused, email: true})}
                    onBlur={() => setIsFocused({...isFocused, email: false})}
                    className={`w-full pl-10 pr-4 py-3 text-white bg-gray-700/70 border ${
                      errors.email ? 'border-red-500' : 'border-gray-600/50'
                    } rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500`}
                    placeholder="Enter your email"
                  />
                </div>
                {errors.email && (
                  <p className="mt-1 text-sm text-red-400 transition-all duration-200">
                    {errors.email}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-1">
                  Username
                </label>
                <div className={`relative transition-all duration-200 ${isFocused.username ? 'ring-2 ring-indigo-500/50' : ''} rounded-lg`}>
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaUser className="text-gray-500" />
                  </div>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onFocus={() => setIsFocused({...isFocused, username: true})}
                    onBlur={() => setIsFocused({...isFocused, username: false})}
                    className={`w-full pl-10 pr-4 py-3 text-white bg-gray-700/70 border ${
                      errors.username ? 'border-red-500' : 'border-gray-600/50'
                    } rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500`}
                    placeholder="Choose a username"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
                  Password
                </label>
                <div className={`relative transition-all duration-200 ${isFocused.password ? 'ring-2 ring-indigo-500/50' : ''} rounded-lg`}>
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaLock className="text-gray-500" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setIsFocused({...isFocused, password: true})}
                    onBlur={() => setIsFocused({...isFocused, password: false})}
                    className={`w-full pl-10 pr-12 py-3 text-white bg-gray-700/70 border ${
                      errors.password ? 'border-red-500' : 'border-gray-600/50'
                    } rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500`}
                    placeholder="Create a password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-indigo-400 transition-colors"
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
                {password && (
                  <div className="mt-2">
                    <div className="flex gap-1 h-1.5 mb-1">
                      {[...Array(3)].map((_, i) => (
                        <div 
                          key={i}
                          className={`flex-1 rounded-full ${
                            getPasswordStrength(password) === 'strong' && i <= 2 ? 'bg-green-500' :
                            getPasswordStrength(password) === 'medium' && i <= 1 ? 'bg-yellow-500' :
                            getPasswordStrength(password) === 'weak' && i === 0 ? 'bg-red-500' : 'bg-gray-600'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-gray-400">
                      Password strength: <span className={
                        getPasswordStrength(password) === 'strong' ? 'text-green-400' :
                        getPasswordStrength(password) === 'medium' ? 'text-yellow-400' : 'text-red-400'
                      }>
                        {getPasswordStrength(password)}
                      </span>
                    </p>
                  </div>
                )}
                {errors.password && (
                  <p className="mt-1 text-sm text-red-400 transition-all duration-200">
                    {errors.password}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-3 px-6 rounded-lg font-medium flex items-center justify-center space-x-2 transition-all duration-200 ${
                  isLoading ? 'bg-indigo-700' : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700'
                } active:scale-[0.98]`}
              >
                {isLoading ? (
                  <>
                    <LoadingSpinner />
                    <span>Creating account...</span>
                  </>
                ) : (
                  <>
                    <span>Register</span>
                    <FaArrowRight className="text-sm" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-gray-400">
              Already have an account?{' '}
              <Link 
                to="/login" 
                className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors duration-200"
              >
                Login here
              </Link>
            </div>
          </div>
        )}

        <div className="mt-8 text-center text-xs text-gray-500">
          <p>© {new Date().getFullYear()} Your Company. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};

export default RegistrationPage;