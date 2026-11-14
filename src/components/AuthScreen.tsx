import React, { useState } from 'react';
import { useAuth } from '../store/AuthContext';

export default function AuthScreen() {
  const { signIn } = useAuth();
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const message = await signIn(passcode);
    setSubmitting(false);
    if (message) setError(message);
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1 className="auth-title">HoloRhythm Chord Chart Builder</h1>
        <p className="auth-subtitle">Enter the passcode to continue</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <input
            type="password"
            className="auth-input"
            placeholder="Passcode"
            value={passcode}
            onChange={e => setPasscode(e.target.value)}
            autoComplete="current-password"
            autoFocus
            required
          />

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="btn btn-primary auth-submit" disabled={submitting}>
            {submitting ? 'Checking…' : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  );
}
