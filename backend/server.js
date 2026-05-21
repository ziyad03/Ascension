const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const csvRoutes = require('./routes/csv');
const { router: phase2CsvRoutes, generateHint } = require('./routes/phase2Csv');

const prisma = new PrismaClient();
const DEVELOPMENT_MODE = process.env.NODE_ENV !== 'production'
  || process.env.DEVELOPMENT_MODE === 'true'
  || process.env.DEV_TESTING_MODE === 'true';

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error.message);
  process.exit(1);
});

const app = express();
const server = http.createServer(app);
const SAFE_ORIGINS = [
  'http://localhost:5174',
  'http://localhost:5173',
  'http://localhost:5175', 
  'http://127.0.0.1:5174',
  'https://crazy-challenge.vercel.app'
];

const io = new Server(server, { 
  cors: { 
    origin: SAFE_ORIGINS, 
    methods: ['GET', 'POST'],
    credentials: true
  } 
});

app.use(cors({ 
  origin: SAFE_ORIGINS, 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'], 
  credentials: true 
}));
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    name: 'Crazy Challenge Platform API',
    status: 'ok',
    health: '/api/health',
    questions: '/api/questions',
    tournament: '/api/tournament/state'
  });
});

// ── ROUTE BUZZ (HTTP fallback) ─────────────────────────────
app.post('/api/game/buzz', async (req, res) => {
  try {
    const { questionId, buzzTime, teamId } = req.body;
    console.log('BUZZ HTTP reçu:', { questionId, buzzTime, teamId });
    
    io.to('moderator-session').emit('game:answer_received', {
      questionId,
      teamId: teamId || 'Équipe',
      buzzTime,
      answer: 'En attente de réponse...',
      points: 0,
      timestamp: new Date()
    });
  io.to('public-room').emit('buzz:first', { teamName: teamId || 'Équipe', time: Date.now() });
    
    res.json({ success: true, message: 'Buzz enregistré' });
  } catch (error) {
    console.error('Erreur buzz:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.get('/debug/ping', (req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json', 'X-Debug': 'server-alive' });
  res.end(JSON.stringify({ ok: true, time: Date.now(), port: process.env.PORT || 10000 }));
});

app.use('/api/csv', csvRoutes);
app.use('/api/phase2', phase2CsvRoutes);

// ── AUTH ───────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, role, teamName } = req.body;
    if (await prisma.user.findUnique({ where: { username } })) 
      return res.status(400).json({ error: 'Utilisateur existe deja' });
    
    const hashed = await bcrypt.hash(password, 10);
    let teamId = null;
    
    if (role === 'team' && teamName) {
      let team = await prisma.team.findUnique({ where: { name: teamName } });
      if (!team) team = await prisma.team.create({ data: { name: teamName, score: 0 } });
      teamId = team.id;
    }
    
    const user = await prisma.user.create({ 
      data: { username, password: hashed, role, teamId } 
    });
    
    res.status(201).json({ 
      message: 'Inscription reussie', 
      user: { id: user.id, username: user.username, role } 
    });
  } catch (e) { 
    console.error('REGISTER ERROR:', e.message); 
    res.status(500).json({ error: 'Erreur serveur' }); 
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await prisma.user.findUnique({ where: { username } });
    
    if (!user || !(await bcrypt.compare(password, user.password))) 
      return res.status(401).json({ error: 'Identifiants incorrects' });
    
    const token = jwt.sign(
      { userId: user.id, role: user.role }, 
      process.env.JWT_SECRET, 
      { expiresIn: '1h' }
    );
    
    res.json({ token, role: user.role, teamId: user.teamId });
  } catch (e) { 
    console.error('LOGIN ERROR:', e.message); 
    res.status(500).json({ error: 'Erreur serveur' }); 
  }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ── API: Questions ─────────────────────────────────────────
app.get('/api/questions', async (req, res) => {
  try {
    const questions = await prisma.question.findMany({
      select: { 
        id: true, 
        text: true, 
        category: true, 
        points: true, 
        type: true, 
        options: true,
        correctAnswer: true
      }
    });
    res.json(questions);
  } catch (e) {
    console.error('Erreur API questions:', e);
    res.status(500).json({ error: 'Erreur recuperation questions' });
  }
});

app.get('/api/tournament/state', (req, res) => {
  res.json(getTournamentSnapshot());
});

app.get('/api/tournament/dev/status', (req, res) => {
  res.json({
    enabled: DEVELOPMENT_MODE,
    panel: DEVELOPMENT_MODE
  });
});

app.post('/api/tournament/phase1/complete', async (req, res) => {
  try {
    const result = await completePhase1();
    broadcastTournamentState('tournament:phase1_complete');
    res.json(result);
  } catch (error) {
    console.error('Erreur fin Phase 1:', error);
    res.status(500).json({ error: 'Erreur fin Phase 1' });
  }
});

app.post('/api/tournament/phase1/skip', async (req, res) => {
  if (!DEVELOPMENT_MODE) {
    return res.status(403).json({ error: 'Mode développement requis' });
  }

  try {
    const result = await skipToPhase2ForTesting();
    broadcastTournamentState('tournament:dev_phase2_started');
    res.json(result);
  } catch (error) {
    console.error('Erreur skip Phase 1:', error);
    res.status(500).json({ error: 'Erreur skip Phase 1' });
  }
});

app.post('/api/tournament/dev/skip-phase3', async (req, res) => {
  if (!DEVELOPMENT_MODE) {
    return res.status(403).json({ error: 'Mode développement requis' });
  }

  try {
    const result = await skipToPhase3ForTesting();
    broadcastTournamentState('tournament:dev_phase3_started');
    res.json(result);
  } catch (error) {
    console.error('Erreur skip Phase 3:', error);
    res.status(500).json({ error: 'Erreur skip Phase 3' });
  }
});

app.post('/api/tournament/dev/mock-rankings', async (req, res) => {
  if (!DEVELOPMENT_MODE) {
    return res.status(403).json({ error: 'Mode développement requis' });
  }

  try {
    const result = await generateMockRankingsForTesting();
    broadcastTournamentState('tournament:dev_state_updated');
    res.json(result);
  } catch (error) {
    console.error('Erreur mock rankings:', error);
    res.status(500).json({ error: 'Erreur mock rankings' });
  }
});

app.post('/api/tournament/dev/simulate-scores', async (req, res) => {
  if (!DEVELOPMENT_MODE) {
    return res.status(403).json({ error: 'Mode développement requis' });
  }

  try {
    const result = await simulateScoresForTesting();
    broadcastTournamentState('tournament:dev_state_updated');
    res.json(result);
  } catch (error) {
    console.error('Erreur simulate scores:', error);
    res.status(500).json({ error: 'Erreur simulate scores' });
  }
});

