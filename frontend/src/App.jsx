import React from 'react';
import { useAuth } from './context/AuthContext';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';

function App() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center space-y-4">
        <div className="relative flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-indigo-600"></div>
        </div>
        <p className="text-sm font-semibold text-slate-400 animate-pulse">Initializing TaskFlow...</p>
      </div>
    );
  }

  return isAuthenticated ? <Dashboard /> : <Auth />;
}

export default App;
