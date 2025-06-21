import React, {useEffect, useState} from 'react';

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
                <ul>
                    {listings.map((listings)=>(
                        <li key={listings.id}>
                            <h3>{listings.title}</h3>
                            <p>{listings.description}</p>
                            <p>Lokalizacja: {listings.location}</p>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );

};

export default ListingPage;