app.post('/api/tournament/dev/reset', async (req, res) => {
  if (!DEVELOPMENT_MODE) {
    return res.status(403).json({ error: 'Mode développement requis' });
  }

  try {
    const result = await resetTournamentState();
    broadcastTournamentState('tournament:dev_reset');
    res.json(result);
  } catch (error) {
    console.error('Erreur reset tournament:', error);
    res.status(500).json({ error: 'Erreur reset tournament' });
  }
});

app.post('/api/tournament/dev/force-qualification', async (req, res) => {
  if (!DEVELOPMENT_MODE) {
    return res.status(403).json({ error: 'Mode développement requis' });
  }

  try {
    const result = await forceQualificationForTesting(req.body?.teamId);
    broadcastTournamentState('tournament:dev_state_updated');
    res.json(result);
  } catch (error) {
    console.error('Erreur force qualification:', error);
    res.status(500).json({ error: 'Erreur force qualification' });
  }
});

app.post('/api/tournament/dev/force-elimination', async (req, res) => {
  if (!DEVELOPMENT_MODE) {
    return res.status(403).json({ error: 'Mode développement requis' });
  }

  try {
    const result = await forceEliminationForTesting(req.body?.teamId);
    broadcastTournamentState('tournament:dev_state_updated');
    res.json(result);
  } catch (error) {
    console.error('Erreur force elimination:', error);
    res.status(500).json({ error: 'Erreur force elimination' });
  }
});

app.post('/api/tournament/phase2/start', async (req, res) => {
  try {
    if (tournamentState.phase1.qualified.length === 0) {
      await completePhase1();
    }

    tournamentState.phase = 'phase2';
    tournamentState.phase2.active = true;
    tournamentState.phase2.paused = false;
    tournamentState.phase2.roundNumber = 0;
    tournamentState.phase2.currentPackId = null;
    tournamentState.phase2.currentPackName = null;
    tournamentState.phase2.currentChallenge = null;
    tournamentState.phase2.submissions = [];
    tournamentState.phase2.hintUsage = {};
    tournamentState.phase2.hintUsageLog = [];
    tournamentState.phase2.penaltyEvents = [];
    tournamentState.phase2.activityFeed = [];
    tournamentState.phase2.roundWinner = null;
    tournamentState.phase2.hintRevealed = false;
    tournamentState.phase2.answerRevealed = false;
    tournamentState.phase2.roundStatus = 'ready';
    tournamentState.phase2.roundHistorySaved = false;
    tournamentState.phase2.scores = {};
    tournamentState.phase2.qualifiedTeams = tournamentState.phase1.qualified;
    tournamentState.phase2.eliminatedTeams = tournamentState.phase1.eliminated;

    tournamentState.phase2.qualifiedTeams.forEach(team => {
      tournamentState.phase2.scores[String(team.id)] = {
        id: String(team.id),
        name: team.name,
        score: 0,
        phase1Score: team.score,
        status: 'active'
      };
    });

    logPhase2Activity('phase2', 'Phase 2 démarrée par le modérateur');
    resetPhase3State();
    await persistTournamentDevelopmentState();
    broadcastTournamentState('tournament:phase2_started');
    res.json(getTournamentSnapshot());
  } catch (error) {
    console.error('Erreur lancement Phase 2:', error);
    res.status(500).json({ error: 'Erreur lancement Phase 2' });
  }
});


let activeTeams = {}; // Stockage en mémoire : { teamId: { id, name, score, socketId } }

const tournamentState = {
  tournamentId: null,
  phase: 'phase1',
  development: {
    enabled: DEVELOPMENT_MODE,
    panel: DEVELOPMENT_MODE,
    lastAction: null,
    isSkipped: false,
    simulatedResults: null,
    generatedRankings: [],
    mockTournamentState: null
  },
  phase1: {
    rankings: [],
    qualified: [],
    eliminated: []
  },
  phase2: {
    active: false,
    paused: false,
    roundNumber: 0,
    currentPackId: null,
    currentPackName: null,
    currentChallenge: null,
    submissions: [],
    qualifiedTeams: [],
    eliminatedTeams: [],
    scores: {},
    hintUsage: {},
    hintUsageLog: [],
    penaltyEvents: [],
    activityFeed: [],
    hintRevealed: false,
    answerRevealed: false,
    roundWinner: null,
    roundStatus: 'idle',
    roundHistorySaved: false,
    timer: 0,
    timerMax: 0,
    timerInterval: null
  },
  phase3: {
    active: false,
    finalists: [],
    eliminatedTeams: [],
    scores: [],
    duelState: 'idle',
    buzzerEnabled: false,
    roundLabel: 'Grand Finale',
    statistics: []
  }
};

