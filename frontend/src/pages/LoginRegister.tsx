import React, { useEffect, useMemo, useState } from 'react';
import './LoginRegister.css';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5050';


const usernameRegex = /^[A-Za-z0-9._-]{3,30}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;


const showErr = (isTouched: boolean | undefined, hasValue: boolean, msg?: string) => (isTouched || hasValue) && msg ? msg : undefined;
const fieldClass = (isTouched: boolean | undefined, hasValue: boolean, msg?: string) => ((isTouched || hasValue) && msg ? 'has-error' : '');


type Tab = 'login' | 'register';
interface Question { id: number; text: string }

const LoginRegister: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('login');
  const navigate = useNavigate();
  const { refresh, user } = useAuth();


  useEffect(() => { console.log('[Give&Get] API_BASE =', API_BASE); }, []);

  // Jeśli użytkownik jest już zalogowany – przekieruj na profil
  useEffect(() => {
    if (user) {
      navigate('/profile', { replace: true });
    }
  }, [user, navigate]);

  // Rejestracja: pytania weryfikacyjne
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState<number | null>(null);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [questionsError, setQuestionsError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      setQuestionsError(null);
      try {
        const res = await fetch(`${API_BASE}/api/auth/questions`, {
        credentials: 'include',
        });
        if (!res.ok) {
          const err = new Error(`Nie udało się pobrać pytań (HTTP ${res.status}).`);
          setQuestionsError(err.message);
          throw err;
        }
        const data = await res.json();
        if (data.ok && Array.isArray(data.questions)) {
          setQuestions(data.questions);
          if (data.questions.length > 0) {
            setSelectedQuestionId(data.questions[0].id);
          } else {
            setSelectedQuestionId(null);
            setQuestionsError("Brak aktywnych pytań w bazie (locale='pl').");
          }
        } else {
          setQuestionsError('Niepoprawna odpowiedź API: brak pola questions.');
          throw new Error('Brak pola questions w odpowiedzi API');
        }
      } catch (e) {
        console.error('Błąd pobierania pytań:', e);
        setQuestionsError(e instanceof Error ? e.message : 'Nie udało się połączyć z API (sprawdź adres API_BASE i CORS).');
      } finally {
        setLoadingQuestions(false);
      }
    };
    run();
  }, []);

  // --- LOGOWANIE ---
  const [loginValue, setLoginValue] = useState(''); // email lub nazwa użytkownika
  const [passwordValue, setPasswordValue] = useState('');
  const [touchedLogin, setTouchedLogin] = useState<{ login?: boolean; password?: boolean }>({});
  const [errorsLogin, setErrorsLogin] = useState<{ login?: string; password?: string; general?: string }>({});
  const [submittingLogin, setSubmittingLogin] = useState(false);

  // --- ODZYSKIWANIE HASŁA (pytanie weryfikacyjne) ---
  const [recoverOpen, setRecoverOpen] = useState(false);
  const [recoverStep, setRecoverStep] = useState<1 | 2>(1);
  const [recoverLogin, setRecoverLogin] = useState('');
  const [recoverQuestion, setRecoverQuestion] = useState<{ id: number; text: string } | null>(null);
  const [recoverAnswer, setRecoverAnswer] = useState('');
  const [recoverNewPass, setRecoverNewPass] = useState('');
  const [recoverConfirm, setRecoverConfirm] = useState('');
  const [recoverBusy, setRecoverBusy] = useState(false);
  const [recoverMsg, setRecoverMsg] = useState<string | null>(null);
  const [recoverErr, setRecoverErr] = useState<string | null>(null);

  const resetRecoverState = () => {
    setRecoverStep(1);
    setRecoverLogin('');
    setRecoverQuestion(null);
    setRecoverAnswer('');
    setRecoverNewPass('');
    setRecoverConfirm('');
    setRecoverMsg(null);
    setRecoverErr(null);
    setRecoverBusy(false);
  };

  const openRecover = () => {
    setRecoverOpen(true);
    setRecoverMsg(null);
    setRecoverErr(null);
    setRecoverStep(1);
    setRecoverLogin(loginValue.trim());
    setRecoverQuestion(null);
    setRecoverAnswer('');
    setRecoverNewPass('');
    setRecoverConfirm('');
  };

  const closeRecover = () => {
    setRecoverOpen(false);
    resetRecoverState();
  };

  const recoverLoginError = useMemo(() => {
    const v = recoverLogin.trim();
    if (!v || v.length < 3) return 'Wpisz e-mail lub nazwę (min. 3 znaki).';
    if (v.includes('@')) {
      if (!emailRegex.test(v)) return 'Wpisz poprawny adres e-mail.';
    } else {
      if (!usernameRegex.test(v)) return 'Wpisz nazwę 3–30 znaków (litery, cyfry, kropka, podkreślnik, myślnik).';
    }
    return null;
  }, [recoverLogin]);

  const recoverResetError = useMemo(() => {
    if (!recoverQuestion) return 'Najpierw pobierz pytanie.';
    if (!recoverAnswer.trim() || recoverAnswer.trim().length < 3) return 'Wpisz odpowiedź (min. 3 znaki).';
    if (!recoverNewPass) return 'Wpisz nowe hasło.';
    if (!passwordRegex.test(recoverNewPass)) return 'Wpisz mocniejsze hasło: min. 8 znaków, mała/DUŻA litera, cyfra, symbol.';
    if (!recoverConfirm) return 'Potwierdź nowe hasło.';
    if (recoverConfirm !== recoverNewPass) return 'Hasła muszą być identyczne.';
    return null;
  }, [recoverQuestion, recoverAnswer, recoverNewPass, recoverConfirm]);

  const fetchRecoverQuestion = async () => {
    setRecoverErr(null);
    setRecoverMsg(null);
    const e = recoverLoginError;
    if (e) {
      setRecoverErr(e);
      return;
    }

    try {
      setRecoverBusy(true);
      const res = await fetch(`${API_BASE}/api/auth/recover/question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ login: recoverLogin.trim() }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        const msg = (Array.isArray(data.errors) && data.errors[0]?.message) || data.message || 'Nie udało się pobrać pytania.';
        setRecoverErr(msg);
        return;
      }

      if (!data.question || typeof data.question.text !== 'string') {
        setRecoverErr('Niepoprawna odpowiedź serwera (brak pytania).');
        return;
      }

      setRecoverQuestion({ id: Number(data.question.id), text: String(data.question.text) });
      setRecoverStep(2);
    } catch (err) {
      console.error(err);
      setRecoverErr('Problem z połączeniem z serwerem.');
    } finally {
      setRecoverBusy(false);
    }
  };

  const submitRecoverReset = async () => {
    setRecoverErr(null);
    setRecoverMsg(null);
    const e = recoverResetError;
    if (e) {
      setRecoverErr(e);
      return;
    }

    try {
      setRecoverBusy(true);
      const res = await fetch(`${API_BASE}/api/auth/recover/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          login: recoverLogin.trim(),
          security_answer: recoverAnswer.trim(),
          new_password: recoverNewPass,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        const msg = (Array.isArray(data.errors) && data.errors[0]?.message) || data.message || 'Nie udało się zresetować hasła.';
        setRecoverErr(msg);
        return;
      }

      setRecoverMsg(data.message || 'Hasło zostało zmienione. Możesz się zalogować.');
      setRecoverAnswer('');
      setRecoverNewPass('');
      setRecoverConfirm('');
      setRecoverStep(1);
      setRecoverQuestion(null);
      setRecoverOpen(false);
    } catch (err) {
      console.error(err);
      setRecoverErr('Problem z połączeniem z serwerem.');
    } finally {
      setRecoverBusy(false);
    }
  };

  const validateLogin = (login: string, password: string) => {
    const e: { login?: string; password?: string } = {};
    const trimmed = login.trim();
    if (!trimmed || trimmed.length < 3) {
    e.login = 'Wpisz e-mail lub nazwę (min. 3 znaki).';
    } else if (trimmed.includes('@')) {
    if (!emailRegex.test(trimmed)) e.login = 'Wpisz poprawny adres e-mail.';
    } else if (!usernameRegex.test(trimmed)) {
    e.login = 'Wpisz nazwę 3–30 znaków (litery, cyfry, kropka, podkreślnik, myślnik).';
    }
    if (!password) e.password = 'Wpisz hasło.';
    return e;
  };

  const onSubmitLogin: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    const eNow = validateLogin(loginValue, passwordValue);
    setErrorsLogin(eNow);
    setTouchedLogin({ login: true, password: true });
    if (Object.keys(eNow).length) return;

    try {
      setSubmittingLogin(true);
      setErrorsLogin({});
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ login: loginValue.trim(), password: passwordValue }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        const msg = (Array.isArray(data.errors) && data.errors[0]?.message) || data.message || 'Błąd logowania.';
        setErrorsLogin({ general: msg });
        return;
      }

      alert('Zalogowano.');
      await refresh();
      navigate('/profile');
    } catch (err) {
      console.error(err);
      setErrorsLogin({ general: 'Problem z połączeniem z serwerem.' });
    } finally {
      setSubmittingLogin(false);
    }
  };

  const showLoginError = (name: 'login' | 'password') => {
    const msg = name === 'login' ? errorsLogin.login : errorsLogin.password;
    const val = name === 'login' ? loginValue : passwordValue;
    const vis = showErr(touchedLogin[name], val.length > 0, msg);
    return vis ? <p className="field-error">{vis}</p> : null;
  };

  // --- REJESTRACJA ---
  const [regUsername, setRegUsername] = useState('');
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [regAnswer, setRegAnswer] = useState('');

  const [touchedReg, setTouchedReg] = useState<Record<string, boolean>>({});
  const [errorsReg, setErrorsReg] = useState<Record<string, string>>({});
  const [submittingReg, setSubmittingReg] = useState(false);
  const [successReg, setSuccessReg] = useState<string | null>(null);

  const validateRegister = () => {
    const e: Record<string, string> = {};

    // username
    if (!regUsername.trim()) e.username = 'Wpisz nazwę użytkownika (3–30 znaków).';
    else if (!usernameRegex.test(regUsername.trim()))
      e.username = 'Wpisz nazwę z dozwolonymi znakami: litery, cyfry, kropka, podkreślnik, myślnik.';

    // email
    if (!regEmail.trim()) e.email = 'Wpisz e-mail.';
    else if (!emailRegex.test(regEmail.trim())) e.email = 'Wpisz poprawny e-mail.';

    // password
    if (!regPassword) e.password = 'Wpisz hasło.';
    else if (!passwordRegex.test(regPassword))
      e.password = 'Wpisz mocniejsze hasło: min. 8 znaków, mała/DUŻA litera, cyfra, symbol.';

    // confirm
    if (!regConfirm) e.confirm = 'Wpisz ponownie hasło.';
    else if (regConfirm !== regPassword) e.confirm = 'Hasła muszą być identyczne.';

    // security question + answer
    if (!selectedQuestionId)
      e.security_question_id = questionsError ? 'Błąd pobierania pytań – odśwież stronę.' : 'Wybierz pytanie.';

    if (!regAnswer.trim()) e.security_answer = 'Wpisz odpowiedź (3–100 znaków).';
    else if (regAnswer.trim().length < 3) e.security_answer = 'Wpisz dłuższą odpowiedź (min. 3 znaki).';
    else if (regAnswer.trim().length > 100) e.security_answer = 'Wpisz krótszą odpowiedź (max 100 znaków).';

    // first/last name 
    if (!regFirstName.trim()) e.first_name = 'Wpisz imię.';
    else if (regFirstName.length > 80) e.first_name = 'Wpisz krótsze imię (max 80 znaków).';

    if (!regLastName.trim()) e.last_name = 'Wpisz nazwisko.';
    else if (regLastName.length > 80) e.last_name = 'Wpisz krótsze nazwisko (max 80 znaków).';

    return e;
  };

  const onSubmitRegister: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    setSuccessReg(null);
    const eNow = validateRegister();
    setErrorsReg(eNow);

    setTouchedReg({
      username: true,
      email: true,
      password: true,
      confirm: true,
      first_name: true,
      last_name: true,
      security_question_id: true,
      security_answer: true,
    });
    if (Object.keys(eNow).length) return;

    try {
      setSubmittingReg(true);
      setErrorsReg({});
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: regUsername.trim(),
          email: regEmail.trim(),
          password: regPassword,
          first_name: regFirstName.trim() || '',
          last_name: regLastName.trim() || '',
          security_question_id: selectedQuestionId,
          security_answer: regAnswer.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        const msg = (Array.isArray(data.errors) && data.errors[0]?.message) || data.message || 'Błąd rejestracji.';
        setErrorsReg({ general: msg });
        return;
      }

      setSuccessReg('Konto utworzone. Możesz się zalogować.');
      // wyczyść formularz
      setRegUsername('');
      setRegEmail('');
      setRegPassword('');
      setRegConfirm('');
      setRegFirstName('');
      setRegLastName('');
      setRegAnswer('');
    } catch (err) {
      console.error(err);
      setErrorsReg({ general: 'Problem z połączeniem z serwerem.' });
    } finally {
      setSubmittingReg(false);
    }
  };

  const showRegError = (key: string) => {
    // mapujemy klucz pola na jego aktualną wartość
    const vals: Record<string, any> = {
      username: regUsername,
      first_name: regFirstName,
      last_name: regLastName,
      email: regEmail,
      password: regPassword,
      confirm: regConfirm,
      security_question_id: selectedQuestionId,
      security_answer: regAnswer,
    };

    // czy pole ma jakąś wartość (dla selecta sprawdzamy samo istnienie ID)
    const hasValue = key === 'security_question_id'
      ? !!selectedQuestionId
      : typeof vals[key] === 'string'
        ? vals[key].length > 0
        : !!vals[key];

    const msg = errorsReg[key];
    const vis = showErr(touchedReg[key], hasValue, msg);
    return vis ? <p className="field-error">{vis}</p> : null;
  };

  return (
    <div className="auth-container">
      <div className="auth-tabs">
        <button className={activeTab === 'login' ? 'active' : ''} onClick={() => setActiveTab('login')}>Logowanie</button>
        <button className={activeTab === 'register' ? 'active' : ''} onClick={() => setActiveTab('register')}>Rejestracja</button>
      </div>

      {activeTab === 'login' ? (
        <>
        <form className="auth-form" onSubmit={onSubmitLogin} noValidate>
          <h2>Zaloguj się</h2>

          {errorsLogin.general && <div className="form-error" role="alert">{errorsLogin.general}</div>}

          <label>
            Email lub nazwa użytkownika
            <input
              type="text"
              name="login"
              value={loginValue}
              onChange={(e) => { const v = e.target.value; setLoginValue(v); setErrorsLogin(validateLogin(v, passwordValue)); }}
              onBlur={() => setTouchedLogin((t) => ({ ...t, login: true }))}
              required
              className={fieldClass(touchedLogin.login, loginValue.length > 0, errorsLogin.login)}
              aria-invalid={!!showErr(touchedLogin.login, loginValue.length > 0, errorsLogin.login)}
            />
            {showLoginError('login')}
          </label>

          <label>
            Hasło
            <input
              type="password"
              name="password"
              value={passwordValue}
              onChange={(e) => { const v = e.target.value; setPasswordValue(v); setErrorsLogin(validateLogin(loginValue, v)); }}
              onBlur={() => setTouchedLogin((t) => ({ ...t, password: true }))}
              required
              className={fieldClass(touchedLogin.password, passwordValue.length > 0, errorsLogin.password)}
              aria-invalid={!!showErr(touchedLogin.password, passwordValue.length > 0, errorsLogin.password)}
            />
            {showLoginError('password')}
          </label>

          <button type="submit" disabled={submittingLogin}>{submittingLogin ? 'Logowanie…' : 'Zaloguj się'}</button>

          <div className="forgot-row">
          <button
            type="button"
            onClick={openRecover}
            disabled={submittingLogin}
            className="forgot-link"
          >
            Zapomniałeś hasła?
          </button>
        </div>
        </form>
        {recoverOpen ? (
          <div className="recover-box">
            <div className="recover-header">
            <h2 style={{ margin: 0 }}>Odzyskiwanie hasła</h2>
            <button
              type="button"
              onClick={closeRecover}
              disabled={recoverBusy}
              className="recover-close"
            >
              Zamknij
            </button>
          </div>

            {recoverErr && <div className="form-error" role="alert">{recoverErr}</div>}
            {recoverMsg && <div className="form-success" role="status">{recoverMsg}</div>}

            {recoverStep === 1 ? (
              <>
                <label>
                  Email lub nazwa użytkownika
                  <input
                    type="text"
                    value={recoverLogin}
                    onChange={(e) => setRecoverLogin(e.target.value)}
                    disabled={recoverBusy}
                  />
                </label>

                <button type="button" onClick={fetchRecoverQuestion} disabled={recoverBusy || !!recoverLoginError}>
                  {recoverBusy ? 'Pobieranie pytania…' : 'Dalej'}
                </button>
              </>
            ) : (
              <>
                <div className="recover-question">{recoverQuestion?.text}</div>

                <label>
                  Odpowiedź
                  <input
                    type="text"
                    value={recoverAnswer}
                    onChange={(e) => setRecoverAnswer(e.target.value)}
                    disabled={recoverBusy}
                  />
                </label>

                <label>
                  Nowe hasło
                  <input
                    type="password"
                    value={recoverNewPass}
                    onChange={(e) => setRecoverNewPass(e.target.value)}
                    disabled={recoverBusy}
                  />
                </label>

                <label>
                  Potwierdź nowe hasło
                  <input
                    type="password"
                    value={recoverConfirm}
                    onChange={(e) => setRecoverConfirm(e.target.value)}
                    disabled={recoverBusy}
                  />
                </label>

                <div className="recover-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setRecoverStep(1);
                      setRecoverQuestion(null);
                      setRecoverErr(null);
                      setRecoverMsg(null);
                    }}
                    disabled={recoverBusy}
                    style={{ flex: 1 }}
                  >
                    Wstecz
                  </button>

                  <button
                    type="button"
                    onClick={submitRecoverReset}
                    disabled={recoverBusy || !!recoverResetError}
                    style={{ flex: 2 }}
                  >
                    {recoverBusy ? 'Zmieniam hasło…' : 'Zmień hasło'}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : null}
        </>
      ) : (
        <form className="auth-form" onSubmit={onSubmitRegister} noValidate>
          <h2>Zarejestruj się</h2>

          {errorsReg.general && <div className="form-error" role="alert">{errorsReg.general}</div>}
          {successReg && <div className="form-success" role="status">{successReg}</div>}

          <label>
            Nazwa użytkownika
            <input
              type="text"
              name="username"
              value={regUsername}
              onChange={(e) => { setRegUsername(e.target.value); setErrorsReg(validateRegister()); }}
              onBlur={() => setTouchedReg((t) => ({ ...t, username: true }))}
              required
              className={fieldClass(touchedReg.username, regUsername.length > 0, errorsReg.username)}
              aria-invalid={!!showErr(touchedReg.username, regUsername.length > 0, errorsReg.username)}
            />
            {showRegError('username')}
          </label>

          <label>
            Imię
            <input
              type="text"
              name="first_name"
              value={regFirstName}
              onChange={(e) => { setRegFirstName(e.target.value); setErrorsReg(validateRegister()); }}
              onBlur={() => setTouchedReg((t) => ({ ...t, first_name: true }))}
              className={fieldClass(touchedReg.first_name, regFirstName.length > 0, errorsReg.first_name)}
              aria-invalid={!!showErr(touchedReg.first_name, regFirstName.length > 0, errorsReg.first_name)}
            />
            {showRegError('first_name')}
          </label>

          <label>
            Nazwisko
            <input
              type="text"
              name="last_name"
              value={regLastName}
              onChange={(e) => { setRegLastName(e.target.value); setErrorsReg(validateRegister()); }}
              onBlur={() => setTouchedReg((t) => ({ ...t, last_name: true }))}
              className={fieldClass(touchedReg.last_name, regLastName.length > 0, errorsReg.last_name)}
              aria-invalid={!!showErr(touchedReg.last_name, regLastName.length > 0, errorsReg.last_name)}
            />
            {showRegError('last_name')}
          </label>

          <label>
            E-mail
            <input
              type="email"
              name="email"
              value={regEmail}
              onChange={(e) => { setRegEmail(e.target.value); setErrorsReg(validateRegister()); }}
              onBlur={() => setTouchedReg((t) => ({ ...t, email: true }))}
              required
              className={fieldClass(touchedReg.email, regEmail.length > 0, errorsReg.email)}
              aria-invalid={!!showErr(touchedReg.email, regEmail.length > 0, errorsReg.email)}
            />
            {showRegError('email')}
          </label>

          <label>
            Hasło
            <input
              type="password"
              name="password"
              value={regPassword}   
              onChange={(e) => { setRegPassword(e.target.value); setErrorsReg(validateRegister()); }}
              onBlur={() => setTouchedReg((t) => ({ ...t, password: true }))}
              required
              className={fieldClass(touchedReg.password, regPassword.length > 0, errorsReg.password)}
              aria-invalid={!!showErr(touchedReg.password, regPassword.length > 0, errorsReg.password)}
            />
            {showRegError('password')}
          </label>

          <label>
            Potwierdź hasło
            <input
              type="password"
              name="confirmPassword"
              value={regConfirm}
              onChange={(e) => { setRegConfirm(e.target.value); setErrorsReg(validateRegister()); }}
              onBlur={() => setTouchedReg((t) => ({ ...t, confirm: true }))}
              required
              className={fieldClass(touchedReg.confirm, regConfirm.length > 0, errorsReg.confirm)}
              aria-invalid={!!showErr(touchedReg.confirm, regConfirm.length > 0, errorsReg.confirm)}
            />
            {showRegError('confirm')}
          </label>

          {questionsError && (
            <div className="form-error" role="alert">{questionsError}</div>
          )}
          <label>
            Pytanie weryfikacyjne
            {loadingQuestions ? (
              <p>Ładowanie pytań...</p>
            ) : (
              <select
                value={selectedQuestionId ?? ''}
                onChange={(e) => { const val = e.target.value; setSelectedQuestionId(val ? Number(val) : null); setErrorsReg(validateRegister()); }}
                onBlur={() => setTouchedReg((t) => ({ ...t, security_question_id: true }))}
                required
                disabled={!!questionsError}
                className={fieldClass(touchedReg.security_question_id, !!selectedQuestionId, errorsReg.security_question_id)}
                aria-invalid={!!showErr(touchedReg.security_question_id, !!selectedQuestionId, errorsReg.security_question_id)}
              >
                <option value="" disabled>— wybierz pytanie —</option>
                {questions.map((q) => (
                  <option key={q.id} value={q.id}>{q.text}</option>
                ))}
              </select>
            )}
            {showRegError('security_question_id')}
          </label>

          <label>
            Odpowiedź na pytanie
            <input
              type="text"
              name="securityAnswer"
              value={regAnswer}
              onChange={(e) => { setRegAnswer(e.target.value); setErrorsReg(validateRegister()); }}
              onBlur={() => setTouchedReg((t) => ({ ...t, security_answer: true }))}
              required
              className={fieldClass(touchedReg.security_answer, regAnswer.length > 0, errorsReg.security_answer)}
              aria-invalid={!!showErr(touchedReg.security_answer, regAnswer.length > 0, errorsReg.security_answer)}
            />
            {showRegError('security_answer')}
          </label>

          <button
            type="submit"
            disabled={submittingReg || loadingQuestions || !!questionsError || !selectedQuestionId}
          >
            {submittingReg ? 'Rejestracja…' : 'Zarejestruj się'}
          </button>
        </form>
      )}
    </div>
  );
};

export default LoginRegister;