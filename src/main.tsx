import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider, useAuth } from './store/AuthContext';
import { AppProvider } from './store/AppContext';
import AuthScreen from './components/AuthScreen';
import App from './App';
import './styles.css';

function AuthGate() {
  const { signedIn, loading } = useAuth();

  if (loading) {
    return <div className="auth-loading">Loading…</div>;
  }

  if (!signedIn) {
    return <AuthScreen />;
  }

  return (
    <AppProvider>
      <App />
    </AppProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  </React.StrictMode>
);
