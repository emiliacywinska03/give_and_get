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
                    <input type="email" placeholder="Email"/>
                    <input type="password" placeholder="Hasło"/>
                    <button type="submit">Zaloguj się</button>
                </form>
            ):(
                <form>
                    <form className="auth-form">
                    <h2>Zarejestruj się</h2>
                    <input type="text" placeholder="Nazwa użytkownika"/>
                    <input type="email" placeholder="Email"/>
                    <input type="password" placeholder="Hasło"/>
                    <input type="password" placeholder="Potwierdź hasło"/>
                    <button type="submit">Zarejestruj się</button>
                </form>
                </form>
            )}
        </div>
    );
};

export default LoginRegister;