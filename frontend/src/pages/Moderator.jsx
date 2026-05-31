import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import TeamAvatar from '../components/TeamAvatar';

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:10000';

const styles = `
  *, *::before, *::after { box-sizing: border-box; }

  :root {
    --mod-bg: #050341;
    --mod-panel: rgba(6, 3, 63, 0.9);
    --mod-panel-soft: rgba(255,253,232,0.07);
    --mod-line: rgba(23, 233, 255, 0.24);
    --mod-text: #fffde8;
    --mod-muted: rgba(255,253,232,0.68);
    --mod-cyan: #17e9ff;
    --mod-violet: #c6b9ff;
    --mod-gold: #fffde8;
    --mod-green: #4ade80;
    --mod-red: #fb7185;
  }

  body {
    margin: 0;
    background:
      radial-gradient(circle at top left, rgba(120,234,216,0.26), transparent 24%),
      radial-gradient(circle at top right, rgba(198,185,255,0.22), transparent 26%),
      linear-gradient(135deg, #3d2f82 0%, #14266f 44%, #050341 100%);
    color: var(--mod-text);
    font-family: Inter, system-ui, sans-serif;
  }

  .mod-root {
    min-height: 100dvh;
    padding: 1.1rem;
  }

  .mod-shell {
    max-width: 1500px;
    margin: 0 auto;
    display: grid;
    gap: 1rem;
  }

  .mod-header,
  .mod-panel {
    background: var(--mod-panel);
    border: 2px solid var(--mod-line);
    border-radius: 8px;
    backdrop-filter: blur(20px);
    box-shadow: 0 0 18px rgba(23,233,255,0.16);
  }

  .mod-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.05rem 1.2rem;
  }

  .mod-kicker {
    color: #a5f3fc;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    font-weight: 700;
  }

  .mod-title {
    margin: 0.28rem 0 0;
    font-size: clamp(1.4rem, 2.2vw, 2rem);
    line-height: 1.05;
  }

  .mod-sub {
    margin: 0.42rem 0 0;
    color: var(--mod-muted);
    font-size: 0.92rem;
  }

  .mod-badges {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .mod-badge {
    min-height: 44px;
    padding: 0.65rem 0.9rem;
    border-radius: 999px;
    border: 2px solid var(--mod-line);
    background: rgba(255,255,255,0.05);
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    font-size: 0.82rem;
    color: var(--mod-text);
  }

  .mod-dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--mod-green);
    box-shadow: 0 0 12px var(--mod-green);
  }

  .mod-dot.off {
    background: var(--mod-red);
    box-shadow: 0 0 12px var(--mod-red);
  }

  .timer-pill {
    min-width: 86px;
    justify-content: center;
    font-weight: 800;
    font-size: 1rem;
  }

  .timer-pill.paused {
    border-color: rgba(251, 191, 36, 0.45);
    color: #fde68a;
    box-shadow: 0 0 18px rgba(251, 191, 36, 0.18);
  }

  .team-score.score-flash {
    animation: scoreFlash 0.65s cubic-bezier(.22,1,.36,1);
    color: #4ade80 !important;
  }

  @keyframes scoreFlash {
    0% { transform: scale(1); }
    40% { transform: scale(1.18); }
    100% { transform: scale(1); }
  }

  .answer-card.correct-pop {
    animation: correctPop 0.55s ease;
    border-color: rgba(74, 222, 128, 0.45);
    box-shadow: 0 0 24px rgba(34, 197, 94, 0.18);
  }

  @keyframes correctPop {
    0% { transform: scale(0.98); opacity: 0.85; }
    100% { transform: scale(1); opacity: 1; }
  }

  .score-toast {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 90;
    padding: 0.75rem 1rem;
    border-radius: 14px;
    border: 1px solid rgba(74, 222, 128, 0.45);
    background: rgba(6, 24, 16, 0.92);
    color: #bbf7d0;
    font-weight: 700;
    animation: toastIn 0.45s ease;
  }

  @keyframes toastIn {
    from { transform: translateY(-8px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  .simple-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.25fr) minmax(320px, 0.75fr);
    gap: 1rem;
    align-items: start;
  }

  .column {
    display: grid;
    gap: 1rem;
  }

  .mod-panel {
    padding: 1rem;
    display: grid;
    gap: 0.95rem;
  }

  .panel-head {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 1rem;
  }

  .panel-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 800;
  }

  .panel-copy {
    margin: 0.28rem 0 0;
    color: var(--mod-muted);
    font-size: 0.86rem;
    line-height: 1.45;
  }

  .status-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.75rem;
  }

  .status-card {
    padding: 0.8rem;
    border-radius: 18px;
    background: var(--mod-panel-soft);
    border: 1px solid rgba(255,255,255,0.06);
  }

  .status-label {
    color: var(--mod-muted);
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-weight: 700;
  }

  .status-value {
    margin-top: 0.42rem;
    font-size: 1.02rem;
    font-weight: 800;
  }

  .button-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.65rem;
  }

  .action-btn {
    appearance: none;
    border: 2px solid rgba(23,233,255,0.22);
    background: rgba(255,253,232,0.07);
    color: var(--mod-text);
    border-radius: 999px;
    padding: 0.72rem 0.95rem;
    cursor: pointer;
    font-size: 0.84rem;
    font-weight: 700;
    transition: transform 0.18s ease, border-color 0.18s ease, opacity 0.18s ease;
  }

  .action-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    border-color: rgba(103,232,249,0.26);
  }

  .action-btn:disabled {
    cursor: not-allowed;
    opacity: 0.44;
  }

  .action-btn.primary {
    background: linear-gradient(135deg, rgba(103,232,249,0.22), rgba(59,130,246,0.18));
    border-color: rgba(103,232,249,0.26);
  }

  .action-btn.gold {
    background: linear-gradient(135deg, rgba(251,191,36,0.22), rgba(249,115,22,0.18));
    border-color: rgba(251,191,36,0.26);
  }

  .action-btn.red {
    background: linear-gradient(135deg, rgba(251,113,133,0.22), rgba(239,68,68,0.18));
    border-color: rgba(251,113,133,0.26);
  }

  .action-btn.green {
    background: linear-gradient(135deg, rgba(74,222,128,0.22), rgba(16,185,129,0.18));
    border-color: rgba(74,222,128,0.26);
  }

  .stack {
    display: grid;
    gap: 0.75rem;
  }

  .question-list,
  .challenge-list,
  .feed-list {
    display: grid;
    gap: 0.7rem;
    max-height: 360px;
    overflow: auto;
    padding-right: 0.2rem;
  }

  .question-item,
  .challenge-item,
  .feed-card,
  .answer-card,
  .team-row {
    border-radius: 18px;
    border: 1px solid rgba(255,255,255,0.07);
    background: rgba(255,255,255,0.045);
  }

  .question-item,
  .challenge-item {
    padding: 0.8rem;
    text-align: left;
    color: inherit;
    cursor: pointer;
  }

  .question-item.active,
  .challenge-item.active {
    border-color: rgba(103,232,249,0.26);
    box-shadow: 0 0 0 1px rgba(103,232,249,0.18) inset;
  }

  .item-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .item-title {
    font-weight: 700;
    line-height: 1.42;
  }

  .item-meta {
    margin-top: 0.45rem;
    color: var(--mod-muted);
    font-size: 0.78rem;
  }

  .pill-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
  }

  .mini-pill {
    padding: 0.28rem 0.55rem;
    border-radius: 999px;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 700;
    background: rgba(255,255,255,0.06);
    color: #cbd5e1;
  }

  .mini-pill.cyan { color: #a5f3fc; background: rgba(103,232,249,0.1); }
  .mini-pill.gold { color: #fde68a; background: rgba(251,191,36,0.1); }
  .mini-pill.red { color: #fda4af; background: rgba(251,113,133,0.1); }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
  }

  .form-grid.full textarea {
    grid-column: 1 / -1;
  }

  .input,
  .select,
  .textarea,
  .file-input {
    width: 100%;
    border-radius: 14px;
    border: 1px solid rgba(148,163,184,0.18);
    background: rgba(15,23,42,0.58);
    color: var(--mod-text);
    padding: 0.8rem 0.9rem;
    font: inherit;
  }

  .textarea {
    resize: vertical;
    min-height: 110px;
  }

  .split-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 0.75rem;
  }

  .team-list {
    display: grid;
    gap: 0.65rem;
  }

  .team-row {
    padding: 0.8rem;
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 0.75rem;
    align-items: center;
  }

  .team-name {
    font-weight: 700;
  }

  .team-sub {
    margin-top: 0.18rem;
    font-size: 0.76rem;
    color: var(--mod-muted);
  }

  .team-score {
    font-weight: 800;
    color: #fde68a;
  }

  .answer-card,
  .feed-card {
    padding: 0.8rem;
    display: grid;
    gap: 0.55rem;
  }

  .answer-actions {
    display: flex;
    gap: 0.55rem;
    flex-wrap: wrap;
  }

  .feed-copy,
  .muted {
    color: var(--mod-muted);
    font-size: 0.8rem;
    line-height: 1.45;
  }

  .current-banner {
    padding: 0.95rem 1rem;
    border-radius: 20px;
    background: linear-gradient(135deg, rgba(103,232,249,0.1), rgba(139,92,246,0.08));
    border: 1px solid rgba(103,232,249,0.16);
  }

  .current-label {
    color: #a5f3fc;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    font-weight: 700;
  }

  .current-text {
    margin-top: 0.5rem;
    font-size: 1rem;
    line-height: 1.46;
    font-weight: 700;
  }

  .dev-drawer {
    border-radius: 24px;
    border: 1px solid rgba(167,139,250,0.2);
    background: rgba(36, 22, 68, 0.86);
    padding: 1rem;
    display: grid;
    gap: 0.9rem;
  }

  .dev-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.75rem;
  }

  .dev-box {
    border-radius: 18px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.08);
    padding: 0.85rem;
    display: grid;
    gap: 0.65rem;
  }

  .dev-title {
    font-size: 0.74rem;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: #c4b5fd;
    font-weight: 800;
  }

  @media (max-width: 1180px) {
    .simple-grid {
      grid-template-columns: 1fr;
    }

    .status-grid,
    .dev-grid,
    .split-row,
    .form-grid {
      grid-template-columns: 1fr;
    }
  }
`;

