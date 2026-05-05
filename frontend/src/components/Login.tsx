'use client';
import { useState } from 'react';
import { authApi, setToken } from '@/lib/api-client';
import type { AuthUser } from '@/types';

interface LoginProps {
  onLogin: (user: AuthUser) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!username) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.login(username, password);
      setToken(res.token);
      const name = res.username
        .replace(/[._]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
      onLogin({
        id: res.user_id,
        username: res.username,
        name: name || res.username,
        role: res.role as 'admin' | 'user',
        token: res.token,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (preset: { username: string; password: string }) => {
    setUsername(preset.username);
    setPassword(preset.password);
  };

  return (
    <div className="login">
      <div className="login__card">
        <div className="login__brand">
          <div className="login__brand-mark">T</div>
          <div className="login__brand-name">Tixley</div>
        </div>
        <h1>Welcome back</h1>
        <p className="login__sub">Sign in to manage events or book tickets.</p>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="field">
            <label>Username</label>
            <input
              className="input"
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              className="input"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {error && (
            <div style={{ color: 'var(--danger)', fontSize: 12.5 }}>{error}</div>
          )}
          <button
            type="submit"
            className="btn btn--primary btn--lg btn--block"
            style={{ marginTop: 4 }}
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="login__quick">
          <div className="login__quick-title">Demo accounts</div>
          <div className="login__quick-row">
            <button
              type="button"
              onClick={() => quickLogin({ username: 'admin', password: 'password' })}
            >
              <strong>Admin</strong>
              <span>admin</span>
            </button>
            <button
              type="button"
              onClick={() => quickLogin({ username: 'alex', password: 'password' })}
            >
              <strong>Customer</strong>
              <span>alex</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
