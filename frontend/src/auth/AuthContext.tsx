import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type User = {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  created_at?: string;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
};

const AuthContext = createContext<AuthContextType | null>(null);
const API_BASE = (process.env.REACT_APP_API_URL || 'http://localhost:5050').replace(/\/$/, '');

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok && data.ok) setUser(data.user);
      else setUser(null);
    } catch (e) {
      console.error('Auth refresh failed:', e);
      setUser(null);
    }
  };

  const logout = async () => {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch (e) {
      console.error('Logout request failed:', e);
    } finally {
      setUser(null);
    }
  };

  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}