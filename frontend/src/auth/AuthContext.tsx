import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';

type User = {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  created_at?: string;
  points: number;
  avatar_url?: string | null;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  login: (login: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  logout: () => Promise<void>;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
};

const AuthContext = createContext<AuthContextType | null>(null);
const API_BASE = (process.env.REACT_APP_API_URL || 'http://localhost:5050').replace(/\/$/, '');

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loggingOutRef = useRef(false);

  const login = async (loginValue: string, password: string) => {
    try {
      loggingOutRef.current = false;
      setLoading(true);

      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: loginValue, password }),
        credentials: 'include',
        cache: 'no-store',
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data?.ok) {
        await refresh();
        setLoading(false);
        return { ok: true };
      }

      setLoading(false);
      const message = data?.errors?.[0]?.message || data?.message || 'Nie udało się zalogować';
      return { ok: false, message };
    } catch (e) {
      console.error('Login request failed:', e);
      setLoading(false);
      return { ok: false, message: 'Błąd połączenia z serwerem' };
    }
  };



const refresh = async () => {
  if (loggingOutRef.current) {
    setUser(null);
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      credentials: 'include',
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-store' },
    });

    const isJson = res.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await res.json() : null;

    if (res.ok && data?.ok && data.user) {
      setUser({
        ...data.user,
        points: data.user.points ?? 0,
      });
    } else {
      setUser(null);
    }
  } catch (e) {
    console.error('Auth refresh failed:', e);
    setUser(null);
  }
};

const logout = async () => {

  loggingOutRef.current = true;
  setUser(null);
  setLoading(false);

  try {
    await fetch(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    console.error('Logout error', e);
  } finally {

    if (typeof window !== 'undefined') {
      window.location.replace('/');
    }
  }
};

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await refresh();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}