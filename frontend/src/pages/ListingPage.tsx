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

    useEffect(() =>{
        fetch('http://localhost:5050/api/listings')
        .then((res) => res.json())
        .then((data) => {
            console.log("Dane z backendu: ", data)
            setListings(data);
        })
        .catch((err)=> console.error("Błąd przy pobieraniu ogłoszeń: ", err))
    }, []);

    return(
        <div className='listing-page'>
            <h2>Wszystkie ogłoszenia</h2>
            {listings.length===0?(
                <p>Brak ogłoszeń.</p>
            ):(
                <div className='listing-grid'>
                    {listings.map((listings)=>(
                        <div key={listings.id} className='listing-card'>
                            <h3 className='listing-title'>{listings.title}</h3>
                            <p className='listing-description'>{listings.description}</p>
                            <p className='listing-location'>Lokalizacja: {listings.location}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

};

export default ListingPage;