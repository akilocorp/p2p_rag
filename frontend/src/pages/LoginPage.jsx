import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpineer'; // ---> 1. Import the spinner

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false); // ---> 2. isLoading state is already here
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();

  const validate = () => {
    const newErrors = {};
    // Note: You may not need strict password validation on a login form,
    // but it is included here as it was in your original code.
    if (!password) {
      newErrors.password = 'Password is required.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({}); // Clear previous errors

    if (!validate()) {
      return;
    }

    setIsLoading(true); // ---> 3. Set loading to true
    try {
      const response = await axios.post('http://localhost:5000/api/auth/login', {
        username,
        password,
      });

      const { access_token, refresh_token } = response.data;

      if (access_token) {
        localStorage.setItem('jwtToken', access_token);
        localStorage.setItem('refreshToken', refresh_token);
        console.log('Login successful! JWT stored:', access_token);
        navigate('/config_list');
      } else {
        setErrors({ form: 'Login failed: No authentication token received.' });
      }
    } catch (error) {
      // ---> 4. Set errors in state instead of using alert()
      console.error('Login error:', error);
      if (error.response) {
        setErrors({ form: error.response.data.error || 'Invalid username or password' });
      } else if (error.request) {
        setErrors({ form: 'No response from server. Please check your connection.' });
      } else {
        setErrors({ form: 'An unexpected error occurred.' });
      }
    } finally {
      setIsLoading(false); // ---> 5. Always set loading to false after the attempt
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
      <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold text-center text-indigo-400">Login</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="username-input" className="block text-sm font-medium text-gray-400">Username</label>
            <input
              id="username-input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>
          <div>
            <label htmlFor="password-input" className="block text-sm font-medium text-gray-400">Password</label>
            <input
              id="password-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              // ---> 6. Add conditional error styling
              className={`w-full px-3 py-2 mt-1 text-white bg-gray-700 border ${
                errors.password ? 'border-red-500' : 'border-gray-600'
              } rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500`}
              required
            />
            {/* ---> 7. Display password-specific errors */}
            {errors.password && <p className="mt-2 text-sm text-red-500">{errors.password}</p>}
          </div>

          {/* ---> 8. Display general form errors */}
          {errors.form && <p className="text-sm text-red-500 text-center">{errors.form}</p>}

          <button
            type="submit"
            // ---> 9. Add disabled styles
            className="w-full py-3 font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500 transition-transform transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading}
          >
            {/* ---> 10. Show spinner or text */}
            {isLoading ? <LoadingSpinner /> : 'Login'}
          </button>
        </form>
        <p className="text-sm text-center text-gray-400">
          Don't have an account?{' '}
          <Link to="/register" className="font-medium text-indigo-400 hover:underline">
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;