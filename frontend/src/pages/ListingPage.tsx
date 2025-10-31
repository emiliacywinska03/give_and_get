import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from "react-router-dom";
import './ListingPage.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5050';
const API_KEY = process.env.REACT_APP_API_KEY;

type Category = { id: number; name: string };
type Subcategory = { id: number; name: string };

interface Listing {
  id: number;
  title: string;
  description: string;
  location: string;
  type_id: number;
  user_id: number;
}

const ListingPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const lastSearchRef = useRef<string>('');

  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<number | ''>('');
  const [subcategoryFilter, setSubcategoryFilter] = useState<number | ''>('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);

  const [listings, setListings] = useState<Listing[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [editedLocation, setEditedLocation] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const type = params.get('type');
    const cat = params.get('category_id');
    const sub = params.get('subcategory_id');

    if (type === 'work' || type === 'sales' || type === 'help') {
      setTypeFilter(type);
    } else {
      setTypeFilter('');
    }
    if (cat) setCategoryFilter(Number(cat));
    if (sub) setSubcategoryFilter(Number(sub));
  }, [location.search]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (typeFilter) params.set('type', typeFilter);
    if (categoryFilter) params.set('category_id', String(categoryFilter));
    if (subcategoryFilter) params.set('subcategory_id', String(subcategoryFilter));

    const newSearch = params.toString();
    if (newSearch === lastSearchRef.current) return;
    lastSearchRef.current = newSearch;

    const newUrl = newSearch ? `/listings?${newSearch}` : '/listings';
    navigate(newUrl, { replace: true });
  }, [typeFilter, categoryFilter, subcategoryFilter, navigate]);

  useEffect(() => {
    const run = async () => {
      setCategories([]);
      setCategoryFilter('');
      setSubcategories([]);
      setSubcategoryFilter('');

      if (!typeFilter) return;

      const res = await fetch(`${API_BASE}/api/listings/categories`, {
        headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) }
      });
      const all: Category[] = await res.json();

      const map: Record<string, string> = { work: 'Praca', help: 'Pomoc', sales: 'Sprzedaż' };
      const filtered = all.filter(c => c.name === map[typeFilter]);

      setCategories(filtered);
      if (filtered.length) setCategoryFilter(filtered[0].id);
    };
    run().catch(console.error);
  }, [typeFilter]);

  useEffect(() => {
    const run = async () => {
      setSubcategories([]);
      setSubcategoryFilter('');
      if (!categoryFilter) return;

      const res = await fetch(`${API_BASE}/api/listings/subcategories?category_id=${categoryFilter}`, {
        headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) }
      });
      const data: Subcategory[] = await res.json();
      setSubcategories(data);
    };
    run().catch(console.error);
  }, [categoryFilter]);

  useEffect(() => {
    const q = new URLSearchParams();

    const mapTypeToCategoryName: Record<string, string> = {
      work: 'praca',
      help: 'pomoc',
      sales: 'sprzedaż',
    };
    if (typeFilter) q.set('category', mapTypeToCategoryName[typeFilter]);

    if (categoryFilter) q.set('category_id', String(categoryFilter));
    if (subcategoryFilter) q.set('subcategory_id', String(subcategoryFilter));

    const qs = q.toString();
    const url = qs ? `${API_BASE}/api/listings?${qs}` : `${API_BASE}/api/listings`;

    fetch(url, {
      headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) }
    })
      .then((res) => {
        if (!res.ok) return res.text().then(t => { throw new Error(`HTTP ${res.status}: ${t}`); });
        return res.json();
      })
      .then(setListings)
      .catch((err) => console.error('Błąd przy pobieraniu ogłoszeń: ', err));
  }, [typeFilter, categoryFilter, subcategoryFilter]);

  const handleEdit = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/listings/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(API_KEY ? { 'x-api-key': API_KEY } : {})
        },
        body: JSON.stringify({
          title: editedTitle,
          description: editedDescription,
          location: editedLocation,
          status_id: 1,
          type_id: 1,
          category_id: 1,
          user_id: 1
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setListings(prev =>
          prev.map(item => (item.id === id ? updated.updated : item))
        );
        setEditingId(null);
      } else {
        const error = await res.json();
        alert(`Błąd: ${error.error}`);
      }
    } catch (err) {
      console.error('Błąd podczas edycji:', err);
      alert('Wystąpił błąd podczas edytowania.');
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = window.confirm('Czy na pewno chcesz usunąć ogłoszenie?');
    if (!confirmed) return;

    try {
      const res = await fetch(`${API_BASE}/api/listings/${id}`, {
        method: 'DELETE',
        headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) }
      });

      if (res.ok) {
        setListings(prev => prev.filter(item => item.id !== id));
      } else {
        const error = await res.json();
        alert(`Błąd: ${error.error}`);
      }
    } catch (err) {
      console.error('Błąd podczas usuwania ogłoszenia:', err);
      alert('Wystąpił błąd podczas usuwania ogłoszenia.');
    }
  };

  return (
    <div className='listing-page'>
      <h2>
        {typeFilter === 'work'
          ? 'Ogłoszenia – Praca'
          : typeFilter === 'sales'
          ? 'Ogłoszenia – Sprzedaż'
          : typeFilter === 'help'
          ? 'Ogłoszenia – Pomoc'
          : 'Wszystkie ogłoszenia'}
      </h2>

      <div className="filters-bar">
        <label> Typ </label>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">Typ</option>
          <option value="work">Praca</option>
          <option value="help">Pomoc</option>
          <option value="sales">Sprzedaż</option>
        </select>

        <div className="filter">
          <label>Podkategoria</label>
          <select
            value={subcategoryFilter}
            onChange={(e) => setSubcategoryFilter(Number(e.target.value) || '')}>
            <option value="">Wszystkie</option>
            {subcategories.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {listings.length === 0 ? (
        <p>Brak ogłoszeń.</p>
      ) : (
        <div className='listing-grid'>
          {listings.map((item) => (
            <div key={item.id} className='listing-card'>
              {editingId === item.id ? (
                <div className='edit-form'>
                  <input
                    type='text'
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    placeholder='Tytuł'
                  />
                  <textarea
                    value={editedDescription}
                    onChange={(e) => setEditedDescription(e.target.value)}
                    placeholder='Opis'
                  />
                  <input
                    type='text'
                    value={editedLocation}
                    onChange={(e) => setEditedLocation(e.target.value)}
                    placeholder='Lokalizacja'
                  />
                  <div className='edit-form-buttons'>
                    <button className='action-button save-button' onClick={() => handleEdit(item.id)}>Zapisz</button>
                    <button className='action-button cancel-button' onClick={() => setEditingId(null)}>Anuluj</button>
                  </div>
                </div>
              ) : (
                <>
                  <h3 className='listing-title'>{item.title}</h3>
                  <p className='listing-description'>{item.description}</p>
                  <p className='listing-location'>Lokalizacja: {item.location}</p>
                  <button className="delete-button" onClick={() => handleDelete(item.id)}>Usuń</button>
                  <button
                    className='edit-button'
                    onClick={() => {
                      setEditingId(item.id);
                      setEditedTitle(item.title);
                      setEditedDescription(item.description);
                      setEditedLocation(item.location);
                    }}
                  >
                    Edytuj
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ListingPage;