const toDbTeamId = (teamId) => {
  const parsed = Number.parseInt(teamId, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const normalizeAnswer = (value) =>
  String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

const feedId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function pushBounded(list, entry, max = 18) {
  list.unshift(entry);
  if (list.length > max) list.length = max;
}

function logPhase2Activity(type, message, extra = {}) {
  pushBounded(tournamentState.phase2.activityFeed, {
    id: feedId(),
    type,
    message,
    timestamp: new Date().toISOString(),
    ...extra
  });
}

const publicChallenge = (challenge) => {
  if (!challenge) return null;
  return {
    id: challenge.id,
    question: challenge.question,
    category: challenge.category,
    difficulty: challenge.difficulty,
    points: challenge.points,
    penalty: challenge.penalty,
    timeLimit: challenge.timeLimit
  };
};

const DEV_TEAM_POOL = [
  { id: 'dev-alpha', name: 'Team Alpha' },
  { id: 'dev-omega', name: 'Team Omega' },
  { id: 'dev-nova', name: 'Team Nova' },
  { id: 'dev-vertex', name: 'Team Vertex' },
  { id: 'dev-aurora', name: 'Team Aurora' },
  { id: 'dev-rift', name: 'Team Rift' }
];

const createScoreSeries = (base, spread, count) =>
  Array.from({ length: count }, (_, index) => base - (index * spread) - ((index % 2) * 3));

function buildMockRankings(teamCount = 6) {
  const source = DEV_TEAM_POOL.slice(0, teamCount);
  const scoreSeries = createScoreSeries(126, 8, source.length);

  return source.map((team, index) => ({
    id: team.id,
    name: team.name,
    score: scoreSeries[index],
    rank: index + 1,
    streak: Math.max(0, 5 - index),
    penalties: index < 2 ? 0 : index - 1,
    answerHistory: Array.from({ length: 5 }, (_, historyIndex) => ({
      round: historyIndex + 1,
      result: historyIndex <= (4 - index) ? 'correct' : 'wrong'
    }))
  }));
}

function buildPhase2MockScores(qualifiedTeams) {
  const scoreSeries = [210, 198, 174, 160];
  return qualifiedTeams.map((team, index) => ({
    id: String(team.id),
    name: team.name,
    score: scoreSeries[index] ?? Math.max(120, 210 - index * 14),
    phase1Score: team.score,
    status: index < 2 ? 'finalist' : 'eliminated',
    streak: Math.max(1, 4 - index),
    penalties: index
  }));
}

function buildPhase3MockFinalists(finalists) {
  return finalists.map((team, index) => ({
    id: String(team.id),
    name: team.name,
    score: index === 0 ? 210 : 198,
    rank: index + 1,
    buzzerWins: index === 0 ? 4 : 3,
    answerAccuracy: index === 0 ? 0.86 : 0.81
  }));
}

async function ensureTournament() {
  if (tournamentState.tournamentId) return tournamentState.tournamentId;

  try {
    const tournament = await prisma.tournament.create({
      data: {
        name: `Crazy Challenge ${new Date().toISOString()}`,
        status: tournamentState.phase,
        developmentMode: DEVELOPMENT_MODE
      }
    });
    tournamentState.tournamentId = tournament.id;
    return tournament.id;
  } catch (error) {
    console.warn('Tournament persistence unavailable:', error.message);
    return null;
  }
}

async function persistTournamentDevelopmentState() {
  const tournamentId = await ensureTournament();
  if (!tournamentId) return;

  try {
    await prisma.tournament.update({
      where: { id: tournamentId },
      data: {
        status: tournamentState.phase,
        developmentMode: tournamentState.development.enabled,
        isSkipped: tournamentState.development.isSkipped,
        simulatedResults: tournamentState.development.simulatedResults,
        generatedRankings: tournamentState.development.generatedRankings,
        mockTournamentState: tournamentState.development.mockTournamentState
      }
    });
  } catch (error) {
    console.warn('Tournament dev state persistence unavailable:', error.message);
  }
}

async function getRankingsFromTeams() {
  const byId = new Map();

  try {
    const dbTeams = await prisma.team.findMany();
    dbTeams.forEach(team => {
      byId.set(String(team.id), {
        id: String(team.id),
        name: team.name,
        score: team.score || 0
      });
    });
  } catch (error) {
    console.warn('Team database ranking unavailable:', error.message);
  }

  Object.values(activeTeams).forEach(team => {
    byId.set(String(team.id), {
      id: String(team.id),
      name: team.name || `Équipe ${team.id}`,
      score: team.score || 0
    });
  });

  return [...byId.values()]
    .sort((a, b) => b.score - a.score)
    .map((team, index) => ({ ...team, rank: index + 1 }));
}

function resetPhase2State() {
  if (tournamentState.phase2.timerInterval) {
    clearInterval(tournamentState.phase2.timerInterval);
  }

  tournamentState.phase2 = {
    active: false,
    paused: false,
    roundNumber: 0,
    currentPackId: null,
    currentPackName: null,
    currentChallenge: null,
    submissions: [],
    qualifiedTeams: [],
    eliminatedTeams: [],
    scores: {},
    hintUsage: {},
    hintUsageLog: [],
    penaltyEvents: [],
    activityFeed: [],
    hintRevealed: false,
    answerRevealed: false,
    roundWinner: null,
    roundStatus: 'idle',
    roundHistorySaved: false,
    timer: 0,
    timerMax: 0,
    timerInterval: null
  };
}

function resetPhase3State() {
  tournamentState.phase3 = {
    active: false,
    finalists: [],
    eliminatedTeams: [],
    scores: [],
    duelState: 'idle',
    buzzerEnabled: false,
    roundLabel: 'Grand Finale',
    statistics: []
  };
}

async function resetTournamentState() {
  Object.keys(activeTeams).forEach(teamId => {
    activeTeams[teamId] = { ...activeTeams[teamId], score: 0 };
  });
  tournamentState.phase = 'phase1';
  tournamentState.phase1 = { rankings: [], qualified: [], eliminated: [] };
  tournamentState.development = {
    enabled: DEVELOPMENT_MODE,
    panel: DEVELOPMENT_MODE,
    lastAction: 'reset_tournament',
    isSkipped: false,
    simulatedResults: null,
    generatedRankings: [],
    mockTournamentState: null
  };
  resetPhase2State();
  resetPhase3State();
  await persistTournamentDevelopmentState();
  return getTournamentSnapshot();
}

function applyDevelopmentSnapshot(action, rankings, qualified, eliminated, mockTournamentState) {
  tournamentState.development.lastAction = action;
  tournamentState.development.isSkipped = true;
  tournamentState.development.simulatedResults = {
    action,
    timestamp: new Date().toISOString(),
    qualified,
    eliminated
  };
  tournamentState.development.generatedRankings = rankings;
  tournamentState.development.mockTournamentState = mockTournamentState;
}

async function persistPhaseResults(phaseNumber, rankings, qualified, eliminated) {
  const tournamentId = await ensureTournament();

  try {
    await prisma.phaseResults.create({
      data: { tournamentId, phaseNumber, rankings, qualified, eliminated }
    });

    await Promise.all(qualified.map(team => prisma.qualifiedTeam.create({
      data: {
        tournamentId,
        phaseNumber,
        teamId: toDbTeamId(team.id),
        teamName: team.name,
        score: team.score,
        rank: team.rank
      }
    })));

    await Promise.all(eliminated.map(team => prisma.eliminatedTeam.create({
      data: {
        tournamentId,
        phaseNumber,
        teamId: toDbTeamId(team.id),
        teamName: team.name,
        score: team.score,
        rank: team.rank,
        reason: phaseNumber === 1 ? 'Not in top 4' : 'Not in top 2'
      }
    })));
  } catch (error) {
    console.warn('Phase result persistence unavailable:', error.message);
  }
}

async function completePhase1() {
  const rankings = await getRankingsFromTeams();
  const qualified = rankings.slice(0, 4).map(team => ({ ...team, status: 'qualified' }));
  const eliminated = rankings.slice(4).map(team => ({ ...team, status: 'eliminated' }));

  tournamentState.phase = 'phase1_complete';
  tournamentState.phase1 = { rankings, qualified, eliminated };
  resetPhase2State();
  resetPhase3State();
  tournamentState.phase2.qualifiedTeams = qualified;
  tournamentState.phase2.eliminatedTeams = eliminated;
  tournamentState.development.isSkipped = false;
  tournamentState.development.simulatedResults = null;
  tournamentState.development.generatedRankings = rankings;
  tournamentState.development.mockTournamentState = null;

  await persistPhaseResults(1, rankings, qualified, eliminated);
  await persistTournamentDevelopmentState();
  return tournamentState.phase1;
}

function initializePhase2State(qualified, eliminated, scores, source = 'normal') {
  resetPhase2State();
  resetPhase3State();
  tournamentState.phase = 'phase2';
  tournamentState.phase2.active = true;
  tournamentState.phase2.paused = false;
  tournamentState.phase2.roundNumber = 0;
  tournamentState.phase2.qualifiedTeams = qualified;
  tournamentState.phase2.eliminatedTeams = eliminated;
  tournamentState.phase2.scores = {};
  tournamentState.phase2.roundStatus = 'ready';

  scores.forEach(team => {
    tournamentState.phase2.scores[String(team.id)] = {
      id: String(team.id),
      name: team.name,
      score: team.score,
      phase1Score: team.phase1Score ?? team.score,
      status: team.status || 'active',
      streak: team.streak || 0,
      penalties: team.penalties || 0
    };
  });

  tournamentState.development.mockTournamentState = {
    source,
    phase: 'phase2',
    scores
  };
  logPhase2Activity('phase2', 'Phase 2 initialisée', { source });
}

async function skipToPhase2ForTesting() {
  const rankings = buildMockRankings(6);
  const qualified = rankings.slice(0, 4).map(team => ({ ...team, status: 'qualified' }));
  const eliminated = rankings.slice(4).map(team => ({ ...team, status: 'eliminated' }));
  const phase2Scores = buildPhase2MockScores(qualified);

  tournamentState.phase1 = { rankings, qualified, eliminated };
  initializePhase2State(qualified, eliminated, phase2Scores, 'skip_phase2');
  applyDevelopmentSnapshot('skip_phase2', rankings, qualified, eliminated, tournamentState.development.mockTournamentState);

  await persistPhaseResults(1, rankings, qualified, eliminated);
  await persistTournamentDevelopmentState();
  return getTournamentSnapshot();
}

async function skipToPhase3ForTesting() {
  const rankings = buildMockRankings(6);
  const phase1Qualified = rankings.slice(0, 4).map(team => ({ ...team, status: 'qualified' }));
  const phase1Eliminated = rankings.slice(4).map(team => ({ ...team, status: 'eliminated' }));
  const phase2Scores = buildPhase2MockScores(phase1Qualified)
    .sort((a, b) => b.score - a.score)
    .map((team, index) => ({ ...team, rank: index + 1 }));
  const finalists = phase2Scores.slice(0, 2).map(team => ({ ...team, status: 'qualified' }));
  const phase2Eliminated = phase2Scores.slice(2).map(team => ({ ...team, status: 'eliminated' }));
  const finalScores = buildPhase3MockFinalists(finalists);

  tournamentState.phase1 = {
    rankings,
    qualified: phase1Qualified,
    eliminated: phase1Eliminated
  };

  initializePhase2State(
    phase1Qualified,
    phase1Eliminated,
    phase2Scores,
    'skip_phase3_seed'
  );

  tournamentState.phase = 'phase3';
  tournamentState.phase2.active = false;
  tournamentState.phase3 = {
    active: true,
    finalists,
    eliminatedTeams: phase2Eliminated,
    scores: finalScores,
    duelState: 'ready',
    buzzerEnabled: true,
    roundLabel: 'Grand Finale',
    statistics: finalScores.map(team => ({
      teamId: team.id,
      teamName: team.name,
      score: team.score,
      buzzerWins: team.buzzerWins,
      answerAccuracy: team.answerAccuracy
    }))
  };

  applyDevelopmentSnapshot('skip_phase3', rankings, finalists, phase2Eliminated, {
    source: 'skip_phase3',
    phase: 'phase3',
    phase2Scores,
    finalScores
  });

  await persistPhaseResults(1, rankings, phase1Qualified, phase1Eliminated);
  await persistPhaseResults(2, phase2Scores, finalists, phase2Eliminated);
  await persistTournamentDevelopmentState();
  return getTournamentSnapshot();
}

async function generateMockRankingsForTesting() {
  const rankings = buildMockRankings(6);
  const qualified = rankings.slice(0, 4).map(team => ({ ...team, status: 'qualified' }));
  const eliminated = rankings.slice(4).map(team => ({ ...team, status: 'eliminated' }));
  tournamentState.phase1 = { rankings, qualified, eliminated };
  applyDevelopmentSnapshot('generate_mock_rankings', rankings, qualified, eliminated, {
    source: 'generate_mock_rankings',
    phase: tournamentState.phase
  });
  await persistTournamentDevelopmentState();
  return getTournamentSnapshot();
}

async function simulateScoresForTesting() {
  if (tournamentState.phase === 'phase3' && tournamentState.phase3.finalists.length) {
    tournamentState.phase3.scores = buildPhase3MockFinalists(tournamentState.phase3.finalists);
  } else if (tournamentState.phase2.qualifiedTeams.length) {
    const scores = buildPhase2MockScores(tournamentState.phase2.qualifiedTeams);
    initializePhase2State(
      tournamentState.phase2.qualifiedTeams,
      tournamentState.phase2.eliminatedTeams,
      scores,
      'simulate_scores'
    );
  } else {
    return generateMockRankingsForTesting();
  }

  tournamentState.development.lastAction = 'simulate_scores';
  tournamentState.development.isSkipped = true;
  tournamentState.development.mockTournamentState = getTournamentSnapshot();
  await persistTournamentDevelopmentState();
  return getTournamentSnapshot();
}

async function forceQualificationForTesting(teamId) {
  const targetId = String(teamId);
  const rankings = tournamentState.phase1.rankings.length
    ? [...tournamentState.phase1.rankings]
    : buildMockRankings(6);

  const reordered = rankings
    .sort((a, b) => (String(a.id) === targetId ? -1 : String(b.id) === targetId ? 1 : b.score - a.score))
    .map((team, index) => ({ ...team, rank: index + 1 }));

  tournamentState.phase1 = {
    rankings: reordered,
    qualified: reordered.slice(0, 4).map(team => ({ ...team, status: 'qualified' })),
    eliminated: reordered.slice(4).map(team => ({ ...team, status: 'eliminated' }))
  };

  applyDevelopmentSnapshot('force_qualification', reordered, tournamentState.phase1.qualified, tournamentState.phase1.eliminated, {
    source: 'force_qualification',
    targetId
  });
  await persistTournamentDevelopmentState();
  return getTournamentSnapshot();
}

async function forceEliminationForTesting(teamId) {
  const targetId = String(teamId);
  const rankings = tournamentState.phase1.rankings.length
    ? [...tournamentState.phase1.rankings]
    : buildMockRankings(6);

  const reordered = rankings
    .sort((a, b) => (String(a.id) === targetId ? 1 : String(b.id) === targetId ? -1 : b.score - a.score))
    .map((team, index) => ({ ...team, rank: index + 1 }));

  tournamentState.phase1 = {
    rankings: reordered,
    qualified: reordered.slice(0, 4).map(team => ({ ...team, status: 'qualified' })),
    eliminated: reordered.slice(4).map(team => ({ ...team, status: 'eliminated' }))
  };

  applyDevelopmentSnapshot('force_elimination', reordered, tournamentState.phase1.qualified, tournamentState.phase1.eliminated, {
    source: 'force_elimination',
    targetId
  });
  await persistTournamentDevelopmentState();
  return getTournamentSnapshot();
}

function startPhase2Timer() {
  if (tournamentState.phase2.timerInterval) {
    clearInterval(tournamentState.phase2.timerInterval);
  }

  tournamentState.phase2.timerInterval = setInterval(() => {
    if (!tournamentState.phase2.active || tournamentState.phase2.paused) return;
    tournamentState.phase2.timer = Math.max(0, tournamentState.phase2.timer - 1);
    io.emit('phase2:timer', { timer: tournamentState.phase2.timer });

    if (tournamentState.phase2.timer === 0) {
      clearInterval(tournamentState.phase2.timerInterval);
      tournamentState.phase2.timerInterval = null;
      void finalizeActivePhase2Round('timeout', 'phase2:round_timeout', 'Temps écoulé');
    }
  }, 1000);
}

async function persistActiveRoundHistory(status = 'ended', reason = null) {
  const challenge = tournamentState.phase2.currentChallenge;
  if (!challenge || tournamentState.phase2.roundHistorySaved) return;

  try {
    await prisma.roundHistory.create({
      data: {
        phaseNumber: 2,
        challengeId: toDbTeamId(challenge.id),
        winnerTeamId: toDbTeamId(tournamentState.phase2.roundWinner?.teamId),
        winnerName: tournamentState.phase2.roundWinner?.teamName || null,
        submissions: tournamentState.phase2.submissions,
        scoreSnapshot: {
          status,
          reason,
          scores: Object.values(tournamentState.phase2.scores)
        }
      }
    });
    tournamentState.phase2.roundHistorySaved = true;
  } catch (error) {
    console.warn('Round history persistence unavailable:', error.message);
  }
}

async function finalizeActivePhase2Round(status, broadcastEvent, reason) {
  if (tournamentState.phase2.timerInterval) {
    clearInterval(tournamentState.phase2.timerInterval);
    tournamentState.phase2.timerInterval = null;
  }

  tournamentState.phase2.timer = 0;
  tournamentState.phase2.roundStatus = status;
  await persistActiveRoundHistory(status, reason);
  logPhase2Activity('round', `Round ${tournamentState.phase2.roundNumber} ${reason || status}`, {
    status,
    roundNumber: tournamentState.phase2.roundNumber
  });
  tournamentState.phase2.currentChallenge = null;
  tournamentState.phase2.hintRevealed = false;
  tournamentState.phase2.answerRevealed = false;
  broadcastTournamentState(broadcastEvent);
}

function getTournamentSnapshot() {
  const phase2Scores = Object.values(tournamentState.phase2.scores)
    .sort((a, b) => b.score - a.score)
    .map((team, index) => ({ ...team, rank: index + 1 }));

  return {
    phase: tournamentState.phase,
    development: tournamentState.development,
    phase1: tournamentState.phase1,
    phase2: {
      active: tournamentState.phase2.active,
      paused: tournamentState.phase2.paused,
      roundNumber: tournamentState.phase2.roundNumber,
      currentPackId: tournamentState.phase2.currentPackId,
      currentPackName: tournamentState.phase2.currentPackName,
      currentChallenge: publicChallenge(tournamentState.phase2.currentChallenge),
      submissions: tournamentState.phase2.submissions,
      qualifiedTeams: tournamentState.phase2.qualifiedTeams,
      eliminatedTeams: tournamentState.phase2.eliminatedTeams,
      scores: phase2Scores,
      hintRevealed: tournamentState.phase2.hintRevealed,
      answerRevealed: tournamentState.phase2.answerRevealed,
      roundWinner: tournamentState.phase2.roundWinner,
      roundStatus: tournamentState.phase2.roundStatus,
      timer: tournamentState.phase2.timer,
      timerMax: tournamentState.phase2.timerMax,
      monitoring: {
        hintUsageLog: tournamentState.phase2.hintUsageLog,
        penaltyEvents: tournamentState.phase2.penaltyEvents,
        activityFeed: tournamentState.phase2.activityFeed
      }
    },
    phase3: {
      active: tournamentState.phase3.active,
      finalists: tournamentState.phase3.finalists,
      eliminatedTeams: tournamentState.phase3.eliminatedTeams,
      scores: tournamentState.phase3.scores,
      duelState: tournamentState.phase3.duelState,
      buzzerEnabled: tournamentState.phase3.buzzerEnabled,
      roundLabel: tournamentState.phase3.roundLabel,
      statistics: tournamentState.phase3.statistics
    }
  };
}

function broadcastTournamentState(event = 'tournament:state') {
  io.emit(event, getTournamentSnapshot());
}

function isQualifiedForPhase2(teamId) {
  return tournamentState.phase2.qualifiedTeams.some(team => String(team.id) === String(teamId));
}

async function loadChallenge(challengeId) {
  const id = Number.parseInt(challengeId, 10);
  if (Number.isNaN(id)) return null;
  return prisma.importedChallenge.findUnique({
    where: { id },
    include: { pack: true }
  });
}

async function endPhase2() {
  await persistActiveRoundHistory('phase_complete', 'Phase 2 terminée');
  const rankings = Object.values(tournamentState.phase2.scores)
    .sort((a, b) => b.score - a.score)
    .map((team, index) => ({ ...team, rank: index + 1 }));
  const qualified = rankings.slice(0, 2).map(team => ({ ...team, status: 'qualified' }));
  const eliminated = rankings.slice(2).map(team => ({ ...team, status: 'eliminated' }));

  tournamentState.phase = 'phase2_complete';
  tournamentState.phase2.active = false;
  tournamentState.phase2.qualifiedTeams = qualified;
  tournamentState.phase2.eliminatedTeams = eliminated;
  tournamentState.phase2.roundStatus = 'complete';

  if (tournamentState.phase2.timerInterval) {
    clearInterval(tournamentState.phase2.timerInterval);
    tournamentState.phase2.timerInterval = null;
  }

  await persistPhaseResults(2, rankings, qualified, eliminated);
  await persistTournamentDevelopmentState();
  broadcastTournamentState('tournament:phase2_complete');
}

io.on('connection', (socket) => {
  console.log('Connecté:', socket.id);

socket.on('join', ({ room, role, teamId, teamName }) => {
    socket.join(room);
    console.log(`${socket.id} -> ${room} (${role})`);

    if (role === 'team' && teamId) {
      activeTeams[teamId] = {
        id: teamId,
        name: teamName || `Équipe ${teamId}`,
        score: 0,
        socketId: socket.id
      };
      if (tournamentState.phase === 'phase2') {
        logPhase2Activity(
          'team',
          `${teamName || `Équipe ${teamId}`} ${isQualifiedForPhase2(teamId) ? 'active sa connexion' : 'rejoint en mode spectateur'}`,
          { teamId: String(teamId), teamName: teamName || `Équipe ${teamId}` }
        );
      }
io.to('moderator-session').emit('score:refresh', { teams: Object.values(activeTeams) });
    }

    socket.emit('tournament:state', getTournamentSnapshot());
  });
socket.on('moderator:send_question', (data) => {
    console.log('Question envoyée:', data.text || data.question);
    io.to('session-1').emit('game:new_question', {
      id: data.id,
      text: data.text || data.question,
      category: data.category || 'Général',
      points: data.points || 10,
      type: data.type || 'multiple_choice',
      timeLimit: data.timer || data.timeLimit || 30
    });
  io.to('public-room').emit('game:new_question', {
    id: data.id,
    text: data.text || data.question,
    category: data.category || 'Général',
    points: data.points || 10,
    type: data.type || 'multiple_choice',
    timeLimit: data.timer || data.timeLimit || 30
  });
  io.to('jury-room').emit('game:new_question', {
    id: data.id,
    text: data.text || data.question,
    category: data.category || 'Général',
    points: data.points || 10,
    type: data.type || 'multiple_choice',
    timeLimit: data.timer || data.timeLimit || 30
  });
  });
socket.on('team:buzz', ({ teamId, teamName, questionId, buzzTime, points }) => {
    console.log('Buzz reçu:', { teamId, questionId, buzzTime });
    io.to('moderator-session').emit('game:answer_received', {
      id: Date.now(),
      teamId: teamId || teamName || 'Équipe',
      questionId,
      questionText: 'Question en cours',
      buzzTime,
      answer: 'En attente...',
      points: points || 0,
      timestamp: new Date()
    });
  });
 socket.on('answer:validate', ({ teamId, accepted, points }) => {
    if (accepted && activeTeams[teamId]) {
      activeTeams[teamId].score += points;
      // Notifier l'équipe que son score a changé
      io.to(activeTeams[teamId].socketId).emit('game:score_update', activeTeams[teamId].score);
    }
  const sortedTeams = Object.values(activeTeams).sort((a, b) => b.score - a.score);
    io.to('moderator-session').emit('score:refresh', { teams: sortedTeams });
  io.to('public-room').emit('score:refresh', { teams: sortedTeams });
  });

  socket.on('phase1:end', async () => {
    try {
      const result = await completePhase1();
      io.emit('tournament:phase1_complete', {
        ...getTournamentSnapshot(),
        result
      });
    } catch (error) {
      console.error('Erreur socket fin Phase 1:', error);
      socket.emit('phase:error', { error: 'Erreur fin Phase 1' });
    }
  });

  socket.on('phase1:skip', async () => {
    if (!DEVELOPMENT_MODE) {
      return socket.emit('phase:error', { error: 'Mode développement requis' });
    }

    try {
      const result = await skipToPhase2ForTesting();
      io.emit('tournament:dev_phase2_started', result);
    } catch (error) {
      console.error('Erreur socket skip Phase 1:', error);
      socket.emit('phase:error', { error: 'Erreur skip Phase 1' });
    }
  });

  socket.on('dev:skip_phase3', async () => {
    if (!DEVELOPMENT_MODE) {
      return socket.emit('phase:error', { error: 'Mode développement requis' });
    }

    try {
      const result = await skipToPhase3ForTesting();
      io.emit('tournament:dev_phase3_started', result);
    } catch (error) {
      console.error('Erreur socket skip Phase 3:', error);
      socket.emit('phase:error', { error: 'Erreur skip Phase 3' });
    }
  });

  socket.on('dev:generate_mock_rankings', async () => {
    if (!DEVELOPMENT_MODE) {
      return socket.emit('phase:error', { error: 'Mode développement requis' });
    }

    try {
      const result = await generateMockRankingsForTesting();
      io.emit('tournament:dev_state_updated', result);
    } catch (error) {
      console.error('Erreur socket mock rankings:', error);
      socket.emit('phase:error', { error: 'Erreur mock rankings' });
    }
  });

  socket.on('dev:simulate_scores', async () => {
    if (!DEVELOPMENT_MODE) {
      return socket.emit('phase:error', { error: 'Mode développement requis' });
    }

    try {
      const result = await simulateScoresForTesting();
      io.emit('tournament:dev_state_updated', result);
    } catch (error) {
      console.error('Erreur socket simulate scores:', error);
      socket.emit('phase:error', { error: 'Erreur simulate scores' });
    }
  });

  socket.on('dev:reset_tournament', async () => {
    if (!DEVELOPMENT_MODE) {
      return socket.emit('phase:error', { error: 'Mode développement requis' });
    }

    try {
      const result = await resetTournamentState();
      io.emit('tournament:dev_reset', result);
    } catch (error) {
      console.error('Erreur socket reset tournament:', error);
      socket.emit('phase:error', { error: 'Erreur reset tournament' });
    }
  });

  socket.on('dev:force_qualification', async ({ teamId }) => {
    if (!DEVELOPMENT_MODE) {
      return socket.emit('phase:error', { error: 'Mode développement requis' });
    }

    try {
      const result = await forceQualificationForTesting(teamId);
      io.emit('tournament:dev_state_updated', result);
    } catch (error) {
      console.error('Erreur socket force qualification:', error);
      socket.emit('phase:error', { error: 'Erreur force qualification' });
    }
  });

  socket.on('dev:force_elimination', async ({ teamId }) => {
    if (!DEVELOPMENT_MODE) {
      return socket.emit('phase:error', { error: 'Mode développement requis' });
    }

    try {
      const result = await forceEliminationForTesting(teamId);
      io.emit('tournament:dev_state_updated', result);
    } catch (error) {
      console.error('Erreur socket force elimination:', error);
      socket.emit('phase:error', { error: 'Erreur force elimination' });
    }
  });

  socket.on('phase2:start', async () => {
    try {
      if (tournamentState.phase1.qualified.length === 0) {
        await completePhase1();
      }

      tournamentState.phase = 'phase2';
      tournamentState.phase2.active = true;
      tournamentState.phase2.paused = false;
      tournamentState.phase2.roundNumber = 0;
      tournamentState.phase2.currentPackId = null;
      tournamentState.phase2.currentPackName = null;
      tournamentState.phase2.currentChallenge = null;
      tournamentState.phase2.submissions = [];
      tournamentState.phase2.hintUsage = {};
      tournamentState.phase2.hintUsageLog = [];
      tournamentState.phase2.penaltyEvents = [];
      tournamentState.phase2.activityFeed = [];
      tournamentState.phase2.roundWinner = null;
      tournamentState.phase2.hintRevealed = false;
      tournamentState.phase2.answerRevealed = false;
      tournamentState.phase2.roundStatus = 'ready';
      tournamentState.phase2.roundHistorySaved = false;
      tournamentState.phase2.qualifiedTeams = tournamentState.phase1.qualified;
      tournamentState.phase2.eliminatedTeams = tournamentState.phase1.eliminated;
      tournamentState.phase2.scores = {};

      tournamentState.phase2.qualifiedTeams.forEach(team => {
        tournamentState.phase2.scores[String(team.id)] = {
          id: String(team.id),
          name: team.name,
          score: 0,
          phase1Score: team.score,
          status: 'active'
        };
      });

      logPhase2Activity('phase2', 'Phase 2 démarrée par le modérateur');
      resetPhase3State();
      await persistTournamentDevelopmentState();
      broadcastTournamentState('tournament:phase2_started');
    } catch (error) {
      console.error('Erreur socket lancement Phase 2:', error);
      socket.emit('phase:error', { error: 'Erreur lancement Phase 2' });
    }
  });

  socket.on('phase2:start_challenge', async ({ challengeId, challenge }) => {
    try {
      const loadedChallenge = challenge || await loadChallenge(challengeId);
      if (!loadedChallenge) return socket.emit('phase:error', { error: 'Challenge introuvable' });

      tournamentState.phase = 'phase2';
      tournamentState.phase2.active = true;
      tournamentState.phase2.paused = false;
      tournamentState.phase2.roundNumber += 1;
      tournamentState.phase2.currentChallenge = {
        ...loadedChallenge,
        hint: loadedChallenge.hint || generateHint(loadedChallenge.question, loadedChallenge.answer, loadedChallenge.difficulty)
      };
      tournamentState.phase2.currentPackId = loadedChallenge.packId || tournamentState.phase2.currentPackId;
      tournamentState.phase2.currentPackName = loadedChallenge.pack?.name || tournamentState.phase2.currentPackName;
      tournamentState.phase2.submissions = [];
      tournamentState.phase2.hintUsage = {};
      tournamentState.phase2.hintUsageLog = [];
      tournamentState.phase2.penaltyEvents = [];
      tournamentState.phase2.hintRevealed = false;
      tournamentState.phase2.answerRevealed = false;
      tournamentState.phase2.roundWinner = null;
      tournamentState.phase2.roundStatus = 'live';
      tournamentState.phase2.roundHistorySaved = false;
      tournamentState.phase2.timer = loadedChallenge.timeLimit || 30;
      tournamentState.phase2.timerMax = loadedChallenge.timeLimit || 30;

      logPhase2Activity('challenge', `Round ${tournamentState.phase2.roundNumber} lancé: ${loadedChallenge.question}`, {
        challengeId: loadedChallenge.id,
        packId: loadedChallenge.packId,
        packName: loadedChallenge.pack?.name || null
      });
      startPhase2Timer();
      broadcastTournamentState('phase2:challenge_started');
    } catch (error) {
      console.error('Erreur lancement challenge Phase 2:', error);
      socket.emit('phase:error', { error: 'Erreur lancement challenge' });
    }
  });

  socket.on('phase2:submit_answer', async ({ teamId, teamName, answer }) => {
    try {
      const challenge = tournamentState.phase2.currentChallenge;
      const id = String(teamId || '');

      if (!challenge || !tournamentState.phase2.active) {
        return socket.emit('phase2:submission_result', { accepted: false, reason: 'Aucun challenge actif' });
      }

      if (!isQualifiedForPhase2(id)) {
        return socket.emit('phase2:submission_result', { accepted: false, reason: 'Equipe non qualifiee' });
      }

      if (tournamentState.phase2.roundWinner) {
        return socket.emit('phase2:submission_result', { accepted: false, reason: 'Round deja gagne' });
      }

      if (!tournamentState.phase2.scores[id]) {
        tournamentState.phase2.scores[id] = {
          id,
          name: teamName || activeTeams[id]?.name || `Équipe ${id}`,
          score: 0,
          phase1Score: 0,
          status: 'active'
        };
      }

      const correct = normalizeAnswer(answer) === normalizeAnswer(challenge.answer);
      const usedHint = Boolean(tournamentState.phase2.hintUsage[id]);
      const timestamp = new Date();
      const submission = {
        id: Date.now(),
        teamId: id,
        teamName: teamName || tournamentState.phase2.scores[id].name,
        answer,
        correct,
        usedHint,
        timestamp: timestamp.toISOString()
      };

      if (correct) {
        const earned = Math.max(0, (challenge.points || 10) - (usedHint ? 2 : 0));
        tournamentState.phase2.scores[id].score += earned;
        submission.points = earned;
        tournamentState.phase2.roundWinner = {
          teamId: id,
          teamName: submission.teamName,
          points: earned,
          usedHint
        };
        tournamentState.phase2.roundStatus = 'won';
        logPhase2Activity('submission', `${submission.teamName} gagne le round ${tournamentState.phase2.roundNumber}`, {
          teamId: id,
          teamName: submission.teamName,
          points: earned,
          usedHint
        });

        if (tournamentState.phase2.timerInterval) {
          clearInterval(tournamentState.phase2.timerInterval);
          tournamentState.phase2.timerInterval = null;
        }

        try {
          await prisma.roundHistory.create({
            data: {
              phaseNumber: 2,
              challengeId: toDbTeamId(challenge.id),
              winnerTeamId: toDbTeamId(id),
              winnerName: submission.teamName,
              submissions: [...tournamentState.phase2.submissions, submission],
              scoreSnapshot: Object.values(tournamentState.phase2.scores)
            }
          });
          tournamentState.phase2.roundHistorySaved = true;
        } catch (error) {
          console.warn('Round history persistence unavailable:', error.message);
        }
      } else {
        const penalty = challenge.penalty || -1;
        tournamentState.phase2.scores[id].score += penalty;
        tournamentState.phase2.scores[id].penalties = (tournamentState.phase2.scores[id].penalties || 0) + 1;
        submission.penalty = penalty;
        pushBounded(tournamentState.phase2.penaltyEvents, {
          id: feedId(),
          teamId: id,
          teamName: submission.teamName,
          penalty,
          answer,
          roundNumber: tournamentState.phase2.roundNumber,
          timestamp: submission.timestamp
        });
        logPhase2Activity('penalty', `${submission.teamName} reçoit ${penalty} points de pénalité`, {
          teamId: id,
          teamName: submission.teamName,
          penalty
        });

        try {
          await prisma.penaltyLog.create({
            data: {
              teamId: toDbTeamId(id),
              teamName: submission.teamName,
              challengeId: toDbTeamId(challenge.id),
              penalty,
              reason: 'Wrong answer'
            }
          });
        } catch (error) {
          console.warn('Penalty persistence unavailable:', error.message);
        }
      }

      tournamentState.phase2.submissions.push(submission);
      socket.emit('phase2:submission_result', submission);
      broadcastTournamentState(correct ? 'phase2:round_winner' : 'phase2:submission_update');
    } catch (error) {
      console.error('Erreur soumission Phase 2:', error);
      socket.emit('phase:error', { error: 'Erreur soumission Phase 2' });
    }
  });

  socket.on('phase2:request_hint', async ({ teamId, teamName }) => {
    try {
      const challenge = tournamentState.phase2.currentChallenge;
      const id = String(teamId || '');

      if (!challenge || !isQualifiedForPhase2(id)) return;

      const hint = challenge.hint || generateHint(challenge.question, challenge.answer, challenge.difficulty);
      if (tournamentState.phase2.hintUsage[id]) {
        return socket.emit('phase2:hint', { hint, rewardPenalty: 2 });
      }

      tournamentState.phase2.hintUsage[id] = true;
      tournamentState.phase2.scores[id] = tournamentState.phase2.scores[id] || {
        id,
        name: teamName || activeTeams[id]?.name || `Équipe ${id}`,
        score: 0,
        phase1Score: 0,
        status: 'active'
      };
      tournamentState.phase2.scores[id].hintsUsed = (tournamentState.phase2.scores[id].hintsUsed || 0) + 1;
      pushBounded(tournamentState.phase2.hintUsageLog, {
        id: feedId(),
        teamId: id,
        teamName: teamName || activeTeams[id]?.name || `Équipe ${id}`,
        hint,
        roundNumber: tournamentState.phase2.roundNumber,
        timestamp: new Date().toISOString()
      });
      logPhase2Activity('hint', `${teamName || activeTeams[id]?.name || `Équipe ${id}`} demande un indice`, {
        teamId: id,
        teamName: teamName || activeTeams[id]?.name || `Équipe ${id}`
      });

      try {
        await prisma.hintUsage.create({
          data: {
            teamId: toDbTeamId(id),
            teamName: teamName || activeTeams[id]?.name || `Équipe ${id}`,
            challengeId: toDbTeamId(challenge.id),
            hint
          }
        });
      } catch (error) {
        console.warn('Hint persistence unavailable:', error.message);
      }

      socket.emit('phase2:hint', { hint, rewardPenalty: 2 });
      broadcastTournamentState('phase2:hint_usage_update');
    } catch (error) {
      console.error('Erreur indice Phase 2:', error);
    }
  });

  socket.on('phase2:reveal_hint', () => {
    const challenge = tournamentState.phase2.currentChallenge;
    if (!challenge) return;
    tournamentState.phase2.hintRevealed = true;
    logPhase2Activity('moderation', 'Indice révélé publiquement');
    io.emit('phase2:hint_revealed', {
      hint: challenge.hint || generateHint(challenge.question, challenge.answer, challenge.difficulty),
      state: getTournamentSnapshot()
    });
  });

  socket.on('phase2:regenerate_hint', () => {
    const challenge = tournamentState.phase2.currentChallenge;
    if (!challenge) return;
    challenge.hint = generateHint(challenge.question, challenge.answer, challenge.difficulty);
    logPhase2Activity('moderation', 'Indice régénéré par le modérateur');
    io.emit('phase2:hint_revealed', { hint: challenge.hint, state: getTournamentSnapshot() });
  });

  socket.on('phase2:reveal_answer', () => {
    const challenge = tournamentState.phase2.currentChallenge;
    if (!challenge) return;
    tournamentState.phase2.answerRevealed = true;
    logPhase2Activity('moderation', 'Réponse révélée publiquement');
    io.emit('phase2:answer_revealed', { answer: challenge.answer, state: getTournamentSnapshot() });
  });

  socket.on('phase2:pause', ({ paused }) => {
    tournamentState.phase2.paused = Boolean(paused);
    logPhase2Activity('moderation', tournamentState.phase2.paused ? 'Compétition mise en pause' : 'Compétition reprise');
    broadcastTournamentState('phase2:pause_update');
  });

  socket.on('phase2:end_round', async () => {
    await finalizeActivePhase2Round('ended', 'phase2:round_ended', 'Round clôturé par le modérateur');
  });

  socket.on('phase2:skip_challenge', async () => {
    await finalizeActivePhase2Round('skipped', 'phase2:round_skipped', 'Challenge passé');
  });

  socket.on('phase2:force_next_round', async () => {
    await finalizeActivePhase2Round('forced_next', 'phase2:round_skipped', 'Passage forcé au challenge suivant');
  });

  socket.on('phase2:manual_eliminate', ({ teamId, reason }) => {
    const id = String(teamId);
    if (tournamentState.phase2.scores[id]) {
      tournamentState.phase2.scores[id].status = 'eliminated';
      tournamentState.phase2.eliminatedTeams.push({
        ...tournamentState.phase2.scores[id],
        reason: reason || 'Manual elimination'
      });
      tournamentState.phase2.qualifiedTeams = tournamentState.phase2.qualifiedTeams
        .filter(team => String(team.id) !== id);
      logPhase2Activity('moderation', `${tournamentState.phase2.scores[id].name} est éliminée manuellement`, {
        teamId: id,
        teamName: tournamentState.phase2.scores[id].name,
        reason: reason || 'Manual elimination'
      });
      broadcastTournamentState('phase2:team_eliminated');
    }
  });

  socket.on('phase2:end', async () => {
    try {
      await endPhase2();
    } catch (error) {
      console.error('Erreur fin Phase 2:', error);
      socket.emit('phase:error', { error: 'Erreur fin Phase 2' });
    }
  });

  socket.on('disconnect', () => {
    console.log('Déconnecté:', socket.id);
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Serveur prêt sur http://localhost:${PORT}`);
});
