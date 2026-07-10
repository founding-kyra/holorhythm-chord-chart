import React from 'react';
import { useApp } from './store/AppContext';
import { useAuth } from './store/AuthContext';
import ChartEditor from './components/ChartEditor';
import ChartLibrary from './components/ChartLibrary';
import LessonSheetComposer from './components/LessonSheetComposer';
import ThemeToggle from './components/ThemeToggle';

export default function App() {
  const { state, dispatch, retryHydrate } = useApp();
  const { signOut } = useAuth();
  const { activeView } = state;

  if (state.isLoading) {
    return <div className="auth-loading">Loading your library…</div>;
  }

  if (state.loadError) {
    return (
      <div className="auth-loading auth-loading-error">
        <p>Couldn't load your library: {state.loadError}</p>
        <div className="auth-loading-actions">
          <button className="btn btn-primary" onClick={retryHydrate}>Retry</button>
          <button className="btn" onClick={signOut}>Sign out</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <h1 className="app-title">HoloRhythm Chord Chart Builder</h1>
        <nav className="app-nav">
          <button
            className={`nav-btn ${activeView === 'editor' ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'SET_ACTIVE_VIEW', view: 'editor' })}
          >
            Editor
          </button>
          <button
            className={`nav-btn ${activeView === 'library' ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'SET_ACTIVE_VIEW', view: 'library' })}
          >
            Library
          </button>
          <button
            className={`nav-btn ${activeView === 'composer' ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'SET_ACTIVE_VIEW', view: 'composer' })}
          >
            Lesson Sheet
          </button>
        </nav>
        <ThemeToggle />
        <button className="btn btn-sm" onClick={signOut}>Sign out</button>
      </header>

      <main className="app-main">
        {activeView === 'editor' && <ChartEditor />}
        {activeView === 'library' && <ChartLibrary />}
        {activeView === 'composer' && <LessonSheetComposer />}
      </main>
    </div>
  );
}
