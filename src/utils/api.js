export const API = 'https://david-api-la1t.onrender.com';

const TOKEN_KEY = 'tramed_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function isAuthenticated() {
  return !!getToken();
}

// Every analytics/warehouse call in the app should go through this instead
// of plain fetch() — it attaches the bearer token, and if the API comes
// back 401 (token missing, expired, or the backend restarted with a fresh
// random JWT signing key — see app.jwt-secret) it clears the stale token
// and bounces to /login instead of leaving the caller stuck on a
// perpetual "Loading…" or a cryptic HTTP 401 error message.
export async function authFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    ...options.headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${API}${path}`, { ...options, headers });
  if (res.status === 401) {
    clearToken();
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }
  return res;
}
