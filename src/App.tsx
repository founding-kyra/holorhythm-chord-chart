import React, { useEffect, useState } from 'react';
import { useApp } from './store/AppContext';
import { useAuth } from './store/AuthContext';
import ChartEditor from './components/ChartEditor';
import ChartLibrary from './components/ChartLibrary';
import LessonSheetComposer from './components/LessonSheetComposer';
import ThemeToggle from './components/ThemeToggle';
import { MenuIcon, EditorIcon, LibraryIcon, SheetIcon, MoonIcon, SunIcon, SignOutIcon, CheckIcon } from './components/Icons';

type View = 'editor' | 'library' | 'composer';
const VIEWS: { id: View; label: string; Icon: typeof EditorIcon }[] = [
  { id: 'editor', label: 'Editor', Icon: EditorIcon },
  { id: 'library', label: 'Library', Icon: LibraryIcon },
  { id: 'composer', label: 'Lesson Sheet', Icon: SheetIcon },
];

export default function App() {
  const { state, dispatch, retryHydrate } = useApp();
  const { signOut } = useAuth();
  const { activeView } = state;
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  // Auto-hide the confirmation toast
  const toastId = state.toast?.id;
  useEffect(() => {
    if (toastId === undefined) return;
    const t = setTimeout(() => dispatch({ type: 'HIDE_TOAST' }), 2400);
    return () => clearTimeout(t);
  }, [toastId, dispatch]);

  const goTo = (view: View) => {
    dispatch({ type: 'SET_ACTIVE_VIEW', view });
    setDrawerOpen(false);
  };
  const currentLabel = VIEWS.find(v => v.id === activeView)?.label ?? '';
  const isDark = state.theme === 'dark';

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
      {state.saveError && (
        <div className="save-banner" role="alert">
          <span>
            {state.saveError.conflict
              ? "This library was changed on another device, so your latest edits here weren't saved. Reload to get the newest version (edits made in this tab since then will be lost)."
              : `Couldn't save your changes: ${state.saveError.message} It will retry on your next edit.`}
          </span>
          {state.saveError.conflict && (
            <button className="btn btn-sm" onClick={() => window.location.reload()}>Reload</button>
          )}
        </div>
      )}
      <header className="app-header">
        <button className="icon-btn menu-btn" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
          <MenuIcon />
        </button>
        <h1 className="app-title">
          <span className="title-full">HoloRhythm Chord Chart Builder</span>
          <span className="title-short">{currentLabel}</span>
        </h1>
        {/* On phones the editor puts its New / Save icon buttons here */}
        <div className="header-actions" id="header-actions" />
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
        <div className="header-desktop">
          <ThemeToggle />
          <button className="btn btn-sm" onClick={signOut}>Sign out</button>
        </div>
      </header>

      {drawerOpen && (
        <div className="drawer-overlay" onClick={() => setDrawerOpen(false)}>
          <aside className="drawer" onClick={e => e.stopPropagation()} aria-label="Menu">
            <div className="drawer-heading">HoloRhythm<br />Chord Chart Builder</div>
            {VIEWS.map(({ id, label, Icon }) => (
              <button key={id} className={`drawer-item ${activeView === id ? 'active' : ''}`} onClick={() => goTo(id)}>
                <Icon /> {label}
              </button>
            ))}
            <div className="drawer-spacer" />
            <button className="drawer-item" onClick={() => dispatch({ type: 'SET_THEME', theme: isDark ? 'light' : 'dark' })}>
              {isDark ? <SunIcon /> : <MoonIcon />} {isDark ? 'Light mode' : 'Dark mode'}
            </button>
            <button className="drawer-item" onClick={() => { setDrawerOpen(false); signOut(); }}>
              <SignOutIcon /> Sign out
            </button>
          </aside>
        </div>
      )}

      {state.toast && (
        <div className="toast" role="status" key={state.toast.id}>
          <CheckIcon size={18} /> {state.toast.message}
        </div>
      )}

      <main className="app-main">
        {activeView === 'editor' && <ChartEditor />}
        {activeView === 'library' && <ChartLibrary />}
        {activeView === 'composer' && <LessonSheetComposer />}
      </main>
    </div>
  );
}
