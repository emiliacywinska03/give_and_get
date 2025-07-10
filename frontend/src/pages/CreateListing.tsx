import React, { useState } from 'react';
import './CreateListing.css'

const CreateListing: React.FC = () => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [location, setLocation] = useState('');
    const [type, setType] = useState('');
    const [userId, setUserId] = useState(1); //do zmiany potem

    const[condition, setCondition] = useState('');
    const[price, setPrice]=useState('');
    const[isFree, setIsFree]=useState(false);
    const[negotiable, setNegotiable]=useState(false);
    const[helpType, setHelpType]=useState('');
    const[exchangeForHelp, setExchangeForHelp]=useState(false);
    const[salary, setSalary]=useState('');
    const[requirements, setRequirements]=useState('');
    const[jobMode, setJobMode]=useState('');
    const[jobCategory, setJobCategory]=useState('');

    const handleSubmit = async (e: React.FormEvent) =>{
        e.preventDefault();

        const body:any={
            title,
            description,
            location,
            status_id: 1, //tymczasowo: np aktywne
            type_id: type=== 'sales'? 1: type === 'help' ? 2:3,
            category_id: 1, //tymczasowe
            user_id: userId,
        };

        if(type === 'sales'){
            body.condition=condition;
            body.price=isFree? 0:price;
            body.isFree = isFree;
            body.negotiable= negotiable;
        }

        if(type === 'work'){
            body.salary=salary;
            body.requirements = requirements;
            body.jobMode = jobMode;
            body.jobCategory = jobCategory;
        }

        try{
            const response = await fetch('http://172.21.40.162:5050/api/listings',{
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
        <div className='create-listing-container'>
            <h2>Dodaj ogłoszenie</h2>
            <form onSubmit={handleSubmit}>
                <input
                type="text"
                placeholder="Tytuł"
                value={title}
                onChange={(e)=> setTitle(e.target.value)}
                required
                />
                <textarea
                    placeholder="Opis (maks. 1000 znaków)"
                    value={description}
                    onChange={(e)=> setDescription(e.target.value)}
                    maxLength={1000}
                    required
                />
                <input
                    type="text"
                    placeholder="Lokalizacja"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                />
                <select value={type} onChange={(e) => setType(e.target.value)} required>
                    <option value="">Wybierz typ</option>
                    <option value="sales">Sprzedaż</option>
                    <option value="help">Pomoc</option>
                    <option value="work">Praca</option>
                </select>
                
                {type === 'sales' && (
                    <>
                        <input type="text" placeholder="Stan przedmiotu" value={condition} onChange={(e) => setCondition(e.target.value)} required/>
                        <input type="number" placeholder="Cena" value={price} onChange={(e) => setPrice(e.target.value)} disabled={isFree} required={!isFree}/>
                        <label>
                            <input type="checkbox" checked={negotiable} onChange={()=> setNegotiable(!negotiable)} disabled={isFree}/>
                            Do negocjacji
                        </label>
                    </>
                )}

                {type === 'help' &&(
                    <>
                        <input type="text" placeholder="Typ pomocy" value={helpType} onChange={(e) => setHelpType(e.target.value)} required/>
                        <label>
                            <input type="checkbox" checked={exchangeForHelp} onChange={() => setExchangeForHelp(!exchangeForHelp)}/>
                            Pomoc za pomoc
                        </label>
                    </>
                )}

                {type === 'work' &&(
                    <>
                        <input type="text" placeholder="Wynagrodzenie (PLN)" value={salary} onChange={(e)=> setSalary(e.target.value)}required/>
                        <input type="text" placeholder="Wymagania" value={requirements} onChange={(e)=>setRequirements(e.target.value)} required/>
                        <select value={jobMode} onChange={(e)=> setJobMode(e.target.value)} required>
                        <option value="">Tryb pracy</option>
                        <option value="zdalna">Zdalna</option>
                        <option value="stacjonarna">Stacjonarna</option>
                        <option value="hybrydowa">Hybrydowa</option>
                        <option value="jednorazowa">Jednorazowa</option>
                        </select>
                        <input type="text" placeholder="Kategoria stanowiska" value={jobCategory} onChange={(e)=> setJobCategory(e.target.value)} required/>
                    </>
                )}
                <button type="submit">Dodaj ogłoszenie</button>
            </form>
        </div>
    );
};

export default CreateListing;