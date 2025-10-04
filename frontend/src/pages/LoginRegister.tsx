import React, {useState, useEffect} from "react";
import './LoginRegister.css'

const LoginRegister: React.FC = () => {
    const[activeTab, setActiveTab] = useState<'login' | 'register'>('login');
    // --- pytania weryfikacyjne ---
    const [questions, setQuestions] = useState<{ id: number; text: string }[]>([]);
    const [selectedQuestionId, setSelectedQuestionId] = useState<number | null>(null);
    const [securityAnswer, setSecurityAnswer] = useState('');
    const [loadingQuestions, setLoadingQuestions] = useState(true);

    useEffect(() => {
    fetch('http://localhost:5050/api/auth/questions')
        .then((res) => res.json())
        .then((data) => {
        if (data.ok && Array.isArray(data.questions)) {
            setQuestions(data.questions);
            setSelectedQuestionId(data.questions[0].id); 
        }
        })
        .catch((err) => console.error('Błąd przy pobieraniu pytań:', err))
        .finally(() => setLoadingQuestions(false));
    }, []);

    return(
        <div className="auth-container">
            <div className="auth-tabs">
                <button
                className={activeTab === 'login'? 'active' : ''}
                onClick={()=> setActiveTab('login')}
                >
                    Logowanie
                </button>
                <button
                className={activeTab === 'register'? 'active' : ''}
                onClick={()=> setActiveTab('register')}
                >
                    Rejestracja
                </button>
            </div>

            {activeTab === 'login'?(
                <form className="auth-form">
                    <h2>Zaloguj się</h2>
                    <label>
                        Email lub nazwa użytkownika
                        <input type="text" name="login" required/>
                    </label>
                    <label>
                        Hasło
                        <input type="password" name="password" required/>
                    </label>
                    <button type="submit">Zaloguj się</button>
                </form>
            ):(
                <form className="auth-form">
                    <h2>Zarejestruj się</h2>
                    <label>
                        Nazwa użytkownika
                        <input type="text" name="username" required/>
                    </label>
                    <label>
                        Imię
                        <input type="text" name="name"/>
                    </label>
                    <label>
                        Nazwisko
                        <input type="text" name="surname"/>
                    </label>
                    <label>
                        E-mail
                        <input type="email" name="email" required/>
                    </label>
                    <label>
                        Hasło
                        <input type="password" name="password" required/>
                    </label>
                    <label>
                        Potwierdź hasło
                        <input type="password" name="confirmPassword" required/>
                    </label>
                    <label>
                    Pytanie weryfikacyjne
                    {loadingQuestions ? (
                        <p>Ładowanie pytań...</p>
                    ) : (
                        <select
                        value={selectedQuestionId ?? ''}
                        onChange={(e) => setSelectedQuestionId(Number(e.target.value))}
                        required
                        >
                        {questions.map((q) => (
                            <option key={q.id} value={q.id}>
                            {q.text}
                            </option>
                        ))}
                        </select>
                    )}
                    </label>
                    <label>
                    Odpowiedź na pytanie
                    <input
                        type="text"
                        name="securityAnswer"
                        value={securityAnswer}
                        onChange={(e) => setSecurityAnswer(e.target.value)}
                        required
                    />
                    </label>
                    <button type="submit">Zarejestruj się</button>
                </form>
                
            )}
        </div>
    );
};

export default LoginRegister;