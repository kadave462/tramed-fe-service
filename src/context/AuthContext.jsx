import { useState, useCallback } from 'react';
import { API, getToken, setToken, clearToken, isAuthenticated } from '../utils/api';
import { AuthContext } from './authContextObject';

export function AuthProvider({ children }) {
  const [authed, setAuthed] = useState(isAuthenticated());

  const login = useCallback(async (username, password) => {
    const res = await fetch(`${API}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const message = res.status === 429
        ? 'Too many failed attempts. Try again later.'
        : 'Invalid username or password';
      throw new Error(message);
    }
    const data = await res.json();
    setToken(data.token);
    setAuthed(true);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setAuthed(false);
  }, []);

  return (
    <AuthContext.Provider value={{ authed, login, logout, token: getToken() }}>
      {children}
    </AuthContext.Provider>
  );
}
