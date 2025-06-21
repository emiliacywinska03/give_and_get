import React, { useState } from 'react';

const CreateListing: React.FC = () => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [location, setLocation] = useState('');
    const [type, setType] = useState('');
    const [userId, setUserId] = useState(1); //do zmiany potem

    const handleSubmit = async (e: React.FormEvent) =>{
        e.preventDefault();

        const body={
            title,
            description,
            location,
            status_id: 1, //tymczasowo: np aktywne
            type_id: type=== 'sales'? 1: type === 'help' ? 2:3,
            category_id: 1, //tymczasowe
            user_id: userId,
        };

        try{
            const response = await fetch('http://localhost:5050/api/listings',{
                method: 'POST',
                headers: { 'Content-Type' : 'application/json'},
                body: JSON.stringify(body),
            });

            if(response.ok){
                alert('Ogłoszenie dodane!');
                setTitle('');
                setDescription('');
                setLocation('');
                setType('');
            }else{
                const data = await response.json();
                alert("Błąd: " + data.error);
            }
        }catch(err){
            console.error("Błąd przy wysyłaniu ogłoszenia: ", err);
            alert('Coś poszło nie tak.');
        }
    };

    return(
        <div>
            <h2>Dodaj ogłoszenie</h2>
            <form onSubmit={handleSubmit}>
                <input
                type="text"
                placeholder="Tytuł"
                value={title}
                onChange={(e)=> setTitle(e.target.value)}
                required
                />
                <br />
                <input
                    type="text"
                    placeholder="lokalizacja"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                />
                <br />
                <select value={type} onChange={(e) => setType(e.target.value)} required>
                    <option value="">Wybierz typ</option>
                    <option value="sales">Sprzedaż</option>
                    <option value="help">Pomoc</option>
                    <option value="work">Praca</option>
                </select>
                <br />
                <button type="submit">Dodaj ogłoszenie</button>
            </form>
        </div>
    );
};

export default CreateListing;