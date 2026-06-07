import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

export const AuthContext = createContext(null);

/**
 * Backend API base URL.
 * Sourced from VITE_API_URL environment variable — set in .env (dev) or
 * .env.production (prod). Falls back to localhost for convenience during
 * local development if the variable is missing.
 */
export const API_BASE_URL =
  (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api').trim();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('taskflow_token') || null);
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('taskflow_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Restore and verify session in the background
  useEffect(() => {
    if (token) {
      axios
        .get(`${API_BASE_URL}/auth/user/`, {
          headers: { Authorization: `Token ${token}` },
        })
        .then((res) => {
          setUser(res.data);
          localStorage.setItem('taskflow_user', JSON.stringify(res.data));
          setLoading(false);
        })
        .catch((err) => {
          console.error('Failed to restore user session', err);
          localStorage.removeItem('taskflow_token');
          localStorage.removeItem('taskflow_user');
          setToken(null);
          setUser(null);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (username, password) => {
    setError(null);
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/auth/login/`, {
        username,
        password,
      });
      const { token: userToken, user: userData } = res.data;
      localStorage.setItem('taskflow_token', userToken);
      localStorage.setItem('taskflow_user', JSON.stringify(userData));
      setToken(userToken);
      setUser(userData);
      setLoading(false);
      return true;
    } catch (err) {
      setLoading(false);
      const errMsg =
        err.response?.data?.non_field_errors?.[0] ||
        err.response?.data?.detail ||
        'Invalid username or password';
      setError(errMsg);
      throw new Error(errMsg);
    }
  };

  const register = async (username, email, password) => {
    setError(null);
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/auth/register/`, {
        username,
        email,
        password,
      });
      const { token: userToken, user: userData } = res.data;
      localStorage.setItem('taskflow_token', userToken);
      localStorage.setItem('taskflow_user', JSON.stringify(userData));
      setToken(userToken);
      setUser(userData);
      setLoading(false);
      return true;
    } catch (err) {
      setLoading(false);
      let errMsg = 'Registration failed. Please try again.';
      if (err.response?.data) {
        const data = err.response.data;
        const firstKey = Object.keys(data)[0];
        const val = data[firstKey];
        errMsg = Array.isArray(val) ? `${firstKey}: ${val[0]}` : `${firstKey}: ${val}`;
      }
      setError(errMsg);
      throw new Error(errMsg);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      if (token) {
        await axios.post(
          `${API_BASE_URL}/auth/logout/`,
          {},
          { headers: { Authorization: `Token ${token}` } }
        );
      }
    } catch (err) {
      console.error('Logout API error', err);
    } finally {
      localStorage.removeItem('taskflow_token');
      localStorage.removeItem('taskflow_user');
      localStorage.removeItem('taskflow_cached_tasks');
      localStorage.removeItem('taskflow_cached_total');
      localStorage.removeItem('taskflow_cached_stats');
      setToken(null);
      setUser(null);
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        error,
        login,
        register,
        logout,
        isAuthenticated: !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
