import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import TeamAvatar from '../components/TeamAvatar';
import { readTeamProfile, writeTeamProfile } from '../components/teamIdentity';

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:10000';

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@400;500;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; }

  :root {
    --quiz-ink: #050341;
    --quiz-blue: #14266f;
    --quiz-purple: #3d2f82;
    --quiz-cyan: #17e9ff;
    --quiz-mint: #78ead8;
    --quiz-cream: #fffde8;
    --quiz-lavender: #c6b9ff;
    --quiz-shadow: rgba(4, 3, 34, 0.42);
  }

  body { margin: 0; }

  .auth-root {
    min-height: 100dvh;
    display: grid;
    place-items: center;
    padding: 1rem;
    font-family: 'DM Sans', sans-serif;
    color: var(--quiz-cream);
    background:
      radial-gradient(circle at 18% 24%, rgba(120,234,216,0.42), transparent 22%),
      radial-gradient(circle at 78% 12%, rgba(198,185,255,0.32), transparent 20%),
      linear-gradient(135deg, #3b2c82 0%, #7fcbd6 48%, #23194e 100%);
    position: relative;
    overflow: hidden;
  }

  .auth-root::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image:
      radial-gradient(circle, rgba(5,3,65,0.42) 0 3px, transparent 3px),
      radial-gradient(circle, rgba(120,234,216,0.32) 0 9px, transparent 9px);
    background-size: 37px 37px, 72px 72px;
    opacity: 0.42;
  }

  .auth-shell {
    position: relative;
    z-index: 1;
    width: min(1120px, 100%);
    display: grid;
    grid-template-columns: 0.86fr 1.14fr;
    gap: 1.1rem;
    align-items: stretch;
  }

  .quiz-frame,
  .auth-panel {
    border: 3px solid var(--quiz-cyan);
    box-shadow: 0 0 0 3px rgba(255,255,255,0.24), 0 0 24px rgba(23,233,255,0.7), 18px 18px 0 var(--quiz-shadow);
  }

  .quiz-frame {
    min-height: 560px;
    border-radius: 8px;
    background: linear-gradient(180deg, #06033f 0%, #1d347e 100%);
    padding: 1.25rem;
    display: grid;
    grid-template-rows: auto 1fr;
    overflow: hidden;
  }

  .quiz-logo {
    width: fit-content;
    padding: 0.4rem 1.2rem;
    border-radius: 18px;
    border: 3px solid var(--quiz-lavender);
    color: var(--quiz-lavender);
    font-family: 'Syne', sans-serif;
    font-size: clamp(2rem, 5vw, 4.4rem);
    line-height: 1;
    font-weight: 800;
    letter-spacing: 0;
    text-shadow: 0 0 10px var(--quiz-cyan), 3px 3px 0 rgba(23,233,255,0.42);
    box-shadow: 0 0 22px rgba(23,233,255,0.62);
  }

  .quiz-copy {
    align-self: end;
    display: grid;
    gap: 1rem;
  }

  .quiz-copy h1 {
    margin: 0;
    max-width: 560px;
    font-family: 'Syne', sans-serif;
    font-size: clamp(2rem, 5vw, 4.2rem);
    line-height: 1;
    letter-spacing: 0;
  }

  .quiz-copy p {
    margin: 0;
    max-width: 520px;
    color: rgba(255,253,232,0.78);
    font-size: 1rem;
    line-height: 1.55;
  }

  .auth-panel {
    border-radius: 8px;
    background: rgba(5,3,65,0.92);
    padding: clamp(1rem, 3vw, 1.5rem);
    display: grid;
    gap: 1rem;
  }

  .mode-tabs {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.6rem;
  }

  .tab-btn,
  .auth-btn,
  .ghost-btn {
    min-height: 48px;
    border-radius: 999px;
    border: 2px solid rgba(23,233,255,0.42);
    font: inherit;
    font-weight: 800;
    cursor: pointer;
  }

  .tab-btn {
    background: rgba(255,253,232,0.08);
    color: rgba(255,253,232,0.78);
  }

  .tab-btn.active,
  .auth-btn {
    background: var(--quiz-cream);
    color: var(--quiz-ink);
    box-shadow: 0 9px 0 rgba(0,0,0,0.42);
  }

  .auth-title {
    margin: 0;
    font-family: 'Syne', sans-serif;
    font-size: clamp(1.45rem, 2.5vw, 2.1rem);
    line-height: 1.1;
    color: var(--quiz-cream);
  }

  .auth-copy {
    margin: 0.25rem 0 0;
    color: rgba(255,253,232,0.7);
    font-size: 0.9rem;
  }

  .form-grid {
    display: grid;
    gap: 0.75rem;
  }

  .field {
    display: grid;
    gap: 0.35rem;
  }

  .field label {
    color: var(--quiz-mint);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: 800;
  }

  .auth-input,
  .auth-select {
    width: 100%;
    min-height: 48px;
    border-radius: 8px;
    border: 2px solid rgba(23,233,255,0.34);
    background: rgba(6,3,63,0.78);
    color: var(--quiz-cream);
    padding: 0 0.85rem;
    font: inherit;
    outline: none;
  }

  .auth-input:focus,
  .auth-select:focus {
    border-color: var(--quiz-cyan);
    box-shadow: 0 0 0 3px rgba(23,233,255,0.16);
  }

  .identity-card {
    border: 2px solid rgba(23,233,255,0.32);
    border-radius: 8px;
    background: rgba(120,234,216,0.1);
    padding: 0.8rem;
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.85rem;
    align-items: center;
  }

  .mini-grid {
    display: grid;
    grid-template-columns: 1fr 108px;
    gap: 0.7rem;
  }

  .upload-box {
    min-height: 46px;
    border-radius: 8px;
    border: 2px dashed rgba(23,233,255,0.44);
    background: rgba(255,253,232,0.08);
    color: var(--quiz-mint);
    display: grid;
    place-items: center;
    font-size: 0.85rem;
    cursor: pointer;
  }

  .team-list {
    display: grid;
    gap: 0.55rem;
    max-height: 220px;
    overflow: auto;
  }

  .team-option {
    border: 2px solid rgba(23,233,255,0.22);
    border-radius: 8px;
    background: rgba(255,253,232,0.06);
    color: var(--quiz-cream);
    padding: 0.65rem;
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 0.7rem;
    align-items: center;
    text-align: left;
    cursor: pointer;
  }

  .team-option.active {
    border-color: var(--quiz-cyan);
    background: rgba(23,233,255,0.13);
  }

  .team-name { font-weight: 800; }
  .team-meta { color: rgba(255,253,232,0.62); font-size: 0.78rem; margin-top: 0.1rem; }

  .auth-actions {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.75rem;
    align-items: center;
  }

  .ghost-btn {
    padding: 0 1rem;
    background: rgba(255,253,232,0.08);
    color: var(--quiz-cream);
  }

  .auth-error {
    border-radius: 8px;
    border: 2px solid rgba(255,120,160,0.45);
    background: rgba(255,120,160,0.1);
    color: #ffd6df;
    padding: 0.7rem 0.8rem;
    font-size: 0.86rem;
  }

  @media (max-width: 900px) {
    .auth-shell { grid-template-columns: 1fr; }
    .quiz-frame { min-height: 260px; }
    .mode-tabs, .auth-actions, .mini-grid { grid-template-columns: 1fr; }
  }
`;

export default function Login() {
  const navigate = useNavigate();
  const initialProfile = readTeamProfile();
  const [mode, setMode] = useState('login');
  const [teams, setTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [teamName, setTeamName] = useState('');
  const [teamTag, setTeamTag] = useState(initialProfile.tag || '');
  const [teamColor, setTeamColor] = useState(initialProfile.color || '#17e9ff');
  const [teamAvatar, setTeamAvatar] = useState(initialProfile.avatar || '');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const selectedTeam = useMemo(
    () => teams.find((team) => String(team.id) === String(selectedTeamId)),
    [teams, selectedTeamId]
  );

  const loadTeams = async () => {
    const { data } = await axios.get(`${API_BASE}/api/teams`);
    setTeams(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    let cancelled = false;
    axios.get(`${API_BASE}/api/teams`)
      .then(({ data }) => {
        if (!cancelled) setTeams(Array.isArray(data) ? data : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const saveSession = (data) => {
    const team = data.team || selectedTeam || null;
    const profile = writeTeamProfile({
      avatar: team?.avatar || teamAvatar,
      tag: team?.tag || teamTag,
      color: team?.color || teamColor
    });

    localStorage.setItem('token', data.token);
    localStorage.setItem('role', data.role);
    localStorage.setItem('teamId', data.teamId || '');
    localStorage.setItem('teamName', team?.name || username);
    localStorage.setItem('username', username);
    localStorage.setItem('teamTag', profile.tag || '');
    localStorage.setItem('teamColor', profile.color || '#17e9ff');
    localStorage.setItem('teamAvatar', profile.avatar || '');

    const routes = { team: '/team', moderator: '/moderator', jury: '/jury', public: '/public' };
    navigate(routes[data.role] || '/');
  };

  const onAvatarChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Format avatar non supporte. Utilisez PNG, JPG ou WebP.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setTeamAvatar(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const createTeam = async (event) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const { data } = await axios.post(`${API_BASE}/api/teams`, {
        name: teamName,
        tag: teamTag,
        color: teamColor,
        avatar: teamAvatar
      });
      await loadTeams();
      setSelectedTeamId(String(data.id));
      setMode('register');
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Erreur creation equipe");
    } finally {
      setIsLoading(false);
    }
  };

  const submitUser = async (event) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      if (mode === 'register' && !selectedTeamId) {
        throw new Error('Choisissez une equipe avant de creer un utilisateur.');
      }

      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const payload = mode === 'register'
        ? { username, password, role: 'team', teamId: selectedTeamId }
        : { username, password };

      const { data } = await axios.post(`${API_BASE}${endpoint}`, payload);
      if (mode === 'register') {
        setMode('login');
        setPassword('');
        await loadTeams();
      } else {
        saveSession(data);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Une erreur est survenue');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <style>{styles}</style>
      <div className="auth-root">
        <div className="auth-shell">
          <section className="quiz-frame">
            <div className="quiz-logo">QUIZ</div>
            <div className="quiz-copy">
              <h1>ISGA Summit Challenge</h1>
              <p>Creer une equipe, ajouter ses joueurs, puis entrer en phase de qualification avec avatar, tag et couleur partages.</p>
            </div>
          </section>

          <section className="auth-panel">
            <div className="mode-tabs">
              <button className={`tab-btn ${mode === 'login' ? 'active' : ''}`} onClick={() => setMode('login')}>Connexion</button>
              <button className={`tab-btn ${mode === 'team' ? 'active' : ''}`} onClick={() => setMode('team')}>Equipe</button>
              <button className={`tab-btn ${mode === 'register' ? 'active' : ''}`} onClick={() => setMode('register')}>Utilisateur</button>
            </div>

            <div>
              <h2 className="auth-title">
                {mode === 'team' ? 'Créer une équipe' : mode === 'register' ? 'Créer un utilisateur' : 'Se connecter'}
              </h2>
              <p className="auth-copy">
                {mode === 'team'
                  ? "L'equipe existe avant les comptes joueurs."
                  : mode === 'register'
                    ? 'Le joueur rejoint une equipe deja creee.'
                    : 'Les roles moderator, jury, public et team gardent leurs acces.'}
              </p>
            </div>

            {mode === 'team' ? (
              <form className="form-grid" onSubmit={createTeam}>
                <div className="identity-card">
                  <TeamAvatar name={teamName || 'Team'} avatar={teamAvatar} color={teamColor} tag={teamTag} size={58} />
                  <div>
                    <div className="team-name">{teamName || 'Nouvelle equipe'}</div>
                    <div className="team-meta">{teamTag || 'TAG'} · {teamColor}</div>
                  </div>
                </div>
                <div className="field">
                  <label>Nom d'equipe</label>
                  <input className="auth-input" value={teamName} onChange={(e) => setTeamName(e.target.value)} required />
                </div>
                <div className="mini-grid">
                  <div className="field">
                    <label>Tag court</label>
                    <input className="auth-input" maxLength={4} value={teamTag} onChange={(e) => setTeamTag(e.target.value.toUpperCase())} required />
                  </div>
                  <div className="field">
                    <label>Couleur</label>
                    <input className="auth-input" type="color" value={teamColor} onChange={(e) => setTeamColor(e.target.value)} />
                  </div>
                </div>
                <label>
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onAvatarChange} style={{ display: 'none' }} />
                  <span className="upload-box">Avatar PNG, JPG ou WebP</span>
                </label>
                {error && <div className="auth-error">{error}</div>}
                <button className="auth-btn" disabled={isLoading}>{isLoading ? 'Creation...' : "Créer l'équipe"}</button>
              </form>
            ) : (
              <form className="form-grid" onSubmit={submitUser}>
                {mode === 'register' && (
                  <div className="field">
                    <label>Equipe</label>
                    <div className="team-list">
                      {teams.map((team) => (
                        <button
                          key={team.id}
                          type="button"
                          className={`team-option ${String(selectedTeamId) === String(team.id) ? 'active' : ''}`}
                          onClick={() => setSelectedTeamId(String(team.id))}
                        >
                          <TeamAvatar name={team.name} avatar={team.avatar} color={team.color || '#17e9ff'} tag={team.tag} size={40} />
                          <div>
                            <div className="team-name">{team.name}</div>
                            <div className="team-meta">{team.tag || 'TEAM'} · {team.memberCount || 0}/4 joueurs</div>
                          </div>
                          <span>{String(selectedTeamId) === String(team.id) ? 'OK' : ''}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="field">
                  <label>Utilisateur</label>
                  <input className="auth-input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
                </div>
                <div className="field">
                  <label>Mot de passe</label>
                  <input className="auth-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required />
                </div>
                {error && <div className="auth-error">{error}</div>}
                <div className="auth-actions">
                  <button className="auth-btn" disabled={isLoading}>
                    {isLoading ? 'Chargement...' : mode === 'register' ? "Créer l'utilisateur" : 'Entrer'}
                  </button>
                  {mode === 'register' && <button type="button" className="ghost-btn" onClick={() => setMode('team')}>Nouvelle equipe</button>}
                </div>
              </form>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
