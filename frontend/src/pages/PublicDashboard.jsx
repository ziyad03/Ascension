import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,400&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --cyan: #06b6d4; --indigo: #6366f1; --red: #ef4444;
    --green: #22c55e; --gold: #fbbf24; --bg: #04080f;
    --surface: rgba(8, 14, 28, 0.82); --border: rgba(255,255,255,0.065);
    --text: #e2e8f0; --muted: rgba(148,163,184,0.55); --radius: 22px;
  }

  .pub-root {
    min-height: 100svh;
    background: var(--bg);
    font-family: 'DM Sans', sans-serif;
    color: var(--text);
    padding: 1rem;
    position: relative;
    overflow-x: hidden;
  }

  .pub-bg {
    position: fixed; inset: 0; pointer-events: none; z-index: 0;
    background:
      radial-gradient(ellipse 70% 60% at 10% 10%, rgba(6,182,212,0.1) 0%, transparent 55%),
      radial-gradient(ellipse 60% 70% at 90% 90%, rgba(99,102,241,0.09) 0%, transparent 55%);
  }

  .pub-grid {
    position: fixed; inset: 0; pointer-events: none; z-index: 0;
    background-image:
      linear-gradient(rgba(6,182,212,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(6,182,212,0.03) 1px, transparent 1px);
    background-size: 52px 52px;
    animation: gridDrift 40s linear infinite;
  }

  @keyframes gridDrift {
    0% { background-position: 0 0, 0 0; }
    100% { background-position: 52px 52px, 52px 52px; }
  }

  .pub-inner {
    position: relative; z-index: 10;
    max-width: 1400px; margin: 0 auto;
    display: grid;
    grid-template-columns: 2fr 1fr;
    grid-template-rows: auto auto 1fr;
    gap: 1rem;
    grid-template-areas:
      "header header"
      "question sidebar"
      "heatmap sidebar";
  }

  @media (max-width: 1024px) {
    .pub-inner {
      grid-template-columns: 1fr;
      grid-template-areas: "header" "question" "sidebar" "heatmap";
    }
  }

  .area-header { grid-area: header; }
  .area-question { grid-area: question; }
  .area-sidebar { grid-area: sidebar; }
  .area-heatmap { grid-area: heatmap; }

  /* Glass card */
  .gc {
    background: var(--surface);
    backdrop-filter: blur(24px);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }
  .gc-cyan { border-color: rgba(6,182,212,0.22); }
  .gc-gold { border-color: rgba(251,191,36,0.22); }
  .gc-indigo { border-color: rgba(99,102,241,0.22); }
  .gc-green { border-color: rgba(34,197,94,0.22); }

  /* Header */
  .pub-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0.9rem 1.25rem; animation: revealDown 0.6s ease both;
  }
  .brand { display: flex; align-items: center; gap: 10px; }
  .brand-logo {
    width: 42px; height: 42px; border-radius: 13px;
    background: linear-gradient(135deg, var(--cyan), var(--indigo));
    display: flex; align-items: center; justify-content: center;
  }
  .brand-name {
    font-family: 'Bebas Neue', sans-serif; font-size: 1.5rem;
    letter-spacing: 0.08em; color: #f0f9ff;
  }
  .brand-sub { font-size: 0.65rem; color: var(--muted); letter-spacing: 0.12em; text-transform: uppercase; }
  .live-badge {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 5px 14px; border-radius: 999px;
    background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3);
    font-size: 0.75rem; color: #f87171; font-weight: 600;
  }
  .live-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: #ef4444; animation: pulse 1.5s infinite;
  }
  @keyframes pulse { 0%,100% { opacity:1; box-shadow:0 0 8px #ef4444; } 50% { opacity:0.4; } }

  /* Question card */
  .q-card { padding: 2rem; animation: revealUp 0.5s 0.1s ease both; }
  .q-header { display: flex; align-items: center; gap: 8px; margin-bottom: 1rem; flex-wrap: wrap; }
  .qtag {
    padding: 3px 11px; border-radius: 999px; font-size: 0.68rem;
    font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase;
  }
  .qtag-cat { background: linear-gradient(135deg, #0891b2, #6366f1); color: #fff; }
  .qtag-pts { background: rgba(251,191,36,0.1); color: #fbbf24; border: 1px solid rgba(251,191,36,0.28); }
  .qtag-easy { background: rgba(34,197,94,0.1); color: #4ade80; border: 1px solid rgba(34,197,94,0.25); }
  .qtag-med { background: rgba(251,191,36,0.1); color: #fbbf24; border: 1px solid rgba(251,191,36,0.25); }
  .qtag-hard { background: rgba(239,68,68,0.1); color: #f87171; border: 1px solid rgba(239,68,68,0.25); }
  .q-text {
    font-family: 'Syne', sans-serif; font-size: clamp(1.3rem, 2.5vw, 2rem);
    font-weight: 700; color: #f0f9ff; line-height: 1.4;
  }
  .q-timer {
    margin-top: 1.5rem; display: flex; align-items: center; gap: 1rem;
  }
  .timer-circle {
    width: 60px; height: 60px; border-radius: 50%;
    background: linear-gradient(135deg, var(--indigo), var(--cyan));
    display: flex; align-items: center; justify-content: center;
    font-family: 'Bebas Neue', sans-serif; font-size: 1.5rem; color: #fff;
  }
  .timer-label { font-size: 0.8rem; color: var(--muted); }

  /* Sidebar: Leaderboard + Buzz activity */
  .sidebar { display: flex; flex-direction: column; gap: 1rem; }
  .panel { padding: 1.25rem; }
  .panel-title {
    font-family: 'Syne', sans-serif; font-size: 0.95rem; font-weight: 700;
    color: #f0f9ff; margin-bottom: 1rem; display: flex; align-items: center; gap: 8px;
  }
  .lb-list { display: flex; flex-direction: column; gap: 0.75rem; }
  .lb-item {
    display: flex; align-items: center; gap: 12px;
    padding: 0.75rem 1rem; background: rgba(255,255,255,0.03);
    border-radius: 12px; transition: background 0.2s;
  }
  .lb-item:hover { background: rgba(255,255,255,0.06); }
  .lb-rank {
    width: 28px; height: 28px; border-radius: 8px;
    background: rgba(255,255,255,0.06);
    display: flex; align-items: center; justify-content: center;
    font-size: 0.75rem; font-weight: 700; color: var(--muted);
  }
  .lb-rank.gold { background: rgba(251,191,36,0.15); color: #fbbf24; }
  .lb-rank.silver { background: rgba(148,163,184,0.12); color: #94a3b8; }
  .lb-rank.bronze { background: rgba(180,83,9,0.15); color: #fb923c; }
  .lb-name { flex: 1; font-weight: 600; font-size: 0.9rem; }
  .lb-score { font-family: 'Bebas Neue', sans-serif; font-size: 1.5rem; color: var(--gold); }

  /* Buzz activity */
  .buzz-list { display: flex; flex-direction: column; gap: 0.5rem; max-height: 200px; overflow-y: auto; }
  .buzz-item {
    display: flex; align-items: center; gap: 8px;
    padding: 0.5rem 0.75rem; background: rgba(239,68,68,0.05);
    border-radius: 10px; font-size: 0.8rem; animation: slideIn 0.3s ease;
  }
  @keyframes slideIn { from { opacity:0; transform:translateX(12px); } to { opacity:1; transform:translateX(0); } }
  .buzz-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--red); }

  /* Heatmap */
  .heatmap { padding: 1.25rem; }
  .hm-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem; }
  .hm-card {
    padding: 1rem; background: rgba(255,255,255,0.03);
    border-radius: 12px; text-align: center;
  }
  .hm-title { font-size: 0.75rem; color: var(--muted); margin-bottom: 0.5rem; }
  .hm-bars { display: flex; gap: 4px; justify-content: center; margin-bottom: 0.5rem; }
  .hm-bar { width: 8px; border-radius: 4px; transition: height 0.3s; }
  .hm-bar.correct { background: var(--green); }
  .hm-bar.wrong { background: var(--red); opacity: 0.6; }
  .hm-stats { display: flex; justify-content: center; gap: 1rem; font-size: 0.7rem; }
  .hm-correct { color: var(--green); }
  .hm-wrong { color: var(--red); }

  /* Empty state */
  .empty {
    text-align: center; padding: 2rem; color: var(--muted);
    font-size: 0.9rem;
  }

  /* Keyframes */
  @keyframes revealDown { from { opacity:0; transform:translateY(-20px); } to { opacity:1; transform:translateY(0); } }
  @keyframes revealUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
`;

export default function PublicDashboard() {
  const [isConnected, setIsConnected] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [teams, setTeams] = useState([]);
  const [buzzActivity, setBuzzActivity] = useState([]);
  const [heatmap, setHeatmap] = useState({});
  const [tournament, setTournament] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io(import.meta.env.VITE_BACKEND_URL || 'http://localhost:10000');
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('join', { room: 'public-room', role: 'spectator' });
    });

    socket.on('game:new_question', (data) => {
      setCurrentQuestion({
        id: data.id,
        text: data.text || data.question,
        category: data.category || 'Général',
        points: data.points || 0,
        difficulty: data.difficulty || data.type || 'medium',
        timeLimit: data.timeLimit || data.timer || 30
      });
    });

    socket.on('score:refresh', (data) => {
      const sorted = [...(data.teams || [])].sort((a, b) => b.score - a.score);
      setTeams(sorted.slice(0, 5)); // Top 5
    });

    const syncTournament = (data) => {
      setTournament(data);
      if (data?.phase2?.scores?.length) {
        setTeams(data.phase2.scores.slice(0, 5));
      }
      if (data?.phase2?.currentChallenge) {
        setCurrentQuestion({
          id: data.phase2.currentChallenge.id,
          text: data.phase2.currentChallenge.question,
          category: data.phase2.currentChallenge.category,
          points: data.phase2.currentChallenge.points,
          difficulty: data.phase2.currentChallenge.difficulty,
          timeLimit: data.phase2.currentChallenge.timeLimit
        });
      } else {
        setCurrentQuestion(null);
      }
    };

    socket.on('tournament:state', syncTournament);
    socket.on('tournament:phase1_complete', syncTournament);
    socket.on('tournament:phase2_started', syncTournament);
    socket.on('phase2:challenge_started', syncTournament);
    socket.on('phase2:submission_update', syncTournament);
    socket.on('phase2:round_winner', syncTournament);
    socket.on('phase2:hint_usage_update', syncTournament);
    socket.on('phase2:round_ended', syncTournament);
    socket.on('phase2:round_timeout', syncTournament);
    socket.on('phase2:round_skipped', syncTournament);
    socket.on('phase2:team_eliminated', syncTournament);
    socket.on('tournament:phase2_complete', syncTournament);
    socket.on('tournament:dev_phase2_started', syncTournament);
    socket.on('tournament:dev_phase3_started', syncTournament);
    socket.on('tournament:dev_state_updated', syncTournament);
    socket.on('tournament:dev_reset', syncTournament);

    socket.on('buzz:first', (data) => {
      setBuzzActivity(prev => [{
        id: Date.now(),
        teamName: data.teamName || 'Équipe',
        time: new Date().toLocaleTimeString()
      }, ...prev].slice(0, 10));
    });

    socket.on('heatmap:update', (data) => {
      setHeatmap(prev => ({ ...prev, [data.questionId]: data.stats }));
    });

    socket.on('disconnect', () => setIsConnected(false));
    return () => socket.disconnect();
  }, []);

  const diffMap = {
    easy: ['qtag-easy', 'Facile'],
    medium: ['qtag-med', 'Moyen'],
    hard: ['qtag-hard', 'Difficile']
  };
  const phaseLabel = tournament?.phase === 'phase2'
    ? 'PHASE 2 · ELIMINATION CSV'
    : tournament?.phase === 'phase3'
      ? 'LA GRANDE FINALE'
    : tournament?.phase === 'phase2_complete'
      ? 'PHASE 2 TERMINEE'
      : tournament?.phase === 'phase1_complete'
        ? 'PHASE 1 TERMINEE'
        : 'PHASE 1 · QUALIFICATION';
  const eliminatedTeams = tournament?.phase2?.eliminatedTeams || tournament?.phase1?.eliminated || [];
  const submissions = tournament?.phase2?.submissions || [];
  const finalScores = tournament?.phase3?.scores || [];
  const penaltyEvents = tournament?.phase2?.monitoring?.penaltyEvents || [];
  const hintUsageLog = tournament?.phase2?.monitoring?.hintUsageLog || [];

  return (
    <>
      <style>{styles}</style>
      <div className="pub-root">
        <div className="pub-bg" />
        <div className="pub-grid" />

        <div className="pub-inner">
          {/* Header */}
          <div className="gc gc-cyan pub-header area-header">
            <div className="brand">
              <div className="brand-logo">
                <svg width="20" height="20" fill="none" stroke="#fff" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                </svg>
              </div>
              <div>
                <p className="brand-name">Crazy Challenge</p>
                <p className="brand-sub">{phaseLabel}</p>
              </div>
            </div>
            <div className="live-badge">
              <span className="live-dot" />
              {isConnected ? 'EN DIRECT' : 'HORS LIGNE'}
            </div>
          </div>

          {/* Question en cours */}
          <div className="area-question">
            {currentQuestion ? (
              <div className="gc gc-cyan q-card">
                <div className="q-header">
                  <span className="qtag qtag-cat">{currentQuestion.category}</span>
                  <span className="qtag qtag-pts">{currentQuestion.points} pts</span>
                  <span className={`qtag ${diffMap[currentQuestion.difficulty]?.[0] || 'qtag-med'}`}>
                    {diffMap[currentQuestion.difficulty]?.[1] || currentQuestion.difficulty}
                  </span>
                </div>
                <p className="q-text">{currentQuestion.text}</p>
                <div className="q-timer">
                  <div className="timer-circle">T</div>
                  <div>
                    <p style={{ fontWeight: 600 }}>Temps restant</p>
                    <p className="timer-label">
                      {tournament?.phase2?.timer !== undefined
                        ? `${tournament.phase2.timer}s · Round ${tournament.phase2.roundNumber}`
                        : 'Compte à rebours en cours...'}
                    </p>
                  </div>
                </div>
                {tournament?.phase2?.roundWinner && (
                  <div className="buzz-item" style={{ marginTop: '1rem', background: 'rgba(34,197,94,0.12)' }}>
                    <span className="buzz-dot" style={{ background: 'var(--green)' }} />
                    <span style={{ flex: 1 }}>
                      {tournament.phase2.roundWinner.teamName} gagne le round
                    </span>
                    <span style={{ color: 'var(--gold)' }}>+{tournament.phase2.roundWinner.points}</span>
                  </div>
                )}
              </div>
            ) : tournament?.phase === 'phase3' ? (
              <div className="gc gc-cyan q-card">
                <div className="q-header">
                  <span className="qtag qtag-cat">Grande Finale</span>
                  <span className="qtag qtag-pts">2 Finalistes</span>
                </div>
                <p className="q-text">Le duel final est prêt. Les deux meilleures équipes entrent en scène.</p>
                <div className="lb-list" style={{ marginTop: '1.25rem' }}>
                  {finalScores.map((team) => (
                    <div key={team.id} className="lb-item">
                      <div className="lb-rank">#{team.rank}</div>
                      <span className="lb-name">{team.name}</span>
                      <span className="lb-score">{team.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="gc" style={{ padding: '2rem', textAlign: 'center' }}>
                <p className="empty">En attente d'une question...</p>
              </div>
            )}
          </div>

          {/* Sidebar: Classement + Buzz */}
          <div className="sidebar area-sidebar">
            {/* Leaderboard */}
            <div className="gc gc-gold panel">
              <h3 className="panel-title">
                <svg width="16" height="16" fill="none" stroke="#fbbf24" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/>
                </svg>
                Classement
              </h3>
              <p style={{ color: 'var(--muted)', fontSize: '0.76rem', marginBottom: '0.75rem' }}>
                Restants: {tournament?.phase2?.qualifiedTeams?.length ?? teams.length} · Eliminés: {eliminatedTeams.length}
              </p>
              {teams.length === 0 ? (
                <p className="empty">En attente des équipes...</p>
              ) : (
                <div className="lb-list">
                  {teams.map((team, i) => (
                    <div key={team.id || i} className="lb-item">
                      <div className={`lb-rank ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}`}>
                        #{i + 1}
                      </div>
                      <span className="lb-name">{team.name || `Équipe ${team.id}`}</span>
                      <span className="lb-score">{team.score}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Buzz activity */}
            <div className="gc gc-red panel">
              <h3 className="panel-title">
                <svg width="16" height="16" fill="none" stroke="#ef4444" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                </svg>
                Buzz récents
              </h3>
              {buzzActivity.length === 0 && submissions.length === 0 ? (
                <p className="empty">Aucun buzz pour l'instant...</p>
              ) : (
                <div className="buzz-list">
                  {submissions.slice(0, 8).map((submission) => (
                    <div key={submission.id} className="buzz-item" style={{ background: submission.correct ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.08)' }}>
                      <span className="buzz-dot" style={{ background: submission.correct ? 'var(--green)' : 'var(--red)' }} />
                      <span style={{ flex: 1 }}>{submission.teamName}</span>
                      <span style={{ color: 'var(--muted)', fontSize: '0.7rem' }}>
                        {submission.correct ? `+${submission.points}` : submission.penalty}
                      </span>
                    </div>
                  ))}
                  {buzzActivity.map((buzz) => (
                    <div key={buzz.id} className="buzz-item">
                      <span className="buzz-dot" />
                      <span style={{ flex: 1 }}>{buzz.teamName}</span>
                      <span style={{ color: 'var(--muted)', fontSize: '0.7rem' }}>{buzz.time}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="gc gc-indigo panel">
              <h3 className="panel-title">
                <svg width="16" height="16" fill="none" stroke="#a5b4fc" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M12 3v18M6 9l6-6 6 6M6 15l6 6 6-6"/>
                </svg>
                Pression du round
              </h3>
              <div className="buzz-list">
                {penaltyEvents.slice(0, 4).map((entry) => (
                  <div key={entry.id} className="buzz-item">
                    <span className="buzz-dot" style={{ background: 'var(--red)' }} />
                    <span style={{ flex: 1 }}>{entry.teamName}</span>
                    <span style={{ color: 'var(--muted)', fontSize: '0.7rem' }}>{entry.penalty}</span>
                  </div>
                ))}
                {hintUsageLog.slice(0, 4).map((entry) => (
                  <div key={entry.id} className="buzz-item">
                    <span className="buzz-dot" style={{ background: 'var(--cyan)' }} />
                    <span style={{ flex: 1 }}>{entry.teamName}</span>
                    <span style={{ color: 'var(--muted)', fontSize: '0.7rem' }}>Indice</span>
                  </div>
                ))}
                {penaltyEvents.length === 0 && hintUsageLog.length === 0 && (
                  <p className="empty">Aucune pénalité ni indice.</p>
                )}
              </div>
            </div>

            <div className="gc gc-indigo panel">
              <h3 className="panel-title">
                <svg width="16" height="16" fill="none" stroke="#a5b4fc" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
                Équipes éliminées
              </h3>
              {eliminatedTeams.length === 0 ? (
                <p className="empty">Aucune élimination...</p>
              ) : (
                <div className="lb-list">
                  {eliminatedTeams.map((team, i) => (
                    <div key={`${team.id}-${i}`} className="lb-item" style={{ filter: 'grayscale(1)', opacity: 0.58 }}>
                      <div className="lb-rank">#{team.rank || i + 1}</div>
                      <span className="lb-name">{team.name}</span>
                      <span className="lb-score">{team.score}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Heatmap des réponses */}
          <div className="area-heatmap">
            <div className="gc gc-indigo heatmap">
              <h3 className="panel-title">
                <svg width="16" height="16" fill="none" stroke="#6366f1" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>
                </svg>
                Statistiques des réponses
              </h3>
              {Object.keys(heatmap).length === 0 ? (
                <p className="empty">En attente de données...</p>
              ) : (
                <div className="hm-grid">
                  {Object.entries(heatmap).slice(0, 6).map(([qId, stats]) => (
                    <div key={qId} className="hm-card">
                      <p className="hm-title">Question #{qId}</p>
                      <div className="hm-bars">
                        <div className="hm-bar correct" style={{ height: `${Math.min(60, stats.correct * 10)}px` }} />
                        <div className="hm-bar wrong" style={{ height: `${Math.min(60, stats.wrong * 10)}px` }} />
                      </div>
                      <div className="hm-stats">
                        <span className="hm-correct">Correct {stats.correct}</span>
                        <span className="hm-wrong">Wrong {stats.wrong}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
