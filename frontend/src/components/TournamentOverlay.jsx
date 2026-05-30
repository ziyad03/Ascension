import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';

const overlayStyles = `
  .tt-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background:
      radial-gradient(circle at 50% 20%, rgba(239,68,68,0.22), transparent 35%),
      radial-gradient(circle at 20% 80%, rgba(6,182,212,0.16), transparent 30%),
      #02030a;
    color: #f8fafc;
    display: grid;
    place-items: center;
    overflow: hidden;
    font-family: 'DM Sans', system-ui, sans-serif;
  }

  .tt-overlay::before {
    content: '';
    position: absolute;
    inset: -20%;
    background-image:
      linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px);
    background-size: 42px 42px;
    animation: tt-grid 12s linear infinite;
    transform: rotate(-8deg);
  }

  .tt-overlay::after {
    content: '';
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      0deg,
      rgba(255,255,255,0.025) 0,
      rgba(255,255,255,0.025) 1px,
      transparent 1px,
      transparent 5px
    );
    mix-blend-mode: screen;
    pointer-events: none;
  }

  @keyframes tt-grid {
    to { transform: rotate(-8deg) translate(42px, 42px); }
  }

  .tt-stage {
    position: relative;
    z-index: 2;
    width: min(1100px, calc(100vw - 32px));
    min-height: min(720px, calc(100dvh - 32px));
    display: grid;
    align-content: center;
    gap: 24px;
    text-align: center;
  }

  .tt-tower {
    width: min(220px, 42vw);
    height: 260px;
    margin: 0 auto 8px;
    border-radius: 120px 120px 26px 26px;
    background:
      linear-gradient(180deg, rgba(255,255,255,0.12), transparent 18%),
      linear-gradient(180deg, rgba(34,211,238,0.18), rgba(30,41,59,0.92));
    border: 1px solid rgba(255,255,255,0.12);
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.04), 0 26px 70px rgba(6,182,212,0.18);
    position: relative;
    overflow: hidden;
  }

  .tt-tower::before {
    content: '';
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    top: 26px;
    bottom: 26px;
    width: 18px;
    border-radius: 999px;
    background: linear-gradient(180deg, rgba(251,191,36,0.64), rgba(99,102,241,0.85));
  }

  .tt-lift {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background: linear-gradient(135deg, #f8fafc, #67e8f9);
    box-shadow: 0 0 26px rgba(103,232,249,0.55);
    transition: bottom 0.8s cubic-bezier(.22,1,.36,1);
  }

  .tt-kicker {
    color: #67e8f9;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    font-size: 0.78rem;
    font-weight: 800;
  }

  .tt-title {
    font-family: 'Bebas Neue', Impact, sans-serif;
    font-size: clamp(3rem, 11vw, 8.5rem);
    line-height: 0.9;
    letter-spacing: 0.08em;
    text-shadow: 0 0 34px rgba(239,68,68,0.45);
    animation: tt-glitch 1.1s steps(2, end) infinite;
  }

  @keyframes tt-glitch {
    0%, 92%, 100% { transform: translateX(0); filter: none; }
    94% { transform: translateX(-3px); filter: drop-shadow(6px 0 #06b6d4); }
    96% { transform: translateX(3px); filter: drop-shadow(-6px 0 #ef4444); }
  }

  .tt-subtitle {
    color: rgba(226,232,240,0.74);
    font-size: clamp(1rem, 2vw, 1.35rem);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .tt-leaderboard,
  .tt-teams {
    display: grid;
    gap: 10px;
    max-width: 760px;
    margin: 0 auto;
    width: 100%;
  }

  .tt-row {
    display: grid;
    grid-template-columns: 64px 1fr auto;
    gap: 14px;
    align-items: center;
    padding: 13px 16px;
    border: 1px solid rgba(255,255,255,0.1);
    background: rgba(15,23,42,0.74);
    border-radius: 12px;
    animation: tt-reveal 0.55s cubic-bezier(.22,1,.36,1) both;
  }

  .tt-row.eliminated {
    filter: grayscale(1);
    opacity: 0.38;
    transform: scale(0.98);
  }

  .tt-rank {
    color: #fbbf24;
    font-family: 'Bebas Neue', Impact, sans-serif;
    font-size: 1.6rem;
  }

  .tt-name {
    text-align: left;
    font-weight: 800;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tt-score {
    color: #67e8f9;
    font-family: 'Bebas Neue', Impact, sans-serif;
    font-size: 1.7rem;
  }

  .tt-qualified {
    border-color: rgba(34,197,94,0.44);
    background: linear-gradient(90deg, rgba(34,197,94,0.18), rgba(15,23,42,0.72));
    box-shadow: 0 0 26px rgba(34,197,94,0.16);
  }

  @keyframes tt-reveal {
    from { opacity: 0; transform: translateY(22px) scale(0.96); filter: blur(8px); }
    to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
  }

  .tt-countdown {
    font-family: 'Bebas Neue', Impact, sans-serif;
    font-size: clamp(5rem, 18vw, 14rem);
    color: #f87171;
    text-shadow: 0 0 46px rgba(239,68,68,0.58);
    animation: tt-pop 0.55s cubic-bezier(.22,1,.36,1) both;
  }

  @keyframes tt-pop {
    from { transform: scale(0.6); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  .tt-particles span {
    position: absolute;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: #67e8f9;
    animation: tt-fly 2.2s ease-in-out infinite;
  }

  @keyframes tt-fly {
    0% { transform: translate(0,0); opacity: 0; }
    20% { opacity: 1; }
    100% { transform: translate(var(--x), var(--y)); opacity: 0; }
  }
`;

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const particleValue = (index, salt, range, offset = 0) =>
  ((index * 37 + salt * 19) % 100) / 100 * range + offset;

