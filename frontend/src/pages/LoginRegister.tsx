import React, {useState} from "react";

const LoginRegister: React.FC = () => {
    const[activeTab, setActiveTab] = useState<'login' | 'register'>('login');

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
                    <button type="submit">Zarejestruj się</button>
                </form>
                
            )}
        </div>
    );
};

export default LoginRegister;