const PHASE1_CATEGORIES = [
  'Technology',
  'Programming',
  'Web Development',
  'Mobile Development',
  'Databases',
  'Networking',
  'Cybersecurity',
  'Artificial Intelligence',
  'Machine Learning',
  'Cloud Computing',
  'Science',
  'Mathematics',
  'Logic',
  'History',
  'Geography',
  'Economics',
  'Business',
  'Entrepreneurship',
  'Startups',
  'Engineering',
  'Electronics',
  'Culture',
  'Cinema',
  'Literature',
  'Sports',
  'General Knowledge',
  'Mixed Challenges'
];

export default function Moderator() {
  const [sessionActive, setSessionActive] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [timer, setTimer] = useState(30);
  const [maxTimer, setMaxTimer] = useState(30);
  const [timerPaused, setTimerPaused] = useState(false);
  const [scoreFlashIds, setScoreFlashIds] = useState([]);
  const [scoreToast, setScoreToast] = useState(null);
  const [tournament, setTournament] = useState(null);
  const [packs, setPacks] = useState([]);
  const [csvFile, setCsvFile] = useState(null);
  const [csvPreview, setCsvPreview] = useState(null);
  const [selectedChallenge, setSelectedChallenge] = useState(null);
  const [challengeDraft, setChallengeDraft] = useState(null);
  const [editStatus, setEditStatus] = useState('');
  const [devStatus, setDevStatus] = useState({ enabled: false, panel: false });
  const [devPanelOpen, setDevPanelOpen] = useState(() => localStorage.getItem('crazy:dev-panel') === '1');
  const [devTeamTarget, setDevTeamTarget] = useState('');
  const [manualEliminationTarget, setManualEliminationTarget] = useState('');
  const [phase1TestSpeed, setPhase1TestSpeed] = useState('5x');
  const [phase1TestStatus, setPhase1TestStatus] = useState('');
  const [phase1Category, setPhase1Category] = useState('Mixed Challenges');
  const [ollamaStatus, setOllamaStatus] = useState({ ready: false, modelAvailable: false });
  const [phase2RoundType, setPhase2RoundType] = useState('random');
  const [phase2PackGenStatus, setPhase2PackGenStatus] = useState('');

  const PHASE2_ROUND_TYPES = [
    { value: 'random', label: 'Random (50%)' },
    { value: 'standard', label: 'Standard' },
    { value: 'double_points', label: 'Double Points (+20)' },
    { value: 'fastest_bonus', label: 'Fast Answer Bonus (+12)' },
    { value: 'risk_round', label: 'Risk Round (wager)' },
    { value: 'sudden_question', label: 'Sudden Question (half timer)' },
    { value: 'no_hint', label: 'No Hint Round' },
    { value: 'mystery_challenge', label: 'Mystery Challenge' }
  ];

  const socketRef = useRef(null);

  const refreshOllamaStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/ai/ollama/status`);
      const data = await res.json();
      setOllamaStatus(data || { ready: false, modelAvailable: false });
      return data;
    } catch {
      setOllamaStatus({ ready: false, modelAvailable: false, error: 'Status check failed' });
      return null;
    }
  };

  const loadPacks = async () => {
    const res = await fetch(`${API_BASE}/api/phase2/packs`);
    const data = await res.json();
    setPacks(Array.isArray(data) ? data : []);
  };

  const generatePhase2OllamaPack = async () => {
    setPhase2PackGenStatus('Generating 7 Ollama questions (1 per round type)...');
    try {
      const res = await fetch(`${API_BASE}/api/phase2/packs/generate-mock-ollama`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (!res.ok) {
        setPhase2PackGenStatus(data?.error || 'Ollama pack generation failed');
        return;
      }
      await loadPacks();
      const firstChallenge = data?.pack?.challenges?.[0];
      if (firstChallenge) {
        setSelectedChallenge(firstChallenge);
        if (firstChallenge.recommendedModifier) {
          setPhase2RoundType(firstChallenge.recommendedModifier);
        }
      }
      setPhase2PackGenStatus(
        `Ollama pack ready · ${data.ollamaCount || 0} AI · ${data.fallbackCount || 0} fallback · ${data.pack?.challengeCount || 0} challenges`
      );
    } catch (error) {
      setPhase2PackGenStatus(error.message || 'Ollama pack generation failed');
    }
  };

  useEffect(() => {
    const socket = io(API_BASE);
    socketRef.current = socket;

    socket.emit('join', { room: 'session-1', role: 'moderator' });
    socket.emit('join', { room: 'moderator-session', role: 'moderator' });

    socket.on('game:answer_received', (data) => setAnswers((prev) => [...prev, data]));

    const applyScoreFlash = (payload) => {
      if (!payload?.teamId) return;
      setScoreFlashIds((prev) => [...new Set([...prev, String(payload.teamId)])]);
      setTimeout(() => {
        setScoreFlashIds((prev) => prev.filter((id) => id !== String(payload.teamId)));
      }, 700);
      if (payload.correct) {
        setScoreToast(`${payload.teamName || 'Team'} · +${payload.delta || 0} pts`);
        setTimeout(() => setScoreToast(null), 1800);
      }
    };

    const mergeScoreUpdate = (payload) => {
      if (!payload?.teamId) return;
      setTeams((prev) => {
        const list = [...prev];
        const index = list.findIndex((team) => String(team.id) === String(payload.teamId));
        if (index >= 0) {
          list[index] = { ...list[index], score: payload.score ?? list[index].score };
          return list;
        }
        return prev;
      });
      setTournament((prev) => {
        if (!prev) return prev;
        if (payload.phase === 'phase2' && prev.phase2?.scores?.length) {
          return {
            ...prev,
            phase2: {
              ...prev.phase2,
              scores: prev.phase2.scores.map((team) => (
                String(team.id) === String(payload.teamId)
                  ? { ...team, score: payload.score ?? team.score }
                  : team
              ))
            }
          };
        }
        if (prev.phase1?.rankings?.length) {
          return {
            ...prev,
            phase1: {
              ...prev.phase1,
              rankings: prev.phase1.rankings.map((team) => (
                String(team.id) === String(payload.teamId)
                  ? { ...team, score: payload.score ?? team.score }
                  : team
              ))
            }
          };
        }
        return prev;
      });
      applyScoreFlash(payload);
    };

    socket.on('score:refresh', (data) => {
      if (data?.teams?.length) setTeams(data.teams);
    });

    socket.on('score:update', mergeScoreUpdate);
    socket.on('game:answer_result', mergeScoreUpdate);

    socket.on('game:timer', (payload) => {
      if (payload && typeof payload === 'object' && payload.phase === 'phase1') {
        if (Number.isFinite(Number(payload.timeLeft))) setTimer(Number(payload.timeLeft));
        return;
      }
      if (typeof payload === 'number') setTimer(payload);
    });

    socket.on('game:timer_stop', ({ timeLeft, phase }) => {
      if (phase === 'phase2') return;
      if (Number.isFinite(Number(timeLeft))) setTimer(Number(timeLeft));
      setTimerPaused(true);
    });

    socket.on('buzz:first', ({ buzzTime }) => {
      if (Number.isFinite(Number(buzzTime))) setTimer(Number(buzzTime));
      setTimerPaused(true);
    });

    const syncTournament = (data) => setTournament(data);
    const syncPhase1Test = (payload) => {
      const snapshot = payload?.snapshot || payload;
      if (snapshot?.phase) {
        setTournament(snapshot);
      }
      if (snapshot?.phase1?.rankings?.length) {
        setTeams(snapshot.phase1.rankings);
      }
    };
    socket.on('tournament:state', syncTournament);
    socket.on('tournament:phase1_complete', syncTournament);
    socket.on('tournament:phase2_started', syncTournament);
    socket.on('phase2:challenge_started', syncTournament);
    socket.on('phase2:submission_update', syncTournament);
    socket.on('phase2:round_winner', syncTournament);
    socket.on('phase2:hint_usage_update', syncTournament);
    socket.on('phase2:pause_update', syncTournament);
    socket.on('phase2:round_ended', syncTournament);
    socket.on('phase2:round_timeout', syncTournament);
    socket.on('phase2:round_skipped', syncTournament);
    socket.on('phase2:team_eliminated', syncTournament);
    socket.on('tournament:phase2_complete', syncTournament);
    socket.on('tournament:dev_phase2_started', syncTournament);
    socket.on('tournament:dev_phase3_started', syncTournament);
    socket.on('tournament:dev_state_updated', syncTournament);
    socket.on('tournament:dev_reset', syncTournament);
    socket.on('phase1:test_state_updated', syncPhase1Test);
    socket.on('phase1:announced', (payload) => {
      syncPhase1Test(payload);
      setPhase1TestStatus('Phase 1 announced');
    });
    socket.on('phase1:test_questions_generated', (payload) => {
      setQuestions(payload.questions || []);
      setCurrentQuestion(payload.snapshot?.phase1?.test?.currentQuestion || (payload.startImmediately ? payload.questions?.[0] : null) || null);
      syncPhase1Test(payload);
      setPhase1TestStatus(`Round ${payload.roundNumber || 1} · ${payload.category || 'Category'} · ${payload.questions?.length || 0} questions loaded`);
    });
    socket.on('phase1:category_bank_regenerated', (payload) => {
      setQuestions(payload.questions || []);
      syncPhase1Test(payload);
      if (payload.ollama?.modelAvailable) {
        setPhase1TestStatus(`Ollama phi3 · ${payload.count || 0} questions · ${payload.category || phase1Category}`);
      } else {
        setPhase1TestStatus(`Local bank fallback · ${payload.count || 0} questions · ${payload.category || phase1Category}`);
      }
      refreshOllamaStatus().catch(() => {});
    });
    socket.on('phase1:test_question_started', (payload) => {
      setCurrentQuestion(payload.question || null);
      setTimer(payload.question?.timeLimit || 30);
      setMaxTimer(payload.question?.timeLimit || 30);
      setTimerPaused(false);
      setAnswers([]);
      syncPhase1Test(payload);
    });
    socket.on('phase1:category_choices', (payload) => {
      syncPhase1Test(payload);
      const winnerName = payload.roundWinner?.name || 'Round winner';
      setPhase1TestStatus(`${winnerName} chooses next category`);
    });
    socket.on('phase1:category_chosen', (payload) => {
      syncPhase1Test(payload);
      setPhase1TestStatus(`Next category: ${payload.category}`);
    });
    socket.on('phase1:test_reset', (payload) => {
      setQuestions([]);
      setCurrentQuestion(null);
      setAnswers([]);
      setTeams([]);
      setTimer(30);
      setMaxTimer(30);
      syncPhase1Test(payload);
      setPhase1TestStatus('Phase 1 restarted');
    });
    socket.on('phase1:test_simulation_complete', (payload) => {
      syncPhase1Test(payload);
      setPhase1TestStatus('Simulation complete');
    });
    socket.on('game:clear_question', () => {
      setCurrentQuestion(null);
      setAnswers([]);
    });
    socket.on('phase:error', (payload) => {
      setPhase1TestStatus(payload?.error || 'Test action failed');
    });

    let cancelled = false;

    fetch(`${API_BASE}/api/questions`)
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) {
          setQuestions(Array.isArray(data) ? data : []);
        }
      })
      .catch(() => {});

    fetch(`${API_BASE}/api/phase2/packs`)
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) {
          setPacks(Array.isArray(data) ? data : []);
        }
      })
      .catch(() => {});

    fetch(`${API_BASE}/api/tournament/dev/status`)
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) {
          setDevStatus(data || { enabled: false, panel: false });
        }
      })
      .catch(() => {});

    fetch(`${API_BASE}/api/tournament/state`)
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) {
          setTournament(data);
        }
      })
      .catch(() => {});

    refreshOllamaStatus().catch(() => {});

    return () => {
      cancelled = true;
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!devStatus.enabled) return undefined;

    const onKeyDown = (event) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'm') {
        event.preventDefault();
        setDevPanelOpen((prev) => {
          const next = !prev;
          localStorage.setItem('crazy:dev-panel', next ? '1' : '0');
          return next;
        });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [devStatus.enabled]);

  useEffect(() => {
    if (!sessionActive || timer <= 0 || tournament?.phase === 'phase2' || timerPaused) return undefined;
    const id = setInterval(() => setTimer((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(id);
  }, [sessionActive, timer, tournament?.phase, timerPaused]);

  const startSession = () => {
    setSessionActive(true);
    setPhase1TestStatus(`Phase 1 announced · ${phase1Category}`);
    socketRef.current?.emit('phase1:announce', { category: phase1Category });
    socketRef.current?.emit('game:start', { sessionId: 'session-1' });
  };

  const stopSession = () => {
    setSessionActive(false);
    setTimer(30);
    setMaxTimer(30);
    socketRef.current?.emit('game:stop', { sessionId: 'session-1' });
  };

  const sendQuestion = (question) => {
    setCurrentQuestion(question);
    socketRef.current?.emit('moderator:send_question', {
      id: question.id,
      text: question.text,
      question: question.text,
      options: question.options,
      choices: question.choices || question.options || [],
      type: question.type,
      points: question.points,
      category: question.category,
      difficulty: question.difficulty,
      timer: question.timeLimit || 20,
      timeLimit: question.timeLimit || 20
    });
    setAnswers([]);
    setTimer(question.timeLimit || 20);
    setMaxTimer(question.timeLimit || 20);
    setTimerPaused(false);
  };

  const previewCsv = async () => {
    if (!csvFile) return;
    const formData = new FormData();
    formData.append('file', csvFile);
    const res = await fetch(`${API_BASE}/api/phase2/packs/preview`, { method: 'POST', body: formData });
    setCsvPreview(await res.json());
  };

  const importCsv = async () => {
    if (!csvFile) return;
    const formData = new FormData();
    formData.append('file', csvFile);
    formData.append('name', csvFile.name.replace(/\.csv$/i, ''));
    const res = await fetch(`${API_BASE}/api/phase2/packs/import`, { method: 'POST', body: formData });
    const data = await res.json();

    if (!res.ok) {
      setCsvPreview(data);
      return;
    }

    setCsvPreview(null);
    setCsvFile(null);
    await loadPacks().catch(() => {});
  };

  const saveChallengeEdit = async () => {
    if (!challengeDraft?.id || !challengeDraft?.packId) return;

    const res = await fetch(`${API_BASE}/api/phase2/packs/${challengeDraft.packId}/challenges/${challengeDraft.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(challengeDraft)
    });
    const data = await res.json();

    if (!res.ok) {
      setEditStatus(data.error || 'Erreur de sauvegarde');
      return;
    }

    setEditStatus('Challenge mis a jour');
    await loadPacks().catch(() => {});
    setSelectedChallenge(data.challenge);
    setChallengeDraft({
      id: data.challenge.id,
      packId: data.challenge.packId,
      question: data.challenge.question || '',
      answer: data.challenge.answer || '',
      hint: data.challenge.hint || '',
      category: data.challenge.category || '',
      difficulty: data.challenge.difficulty || 'Medium',
      points: data.challenge.points ?? 10,
      penalty: data.challenge.penalty ?? -1,
      timeLimit: data.challenge.timeLimit ?? 30
    });
  };

  const regenerateDraftHint = async () => {
    if (!challengeDraft?.id || !challengeDraft?.packId) return;

    const res = await fetch(`${API_BASE}/api/phase2/packs/${challengeDraft.packId}/challenges/${challengeDraft.id}/regenerate-hint`, {
      method: 'POST'
    });
    const data = await res.json();

    if (!res.ok) {
      setEditStatus(data.error || "Erreur de generation d'indice");
      return;
    }

    setEditStatus('Indice regenere');
    setSelectedChallenge(data.challenge);
    setChallengeDraft({
      id: data.challenge.id,
      packId: data.challenge.packId,
      question: data.challenge.question || '',
      answer: data.challenge.answer || '',
      hint: data.challenge.hint || '',
      category: data.challenge.category || '',
      difficulty: data.challenge.difficulty || 'Medium',
      points: data.challenge.points ?? 10,
      penalty: data.challenge.penalty ?? -1,
      timeLimit: data.challenge.timeLimit ?? 30
    });
    await loadPacks().catch(() => {});
  };

  const endPhase1 = () => socketRef.current?.emit('phase1:end');
  const startPhase2 = () => socketRef.current?.emit('phase2:start');
  const pausePhase2 = () => socketRef.current?.emit('phase2:pause', { paused: !tournament?.phase2?.paused });
  const startPhase2Challenge = () => {
    if (!selectedChallenge) return;
    socketRef.current?.emit('phase2:start_challenge', {
      challengeId: selectedChallenge.id,
      modifier: phase2RoundType
    });
  };
  const endRound = () => socketRef.current?.emit('phase2:end_round');
  const skipChallenge = () => socketRef.current?.emit('phase2:skip_challenge');
  const forceNextRound = () => socketRef.current?.emit('phase2:force_next_round');
  const revealHint = () => socketRef.current?.emit('phase2:reveal_hint');
  const regenerateHint = () => socketRef.current?.emit('phase2:regenerate_hint');
  const revealAnswer = () => socketRef.current?.emit('phase2:reveal_answer');
  const endPhase2 = () => socketRef.current?.emit('phase2:end');
  const forceQualification = () => devTeamTarget && socketRef.current?.emit('dev:force_qualification', { teamId: devTeamTarget });
  const forceElimination = () => devTeamTarget && socketRef.current?.emit('dev:force_elimination', { teamId: devTeamTarget });
  const generatePhase1Questions = (shuffle = false) => {
    const shouldShuffle = shuffle === true;
    setPhase1TestStatus(shouldShuffle ? 'Drawing 10 new questions...' : 'Loading 10 questions...');
    socketRef.current?.emit('phase1:test_generate_questions', {
      category: phase1Category,
      startImmediately: false,
      fast: true,
      shuffle: shouldShuffle
    });
  };
  const regeneratePhase1Bank = async () => {
    setPhase1TestStatus(`Generating ${phase1Category} bank via Ollama phi3...`);
    const status = await refreshOllamaStatus();
    if (!status?.modelAvailable) {
      setPhase1TestStatus(status?.error || 'Ollama phi3 unavailable — using local bank fallback');
    }
    socketRef.current?.emit('phase1:test_regenerate_category_bank', {
      category: phase1Category,
      targetCount: 50
    });
  };
  const generatePhase1MockTeams = () => {
    setPhase1TestStatus('Generating mock teams...');
    socketRef.current?.emit('phase1:test_generate_mock_teams');
  };
  const autoAnswerPhase1 = () => {
    setPhase1TestStatus('Auto answer applied');
    socketRef.current?.emit('phase1:test_auto_answer');
  };
  const skipPhase1Question = () => {
    setPhase1TestStatus('Question skipped');
    socketRef.current?.emit('phase1:test_skip_question');
  };
  const skipPhase1Round = () => {
    setPhase1TestStatus('Round skipped');
    socketRef.current?.emit('phase1:test_skip_round');
  };
  const finishPhase1Round = () => {
    setPhase1TestStatus('Round finished');
    socketRef.current?.emit('phase1:test_finish_round');
  };
  const choosePhase1Category = (category) => {
    setPhase1TestStatus(`Next category: ${category}`);
    socketRef.current?.emit('phase1:choose_category', { category, teamId: 'moderator' });
  };
  const finishPhase1Test = () => {
    setPhase1TestStatus('Finishing Phase 1...');
    socketRef.current?.emit('phase1:test_finish_phase');
  };
  const jumpToQualificationReveal = () => {
    setPhase1TestStatus('Qualification reveal');
    socketRef.current?.emit('phase1:test_jump_qualification');
  };
  const restartPhase1Test = () => {
    setPhase1TestStatus('Restarting Phase 1...');
    socketRef.current?.emit('phase1:test_restart');
  };
  const simulatePhase1Tournament = () => {
    setPhase1TestStatus(`Simulating tournament (${phase1TestSpeed})...`);
    socketRef.current?.emit('phase1:test_simulate_tournament', { speed: phase1TestSpeed });
  };
  const manualEliminate = () => manualEliminationTarget && socketRef.current?.emit('phase2:manual_eliminate', { teamId: manualEliminationTarget });

  const validateAnswer = (answer, accepted) => {
    if (!socketRef.current) return;

    socketRef.current.emit('answer:validate', {
      teamId: answer.teamId || 'team-unknown',
      accepted,
      points: accepted ? (answer.points || currentQuestion?.points || 10) : 0
    });

    setAnswers((prev) => prev.filter((entry) => entry.id !== answer.id));
  };

  const sortedTeams = useMemo(() => {
    if (['phase2', 'phase2_complete'].includes(tournament?.phase) && tournament?.phase2?.scores?.length) {
      return [...tournament.phase2.scores].sort((a, b) => (b.score || 0) - (a.score || 0));
    }
    return [...teams].sort((a, b) => (b.score || 0) - (a.score || 0));
  }, [teams, tournament]);

  const flatChallenges = useMemo(
    () => packs.flatMap((pack) => (pack.challenges || []).map((challenge) => ({ ...challenge, packName: pack.name }))),
    [packs]
  );

  const phase2QualifiedTeams = tournament?.phase2?.qualifiedTeams || tournament?.phase1?.qualified || [];
  const devCandidates = tournament?.phase1?.rankings || sortedTeams;
  const phase2Submissions = tournament?.phase2?.submissions || [];
  const phase2Penalties = tournament?.phase2?.monitoring?.penaltyEvents || [];
  const phase2HintUsage = tournament?.phase2?.monitoring?.hintUsageLog || [];
  const phase2Activity = tournament?.phase2?.monitoring?.activityFeed || [];
  const activeChallenge = tournament?.phase2?.currentChallenge;
  const displayTimer = tournament?.phase === 'phase2'
    ? (tournament?.phase2?.timer ?? activeChallenge?.timeLimit ?? 0)
    : timer;
  const timerCap = tournament?.phase === 'phase2'
    ? (activeChallenge?.timeLimit ?? maxTimer)
    : maxTimer;

  return (
    <>
      <style>{styles}</style>
      <div className="mod-root">
        {scoreToast && <div className="score-toast">{scoreToast}</div>}
        <div className="mod-shell">
          <header className="mod-header">
            <div>
              <div className="mod-kicker">ISGA Summit Challenge</div>
              <h1 className="mod-title">Moderator Control</h1>
              <p className="mod-sub">Actions directes, phase active, validation lisible.</p>
            </div>

            <div className="mod-badges">
              <div className="mod-badge">
                <span className={`mod-dot ${sessionActive ? '' : 'off'}`} />
                {sessionActive ? 'Session active' : 'Session arretee'}
              </div>
              <div className="mod-badge">{tournament?.phase || 'phase1'}</div>
              <div className={`mod-badge timer-pill ${timerPaused ? 'paused' : ''}`}>{displayTimer}s / {timerCap}s</div>
              <div className={`mod-badge ${ollamaStatus.modelAvailable ? '' : 'off'}`}>
                {ollamaStatus.modelAvailable ? 'Ollama phi3 ready' : 'Ollama offline'}
              </div>
            </div>
          </header>

          <div className="simple-grid">
            <div className="column">
              <section className="mod-panel">
                <div className="panel-head">
                  <div>
                    <h2 className="panel-title">Tournament</h2>
                    <p className="panel-copy">Les controles principaux restent ici. Le reste est condense par contexte.</p>
                  </div>
                </div>

                <div className="status-grid">
                  <div className="status-card">
                    <div className="status-label">Phase</div>
                    <div className="status-value">{tournament?.phase || 'phase1'}</div>
                  </div>
                  <div className="status-card">
                    <div className="status-label">Round</div>
                    <div className="status-value">{tournament?.phase1?.test?.roundNumber || tournament?.phase2?.roundNumber || 0}/6</div>
                  </div>
                  <div className="status-card">
                    <div className="status-label">Qualifiees</div>
                    <div className="status-value">{phase2QualifiedTeams.length}</div>
                  </div>
                  <div className="status-card">
                    <div className="status-label">Categorie</div>
                    <div className="status-value">{tournament?.phase1?.test?.roundCategory || activeChallenge?.category || '-'}</div>
                  </div>
                </div>

                <div className="feed-card">
                  <div className="item-title">Phase 1 setup</div>
                  <div className="feed-copy" style={{ marginBottom: '0.65rem' }}>
                    Question bank: {tournament?.phase1?.test?.categoryBankSource || 'not generated'} ·
                    {' '}{tournament?.phase1?.test?.categoryBankSize || 0} stored ·
                    {' '}{ollamaStatus.modelAvailable ? 'Ollama phi3 connected' : (ollamaStatus.error || 'Ollama not connected')}
                  </div>
                  <div style={{ display: 'flex', gap: '0.6rem' }}>
                    <select
                      className="select"
                      value={phase1Category}
                      onChange={(event) => setPhase1Category(event.target.value)}
                      style={{ flex: 1, minWidth: '150px' }}
                    >
                      {PHASE1_CATEGORIES.map((category) => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                    <button
                      className="action-btn gold"
                      onClick={() => {
                        setPhase1TestStatus('Drawing 10 new questions...');
                        socketRef.current?.emit('phase1:test_generate_questions', {
                          category: phase1Category,
                          startImmediately: false,
                          fast: true,
                          shuffle: true
                        });
                      }}
                      style={{ whiteSpace: 'nowrap', padding: '0.8rem 1rem' }}
                    >
                      Shuffle Category
                    </button>
                  </div>
                </div>

                {tournament?.phase1?.test?.pendingCategoryChoice && (
                  <div className="feed-card">
                    <div className="item-title">
                      {tournament?.phase1?.test?.roundWinner?.name || 'Round winner'} choisit la prochaine categorie
                    </div>
                    <div className="button-row">
                      {(tournament?.phase1?.test?.nextCategoryChoices || []).map((category) => (
                        <button
                          key={category}
                          className="action-btn primary"
                          onClick={() => choosePhase1Category(category)}
                        >
                          {category}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="button-row">
                  <button className="action-btn green" onClick={startSession} disabled={sessionActive}>Announce Phase 1</button>
                  <button className="action-btn primary" onClick={() => generatePhase1Questions()}>Load 10 Questions</button>
                  <button className="action-btn" onClick={() => generatePhase1Questions(true)}>Shuffle Questions</button>
                  <button className="action-btn" onClick={() => regeneratePhase1Bank()}>Generate Bank (Ollama)</button>
                  <button className="action-btn" onClick={stopSession} disabled={!sessionActive}>Pause</button>
                  <button className="action-btn" onClick={skipPhase1Question}>Next Question</button>
                  <button className="action-btn" onClick={finishPhase1Round}>Finish Round</button>
                  <button className="action-btn gold" onClick={endPhase1}>End Phase</button>
                  {tournament?.phase === 'phase1_complete' && (
                    <button className="action-btn primary" onClick={startPhase2}>Demarrer Phase 2</button>
                  )}
                  {tournament?.phase === 'phase2' && (
                    <>
                      <button className="action-btn" onClick={pausePhase2}>{tournament?.phase2?.paused ? 'Reprendre' : 'Pause Phase 2'}</button>
                      <button className="action-btn red" onClick={endPhase2}>Cloturer Phase 2</button>
                    </>
                  )}
                </div>
              </section>

              <section className="mod-panel">
                <div className="panel-head">
                  <div>
                    <h2 className="panel-title">Phase 1 questions</h2>
                    <p className="panel-copy">Choisir une question, la pousser aux ecrans, puis valider les reponses entrantes.</p>
                  </div>
                </div>

                {currentQuestion && (
                  <div className="current-banner">
                    <div className="current-label">Question en cours</div>
                    <div className="current-text">{currentQuestion.text}</div>
                    <div className="panel-copy" style={{ marginTop: '0.55rem' }}>
                      Reponse: <strong>{currentQuestion.correctAnswer || currentQuestion.answer || '-'}</strong>
                    </div>
                    <div className="pill-row" style={{ marginTop: '0.65rem' }}>
                      {currentQuestion.category && <span className="mini-pill cyan">{currentQuestion.category}</span>}
                      {currentQuestion.type && <span className="mini-pill">{currentQuestion.type}</span>}
                      {currentQuestion.difficulty && <span className="mini-pill">{currentQuestion.difficulty}</span>}
                      <span className="mini-pill gold">{currentQuestion.points || 0} pts</span>
                    </div>
                  </div>
                )}

                <div className="question-list">
                  {questions.length === 0 ? (
                    <div className="feed-card">
                      <div className="panel-copy">Aucune question chargee.</div>
                    </div>
                  ) : questions.map((question, index) => (
                    <button
                      key={question.id}
                      type="button"
                      className={`question-item ${currentQuestion?.id === question.id ? 'active' : ''}`}
                      onClick={() => sendQuestion(question)}
                      disabled={!sessionActive}
                    >
                      <div className="item-top">
                        <div className="item-title">#{index + 1} {question.text}</div>
                        <span className="mini-pill gold">{question.points || 0} pts</span>
                      </div>
                      <div className="item-meta">
                        {[question.category, question.type].filter(Boolean).join(' · ') || 'Question standard'}
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              {tournament?.phase === 'phase2' && (
              <section className="mod-panel">
                <div className="panel-head">
                  <div>
                    <h2 className="panel-title">Phase 2 packs</h2>
                    <p className="panel-copy">Importer, previsualiser, selectionner puis lancer un challenge.</p>
                  </div>
                </div>

                <div className="split-row">
                  <div className="stack">
                    <input
                      className="file-input"
                      type="file"
                      accept=".csv,text/csv"
                      onChange={(event) => setCsvFile(event.target.files?.[0] || null)}
                    />
                    <div className="button-row">
                      <button className="action-btn" onClick={previewCsv} disabled={!csvFile}>Previsualiser</button>
                      <button className="action-btn green" onClick={importCsv} disabled={!csvFile}>Importer pack</button>
                      <button className="action-btn gold" onClick={generatePhase2OllamaPack}>Generate Ollama Test Pack</button>
                    </div>
                    {phase2PackGenStatus && (
                      <div className="feed-card">
                        <div className="feed-copy">{phase2PackGenStatus}</div>
                      </div>
                    )}
                    {csvPreview && (
                      <div className="feed-card">
                        <div className="item-title">
                          {csvPreview.valid === false
                            ? 'CSV invalide'
                            : `${csvPreview.count || 0} challenges detectes`}
                        </div>
                        <div className="feed-copy">
                          {csvPreview.valid === false
                            ? `Champs manquants: ${(csvPreview.missingFields || []).join(', ') || 'lignes incompletes'}`
                            : 'La structure semble correcte.'}
                        </div>
                        {csvPreview.rowErrors?.slice(0, 4).map((row) => (
                          <div key={row.row} className="muted">Ligne {row.row}: {row.missing.join(', ')}</div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="stack">
                    <label className="panel-copy" style={{ display: 'grid', gap: '0.35rem' }}>
                      Round type (test)
                      <select
                        className="select"
                        value={phase2RoundType}
                        onChange={(event) => setPhase2RoundType(event.target.value)}
                      >
                        {PHASE2_ROUND_TYPES.map((entry) => (
                          <option key={entry.value} value={entry.value}>{entry.label}</option>
                        ))}
                      </select>
                    </label>
                    <div className="button-row">
                      <button className="action-btn primary" onClick={startPhase2Challenge} disabled={!selectedChallenge}>Lancer challenge</button>
                      <button className="action-btn" onClick={endRound}>Fin round</button>
                      <button className="action-btn" onClick={skipChallenge}>Passer</button>
                      <button className="action-btn" onClick={forceNextRound}>Round suivant</button>
                      <button className="action-btn gold" onClick={revealHint}>Reveler indice</button>
                      <button className="action-btn" onClick={regenerateHint}>Regen indice</button>
                      <button className="action-btn red" onClick={revealAnswer}>Reveler reponse</button>
                    </div>
                    <div className="feed-card">
                      <div className="item-title">Etat du round</div>
                      <div className="feed-copy">
                        Pack: {tournament?.phase2?.currentPackName || 'aucun'} · Statut: {tournament?.phase2?.roundStatus || 'idle'}
                      </div>
                      <div className="feed-copy">
                        Challenge actif: {activeChallenge?.question || 'aucun'}
                      </div>
                      <div className="feed-copy">
                        Modifier: {tournament?.phase2?.modifierLabel || 'Standard'}
                        {tournament?.phase2?.mysteryResolved
                          ? ` → ${tournament.phase2.modifier}`
                          : ''}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="challenge-list">
                  {flatChallenges.length === 0 ? (
                    <div className="feed-card">
                      <div className="panel-copy">Aucun challenge pack importe.</div>
                    </div>
                  ) : flatChallenges.map((challenge) => (
                    <button
                      key={challenge.id}
                      type="button"
                      className={`challenge-item ${selectedChallenge?.id === challenge.id ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedChallenge(challenge);
                        if (challenge.recommendedModifier) {
                          setPhase2RoundType(challenge.recommendedModifier);
                        }
                        setChallengeDraft({
                          id: challenge.id,
                          packId: challenge.packId,
                          question: challenge.question || '',
                          answer: challenge.answer || '',
                          hint: challenge.hint || '',
                          category: challenge.category || '',
                          difficulty: challenge.difficulty || 'Medium',
                          points: challenge.points ?? 10,
                          penalty: challenge.penalty ?? -1,
                          timeLimit: challenge.timeLimit ?? 30
                        });
                        setEditStatus('');
                      }}
                    >
                      <div className="item-top">
                        <div className="item-title">{challenge.question}</div>
                        <span className="mini-pill cyan">{challenge.packName}</span>
                      </div>
                      <div className="pill-row" style={{ marginTop: '0.55rem' }}>
                        <span className="mini-pill">{challenge.category || 'General'}</span>
                        <span className="mini-pill gold">{challenge.points ?? 10} pts</span>
                        <span className="mini-pill red">{challenge.penalty ?? -1}</span>
                        <span className="mini-pill">{challenge.difficulty || 'Medium'}</span>
                        {challenge.modifierLabel && (
                          <span className="mini-pill cyan">{challenge.modifierLabel}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </section>
              )}

              {tournament?.phase === 'phase2' && challengeDraft && (
                <section className="mod-panel">
                  <div className="panel-head">
                    <div>
                      <h2 className="panel-title">Edition du challenge</h2>
                      <p className="panel-copy">Modification rapide sans quitter la page.</p>
                    </div>
                  </div>

                  <div className="form-grid full">
                    <textarea
                      className="textarea"
                      value={challengeDraft.question}
                      onChange={(event) => setChallengeDraft((prev) => ({ ...prev, question: event.target.value }))}
                      placeholder="Question"
                    />
                    <input
                      className="input"
                      value={challengeDraft.answer}
                      onChange={(event) => setChallengeDraft((prev) => ({ ...prev, answer: event.target.value }))}
                      placeholder="Reponse"
                    />
                    <input
                      className="input"
                      value={challengeDraft.category}
                      onChange={(event) => setChallengeDraft((prev) => ({ ...prev, category: event.target.value }))}
                      placeholder="Categorie"
                    />
                    <textarea
                      className="textarea"
                      value={challengeDraft.hint}
                      onChange={(event) => setChallengeDraft((prev) => ({ ...prev, hint: event.target.value }))}
                      placeholder="Indice"
                    />
                    <select
                      className="select"
                      value={challengeDraft.difficulty}
                      onChange={(event) => setChallengeDraft((prev) => ({ ...prev, difficulty: event.target.value }))}
                    >
                      <option value="Easy">Easy</option>
                      <option value="Medium">Medium</option>
                      <option value="Hard">Hard</option>
                    </select>
                    <input
                      className="input"
                      type="number"
                      value={challengeDraft.points}
                      onChange={(event) => setChallengeDraft((prev) => ({ ...prev, points: Number(event.target.value) }))}
                      placeholder="Points"
                    />
                    <input
                      className="input"
                      type="number"
                      value={challengeDraft.penalty}
                      onChange={(event) => setChallengeDraft((prev) => ({ ...prev, penalty: Number(event.target.value) }))}
                      placeholder="Penalite"
                    />
                    <input
                      className="input"
                      type="number"
                      value={challengeDraft.timeLimit}
                      onChange={(event) => setChallengeDraft((prev) => ({ ...prev, timeLimit: Number(event.target.value) }))}
                      placeholder="Temps limite"
                    />
                  </div>

                  <div className="button-row">
                    <button className="action-btn" onClick={regenerateDraftHint}>Regen indice</button>
                    <button className="action-btn green" onClick={saveChallengeEdit}>Sauvegarder</button>
                  </div>

                  {editStatus && <div className="muted">{editStatus}</div>}
                </section>
              )}
            </div>

            <div className="column">
              <section className="mod-panel">
                <div className="panel-head">
                  <div>
                    <h2 className="panel-title">Classement live</h2>
                    <p className="panel-copy">Vue rapide des scores sans panneau secondaire inutile.</p>
                  </div>
                </div>

                <div className="team-list">
                  {sortedTeams.length === 0 ? (
                    <div className="feed-card">
                      <div className="panel-copy">Aucune equipe connectee.</div>
                    </div>
                  ) : sortedTeams.map((team, index) => (
                    <div key={`${team.id}-${index}`} className="team-row">
                      <TeamAvatar
                        name={team.name}
                        avatar={team.avatar}
                        color={team.color || '#17e9ff'}
                        tag={team.tag}
                        size={44}
                      />
                      <div>
                        <div className="team-name">#{index + 1} {team.name}</div>
                        <div className="team-sub">{team.tag || `Equipe ${team.id}`}</div>
                      </div>
                      <div className={`team-score ${scoreFlashIds.includes(String(team.id)) ? 'score-flash' : ''}`}>{team.score ?? 0}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mod-panel">
                <div className="panel-head">
                  <div>
                    <h2 className="panel-title">Reponses et soumissions</h2>
                    <p className="panel-copy">Phase 1 en validation manuelle, Phase 2 en monitoring direct.</p>
                  </div>
                </div>

                <div className="stack">
                  {answers.length > 0 ? answers.map((answer) => (
                    <div key={answer.id} className="answer-card">
                      <div className="item-title">{answer.teamName || answer.teamId}</div>
                      <div className="feed-copy">{answer.answer || 'Buzz / reponse recue'}</div>
                      <div className="answer-actions">
                        <button className="action-btn green" onClick={() => validateAnswer(answer, true)}>Valider</button>
                        <button className="action-btn red" onClick={() => validateAnswer(answer, false)}>Refuser</button>
                      </div>
                    </div>
                  )) : (
                    <div className="feed-card">
                      <div className="panel-copy">Aucune reponse en attente.</div>
                    </div>
                  )}

                  {phase2Submissions.slice(-6).reverse().map((submission) => (
                    <div key={submission.id} className="feed-card">
                      <div className="item-title">{submission.teamName}</div>
                      <div className="feed-copy">
                        {submission.correct
                          ? `Bonne reponse +${submission.points}`
                          : `Reponse ratee ${submission.penalty ?? 0}`}
                      </div>
                      <div className="muted">{new Date(submission.timestamp).toLocaleTimeString()}</div>
                    </div>
                  ))}
                </div>
              </section>

              {tournament?.phase === 'phase2' && (
              <section className="mod-panel">
                <div className="panel-head">
                  <div>
                    <h2 className="panel-title">Pression et activite</h2>
                    <p className="panel-copy">Penalites, indices, activite et elimination manuelle.</p>
                  </div>
                </div>

                <select
                  className="select"
                  value={manualEliminationTarget}
                  onChange={(event) => setManualEliminationTarget(event.target.value)}
                >
                  <option value="">Choisir une equipe qualifiee</option>
                  {phase2QualifiedTeams.map((team) => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>

                <div className="button-row">
                  <button className="action-btn red" onClick={manualEliminate} disabled={!manualEliminationTarget}>Eliminer l'equipe</button>
                </div>

                <div className="feed-list">
                  {phase2Penalties.slice(0, 4).map((entry) => (
                    <div key={entry.id} className="feed-card">
                      <div className="item-title">{entry.teamName}</div>
                      <div className="feed-copy">Penalite {entry.penalty}</div>
                      <div className="muted">{new Date(entry.timestamp).toLocaleTimeString()}</div>
                    </div>
                  ))}
                  {phase2HintUsage.slice(0, 4).map((entry) => (
                    <div key={entry.id} className="feed-card">
                      <div className="item-title">{entry.teamName}</div>
                      <div className="feed-copy">Indice utilise · Round {entry.roundNumber}</div>
                      <div className="muted">{new Date(entry.timestamp).toLocaleTimeString()}</div>
                    </div>
                  ))}
                  {phase2Activity.slice(0, 4).map((entry) => (
                    <div key={entry.id} className="feed-card">
                      <div className="item-title">Activite</div>
                      <div className="feed-copy">{entry.message}</div>
                      <div className="muted">{new Date(entry.timestamp).toLocaleTimeString()}</div>
                    </div>
                  ))}
                  {phase2Penalties.length === 0 && phase2HintUsage.length === 0 && phase2Activity.length === 0 && (
                    <div className="feed-card">
                      <div className="panel-copy">Aucune activite recente.</div>
                    </div>
                  )}
                </div>
              </section>
              )}
            </div>
          </div>

          {devStatus.enabled && devPanelOpen && (
            <section className="dev-drawer">
                <div className="panel-head">
                  <div>
                    <h2 className="panel-title">Qualification Testing</h2>
                    <p className="panel-copy">Cache par défaut. Raccourci: Ctrl + Shift + M. Les actions restent limitées à la qualification.</p>
                  </div>
                {phase1TestStatus && <div className="mini-pill cyan">{phase1TestStatus}</div>}
              </div>

              <div className="dev-grid">
                <div className="dev-box">
                  <div className="dev-title">Generate</div>
                  <button className="action-btn primary" onClick={() => generatePhase1Questions()}>Generate 10 Questions</button>
                  <button className="action-btn" onClick={generatePhase1MockTeams}>Generate Mock Teams</button>
                  <button className="action-btn" onClick={autoAnswerPhase1}>Auto Answer</button>
                  <button className="action-btn" onClick={() => regeneratePhase1Bank()}>Generate Rankings Bank</button>
                </div>

                <div className="dev-box">
                  <div className="dev-title">Run</div>
                  <select
                    className="select"
                    value={phase1TestSpeed}
                    onChange={(event) => setPhase1TestSpeed(event.target.value)}
                  >
                    <option value="realtime">Real Time</option>
                    <option value="2x">2x</option>
                    <option value="5x">5x</option>
                    <option value="instant">Instant</option>
                  </select>
                  <button className="action-btn gold" onClick={simulatePhase1Tournament}>Simulate Tournament</button>
                  <button className="action-btn" onClick={skipPhase1Question}>Skip Current Question</button>
                  <button className="action-btn" onClick={skipPhase1Round}>Skip Current Round</button>
                  <button className="action-btn" onClick={finishPhase1Round}>Finish Current Round</button>
                </div>

                <div className="dev-box">
                  <div className="dev-title">Qualification</div>
                  <button className="action-btn green" onClick={finishPhase1Test}>Finish Phase 1</button>
                  <button className="action-btn primary" onClick={jumpToQualificationReveal}>Jump To Qualification Reveal</button>
                  <button className="action-btn red" onClick={restartPhase1Test}>Restart Phase 1</button>
                  <select
                    className="select"
                    value={devTeamTarget}
                    onChange={(event) => setDevTeamTarget(event.target.value)}
                  >
                    <option value="">Choisir une equipe</option>
                    {devCandidates.map((team) => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                  </select>
                  <button className="action-btn green" onClick={forceQualification} disabled={!devTeamTarget}>Force Qualification</button>
                  <button className="action-btn red" onClick={forceElimination} disabled={!devTeamTarget}>Force Elimination</button>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
