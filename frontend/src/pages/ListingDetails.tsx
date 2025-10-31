import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import './ListingDetails.css'; 

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5050';
const API_KEY = process.env.REACT_APP_API_KEY;

type ListingDetails = {
  id: number;
  title: string;
  description: string;
  location: string | null;
  created_at: string;
  user_id: number;
  author_username?: string;
  category_name?: string;
  subcategory_name?: string;
};

export default function ListingDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState<ListingDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/listings/${id}`, {
          headers: {
            'Content-Type': 'application/json',
            ...(API_KEY ? { 'x-api-key': API_KEY } : {})
          },
          credentials: 'include',
        });
        if (res.status === 404) { navigate('/'); return; }
        if (!res.ok) throw new Error(await res.text());
        setData(await res.json());
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, navigate]);

  if (loading) return <div className="listing-details-container"><p>Ładowanie…</p></div>;
  if (!data)    return <div className="listing-details-container"><p>Brak danych.</p></div>;

  const canEdit = user?.id === data.user_id;

  return (
    <div className="listing-details-container">
      <Link to="/" className="listing-details-back">← Wróć do listy</Link>

      <h1 className="listing-details-title">{data.title}</h1>
      <p className="listing-details-meta">
        Autor: <strong>{data.author_username ?? 'nieznany'}</strong> •{' '}
        Dodano: {new Date(data.created_at).toLocaleString()}
      </p>

      <div className="listing-details-card">
        <p className="listing-details-description">{data.description}</p>

        <div className="listing-details-info">
          <p><strong>Lokalizacja:</strong> {data.location || '—'}</p>
          <p><strong>Kategoria:</strong> {data.category_name || '—'}{data.subcategory_name ? ` → ${data.subcategory_name}` : ''}</p>
        </div>
      </div>

      {canEdit && (
        <div className="listing-details-actions">
          {}
          <Link to="/listings">Edytuj na liście</Link>
        </div>
      )}
    </div>
  );
}