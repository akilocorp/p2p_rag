import React, { useState, useEffect } from 'react';
import apiClient from '../api/apiClient';
import { FaUser, FaEnvelope, FaCalendar } from 'react-icons/fa';

const UserInfo = () => {
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const response = await apiClient.get('/auth/me');
        setUserInfo(response.data);
      } catch (error) {
        console.error('Error fetching user info:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserInfo();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center">
        <div className="animate-spin h-4 w-4 border-2 border-indigo-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!userInfo) {
    return null;
  }

  return (
    <div className="flex items-center text-sm text-gray-400">
      <FaUser className="mr-2 text-indigo-400" />
      <span>{userInfo.username}</span>
    </div>
  );
};

export default UserInfo;
