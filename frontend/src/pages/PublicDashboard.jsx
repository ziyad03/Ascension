import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import TeamAvatar from '../components/TeamAvatar';

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:10000';

const styles = `
  *, *::before, *::after { box-sizing: border-box; }

  :root {
    --screen-bg: #07111f;
    --screen-panel: #f8fafc;
    --screen-ink: #102033;
    --screen-muted: #64748b;
    --screen-line: rgba(15, 23, 42, 0.12);
    --screen-cyan: #17e9ff;
    --screen-blue: #14266f;
    --screen-mint: #78ead8;
    --screen-cream: #fffde8;
    --screen-red: #ef476f;
  }

  body {
    margin: 0;
    background:
      linear-gradient(135deg, rgba(120, 234, 216, 0.16), transparent 28%),
      linear-gradient(315deg, rgba(20, 38, 111, 0.3), transparent 36%),
      var(--screen-bg);
    color: var(--screen-ink);
    font-family: "DM Sans", "Segoe UI", sans-serif;
  }

  .public-root {
    min-height: 100dvh;
    padding: clamp(0.7rem, 1.4vw, 1.25rem);
  }

  .public-shell {
    min-height: calc(100dvh - clamp(1.4rem, 2.8vw, 2.5rem));
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    gap: 0.9rem;
  }

  .public-top,
  .question-panel,
  .ranking-panel,
  .team-card {
    background: rgba(248, 250, 252, 0.96);
    border: 1px solid var(--screen-line);
    border-radius: 8px;
    box-shadow: 0 18px 42px rgba(0, 0, 0, 0.18);
  }

  .public-top {
    display: grid;
    grid-template-columns: minmax(0, 1fr) repeat(3, auto);
    gap: 0.8rem;
    align-items: center;
    padding: 0.85rem 1rem;
  }

  .brand-kicker,
  .meta-label,
  .question-label,
  .ranking-title,
  .team-sub {
    margin: 0;
    color: var(--screen-muted);
    font-size: 0.78rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .brand-title {
    margin: 0.12rem 0 0;
    font-size: clamp(1.45rem, 2.5vw, 2.4rem);
    line-height: 1;
    color: var(--screen-blue);
  }

  .meta-box {
    min-width: 124px;
    padding: 0.7rem 0.8rem;
    border: 1px solid var(--screen-line);
    border-radius: 8px;
    background: #ffffff;
  }

  .meta-value {
    margin-top: 0.2rem;
    font-size: clamp(1.05rem, 1.7vw, 1.45rem);
    font-weight: 900;
    color: var(--screen-ink);
    white-space: nowrap;
  }

  .timer-value {
    color: var(--screen-red);
  }

  .timer-value.paused {
    color: #d97706;
  }

  .timer-value.danger {
    animation: pulseTimer 0.55s ease infinite alternate;
  }

  @keyframes pulseTimer {
    from { transform: scale(1); }
    to { transform: scale(1.06); }
  }

  .rank-score.score-flash,
  .team-score.score-flash {
    animation: scoreFlash 0.65s cubic-bezier(.22,1,.36,1);
    color: #15803d !important;
  }

  @keyframes scoreFlash {
    0% { transform: scale(1); }
    40% { transform: scale(1.18); }
    100% { transform: scale(1); }
  }

  .ranking-row.buzzed,
  .team-card.buzzed {
    border-color: rgba(217, 119, 6, 0.55);
    box-shadow: 0 0 18px rgba(217, 119, 6, 0.12);
    animation: buzzPulse 0.8s ease;
  }

  @keyframes buzzPulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.02); }
    100% { transform: scale(1); }
  }

  .correct-banner {
    position: fixed;
    top: 1.2rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 40;
    padding: 0.85rem 1.2rem;
    border-radius: 999px;
    border: 1px solid rgba(21, 128, 61, 0.35);
    background: rgba(240, 253, 244, 0.96);
    color: #166534;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    animation: bannerIn 0.45s ease;
  }

  @keyframes bannerIn {
    from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  .public-main {
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(280px, 360px);
    gap: 0.9rem;
  }

  .question-panel {
    min-height: 0;
    padding: clamp(1.2rem, 2.4vw, 2rem);
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    gap: 1rem;
  }

  .question-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .tag {
    padding: 0.42rem 0.62rem;
    border-radius: 8px;
    background: rgba(20, 38, 111, 0.08);
    color: var(--screen-blue);
    font-size: 0.82rem;
    font-weight: 800;
  }

  .question-text {
    align-self: center;
    margin: 0;
    color: var(--screen-ink);
    font-size: clamp(2rem, 4vw, 4.4rem);
    line-height: 1.08;
    letter-spacing: 0;
  }

  .answers-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
  }

  .answer-option {
    min-height: 72px;
    padding: 0.85rem 1rem;
    border-radius: 8px;
    border: 2px solid rgba(20, 38, 111, 0.16);
    background: #ffffff;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: clamp(1rem, 1.5vw, 1.35rem);
    font-weight: 800;
    color: var(--screen-ink);
  }

  .answer-key {
    width: 34px;
    height: 34px;
    flex: 0 0 34px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--screen-blue);
    color: var(--screen-cream);
    font-size: 0.9rem;
  }

  .ranking-panel {
    min-height: 0;
    padding: 1rem;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    gap: 0.85rem;
  }

  .ranking-list {
    min-height: 0;
    overflow: hidden;
    display: grid;
    align-content: start;
    gap: 0.55rem;
  }

  .ranking-row {
    display: grid;
    grid-template-columns: 40px minmax(0, 1fr) auto;
    gap: 0.65rem;
    align-items: center;
    padding: 0.65rem;
    border-radius: 8px;
    background: #ffffff;
    border: 1px solid var(--screen-line);
  }

  .rank-number {
    color: var(--screen-blue);
    font-size: 1.1rem;
    font-weight: 900;
  }

  .rank-name,
  .team-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 900;
  }

  .rank-score,
  .team-score {
    font-weight: 900;
    color: var(--screen-blue);
  }

  .team-strip {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 0.75rem;
  }

  .team-card {
    min-width: 0;
    padding: 0.75rem;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0.65rem;
    align-items: center;
  }

  .empty-state {
    height: 100%;
    min-height: 160px;
    display: grid;
    place-items: center;
    color: var(--screen-muted);
    font-size: 1.2rem;
    font-weight: 800;
    text-align: center;
  }

  @media (max-width: 980px) {
    .public-top {
      grid-template-columns: 1fr 1fr;
    }

    .public-main {
      grid-template-columns: 1fr;
    }

    .team-strip {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 620px) {
    .public-top,
    .answers-grid,
    .team-strip {
      grid-template-columns: 1fr;
    }

    .question-text {
      font-size: 2rem;
    }
  }
`;

