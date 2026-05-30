import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import TeamAvatar from '../components/TeamAvatar';
import { getTowerPhase } from '../components/towerModel';
import '../neon-quiz.css';

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:10000';

const styles = `
  *, *::before, *::after { box-sizing: border-box; }

  :root {
    --retro-bg: #050341;
    --retro-night: #14266f;
    --retro-panel: #06033f;
    --retro-panel-2: #17266f;
    --retro-line: #17e9ff;
    --retro-stone: #3d2f82;
    --retro-stone-2: #223374;
    --retro-sand: #fffde8;
    --retro-accent: #17e9ff;
    --retro-gold: #c6b9ff;
    --retro-red: #ff6b8a;
    --retro-green: #78ead8;
    --retro-text: #fffde8;
    --retro-muted: rgba(255,253,232,0.68);
  }

  body {
    margin: 0;
    background:
      radial-gradient(circle at 18% 14%, rgba(120,234,216,0.24), transparent 18%),
      radial-gradient(circle at 82% 10%, rgba(198,185,255,0.24), transparent 16%),
      linear-gradient(135deg, #3d2f82 0%, #78cbd6 42%, #050341 100%);
    color: var(--retro-text);
    font-family: "Courier New", monospace;
  }

  .public-root {
    min-height: 100dvh;
    padding: 1rem;
  }

  .public-shell {
    max-width: 1560px;
    margin: 0 auto;
    display: grid;
    gap: 1rem;
  }

  .pixel-panel {
    background: var(--retro-panel);
    border: 3px solid var(--retro-line);
    box-shadow:
      0 0 0 3px rgba(18, 9, 25, 0.9),
      8px 8px 0 rgba(0, 0, 0, 0.22);
    border-radius: 8px;
  }

  .hud {
    padding: 1rem 1.1rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .hud-brand {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .hud-kicker {
    color: var(--retro-accent);
    font-size: 0.8rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    font-weight: 700;
  }

  .hud-title {
    margin: 0;
    font-size: clamp(1.45rem, 2.4vw, 2.2rem);
    line-height: 1.05;
    color: var(--retro-sand);
    text-shadow: 2px 2px 0 rgba(0,0,0,0.3);
  }

  .hud-sub {
    color: var(--retro-muted);
    font-size: 0.86rem;
  }

  .hud-meta {
    display: flex;
    gap: 0.65rem;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .hud-pill {
    min-height: 42px;
    padding: 0.65rem 0.85rem;
    border: 2px solid var(--retro-line);
    border-radius: 6px;
    background: var(--retro-panel-2);
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    font-size: 0.78rem;
    color: var(--retro-text);
  }

  .hud-dot {
    width: 10px;
    height: 10px;
    background: var(--retro-green);
    border-radius: 2px;
    box-shadow: 0 0 10px rgba(125,249,165,0.45);
  }

  .hud-dot.off {
    background: var(--retro-red);
    box-shadow: 0 0 10px rgba(255,107,138,0.45);
  }

  .public-grid {
    display: grid;
    grid-template-columns: 320px minmax(0, 1fr) 340px;
    gap: 1rem;
    align-items: start;
  }

  .stack {
    display: grid;
    gap: 1rem;
  }

  .side-panel {
    padding: 1rem;
    display: grid;
    gap: 0.85rem;
  }

  .side-title {
    font-size: 0.88rem;
    color: var(--retro-gold);
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-weight: 700;
  }

  .side-copy {
    color: var(--retro-muted);
    font-size: 0.8rem;
    line-height: 1.5;
  }

  .phase-card {
    padding: 1rem;
    display: grid;
    gap: 0.8rem;
  }

  .phase-banner {
    display: inline-flex;
    width: fit-content;
    padding: 0.4rem 0.65rem;
    background: #36224e;
    color: var(--retro-accent);
    border: 2px solid var(--retro-line);
    border-radius: 6px;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    font-weight: 700;
  }

  .phase-copy {
    font-size: clamp(1rem, 1.5vw, 1.2rem);
    line-height: 1.5;
    color: var(--retro-text);
  }

  .chip-row {
    display: flex;
    gap: 0.45rem;
    flex-wrap: wrap;
  }

  .chip {
    padding: 0.35rem 0.55rem;
    border-radius: 6px;
    border: 2px solid var(--retro-line);
    background: rgba(255,255,255,0.04);
    color: var(--retro-text);
    font-size: 0.72rem;
  }

  .tower-stage {
    padding: 1rem;
    display: grid;
    gap: 1rem;
  }

  .stage-top {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 1rem;
    align-items: start;
  }

  .stage-question {
    padding: 0.9rem;
    border: 2px solid var(--retro-line);
    border-radius: 8px;
    background: #26173b;
    display: grid;
    gap: 0.75rem;
  }

  .question-title {
    font-size: clamp(1.1rem, 2vw, 1.45rem);
    line-height: 1.55;
    color: #fff7de;
  }

  .open-ground-question {
    animation: questionSlide 0.36s ease both;
  }

  .open-ground-question.round-choice {
    border: 2px solid rgba(125,249,165,0.42);
    border-radius: 8px;
    padding: 1rem;
    background:
      radial-gradient(circle at 50% 0%, rgba(125,249,165,0.18), transparent 58%),
      rgba(139,233,253,0.06);
    animation: openGroundLift 1.3s ease-in-out infinite alternate;
  }

  @keyframes questionSlide {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes openGroundLift {
    from { transform: translateY(0); box-shadow: 0 0 0 rgba(125,249,165,0); }
    to { transform: translateY(-5px); box-shadow: 0 14px 28px rgba(125,249,165,0.14); }
  }

  .question-eyebrow {
    color: var(--retro-accent);
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    font-weight: 700;
    animation: categoryGlow 1.1s ease-in-out infinite alternate;
  }

  @keyframes categoryGlow {
    from { opacity: 0.72; text-shadow: 0 0 8px rgba(23,233,255,0.44); transform: translateY(0); }
    to { opacity: 1; text-shadow: 0 0 22px rgba(23,233,255,0.92); transform: translateY(-2px); }
  }

  .public-options {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.65rem;
    margin-top: 1rem;
  }

  .public-option {
    min-height: 44px;
    padding: 0.65rem 0.75rem;
    border: 2px solid rgba(139,233,253,0.32);
    border-radius: 6px;
    background: rgba(139,233,253,0.08);
    color: #fff7de;
    font-size: 0.84rem;
    display: flex;
    align-items: center;
    gap: 0.55rem;
  }

  .public-option::before {
    content: "";
    width: 12px;
    height: 12px;
    border: 2px solid var(--retro-accent);
    border-radius: 50%;
    flex: 0 0 auto;
  }

  .timer-box {
    min-width: 114px;
    padding: 0.85rem 0.9rem;
    border: 2px solid var(--retro-line);
    border-radius: 8px;
    background: #29183d;
    text-align: center;
  }

  .timer-label {
    color: var(--retro-muted);
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }

  .timer-value {
    margin-top: 0.45rem;
    font-size: clamp(1.5rem, 2vw, 2rem);
    color: var(--retro-gold);
    font-weight: 700;
  }

  .tower-map {
    padding: 1rem;
    border: 2px solid var(--retro-line);
    border-radius: 8px;
    background:
      linear-gradient(180deg, rgba(139,233,253,0.08), transparent 18%),
      linear-gradient(180deg, #241334 0%, #160d22 100%);
    display: grid;
    gap: 0.85rem;
  }

  .map-title {
    color: var(--retro-accent);
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    font-weight: 700;
  }

  .tower-body {
    position: relative;
    width: min(100%, 760px);
    margin: 0 auto;
    display: grid;
    gap: 0.75rem;
    padding: 1rem 1rem 0.8rem;
    background:
      linear-gradient(90deg, rgba(255,255,255,0.02), rgba(255,255,255,0.02)),
      linear-gradient(180deg, #6d576f 0%, #59445d 100%);
    border: 4px solid var(--retro-sand);
    border-radius: 6px;
    overflow: hidden;
  }

  .tower-body::before {
    content: "";
    position: absolute;
    inset: 0;
    background:
      repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0 2px, transparent 2px 28px),
      repeating-linear-gradient(90deg, rgba(0,0,0,0.18) 0 2px, transparent 2px 64px),
      repeating-linear-gradient(180deg, rgba(0,0,0,0.1) 0 28px, transparent 28px 56px);
    pointer-events: none;
    opacity: 0.55;
  }

  .shaft {
    position: absolute;
    top: 18px;
    bottom: 18px;
    left: 50%;
    transform: translateX(-50%);
    width: 92px;
    border-left: 4px solid rgba(18,9,25,0.4);
    border-right: 4px solid rgba(18,9,25,0.4);
    background:
      repeating-linear-gradient(180deg, rgba(255,255,255,0.08) 0 8px, rgba(0,0,0,0.1) 8px 16px);
    z-index: 1;
  }

  .lift {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    width: 72px;
    height: 54px;
    border: 3px solid var(--retro-gold);
    background:
      linear-gradient(180deg, #4c2f12 0%, #2c1b0a 100%);
    z-index: 3;
    transition: top 0.6s ease;
    box-shadow: 0 0 0 3px rgba(0,0,0,0.16);
  }

  .lift::before,
  .lift::after {
    content: "";
    position: absolute;
    top: 7px;
    bottom: 7px;
    width: 2px;
    background: rgba(246,211,101,0.5);
  }

  .lift::before { left: 22px; }
  .lift::after { right: 22px; }

  .floor-band {
    position: relative;
    min-height: 172px;
    border: 3px solid rgba(18,9,25,0.42);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.06), rgba(0,0,0,0.08)),
      rgba(58,36,70,0.45);
    border-radius: 6px;
    padding: 0.85rem 0.9rem;
    overflow: hidden;
  }

  .floor-band.active {
    box-shadow: inset 0 0 0 3px rgba(139,233,253,0.22), 0 0 26px rgba(139,233,253,0.08);
  }

  .floor-head {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .floor-name {
    font-size: 0.76rem;
    color: var(--retro-gold);
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-weight: 700;
  }

  .floor-theme {
    color: var(--retro-muted);
    font-size: 0.72rem;
  }

  .window-row {
    position: absolute;
    left: 0.9rem;
    right: 0.9rem;
    bottom: 0.9rem;
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 0.5rem;
    z-index: 1;
  }

  .window {
    height: 54px;
    border: 2px solid rgba(18,9,25,0.38);
    background:
      linear-gradient(180deg, rgba(139,233,253,0.26), rgba(60,130,196,0.08));
    border-radius: 4px;
  }

  .tower-token {
    position: absolute;
    top: 48px;
    width: 74px;
    transform: translateX(-50%);
    display: grid;
    justify-items: center;
    gap: 0.28rem;
    z-index: 4;
  }

  .token-frame {
    width: 58px;
    height: 58px;
    display: grid;
    place-items: center;
    border: 3px solid rgba(18,9,25,0.55);
    background: rgba(255,255,255,0.06);
    border-radius: 8px;
    box-shadow: 4px 4px 0 rgba(0,0,0,0.18);
  }

  .token-name {
    max-width: 86px;
    text-align: center;
    font-size: 0.62rem;
    line-height: 1.25;
    color: #fff7de;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ground-strip {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.6rem;
    padding: 0.85rem;
    border: 3px solid var(--retro-line);
    border-radius: 6px;
    background:
      linear-gradient(180deg, rgba(0,0,0,0.18), rgba(0,0,0,0.06)),
      #261739;
  }

  .ground-card,
  .leader-row,
  .feed-row {
    border: 2px solid var(--retro-line);
    border-radius: 6px;
    background: rgba(255,255,255,0.04);
  }

  .ground-card {
    padding: 0.55rem;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    opacity: 0.72;
  }

  .ground-card strong {
    display: block;
    font-size: 0.74rem;
  }

  .ground-card span {
    color: var(--retro-muted);
    font-size: 0.68rem;
  }

  .team-card-strip {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.65rem;
  }

  .team-card-strip .ground-card {
    min-height: 74px;
    opacity: 1;
    transition: transform 0.35s ease, box-shadow 0.35s ease;
  }

  .team-card-strip .ground-card.qualified {
    border-color: rgba(125,249,165,0.55);
    box-shadow: 0 0 20px rgba(125,249,165,0.12);
    transform: translateY(-4px);
  }

  .leader-list,
  .feed-list {
    display: grid;
    gap: 0.65rem;
  }

  .leader-row {
    padding: 0.65rem;
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 0.7rem;
    align-items: center;
  }

  .leader-rank {
    width: 36px;
    height: 36px;
    border: 2px solid var(--retro-line);
    border-radius: 6px;
    display: grid;
    place-items: center;
    color: var(--retro-gold);
    font-size: 0.78rem;
    font-weight: 700;
    background: rgba(0,0,0,0.15);
  }

  .leader-name {
    font-size: 0.8rem;
    font-weight: 700;
  }

  .leader-sub {
    color: var(--retro-muted);
    font-size: 0.68rem;
    margin-top: 0.14rem;
  }

  .leader-score {
    color: var(--retro-gold);
    font-weight: 700;
    font-size: 0.9rem;
  }

  .feed-row {
    padding: 0.7rem;
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.65rem;
    align-items: start;
  }

  .feed-dot {
    width: 12px;
    height: 12px;
    border-radius: 2px;
    background: var(--retro-accent);
    box-shadow: 0 0 10px rgba(139,233,253,0.34);
    margin-top: 0.12rem;
  }

  .feed-title {
    font-size: 0.78rem;
    font-weight: 700;
  }

  .feed-copy {
    color: var(--retro-muted);
    font-size: 0.72rem;
    margin-top: 0.2rem;
    line-height: 1.45;
  }

  .winner-banner {
    padding: 0.8rem;
    border: 2px solid rgba(125,249,165,0.34);
    border-radius: 6px;
    background: rgba(125,249,165,0.08);
    color: #d4ffe5;
    font-size: 0.76rem;
  }

  .winner-banner strong {
    display: block;
    color: var(--retro-green);
    margin-bottom: 0.35rem;
  }

  @media (max-width: 1240px) {
    .public-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 760px) {
    .stage-top,
    .hud {
      grid-template-columns: 1fr;
      display: grid;
    }

    .ground-strip {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .public-options,
    .team-card-strip {
      grid-template-columns: 1fr;
    }

    .tower-token {
      width: 64px;
    }
  }
`;

