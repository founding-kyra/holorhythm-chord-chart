import React from 'react';
import { useApp } from '../store/AppContext';

export default function ThemeToggle() {
  const { state, dispatch } = useApp();
  const isDark = state.theme === 'dark';

  return (
    <button
      className="theme-toggle"
      onClick={() => dispatch({ type: 'SET_THEME', theme: isDark ? 'light' : 'dark' })}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? '\u2600' : '\u263E'}
    </button>
  );
}