function phaseLabel(phase) {
  if (phase === 'phase3') return 'La Grande Finale';
  if (phase === 'phase2' || phase === 'phase2_complete') return "Phase d'Elimination";
  if (phase === 'phase1_complete') return 'Qualification terminee';
  return 'Phase de Qualification';
}

function sortByScore(list = []) {
  return [...list].sort((a, b) => (b.score || 0) - (a.score || 0));
}

export default function PublicDashboard() {
  const [isConnected, setIsConnected] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [teams, setTeams] = useState([]);
  const [tournament, setTournament] = useState(null);
  const [timerValue, setTimerValue] = useState(0);
  const [timerMax, setTimerMax] = useState(0);
  const [timerPaused, setTimerPaused] = useState(false);
  const [buzzTeamId, setBuzzTeamId] = useState(null);
  const [scoreFlashIds, setScoreFlashIds] = useState([]);
  const [correctBanner, setCorrectBanner] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io(API_BASE);
    socketRef.current = socket;

    const syncTeams = (data) => {
      if (data?.phase3?.scores?.length) return setTeams(sortByScore(data.phase3.scores));
      if (data?.phase2?.scores?.length) return setTeams(sortByScore(data.phase2.scores));
      if (data?.phase1?.rankings?.length) return setTeams(sortByScore(data.phase1.rankings));
      return undefined;
    };

    const applyScoreFlash = (payload) => {
      if (!payload?.teamId) return;
      setScoreFlashIds((prev) => [...new Set([...prev, String(payload.teamId)])]);
      setTimeout(() => {
        setScoreFlashIds((prev) => prev.filter((id) => id !== String(payload.teamId)));
      }, 700);
    };

    const mergeScoreUpdate = (payload) => {
      if (!payload?.teamId) return;
      setTeams((prev) => {
        const list = [...prev];
        const index = list.findIndex((team) => String(team.id) === String(payload.teamId));
        if (index >= 0) {
          list[index] = { ...list[index], score: payload.score ?? list[index].score };
          return sortByScore(list);
        }
        return prev;
      });
      applyScoreFlash(payload);
      if (payload.correct) {
        setCorrectBanner(`${payload.teamName || 'Team'} · +${payload.delta || 0} pts`);
        setTimeout(() => setCorrectBanner(null), 1800);
      }
    };

    const syncTournament = (data) => {
      setTournament(data);
      syncTeams(data);

      if (data?.phase === 'phase1' && data?.phase1?.test?.pendingCategoryChoice) {
        const test = data.phase1.test;
        setCurrentQuestion({
          id: `phase1-category-choice-${test.roundNumber || 1}`,
          text: `${test.roundWinner?.name || "L'equipe gagnante"} choisit la prochaine categorie.`,
          category: 'Choix de categorie',
          points: 0,
          difficulty: 'Live',
          timeLimit: 0,
          options: test.nextCategoryChoices || []
        });
        return;
      }

      if (data?.phase1?.test?.currentQuestion) {
        const question = data.phase1.test.currentQuestion;
        setCurrentQuestion({
          id: question.id,
          text: question.text || question.question,
          category: question.category,
          points: question.points || 10,
          difficulty: question.difficulty || question.type || 'Medium',
          timeLimit: question.timeLimit || 20,
          options: question.options || question.choices || []
        });
        return;
      }

      if (data?.phase2?.currentChallenge) {
        setCurrentQuestion({
          id: data.phase2.currentChallenge.id,
          text: data.phase2.currentChallenge.question,
          category: data.phase2.currentChallenge.category || 'Challenge',
          points: data.phase2.currentChallenge.points || 0,
          difficulty: data.phase2.currentChallenge.difficulty || 'Medium',
          timeLimit: data.phase2.currentChallenge.timeLimit || 30,
          options: []
        });
        return;
      }

      if (data?.phase !== 'phase1') {
        setCurrentQuestion(null);
      }
    };

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('join', { room: 'public-room', role: 'spectator' });
    });
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('game:new_question', (data) => {
      const limit = data.timeLimit || data.timer || 20;
      setCurrentQuestion({
        id: data.id,
        text: data.text || data.question,
        category: data.category || 'General',
        points: data.points || 10,
        difficulty: data.difficulty || data.type || 'Medium',
        timeLimit: limit,
        options: data.options || data.choices || []
      });
      setTimerValue(limit);
      setTimerMax(limit);
      setTimerPaused(false);
      setBuzzTeamId(null);
    });
    socket.on('game:clear_question', () => setCurrentQuestion(null));
    socket.on('score:refresh', (data) => {
      if (data?.teams?.length) setTeams(sortByScore(data.teams));
    });
    socket.on('score:update', mergeScoreUpdate);
    socket.on('game:answer_result', mergeScoreUpdate);

    socket.on('game:timer', (payload) => {
      if (payload && typeof payload === 'object') {
        if (payload.phase === 'phase2') {
          if (Number.isFinite(Number(payload.timeLeft))) setTimerValue(Number(payload.timeLeft));
          return;
        }
        if (Number.isFinite(Number(payload.timeLeft))) {
          setTimerValue(Number(payload.timeLeft));
          if (Number.isFinite(Number(payload.timerMax))) setTimerMax(Number(payload.timerMax));
        }
        return;
      }
      if (typeof payload === 'number') setTimerValue(payload);
    });

    socket.on('game:timer_stop', ({ timeLeft, phase }) => {
      if (phase === 'phase2') return;
      if (Number.isFinite(Number(timeLeft))) setTimerValue(Number(timeLeft));
      setTimerPaused(true);
    });

    socket.on('phase2:timer', ({ timer }) => {
      if (Number.isFinite(Number(timer))) setTimerValue(Number(timer));
    });

    socket.on('buzz:first', ({ teamId, buzzTime }) => {
      setBuzzTeamId(String(teamId || ''));
      if (Number.isFinite(Number(buzzTime))) setTimerValue(Number(buzzTime));
      setTimerPaused(true);
      setTimeout(() => setBuzzTeamId(null), 2500);
    });

    [
      'tournament:state',
      'tournament:phase1_complete',
      'tournament:phase2_started',
      'phase2:challenge_started',
      'phase2:submission_update',
      'phase2:scores_updated',
      'phase2:round_winner',
      'phase2:hint_usage_update',
      'phase2:round_ended',
      'phase2:round_timeout',
      'phase2:round_skipped',
      'phase2:team_eliminated',
      'tournament:phase2_complete',
      'tournament:dev_phase2_started',
      'tournament:dev_phase3_started',
      'tournament:dev_state_updated',
      'tournament:dev_reset',
      'phase1:test_state_updated',
      'phase1:test_reset',
      'phase1:test_simulation_complete'
    ].forEach(event => socket.on(event, syncTournament));

    socket.on('phase1:test_question_started', (payload) => {
      if (payload?.question) {
        const limit = payload.question.timeLimit || 20;
        setCurrentQuestion({
          id: payload.question.id,
          text: payload.question.text || payload.question.question,
          category: payload.question.category,
          points: payload.question.points || 10,
          difficulty: payload.question.difficulty || payload.question.type || 'Medium',
          timeLimit: limit,
          options: payload.question.options || payload.question.choices || []
        });
        setTimerValue(limit);
        setTimerMax(limit);
        setTimerPaused(false);
      }
      if (payload?.snapshot) syncTournament(payload.snapshot);
    });
    socket.on('phase1:category_choices', (payload) => payload?.snapshot && syncTournament(payload.snapshot));
    socket.on('phase1:category_chosen', (payload) => payload?.snapshot && syncTournament(payload.snapshot));

    fetch(`${API_BASE}/api/tournament/state`)
      .then(response => response.json())
      .then(syncTournament)
      .catch(() => {});

    return () => socket.disconnect();
  }, []);

  const leaderboard = useMemo(() => sortByScore(teams), [teams]);
  const phase = phaseLabel(tournament?.phase || 'phase1');
  const roundNumber = tournament?.phase === 'phase2'
    ? tournament?.phase2?.roundNumber || 0
    : tournament?.phase1?.test?.roundNumber || 0;
  const displayTimer = tournament?.phase === 'phase2'
    ? (Number.isFinite(Number(tournament?.phase2?.timer)) ? tournament.phase2.timer : timerValue)
    : timerValue;
  const displayTimerMax = tournament?.phase === 'phase2'
    ? (tournament?.phase2?.timerMax || currentQuestion?.timeLimit || timerMax || 0)
    : (timerMax || currentQuestion?.timeLimit || 0);
  const timerDanger = !timerPaused && displayTimer <= 5 && displayTimer > 0;
  const options = currentQuestion?.options || [];

  return (
    <>
      <style>{styles}</style>
      <div className="public-root">
        {correctBanner && <div className="correct-banner">{correctBanner}</div>}
        <div className="public-shell">
          <header className="public-top">
            <div>
              <p className="brand-kicker">{isConnected ? 'Live' : 'Offline'}</p>
              <h1 className="brand-title">ISGA Summit Challenge</h1>
            </div>
            <div className="meta-box">
              <p className="meta-label">Phase</p>
              <div className="meta-value">{phase}</div>
            </div>
            <div className="meta-box">
              <p className="meta-label">Round</p>
              <div className="meta-value">{roundNumber}</div>
            </div>
            <div className="meta-box">
              <p className="meta-label">Timer</p>
              <div className={`meta-value timer-value ${timerPaused ? 'paused' : ''} ${timerDanger ? 'danger' : ''}`}>
                {displayTimer}s
              </div>
            </div>
          </header>

          <main className="public-main">
            <section className="question-panel">
              <div>
                <p className="question-label">Question</p>
                <div className="question-tags">
                  <span className="tag">{currentQuestion?.category || 'En attente'}</span>
                  <span className="tag">{currentQuestion?.difficulty || 'Medium'}</span>
                  <span className="tag">{currentQuestion?.points || 10} pts</span>
                </div>
              </div>

              <h2 className="question-text">
                {currentQuestion?.text || "En attente de la prochaine question."}
              </h2>

              {options.length > 0 ? (
                <div className="answers-grid">
                  {options.slice(0, 4).map((option, index) => (
                    <div className="answer-option" key={`${option}-${index}`}>
                      <span className="answer-key">{String.fromCharCode(65 + index)}</span>
                      <span>{option}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">Les reponses seront affichees avec la question.</div>
              )}
            </section>

            <aside className="ranking-panel">
              <p className="ranking-title">Live Ranking</p>
              <div className="ranking-list">
                {leaderboard.slice(0, 8).map((team, index) => (
                  <div
                    className={`ranking-row ${buzzTeamId === String(team.id) ? 'buzzed' : ''}`}
                    key={`${team.id}-${index}`}
                  >
                    <div className="rank-number">#{index + 1}</div>
                    <div className="rank-name">{team.name}</div>
                    <div className={`rank-score ${scoreFlashIds.includes(String(team.id)) ? 'score-flash' : ''}`}>{team.score ?? 0}</div>
                  </div>
                ))}
                {leaderboard.length === 0 && (
                  <div className="empty-state">Aucune equipe connectee.</div>
                )}
              </div>
            </aside>
          </main>

          <section className="team-strip">
            {leaderboard.slice(0, 6).map((team, index) => (
              <div className={`team-card ${buzzTeamId === String(team.id) ? 'buzzed' : ''}`} key={`team-card-${team.id}-${index}`}>
                <TeamAvatar
                  name={team.name}
                  avatar={team.avatar}
                  color={team.color || '#17e9ff'}
                  tag={team.tag}
                  size={42}
                />
                <div style={{ minWidth: 0 }}>
                  <div className="team-name">{team.name}</div>
                  <p className="team-sub">{team.tag || 'TEAM'}</p>
                  <div className={`team-score ${scoreFlashIds.includes(String(team.id)) ? 'score-flash' : ''}`}>{team.score ?? 0} pts</div>
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>
    </>
  );
}
