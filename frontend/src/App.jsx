import React from 'react';
import { useAuth } from './context/AuthContext';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';

function App() {
  const { isAuthenticated } = useAuth();

  return isAuthenticated ? <Dashboard /> : <Auth />;
}

export default App;
