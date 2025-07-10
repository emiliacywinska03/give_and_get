import React, {useEffect, useState} from 'react';
import './ListingPage.css'

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
        fetch('http://172.21.40.162:5050/api/listings')
        .then((res) => res.json())
        .then((data) => {
            console.log("Dane z backendu: ", data)
            setListings(data);
        })
        .catch((err)=> console.error("Błąd przy pobieraniu ogłoszeń: ", err))
    }, []);


    const handleEdit = async (id: number) => {
        try {
            const res = await fetch(`http://172.21.40.162:5050/api/listings
/${id}`,{
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
            const res = await fetch(`http://172.21.40.162:5050/api/listings
/${id}`, {
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
            {listings.length===0?(
                <p>Brak ogłoszeń.</p>
            ):(
                <div className='listing-grid'>
                    {listings.map((listings)=>(
                        <div key={listings.id} className='listing-card'>
                            {editingId === listings.id ? (
                                <>
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
                                    <button onClick={()=> handleEdit(listings.id)}>Zapisz</button>
                                    <button onClick={()=> setEditingId(null)}>Anuluj</button>
                                    </>
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