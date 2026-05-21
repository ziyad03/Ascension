import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; }

  .auth-root {
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #030712;
    font-family: 'DM Sans', sans-serif;
    padding: 1rem;
    position: relative;
    overflow: hidden;
  }

  .auth-root::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 60% 50% at 20% 20%, rgba(6,182,212,0.12) 0%, transparent 60%),
      radial-gradient(ellipse 50% 60% at 80% 80%, rgba(99,102,241,0.1) 0%, transparent 60%);
    pointer-events: none;
  }

  .auth-grid {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(6,182,212,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(6,182,212,0.04) 1px, transparent 1px);
    background-size: 48px 48px;
    pointer-events: none;
  }

  /* ── Card ── */
  .auth-card {
    position: relative;
    width: 100%;
    max-width: 440px;
    background: rgba(10,16,30,0.88);
    backdrop-filter: blur(24px);
    border: 1px solid rgba(6,182,212,0.2);
    border-radius: 20px;
    padding: clamp(1.5rem, 5vw, 2.5rem);
    box-shadow: 0 0 0 1px rgba(255,255,255,0.03), 0 32px 64px rgba(0,0,0,0.5);
    animation: cardIn 0.5s cubic-bezier(.22,1,.36,1) both;
  }

  @keyframes cardIn {
    from { opacity: 0; transform: translateY(24px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  /* ── Badge ── */
  .auth-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(6,182,212,0.1);
    border: 1px solid rgba(6,182,212,0.25);
    color: #22d3ee;
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 4px 10px;
    border-radius: 999px;
    margin-bottom: 1rem;
  }

  /* ── Typography ── */
  .auth-title {
    font-family: 'Syne', sans-serif;
    font-size: clamp(1.4rem, 4vw, 1.75rem);
    font-weight: 800;
    color: #f0f9ff;
    line-height: 1.15;
    margin: 0 0 0.3rem;
    white-space: pre-line;
  }

  .auth-subtitle {
    font-size: clamp(0.8rem, 2vw, 0.875rem);
    color: rgba(148,163,184,0.75);
    margin: 0 0 1.5rem;
  }

  /* ── Inputs ── */
  .input-group {
    position: relative;
    margin-bottom: 0.875rem;
  }

  .input-icon {
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    color: rgba(100,116,139,0.7);
    pointer-events: none;
    transition: color 0.2s;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  .auth-input {
    width: 100%;
    padding: 13px 14px 13px 42px;
    background: rgba(15,23,42,0.8);
    border: 1px solid rgba(51,65,85,0.8);
    border-radius: 12px;
    color: #e2e8f0;
    font-size: clamp(0.875rem, 2.5vw, 0.9rem);
    font-family: 'DM Sans', sans-serif;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
    min-height: 48px;
    -webkit-appearance: none;
  }

  .auth-input::placeholder { color: rgba(100,116,139,0.6); }

  .auth-input:focus {
    border-color: rgba(6,182,212,0.6);
    box-shadow: 0 0 0 3px rgba(6,182,212,0.1);
  }

  .input-group:focus-within .input-icon { color: #22d3ee; }

  .field-enter {
    animation: fieldIn 0.3s cubic-bezier(.22,1,.36,1) both;
  }
  @keyframes fieldIn {
    from { opacity: 0; transform: translateY(-8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ── Error ── */
  .auth-error {
    background: rgba(239,68,68,0.08);
    border: 1px solid rgba(239,68,68,0.25);
    border-radius: 10px;
    padding: 10px 14px;
    color: #fca5a5;
    font-size: 0.82rem;
    text-align: center;
    margin-bottom: 0.75rem;
  }

  /* ── Button ── */
  .auth-btn {
    width: 100%;
    min-height: 50px;
    padding: 14px;
    background: linear-gradient(135deg, #0891b2 0%, #6366f1 100%);
    border: none;
    border-radius: 12px;
    color: #fff;
    font-size: clamp(0.88rem, 2.5vw, 0.92rem);
    font-weight: 600;
    font-family: 'DM Sans', sans-serif;
    letter-spacing: 0.02em;
    cursor: pointer;
    transition: opacity 0.2s, transform 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    position: relative;
    overflow: hidden;
    margin-top: 0.5rem;
    -webkit-tap-highlight-color: transparent;
  }

  .auth-btn::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.1), transparent);
    opacity: 0;
    transition: opacity 0.2s;
  }

  @media (hover: hover) {
    .auth-btn:hover:not(:disabled)::before { opacity: 1; }
  }

  .auth-btn:active:not(:disabled) { transform: scale(0.98); }
  .auth-btn:disabled { opacity: 0.6; cursor: not-allowed; }

  .spinner {
    width: 16px; height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Divider ── */
  .auth-divider {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 1.25rem 0 0.875rem;
  }
  .auth-divider::before, .auth-divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: rgba(51,65,85,0.6);
  }
  .auth-divider span {
    font-size: 0.72rem;
    color: rgba(100,116,139,0.6);
  }

  /* ── Toggle ── */
  .auth-toggle-btn {
    width: 100%;
    min-height: 46px;
    padding: 11px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(51,65,85,0.6);
    border-radius: 12px;
    color: #94a3b8;
    font-size: clamp(0.8rem, 2.5vw, 0.85rem);
    font-family: 'DM Sans', sans-serif;
    cursor: pointer;
    transition: background 0.2s, color 0.2s, border-color 0.2s;
    -webkit-tap-highlight-color: transparent;
  }

  @media (hover: hover) {
    .auth-toggle-btn:hover {
      background: rgba(6,182,212,0.08);
      border-color: rgba(6,182,212,0.3);
      color: #22d3ee;
    }
  }

  .auth-toggle-btn:active {
    background: rgba(6,182,212,0.08);
    border-color: rgba(6,182,212,0.3);
    color: #22d3ee;
  }

  /* ── Corner dots ── */
  .auth-corner-dot {
    position: absolute;
    width: 6px; height: 6px;
    border-radius: 50%;
    background: #22d3ee;
    opacity: 0.6;
  }

  /* ── Tablet+ ── */
  @media (min-width: 480px) {
    .auth-root { padding: 1.5rem; }
    .auth-badge { font-size: 0.7rem; }
  }

  /* ── Small phones ── */
  @media (max-width: 360px) {
    .auth-card { border-radius: 16px; }
    .auth-corner-dot { display: none; }
  }
`;

const IconUser = () => (
  <svg className="input-icon" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

const IconLock = () => (
  <svg className="input-icon" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <rect x="3" y="11" width="18" height="11" rx="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

const IconTeam = () => (
  <svg className="input-icon" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername]     = useState('');
  const [password, setPassword]     = useState('');
  const [teamName, setTeamName]     = useState('');
  const [error, setError]           = useState('');
  const [isLoading, setIsLoading]   = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
    try {
      const payload = { username, password, teamName };
      if (isRegister) payload.role = 'team';
      const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}${endpoint}`, payload);
      if (!isRegister) {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('role', res.data.role);
        localStorage.setItem('teamId', res.data.teamId);
        localStorage.setItem('username', username);
        const routes = { team: '/team', moderator: '/moderator', jury: '/jury', public: '/public' };
        navigate(routes[res.data.role] || '/');
      } else {
        alert('Inscription réussie ! Connectez-vous.');
        setIsRegister(false);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Une erreur est survenue');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <style>{styles}</style>
      <div className="auth-root">
        <div className="auth-grid" />
        <div className="auth-card">
          <span className="auth-corner-dot" style={{ top: 14, left: 14 }} />
          <span className="auth-corner-dot" style={{ top: 14, right: 14 }} />
          <span className="auth-corner-dot" style={{ bottom: 14, left: 14 }} />
          <span className="auth-corner-dot" style={{ bottom: 14, right: 14 }} />

          <div className="auth-badge">
            {isRegister ? 'Nouvelle équipe' : 'Espace joueur'}
          </div>

          <h1 className="auth-title">
            {isRegister ? 'Rejoindre\nla compétition' : 'Bon retour\nparmi nous'}
          </h1>
          <p className="auth-subtitle">
            {isRegister ? 'Créez votre équipe pour participer' : 'Connectez-vous pour accéder à votre espace'}
          </p>

          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <input className="auth-input" type="text" placeholder="Nom d'utilisateur"
                value={username} onChange={e => setUsername(e.target.value)}
                required autoComplete="username" />
              <IconUser />
            </div>

            <div className="input-group">
              <input className="auth-input" type="password" placeholder="Mot de passe"
                value={password} onChange={e => setPassword(e.target.value)}
                required autoComplete={isRegister ? 'new-password' : 'current-password'} />
              <IconLock />
            </div>

            {isRegister && (
              <div className="input-group field-enter">
                <input className="auth-input" type="text" placeholder="Nom de l'équipe"
                  value={teamName} onChange={e => setTeamName(e.target.value)} required />
                <IconTeam />
              </div>
            )}

            {error && <div className="auth-error">{error}</div>}

            <button className="auth-btn" type="submit" disabled={isLoading}>
              {isLoading
                ? <><div className="spinner" /> Chargement...</>
                : isRegister ? 'Créer mon équipe →' : 'Se connecter →'}
            </button>
          </form>

          <div className="auth-divider"><span>ou</span></div>

          <button className="auth-toggle-btn" onClick={() => { setIsRegister(v => !v); setError(''); }}>
            {isRegister ? 'Déjà un compte ? Se connecter' : "Pas de compte ? S'inscrire"}
          </button>
        </div>
      </div>
    </>
  );
}
