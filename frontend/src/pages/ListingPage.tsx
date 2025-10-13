import React, {useEffect, useState} from 'react';
import './ListingPage.css'

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5050';
const API_KEY = process.env.REACT_APP_API_KEY;

type Category = { id: number; name: string };
type Subcategory = { id: number; name: string };

interface Listing{
    id: number;
    title: string;
    description: string;
    location: string;
    type_id: number;
    user_id: number;
}


const ListingPage: React.FC =() =>{
    const [listings, setListings] = useState<Listing[]>([]);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editedTitle, setEditedTitle] = useState('');
    const [editedDescription, setEditedDescription] = useState('');
    const [editedLocation, setEditedLocation] = useState('');

    useEffect(() =>{
        fetch('http://localhost:5050/api/listings')
        .then((res) => res.json())
        .then((data) => {
            console.log("Dane z backendu: ", data)
            setListings(data);
        })
        .catch((err)=> console.error("Błąd przy pobieraniu ogłoszeń: ", err))
    }, []);
    const [typeFilter, setTypeFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<number | ''>('');
    const [subcategoryFilter, setSubcategoryFilter] = useState<number | ''>('');
    const [categories, setCategories] = useState<Category[]>([]);
    const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
      
    
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
      
          const map: Record<string, string> = { work:'Praca', help:'Pomoc', sales:'Sprzedaż' };
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
        if (typeFilter) q.set('type_id', typeFilter === 'sales' ? '1' : typeFilter === 'help' ? '2' : '3');
        if (categoryFilter) q.set('category_id', String(categoryFilter));
        if (subcategoryFilter) q.set('subcategory_id', String(subcategoryFilter));
      
        fetch(`${API_BASE}/api/listings?${q.toString()}`, {
          headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) }
        })
          .then((res) => res.json())
          .then(setListings)
          .catch((err) => console.error('Błąd przy pobieraniu ogłoszeń: ', err));
    }, [typeFilter, categoryFilter, subcategoryFilter]);
      


    const handleEdit = async (id: number) => {
        try {
            const res = await fetch(`http://localhost:5050/api/listings/${id}`,{
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: editedTitle,
                    description: editedDescription,
                    location: editedLocation,
                    status_id:1,
                    type_id:1,
                    category_id:1,
                    user_id:1
                }),
            });

            if (res.ok) {
                alert('Ogłoszenie zaktualizowane!');
                const updated = await res.json();
                setListings(prev => 
                    prev.map(listing => (listing.id === id ? updated.updated : listing))
                );
                setEditingId(null);
            } else {
                const error = await res.json();
                alert(`Błąd: ${error.error}`);
            }
        } catch (err) {
            console.error ('Błąd podczas edycji:', err);
            alert('Wystąpił błąd podczas edytowania.');
        }
    };


    const handleDelete = async (id: number) => {
        const confirm = window.confirm('Czy na pewno chcesz usunąc ogłoszenie?');
        if (!confirm) return;
    
        try {
            const res = await fetch(`http://localhost:5050/api/listings/${id}`, {
                method: 'DELETE',
            });
    
            if (res.ok) {
                alert('Ogłoszenie usunięte!');
                setListings(prev => prev.filter(listing => listing.id !== id ));
            } else {
                const error = await res.json();
                alert(`Błąd: $(error.error)`);
            }
        } catch (err) {
            console.error('Błąd podczas usuwania:', err);
            alert('Wystąpił błąd podczas usuwania ogłoszenia.');
        }
    };

    return(
        <div className='listing-page'>

            <h2>Wszystkie ogłoszenia</h2>
            <div className="filters-bar">
                <label> Typ </label>
                <select value={typeFilter} onChange={(e)=> setTypeFilter(e.target.value)}>
                    <option value="">Typ</option>
                    <option value="work">Praca</option>
                    <option value="help">Pomoc</option>
                    <option value="sales">Sprzedaż</option>
                </select>

                <div className="filter">
                    <label>Podkategoria</label>
                    <select
                        value={subcategoryFilter}
                        onChange={(e)=> setSubcategoryFilter(Number(e.target.value) || '')} >
                            
                        <option value="">Wszystkie</option>

                        {subcategories.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {listings.length===0?(
                <p>Brak ogłoszeń.</p>
            ):(
                <div className='listing-grid'>
                    {listings.map((listings)=>(
                        <div key={listings.id} className='listing-card'>
                            {editingId === listings.id ? (
                                <div className='edit-form'>
                                    <input
                                        type='text'
                                        value={editedTitle}
                                        onChange={(e)=> setEditedTitle(e.target.value)}
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
                                        onChange={(e)=> setEditedLocation(e.target.value)}
                                        placeholder='Lokalizacja'
                                    />
                                    <div className='edit-form-buttons'>
                                    <button className='action-button save-button' onClick={()=> handleEdit(listings.id)}>Zapisz</button>
                                    <button className='action-button cancel-button' onClick={()=> setEditingId(null)}>Anuluj</button>
                                    </div>
                                    </div>
                                    
                                    ):(
                                        <>
                                        <h3 className='listing-title'>{listings.title}</h3>
                                        <p className='listing-description'>{listings.description}</p>
                                        <p className='listing-location'>Lokalizacja: {listings.location}</p>
                                        <button className="delete-button" onClick={() => handleDelete(listings.id)}> Usuń</button>
                                        <button
                                        className='edit-button'
                                        onClick={()=>{
                                            setEditingId(listings.id);
                                            setEditedTitle(listings.title);
                                            setEditedDescription(listings.description);
                                            setEditedLocation(listings.location);
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