const PARTICLES = Array.from({ length: 34 }, (_, i) => ({
  id: i,
  left: `${particleValue(i, 1, 100)}%`,
  top: `${particleValue(i, 2, 100)}%`,
  x: `${particleValue(i, 3, 260, -130)}px`,
  y: `${particleValue(i, 4, 260, -130)}px`,
  delay: `${particleValue(i, 5, 1.8)}s`
}));

export default function TournamentOverlay() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState('complete');
  const [snapshot, setSnapshot] = useState(null);
  const [count, setCount] = useState('3');

  const particles = useMemo(() => PARTICLES, []);

  useEffect(() => {
    const socket = io(import.meta.env.VITE_BACKEND_URL || 'http://localhost:10000');

    const runPhase1Complete = async (data) => {
      setSnapshot(data);
      setVisible(true);
      window.dispatchEvent(new CustomEvent('crazy:music-cue', { detail: { cue: 'phase1-complete' } }));

      setStep('complete');
      await wait(3200);
      setStep('qualified');
      await wait(4200);
      setStep('phase2');
      window.dispatchEvent(new CustomEvent('crazy:music-cue', { detail: { cue: 'phase2-intro' } }));
    };

    const runPhase2Started = async (data) => {
      setSnapshot(data);
      setVisible(true);
      setStep('phase2');

      for (const value of ['3', '2', '1', 'DEBUT']) {
        setCount(value);
        await wait(value === 'DEBUT' ? 900 : 850);
      }

      setVisible(false);
    };

    const runPhase2Complete = async (data) => {
      setSnapshot(data);
      setVisible(true);
      setStep('phase2Complete');
      window.dispatchEvent(new CustomEvent('crazy:music-cue', { detail: { cue: 'phase2-complete' } }));
      await wait(5200);
      setVisible(false);
    };

    const runDevPhase2Start = async (data) => {
      setSnapshot(data);
      setVisible(true);
      setStep('devPhase2');
      window.dispatchEvent(new CustomEvent('crazy:music-cue', { detail: { cue: 'phase2-intro' } }));
      await wait(2600);
      setVisible(false);
    };

    const runDevPhase3Start = async (data) => {
      setSnapshot(data);
      setVisible(true);
      setStep('devPhase3');
      window.dispatchEvent(new CustomEvent('crazy:music-cue', { detail: { cue: 'phase3-intro' } }));
      await wait(3200);
      setVisible(false);
    };

    socket.on('tournament:phase1_complete', runPhase1Complete);
    socket.on('tournament:phase2_started', runPhase2Started);
    socket.on('tournament:phase2_complete', runPhase2Complete);
    socket.on('tournament:dev_phase2_started', runDevPhase2Start);
    socket.on('tournament:dev_phase3_started', runDevPhase3Start);

    const onForceOverlay = (event) => {
      const { type, snapshot: nextSnapshot } = event.detail || {};
      setSnapshot(nextSnapshot || null);
      setVisible(true);
      setStep(type || 'devPhase2');
      setTimeout(() => setVisible(false), 2600);
    };
    window.addEventListener('crazy:force-overlay', onForceOverlay);

    return () => {
      socket.disconnect();
      window.removeEventListener('crazy:force-overlay', onForceOverlay);
    };
  }, []);

  if (!visible) return null;

  const rankings = snapshot?.phase1?.rankings || snapshot?.result?.rankings || [];
  const qualified = snapshot?.phase1?.qualified || snapshot?.result?.qualified || [];
  const eliminated = snapshot?.phase1?.eliminated || snapshot?.result?.eliminated || [];
  const phase2Scores = snapshot?.phase2?.scores || [];
  const phase3Scores = snapshot?.phase3?.scores || [];

  return (
    <>
      <style>{overlayStyles}</style>
      <div className="tt-overlay" role="status" aria-live="polite">
        <div className="tt-particles">
          {particles.map(p => (
            <span
              key={p.id}
              style={{ left: p.left, top: p.top, '--x': p.x, '--y': p.y, animationDelay: p.delay }}
            />
          ))}
        </div>

        <div className="tt-stage">
          <div className="tt-tower">
            <div
              className="tt-lift"
              style={{
                bottom:
                  step === 'phase2Complete' || step === 'devPhase3'
                    ? '194px'
                    : step === 'phase2' || step === 'devPhase2'
                      ? '118px'
                      : '38px'
              }}
            />
          </div>

          {step === 'complete' && (
            <>
              <p className="tt-kicker">Open Ground</p>
              <h1 className="tt-title">PHASE 1 TERMINEE</h1>
              <p className="tt-subtitle">La base de la tour est verrouillée</p>
              <div className="tt-leaderboard">
                {rankings.map((team, index) => (
                  <div
                    className={`tt-row ${index < 4 ? 'tt-qualified' : 'eliminated'}`}
                    key={team.id}
                    style={{ animationDelay: `${index * 0.16}s` }}
                  >
                    <span className="tt-rank">#{team.rank}</span>
                    <span className="tt-name">{team.name}</span>
                    <span className="tt-score">{team.score}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {step === 'qualified' && (
            <>
              <p className="tt-kicker">4 Equipes Qualifiées</p>
              <h1 className="tt-title">REVELATION DU TOP 4</h1>
              <div className="tt-teams">
                {qualified.map((team, index) => (
                  <div className="tt-row tt-qualified" key={team.id} style={{ animationDelay: `${index * 0.5}s` }}>
                    <span className="tt-rank">#{team.rank}</span>
                    <span className="tt-name">{team.name} QUALIFIEE</span>
                    <span className="tt-score">{team.score}</span>
                  </div>
                ))}
                {eliminated.map((team, index) => (
                  <div className="tt-row eliminated" key={team.id} style={{ animationDelay: `${2 + index * 0.15}s` }}>
                    <span className="tt-rank">#{team.rank}</span>
                    <span className="tt-name">{team.name} ELIMINEE</span>
                    <span className="tt-score">{team.score}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {step === 'phase2' && (
            <>
              <p className="tt-kicker">Ascension vers Floor 2</p>
              <h1 className="tt-title">PHASE D'ELIMINATION</h1>
              <p className="tt-subtitle">CSV Challenge Elimination Round</p>
              <p className="tt-subtitle">2 Equipes Survivront</p>
              <div className="tt-countdown" key={count}>{count}</div>
            </>
          )}

          {step === 'devPhase2' && (
            <>
              <p className="tt-kicker">Pressure Floor</p>
              <h1 className="tt-title">PHASE D'ELIMINATION</h1>
              <p className="tt-subtitle">Les équipes qualifiées arrivent déjà à l'étage 2</p>
              <div className="tt-teams">
                {qualified.slice(0, 4).map((team, index) => (
                  <div className="tt-row tt-qualified" key={team.id} style={{ animationDelay: `${index * 0.18}s` }}>
                    <span className="tt-rank">#{team.rank}</span>
                    <span className="tt-name">{team.name}</span>
                    <span className="tt-score">{team.score}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {step === 'devPhase3' && (
            <>
              <p className="tt-kicker">Summit Access</p>
              <h1 className="tt-title">LA GRANDE FINALE</h1>
              <p className="tt-subtitle">Deux équipes, un duel final</p>
              <div className="tt-teams">
                {phase3Scores.slice(0, 2).map((team, index) => (
                  <div className="tt-row tt-qualified" key={team.id} style={{ animationDelay: `${index * 0.2}s` }}>
                    <span className="tt-rank">#{team.rank}</span>
                    <span className="tt-name">{team.name}</span>
                    <span className="tt-score">{team.score}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {step === 'phase2Complete' && (
            <>
              <p className="tt-kicker">Accès au Sommet</p>
              <h1 className="tt-title">2 EQUIPES QUALIFIEES</h1>
              <div className="tt-teams">
                {phase2Scores.slice(0, 2).map((team, index) => (
                  <div className="tt-row tt-qualified" key={team.id} style={{ animationDelay: `${index * 0.35}s` }}>
                    <span className="tt-rank">#{team.rank}</span>
                    <span className="tt-name">{team.name} FINALISTE</span>
                    <span className="tt-score">{team.score}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
