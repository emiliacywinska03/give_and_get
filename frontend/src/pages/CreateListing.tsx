import React, { useEffect, useState } from 'react';
import './CreateListing.css'
import { useNavigate } from 'react-router-dom';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5050';
const API_KEY = process.env.REACT_APP_API_KEY;

type Category = { id: number; name: string };
type Subcategory = { id: number; name: string };


const CreateListing: React.FC = () => {
    const navigate = useNavigate(); 
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [location, setLocation] = useState('');
    const [type, setType] = useState('');

    const [categories, setCategories] = useState<Category[]>([]);
    const [categoryId, setCategoryId] = useState<number | null>(null);
    const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
    const [subcategoryId, setSubcategoryId] = useState<number | null>(null);

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

    const [images, setImages] = useState<File[]>([]);
    const [imageErrors, setImageErrors] = useState<string[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);

    const MAX_FILES = 6;
    const MAX_FILE_SIZE_MB = 10;
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];


    useEffect(() => {
        const loadCategories = async () => {
          setCategories([]);
          setCategoryId(null);
          setSubcategories([]);
          setSubcategoryId(null);
      
          if (!type) return;
          const res = await fetch(`${API_BASE}/api/listings/categories`, {
            headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) }
          });
          const all: Category[] = await res.json();
      
          const map: Record<string, string> = { work: 'Praca', help: 'Pomoc', sales: 'Sprzedaż' };
          const filtered = all.filter(c => c.name === map[type]);
      
          setCategories(filtered);
          if (filtered.length) setCategoryId(filtered[0].id);
        };
        loadCategories().catch(console.error);
    }, [type]);
      

    useEffect(() => {
        const loadSubcategories = async () => {
          setSubcategories([]);
          setSubcategoryId(null);
          if (!categoryId) return;
      
          const res = await fetch(`${API_BASE}/api/listings/subcategories?category_id=${categoryId}`, {
            headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) }
          });
          const data: Subcategory[] = await res.json();
          setSubcategories(data);
        };
        loadSubcategories().catch(console.error);
    }, [categoryId]);
      
    const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = Array.from(e.target.files || []);
        const newErrors: string[] = [];
        const current = [...images];

        for (const file of selected) {
            if (current.length >= MAX_FILES) {
                newErrors.push(`Możesz dodać maksymalnie ${MAX_FILES} zdjęć.`);
                break;
            }
            if (!ALLOWED_TYPES.includes(file.type)) {
                newErrors.push(`Niedozwolony typ pliku: ${file.name}. Dozwolone: JPG/PNG/WebP.`);
                continue;
            }
            const sizeMB = file.size / (1024 * 1024);
            if (sizeMB > MAX_FILE_SIZE_MB) {
                newErrors.push(`Plik ${file.name} jest za duży (${sizeMB.toFixed(1)} MB). Maksymalnie ${MAX_FILE_SIZE_MB} MB.`);
                continue;
            }
            current.push(file);
        }

        setImages(current);
        setImageErrors(newErrors);

        const newPreviews = current.map(f => URL.createObjectURL(f));
        previews.forEach(url => URL.revokeObjectURL(url));
        setPreviews(newPreviews);

        if (e.target) e.target.value = '';
    };

    const removeImageAt = (idx: number) => {
        const next = images.filter((_, i) => i !== idx);
        setImages(next);
        previews.forEach(url => URL.revokeObjectURL(url));
        const nextPreviews = next.map(f => URL.createObjectURL(f));
        setPreviews(nextPreviews);
    };

    useEffect(() => {
        return () => {
            previews.forEach(url => URL.revokeObjectURL(url));
        };
    }, [previews]);


    const handleSubmit = async (e: React.FormEvent) =>{
        e.preventDefault();

        if (!type) { alert('Wybierz typ ogłoszenia'); return; }
        if (!categoryId) { alert('Wystąpił błąd: brak kategorii dla wybranego typu'); return; }
        if (!subcategoryId) { alert('Wybierz podkategorię'); return; }

        let imagesBase64: string[] = [];
        if (images.length > 0) {
          const toBase64 = (file: File): Promise<string> =>
            new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.readAsDataURL(file);
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = (error) => reject(error);
            });
          imagesBase64 = await Promise.all(images.map(toBase64));
        }

        let body: any = {
          title,
          description,
          location,
          status_id: 1,
          type_id: type === 'sales' ? 1 : type === 'help' ? 2 : 3,
          category_id: categoryId ? Number(categoryId) : null,
          subcategory_id: subcategoryId ? Number(subcategoryId) : null,
          images: imagesBase64
        };

        if (type === 'sales') {
          body.condition = condition;
          body.price = isFree ? 0 : Number(price || 0);
          body.isFree = isFree;
          body.negotiable = negotiable;
        }
        if (type === 'work') {
          body.salary = salary;
          body.requirements = requirements;
          body.jobMode = jobMode;
          body.jobCategory = jobCategory;
        }
        if (type === 'help') {
          body.exchangeForHelp = exchangeForHelp;
          body.helpType = helpType;
        }

        try {
            const response = await fetch(`${API_BASE}/api/listings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(API_KEY ? { 'x-api-key': API_KEY } : {})
                },
                credentials: 'include',
                body: JSON.stringify(body),
            });

            const data = await response.json();
            if (!response.ok) {
                alert('Błąd: ' + (data?.error || 'nie udało się dodać ogłoszenia'));
                return;
            }

            alert('Ogłoszenie dodane!');
            navigate('/');
            setTitle('');
            setDescription('');
            setLocation('');
            setType('');
            setCategoryId(null);
            setSubcategoryId(null);
            setCategories([]);
            setSubcategories([]);
            setImages([]);
            setImageErrors([]);
            previews.forEach(url => URL.revokeObjectURL(url));
            setPreviews([]);
        } catch (err) {
            console.error('Błąd przy wysyłaniu ogłoszenia: ', err);
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

                {type && (
                    <>
                        <select
                        value={subcategoryId ?? ''}
                        onChange={(e) => setSubcategoryId(Number(e.target.value))}
                        required
                        >
                        <option value="">Wybierz podkategorię</option>
                        {subcategories.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                        </select>
                    </>
                )}
                
                {type === 'sales' && (
                    <>
                        <input type="text" placeholder="Stan przedmiotu" value={condition} onChange={(e) => setCondition(e.target.value)} required/>
                        <input type="number" placeholder="Cena" value={price} onChange={(e) => setPrice(e.target.value)} disabled={isFree} required={!isFree}/>
                        <label>
                            <input type="checkbox" checked={negotiable} onChange={()=> setNegotiable(!negotiable)} disabled={isFree}/>
                            Do negocjacji
                        </label>
                        <label>
                            <input type="checkbox" checked={isFree} onChange={()=> setIsFree(!isFree)} />
                            Oddam za darmo
                        </label>
                    </>
                )}

                {type === 'help' &&(
                    <>
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
                <div className="images-section">
                    <label>Zdjęcia (JPG/PNG/WebP, do {MAX_FILES} plików, max {MAX_FILE_SIZE_MB} MB każdy)</label>
                    <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        onChange={handleFilesChange}
                    />
                    {imageErrors.length > 0 && (
                        <ul className="image-errors">
                            {imageErrors.map((er, i) => (
                                <li key={i} style={{ color: 'red' }}>{er}</li>
                            ))}
                        </ul>
                    )}
                    {previews.length > 0 && (
                        <div className="previews-grid">
                            {previews.map((src, i) => (
                                <div key={i} className="preview-item">
                                    <img src={src} alt={`podgląd ${i + 1}`} style={{ maxWidth: '120px', maxHeight: '120px', objectFit: 'cover', borderRadius: 8 }} />
                                    <button type="button" onClick={() => removeImageAt(i)}>Usuń</button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <button type="submit">Dodaj ogłoszenie</button>
            </form>
        </div>
    );
};

export default CreateListing;