const FLOOR_LABELS = {
  3: { name: 'Floor 3', theme: 'Summit' },
  2: { name: 'Floor 2', theme: 'Pressure Floor' },
  1: { name: 'Floor 1', theme: 'Open Ground' }
};

const FLOOR_SLOTS = {
  3: ['20%', '38%', '62%', '80%'],
  2: ['12%', '28%', '72%', '88%'],
  1: ['12%', '28%', '44%', '56%', '72%', '88%']
};

export default function PublicDashboard() {
  const [isConnected, setIsConnected] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [teams, setTeams] = useState([]);
  const [buzzActivity, setBuzzActivity] = useState([]);
  const [tournament, setTournament] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io(API_BASE);
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('join', { room: 'public-room', role: 'spectator' });
    });

    socket.on('game:new_question', (data) => {
      setCurrentQuestion({
        id: data.id,
        text: data.text || data.question,
        category: data.category || 'General',
        points: data.points || 0,
        difficulty: data.difficulty || data.type || 'Medium',
        timeLimit: data.timeLimit || data.timer || 30,
        options: data.options || data.choices || []
      });
    });

    socket.on('game:clear_question', () => {
      setCurrentQuestion(null);
    });

    socket.on('score:refresh', (data) => {
      const sorted = [...(data.teams || [])].sort((a, b) => (b.score || 0) - (a.score || 0));
      setTeams(sorted);
    });

    const syncTournament = (data) => {
      setTournament(data);

      if (data?.phase3?.scores?.length) {
        setTeams([...data.phase3.scores].sort((a, b) => (b.score || 0) - (a.score || 0)));
      } else if (data?.phase2?.scores?.length) {
        setTeams([...data.phase2.scores].sort((a, b) => (b.score || 0) - (a.score || 0)));
      } else if (data?.phase1?.rankings?.length) {
        setTeams([...data.phase1.rankings].sort((a, b) => (b.score || 0) - (a.score || 0)));
      }

      if (data?.phase === 'phase1' && data?.phase1?.test?.pendingCategoryChoice) {
        const test = data.phase1.test;
        setCurrentQuestion({
          id: `phase1-category-choice-${test.roundNumber || 1}`,
          text: `${test.roundWinner?.name || "L'equipe gagnante"} choisit la prochaine categorie parmi 3 possibilites.`,
          category: 'Choix de categorie',
          points: 0,
          difficulty: 'Open Ground',
          timeLimit: 0,
          options: test.nextCategoryChoices || [],
          transition: 'round-choice'
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
      } else if (data?.phase !== 'phase1') {
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
    socket.on('phase1:test_state_updated', syncTournament);
    socket.on('phase1:test_questions_generated', (payload) => syncTournament(payload.snapshot));
    socket.on('phase1:test_question_started', (payload) => {
      if (payload?.question) {
        setCurrentQuestion({
          id: payload.question.id,
          text: payload.question.text,
          category: payload.question.category,
          points: payload.question.points,
          difficulty: payload.question.type || 'Qualification',
          timeLimit: payload.question.timeLimit || 30,
          options: payload.question.options || payload.question.choices || []
        });
      }
      syncTournament(payload.snapshot);
    });
    socket.on('phase1:category_choices', (payload) => syncTournament(payload.snapshot));
    socket.on('phase1:category_chosen', (payload) => syncTournament(payload.snapshot));
    socket.on('phase1:test_reset', syncTournament);
    socket.on('phase1:test_simulation_complete', syncTournament);

    socket.on('buzz:first', (data) => {
      setBuzzActivity((prev) => [{
        id: `${Date.now()}-${Math.random()}`,
        teamName: data.teamName || 'Equipe',
        avatar: data.avatar || '',
        color: data.color || '#17e9ff',
        tag: data.tag || '',
        time: new Date().toLocaleTimeString()
      }, ...prev].slice(0, 8));
    });

    fetch(`${API_BASE}/api/tournament/state`)
      .then((response) => response.json())
      .then(syncTournament)
      .catch(() => {});

    socket.on('disconnect', () => setIsConnected(false));
    return () => socket.disconnect();
  }, []);

  const towerPhase = getTowerPhase(tournament?.phase || 'phase1');
  const timerValue = tournament?.phase === 'phase2'
    ? (tournament?.phase2?.timer ?? currentQuestion?.timeLimit ?? 0)
    : (currentQuestion?.timeLimit ?? 0);
  const finalScores = useMemo(() => tournament?.phase3?.scores || [], [tournament?.phase3?.scores]);
  const leaderboard = useMemo(() => {
    const source = finalScores.length > 0 ? finalScores : teams;
    return [...source].sort((a, b) => (b.score || 0) - (a.score || 0));
  }, [finalScores, teams]);

  const phase1Qualified = useMemo(() => tournament?.phase1?.qualified || [], [tournament?.phase1?.qualified]);
  const phase2Eliminated = useMemo(
    () => tournament?.phase2?.eliminatedTeams || tournament?.phase1?.eliminated || [],
    [tournament?.phase2?.eliminatedTeams, tournament?.phase1?.eliminated]
  );
  const submissions = tournament?.phase2?.submissions || [];
  const penaltyEvents = tournament?.phase2?.monitoring?.penaltyEvents || [];
  const hintUsageLog = tournament?.phase2?.monitoring?.hintUsageLog || [];
  const winner = tournament?.phase2?.roundWinner;

  const phase1QualifiedIds = useMemo(
    () => new Set(phase1Qualified.map((team) => String(team.id))),
    [phase1Qualified]
  );
  const phase2EliminatedIds = useMemo(
    () => new Set(phase2Eliminated.map((team) => String(team.id))),
    [phase2Eliminated]
  );
  const finalistIds = useMemo(
    () => new Set(finalScores.map((team) => String(team.id))),
    [finalScores]
  );

  const mapTeams = useMemo(() => {
    const visible = leaderboard.slice(0, 8);
    const floors = { 1: [], 2: [], 3: [] };
    const ground = [];

    const teamFloor = (team, index) => {
      const id = String(team.id);

      if (tournament?.phase === 'phase3') {
        if (finalistIds.has(id) || index < 2) return 3;
        if (phase1QualifiedIds.has(id)) return 2;
        return 1;
      }

      if (tournament?.phase === 'phase2' || tournament?.phase === 'phase2_complete') {
        if (phase2EliminatedIds.has(id) || team.status === 'eliminated') return 1;
        if (phase1QualifiedIds.has(id) || index < 4) return 2;
        return 1;
      }

      if (tournament?.phase === 'phase1_complete') {
        return phase1QualifiedIds.has(id) || index < 4 ? 2 : 1;
      }

      return 1;
    };

    visible.forEach((team, index) => {
      const floor = teamFloor(team, index);
      floors[floor].push(team);
    });

    phase2Eliminated.slice(0, 4).forEach((team) => {
      if (!ground.some((entry) => String(entry.id) === String(team.id))) {
        ground.push(team);
      }
    });

    return { floors, ground };
  }, [leaderboard, finalistIds, phase1QualifiedIds, phase2Eliminated, phase2EliminatedIds, tournament?.phase]);

  const liftTop = towerPhase.floor === 3 ? '6%' : towerPhase.floor === 2 ? '38%' : '70%';

  const challengeText = currentQuestion?.text
    || (tournament?.phase === 'phase3'
      ? 'Le duel final attend ses deux finalistes.'
      : 'Le prochain defi n est pas encore lance.');
  const questionOptions = Array.isArray(currentQuestion?.options) ? currentQuestion.options : [];

  const feed = [
    ...submissions.slice(-3).reverse().map((entry) => ({
      id: `sub-${entry.id}`,
      title: entry.teamName,
      copy: entry.correct ? `Bonne reponse +${entry.points}` : `Reponse ratee ${entry.penalty ?? 0}`,
      color: entry.correct ? '#7df9a5' : '#ff6b8a'
    })),
    ...buzzActivity.slice(0, 2).map((entry) => ({
      id: `buzz-${entry.id}`,
      title: entry.teamName,
      copy: `Buzz a ${entry.time}`,
      color: '#8be9fd'
    })),
    ...hintUsageLog.slice(0, 2).map((entry) => ({
      id: `hint-${entry.id}`,
      title: entry.teamName,
      copy: `Indice utilise · Round ${entry.roundNumber}`,
      color: '#f6d365'
    }))
  ].slice(0, 6);

  return (
    <>
      <style>{styles}</style>
      <div className="public-root">
        <div className="public-shell">
          <header className="pixel-panel hud">
            <div className="hud-brand">
              <div className="hud-kicker">Tournament Tower View</div>
              <h1 className="hud-title">Crazy Challenge Tower</h1>
              <div className="hud-sub">{towerPhase.title} · {towerPhase.theme}</div>
            </div>

            <div className="hud-meta">
              <div className="hud-pill">
                <span className={`hud-dot ${isConnected ? '' : 'off'}`} />
                {isConnected ? 'Live' : 'Offline'}
              </div>
              <div className="hud-pill">{towerPhase.short}</div>
              <div className="hud-pill">{timerValue}s</div>
            </div>
          </header>

          <div className="public-grid">
            <aside className="stack">
              <section className="pixel-panel phase-card">
                <div className="phase-banner">{towerPhase.short}</div>
                <div className="phase-copy">{challengeText}</div>
                <div className="chip-row">
                  <div className="chip">{currentQuestion?.category || towerPhase.theme}</div>
                  <div className="chip">{currentQuestion?.points || 0} pts</div>
                  <div className="chip">{currentQuestion?.difficulty || 'Live'}</div>
                </div>
              </section>

              <section className="pixel-panel side-panel">
                <div className="side-title">Tower state</div>
                <div className="side-copy">
                  {tournament?.phase === 'phase3'
                    ? 'Deux equipes sont au sommet. Toute la tour regarde le duel.'
                    : tournament?.phase === 'phase2'
                      ? 'Le floor 2 garde les qualifiees sous pression.'
                      : 'Toutes les equipes progressent depuis la base de la tour.'}
                </div>
                <div className="chip-row">
                  <div className="chip">Qualifiees: {phase1Qualified.length || Math.min(leaderboard.length, 4)}</div>
                  <div className="chip">Eliminees: {phase2Eliminated.length}</div>
                </div>
              </section>

              {winner && (
                <section className="pixel-panel side-panel">
                  <div className="winner-banner">
                    <strong>Round winner</strong>
                    {winner.teamName} monte avec +{winner.points}
                  </div>
                </section>
              )}
            </aside>

            <main className="pixel-panel tower-stage">
              <div className="stage-top" style={{ display: 'block' }}>
                <div className="neon-q-card" style={{ width: '100%' }}>
                  <div className="neon-quiz-badge">{tournament?.phase === 'phase1' ? 'QUESTION' : 'QUIZ'}</div>
                  <div className="chip-row" style={{ marginBottom: '1rem' }}>
                    <div className="chip">Round {tournament?.phase1?.test?.roundNumber || tournament?.phase2?.roundNumber || 1}</div>
                    <div className="chip">{currentQuestion?.category || tournament?.phase2?.roundStatus || 'open ground'}</div>
                    <div className="chip">{currentQuestion?.points || 10} pts</div>
                    <div className="chip" style={{ background: 'var(--retro-red)', color: 'white' }}>{timerValue}s</div>
                  </div>
                  <div className={`open-ground-question ${currentQuestion?.transition === 'round-choice' ? 'round-choice' : ''}`}>
                    <div className="question-eyebrow" key={currentQuestion?.category || 'Question'}>
                      {currentQuestion?.category || 'Question'}
                    </div>
                    <div className="neon-q-text">{challengeText}</div>
                    {questionOptions.length > 0 && (
                      <div className="public-options">
                        {questionOptions.map((option, index) => (
                          <div key={`${option}-${index}`} className="public-option">{option}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Timer moved into chips for cleaner layout */}
              </div>

              <section className="tower-map">
                <div className="map-title">Vintage tower map</div>

                <div className="tower-body">
                  <div className="shaft" />
                  <div className="lift" style={{ top: liftTop }} />

                  {[3, 2, 1].map((floor) => (
                    <div
                      key={floor}
                      className={`floor-band ${towerPhase.floor === floor ? 'active' : ''}`}
                    >
                      <div className="floor-head">
                        <div className="floor-name">{FLOOR_LABELS[floor].name}</div>
                        <div className="floor-theme">{FLOOR_LABELS[floor].theme}</div>
                      </div>

                      {mapTeams.floors[floor].slice(0, FLOOR_SLOTS[floor].length).map((team, index) => (
                        <div
                          key={`${floor}-${team.id}-${index}`}
                          className="tower-token"
                          style={{ left: FLOOR_SLOTS[floor][index] }}
                        >
                          <div className="token-frame">
                            <TeamAvatar
                              name={team.name}
                              avatar={team.avatar}
                              color={team.color || '#17e9ff'}
                              tag={team.tag}
                              size={42}
                            />
                          </div>
                          <div className="token-name">{team.tag || team.name}</div>
                        </div>
                      ))}

                      <div className="window-row">
                        {Array.from({ length: 6 }).map((_, index) => (
                          <div key={`${floor}-window-${index}`} className="window" />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="ground-strip">
                  {mapTeams.ground.length === 0 ? (
                    <div className="ground-card" style={{ gridColumn: '1 / -1' }}>
                      <div>
                        <strong>Base de la tour</strong>
                        <span>Aucune equipe descendue pour le moment.</span>
                      </div>
                    </div>
                  ) : mapTeams.ground.map((team, index) => (
                    <div key={`${team.id}-${index}`} className="ground-card">
                      <TeamAvatar
                        name={team.name}
                        avatar={team.avatar}
                        color={team.color || '#17e9ff'}
                        tag={team.tag}
                        size={34}
                      />
                      <div>
                        <strong>{team.name}</strong>
                        <span>{team.score ?? 0} pts</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="team-card-strip">
                {leaderboard.slice(0, 8).map((team, index) => (
                  <div
                    key={`team-card-${team.id}-${index}`}
                    className={`ground-card ${phase1QualifiedIds.has(String(team.id)) || index < 4 ? 'qualified' : ''}`}
                  >
                    <TeamAvatar
                      name={team.name}
                      avatar={team.avatar}
                      color={team.color || '#17e9ff'}
                      tag={team.tag}
                      size={40}
                    />
                    <div>
                      <strong>#{index + 1} {team.name}</strong>
                      <span>{team.score ?? 0} pts · {team.tag || 'TEAM'}</span>
                    </div>
                  </div>
                ))}
              </section>
            </main>

            <aside className="stack">
              <section className="pixel-panel side-panel">
                <div className="side-title">Leaderboard</div>
                <div className="leader-list">
                  {leaderboard.slice(0, 6).map((team, index) => (
                    <div key={`${team.id}-${index}`} className="leader-row">
                      <div className="leader-rank">#{index + 1}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                        <TeamAvatar
                          name={team.name}
                          avatar={team.avatar}
                          color={team.color || '#17e9ff'}
                          tag={team.tag}
                          size={38}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div className="leader-name">{team.name}</div>
                          <div className="leader-sub">{team.tag || towerPhase.short}</div>
                        </div>
                      </div>
                      <div className="leader-score">{team.score ?? 0}</div>
                    </div>
                  ))}
                  {leaderboard.length === 0 && (
                    <div className="leader-row">
                      <div className="leader-rank">--</div>
                      <div>
                        <div className="leader-name">En attente</div>
                        <div className="leader-sub">La tour attend ses equipes.</div>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <section className="pixel-panel side-panel">
                <div className="side-title">Live feed</div>
                <div className="feed-list">
                  {feed.map((entry) => (
                    <div key={entry.id} className="feed-row">
                      <div className="feed-dot" style={{ background: entry.color, boxShadow: `0 0 10px ${entry.color}` }} />
                      <div>
                        <div className="feed-title">{entry.title}</div>
                        <div className="feed-copy">{entry.copy}</div>
                      </div>
                    </div>
                  ))}
                  {feed.length === 0 && (
                    <div className="feed-row">
                      <div className="feed-dot" />
                      <div>
                        <div className="feed-title">Calme</div>
                        <div className="feed-copy">Pas encore d activite recente dans la tour.</div>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <section className="pixel-panel side-panel">
                <div className="side-title">Pressure</div>
                <div className="feed-list">
                  {penaltyEvents.slice(0, 4).map((entry) => (
                    <div key={entry.id} className="feed-row">
                      <div className="feed-dot" style={{ background: '#ff6b8a', boxShadow: '0 0 10px #ff6b8a' }} />
                      <div>
                        <div className="feed-title">{entry.teamName}</div>
                        <div className="feed-copy">Penalite {entry.penalty}</div>
                      </div>
                    </div>
                  ))}
                  {penaltyEvents.length === 0 && (
                    <div className="feed-row">
                      <div className="feed-dot" style={{ background: '#7df9a5', boxShadow: '0 0 10px #7df9a5' }} />
                      <div>
                        <div className="feed-title">Stable</div>
                        <div className="feed-copy">Aucune penalite recente.</div>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}
