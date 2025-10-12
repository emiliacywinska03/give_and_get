import React, { JSX } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return <div>Ładowanie…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}