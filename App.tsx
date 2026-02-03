
import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const auth = localStorage.getItem('cm_auth');
    if (auth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (success: boolean) => {
    if (success) {
      localStorage.setItem('cm_auth', 'true');
      setIsAuthenticated(true);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('cm_auth');
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return <Dashboard onLogout={handleLogout} />;
};

export default App;
