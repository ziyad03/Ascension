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
const { generateRoundQuestions } = require('./services/ai/questionGenerator');
const localStore = require('./services/localStore');

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
    const activeTeam = activeTeams[String(teamId)];
    
    io.to('moderator-session').emit('game:answer_received', {
      questionId,
      teamId: activeTeam?.name || teamId || 'Équipe',
      buzzTime,
      answer: 'En attente de réponse...',
      points: 0,
      timestamp: new Date()
    });
  io.to('public-room').emit('buzz:first', {
    teamName: activeTeam?.name || teamId || 'Équipe',
    teamId: String(teamId || ''),
    avatar: activeTeam?.avatar || '',
    color: activeTeam?.color || '#17e9ff',
    tag: activeTeam?.tag || '',
    time: Date.now()
  });
    
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

app.get('/api/health', async (req, res) => {
  const health = {
    ok: true,
    api: 'ok',
    database: 'unknown',
    fallbackStore: 'available',
    time: new Date().toISOString()
  };

  try {
    await dbTimeout(prisma.$queryRaw`SELECT 1`, 'Health database check');
    health.database = 'ok';
  } catch (error) {
    health.database = 'unavailable';
    health.databaseError = error.message;
  }

  res.json(health);
});

app.use('/api/csv', csvRoutes);
app.use('/api/phase2', phase2CsvRoutes);

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Non autorisé' });
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Non autorisé' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token invalide' });
  }
};

app.post('/api/teams', async (req, res) => {
  try {
    const { name, tag, color, avatar } = req.body;
    const teamName = String(name || '').trim();
    if (!teamName) return res.status(400).json({ error: "Nom d'équipe requis" });
    
    if (await dbTimeout(prisma.team.findUnique({ where: { name: teamName } }), 'Team lookup')) {
      return res.status(400).json({ error: 'Cette équipe existe déjà' });
    }
    
    const team = await dbTimeout(prisma.team.create({
      data: {
        name: teamName,
        tag: String(tag || '').trim().slice(0, 4).toUpperCase() || null,
        color: color || '#17e9ff',
        avatar: avatar || null,
        score: 0
      }
    }), 'Team create');
    
    res.json(team);
  } catch (error) {
    console.warn('Team database create unavailable, using local fallback:', error.message);
    try {
      const team = localStore.createTeam(req.body || {});
      res.json({ ...team, source: 'local_fallback' });
    } catch (fallbackError) {
      res.status(fallbackError.statusCode || 500).json({ error: fallbackError.message || 'Erreur serveur' });
    }
  }
});

app.get('/api/teams', async (req, res) => {
  try {
    const teams = await dbTimeout(prisma.team.findMany(), 'Team list');
    const teamsWithCounts = await Promise.all(teams.map(async (t) => {
      const count = await dbTimeout(prisma.user.count({ where: { teamId: t.id } }), 'Team member count');
      return { ...t, memberCount: count };
    }));
    res.json(teamsWithCounts);
  } catch (error) {
    console.warn('Team database list unavailable, using local fallback:', error.message);
    res.json(localStore.listTeams().map(team => ({ ...team, source: 'local_fallback' })));
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, role, teamId } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: "Nom d'utilisateur et mot de passe requis" });
    }

    const hashed = await bcrypt.hash(password, 10);
    try {
      if (await dbTimeout(prisma.user.findUnique({ where: { username } }), 'User lookup')) {
        return res.status(400).json({ error: 'Utilisateur existe deja' });
      }
      
      let assignedTeamId = null;
      if (role === 'team' && teamId) {
        const team = await dbTimeout(prisma.team.findUnique({ where: { id: parseInt(teamId, 10) } }), 'Register team lookup');
        if (!team) {
          return res.status(400).json({ error: 'Équipe introuvable' });
        }
        const memberCount = await dbTimeout(prisma.user.count({ where: { teamId: team.id } }), 'Register team member count');
        if (memberCount >= 4) {
          return res.status(400).json({ error: "L'équipe est complète (maximum 4 membres)" });
        }
        assignedTeamId = team.id;
      }

      const user = await dbTimeout(prisma.user.create({
        data: { username, password: hashed, role, teamId: assignedTeamId }
      }), 'User create');
      
      const team = user.teamId
        ? await dbTimeout(prisma.team.findUnique({ where: { id: user.teamId } }), 'Registered team lookup')
        : null;
      return res.json({ id: user.id, username: user.username, role: user.role, teamId: user.teamId, team });
    } catch (dbError) {
      console.warn('User database register unavailable, using local fallback:', dbError.message);
      const user = localStore.createUser({ username, password: hashed, role, teamId });
      const team = user.teamId ? localStore.findTeamById(user.teamId) : null;
      return res.json({ id: user.id, username: user.username, role: user.role, teamId: user.teamId, team, source: 'local_fallback' });
    }
  } catch (error) {
    console.error('Erreur register:', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Erreur serveur' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    let user;
    let team = null;
    let source = 'database';
    try {
      user = await dbTimeout(prisma.user.findUnique({ where: { username } }), 'Login user lookup');
      team = user?.teamId
        ? await dbTimeout(prisma.team.findUnique({ where: { id: user.teamId } }), 'Login team lookup')
        : null;
    } catch (dbError) {
      console.warn('User database login unavailable, using local fallback:', dbError.message);
      user = localStore.findUserByUsername(username);
      team = user?.teamId ? localStore.findTeamById(user.teamId) : null;
      source = 'local_fallback';
    }
    if (!user) return res.status(400).json({ error: 'Identifiants invalides' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: 'Identifiants invalides' });

    const token = jwt.sign(
      { userId: user.id, role: user.role, teamId: user.teamId }, 
      process.env.JWT_SECRET || 'dev_secret', 
      { expiresIn: '24h' }
    );
    res.json({ token, userId: user.id, role: user.role, teamId: user.teamId, username: user.username, team, source });
  } catch (error) {
    console.error('Erreur login:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

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
        tag: team.tag || '',
        color: team.color || '#17e9ff',
        avatar: team.avatar || '',
        score: activeTeams[teamId]?.score || 0,
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

function dbTimeout(promise, label, ms = 150) {
  let timeout;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error(`${label} timeout`)), ms);
    })
  ]).finally(() => clearTimeout(timeout));
}

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
  { id: 'dev-alpha', name: 'Team Alpha', tag: 'ALP', color: '#38bdf8' },
  { id: 'dev-omega', name: 'Team Omega', tag: 'OMG', color: '#f59e0b' },
  { id: 'dev-nova', name: 'Team Nova', tag: 'NOV', color: '#a78bfa' },
  { id: 'dev-vertex', name: 'Team Vertex', tag: 'VTX', color: '#34d399' },
  { id: 'dev-atlas', name: 'Team Atlas', tag: 'ATL', color: '#fb7185' },
  { id: 'dev-sigma', name: 'Team Sigma', tag: 'SIG', color: '#22c55e' },
  { id: 'dev-orion', name: 'Team Orion', tag: 'ORI', color: '#60a5fa' },
  { id: 'dev-rift', name: 'Team Rift', tag: 'RFT', color: '#f472b6' }
];

const PHASE1_TEST_SPEEDS = {
  realtime: 1800,
  '2x': 950,
  '5x': 450,
  instant: 0
};

const PHASE1_ROUND_COUNT = 6;
const PHASE1_QUESTIONS_PER_ROUND = 5;
const PHASE1_CATEGORIES = [
  'Technology',
  'Programming',
  'Web Development',
  'Databases',
  'Networking',
  'Cybersecurity',
  'Artificial Intelligence',
  'Science',
  'Mathematics',
  'Logic',
  'History',
  'Geography',
  'Economics',
  'Business',
  'Startups',
  'Engineering',
  'Culture',
  'Cinema',
  'Sports',
  'General Knowledge',
  'Mixed Challenges'
];

const FALLBACK_PHASE1_QUESTIONS = [
  { text: "Quel protocole chiffre le plus souvent une connexion web HTTPS ?", correctAnswer: 'TLS', category: 'Technology', type: 'short_answer', difficulty: 'Medium' },
  { text: 'Quelle notation decrit une complexite lineaire ?', correctAnswer: 'O(n)', category: 'Programming', type: 'short_answer', difficulty: 'Medium' },
  { text: 'Quel pays abrite le site historique du Machu Picchu ?', correctAnswer: 'Perou', category: 'General Knowledge', type: 'short_answer', difficulty: 'Medium' },
  { text: 'Combien vaut 15 pour cent de 240 ?', correctAnswer: '36', category: 'Mathematics', type: 'short_answer', difficulty: 'Medium' },
  { text: 'Quel organite produit le plus d energie dans la cellule ?', correctAnswer: 'Mitochondrie', category: 'Science', type: 'short_answer', difficulty: 'Medium' }
];

const PHASE1_FAST_QUESTION_BANK = {
  'General Knowledge': [
    ['Quel pays abrite le site historique du Machu Picchu ?', 'Perou'],
    ['Quelle mer separe l Europe du Nord de la Grande-Bretagne ?', 'Mer du Nord'],
    ['Quel pays a accueilli les Jeux olympiques d ete 2016 ?', 'Bresil'],
    ['Quelle ville est associee au canal qui relie Atlantique et Pacifique ?', 'Panama'],
    ['Quel pays possede la plus grande population au monde depuis 2023 ?', 'Inde']
  ],
  Technology: [
    ['Quel protocole chiffre le plus souvent une connexion web HTTPS ?', 'TLS'],
    ['Quel type de base de donnees stocke les donnees en documents JSON ?', 'NoSQL'],
    ['Quel composant conserve temporairement les donnees pour accelerer les acces ?', 'Cache'],
    ['Quel principe ajoute des serveurs pour absorber plus de trafic ?', 'Scalabilite horizontale'],
    ['Quel format leger transporte souvent les donnees entre API web ?', 'JSON']
  ],
  Programming: [
    ['Quelle notation decrit une complexite lineaire ?', 'O(n)'],
    ['Quel concept permet a une fonction de garder acces a son scope parent ?', 'Closure'],
    ['Quelle commande Git cree une nouvelle branche ?', 'git branch'],
    ['Quel type d erreur survient pendant l execution du programme ?', 'Runtime error'],
    ['Quel fichier verrouille les versions exactes des dependances npm ?', 'package-lock.json']
  ],
  'Web Development': [
    ['Quel en-tete HTTP controle les permissions cross-origin ?', 'CORS'],
    ['Quel code HTTP indique une ressource introuvable ?', '404'],
    ['Quel API du navigateur stocke des paires cle valeur persistantes ?', 'localStorage'],
    ['Quel rendu genere le HTML sur le serveur avant envoi ?', 'SSR'],
    ['Quel attribut HTML ameliore le texte alternatif des images ?', 'alt']
  ],
  Databases: [
    ['Quel langage interroge une base relationnelle ?', 'SQL'],
    ['Quelle cle identifie une ligne de maniere unique ?', 'Cle primaire'],
    ['Quel index accelere une recherche mais ralentit parfois l ecriture ?', 'Index'],
    ['Quelle operation combine des lignes de deux tables ?', 'JOIN'],
    ['Quelle propriete ACID garantit tout ou rien ?', 'Atomicite']
  ],
  Networking: [
    ['Quel protocole attribue automatiquement une adresse IP ?', 'DHCP'],
    ['Quel protocole traduit un nom de domaine en adresse IP ?', 'DNS'],
    ['Quelle couche OSI gere le routage IP ?', 'Reseau'],
    ['Quel outil mesure les sauts vers une destination ?', 'traceroute'],
    ['Quel protocole transporte HTTP de facon fiable ?', 'TCP']
  ],
  Cybersecurity: [
    ['Quelle attaque tente de tromper un utilisateur par faux message ?', 'Phishing'],
    ['Quel principe donne seulement les droits necessaires ?', 'Moindre privilege'],
    ['Quel hachage ne doit pas etre reversible ?', 'Hash'],
    ['Quel test controle l identite avant l acces ?', 'Authentification'],
    ['Quel second facteur utilise un code temporaire ?', 'OTP']
  ],
  'Artificial Intelligence': [
    ['Quel type de modele est entraine avec donnees etiquetees ?', 'Supervise'],
    ['Quel phenomene arrive quand un modele memorise trop l entrainement ?', 'Surapprentissage'],
    ['Quel score mesure souvent precision et rappel ensemble ?', 'F1-score'],
    ['Quel reseau est inspire du cerveau ?', 'Reseau neuronal'],
    ['Quel terme designe une instruction envoyee a un LLM ?', 'Prompt']
  ],
  Logic: [
    ['Dans la suite 3, 6, 12, 24, quel est le prochain nombre ?', '48'],
    ['Si A implique B et A est vrai, que peut-on conclure ?', 'B est vrai'],
    ['Quel operateur logique est vrai si une seule condition est vraie ?', 'XOR'],
    ['Si tous les objets du groupe A sont bleus et Mira est dans le groupe A, quelle couleur est Mira ?', 'Bleue'],
    ['Dans une grille 4 par 4, combien de cases y a-t-il ?', '16']
  ],
  Mathematics: [
    ['Combien vaut 15 pour cent de 240 ?', '36'],
    ['Quelle est la racine carree de 144 ?', '12'],
    ['Combien vaut 3 puissance 4 ?', '81'],
    ['Quel est le perimetre d un carre de cote 9 ?', '36'],
    ['Combien vaut 7 x 8 moins 6 ?', '50']
  ],
  Science: [
    ['Quel organite produit le plus d energie dans la cellule ?', 'Mitochondrie'],
    ['Un pH inferieur a 7 indique quel type de solution ?', 'Acide'],
    ['Quel gaz est majoritaire dans l atmosphere terrestre ?', 'Azote'],
    ['Quel type d onde transporte la lumiere ?', 'Electromagnetique'],
    ['Quel scientifique est associe aux lois du mouvement ?', 'Newton']
  ],
  History: [
    ['En quelle annee la chute du mur de Berlin a-t-elle eu lieu ?', '1989'],
    ['Quel empire avait Constantinople pour capitale ?', 'Byzantin'],
    ['Quel traite met fin a la Premiere Guerre mondiale ?', 'Versailles'],
    ['Quel navigateur est associe au tour du monde de 1519 ?', 'Magellan'],
    ['Quelle revolution commence en France en 1789 ?', 'Revolution francaise']
  ],
  Geography: [
    ['Quel fleuve traverse l Egypte ?', 'Nil'],
    ['Quelle chaine de montagnes separe la France et l Espagne ?', 'Pyrenees'],
    ['Quel desert couvre une grande partie de l Afrique du Nord ?', 'Sahara'],
    ['Quelle capitale est traversee par le Danube ?', 'Budapest'],
    ['Quel pays a Jakarta pour capitale ?', 'Indonesie']
  ],
  Economics: [
    ['Quel indicateur mesure la hausse generale des prix ?', 'Inflation'],
    ['Quel marche vend des actions d entreprises ?', 'Bourse'],
    ['Quel terme decrit une baisse durable de l activite economique ?', 'Recession'],
    ['Quel acteur fixe souvent les taux directeurs ?', 'Banque centrale'],
    ['Quel ratio compare dette et richesse produite ?', 'Dette PIB']
  ],
  Business: [
    ['Quel indicateur mesure le revenu avant couts principaux ?', 'Marge brute'],
    ['Quel document resume le modele economique d une entreprise ?', 'Business plan'],
    ['Quel cout ne varie pas directement avec le volume produit ?', 'Cout fixe'],
    ['Quel terme designe la perte de clients sur une periode ?', 'Churn'],
    ['Quel indicateur suit le cout d acquisition client ?', 'CAC']
  ],
  Startups: [
    ['Quel produit minimal teste une idee rapidement ?', 'MVP'],
    ['Quel terme designe l adequation produit marche ?', 'Product-market fit'],
    ['Quelle mesure suit le revenu mensuel recurrent ?', 'MRR'],
    ['Quel financement echange capital contre parts ?', 'Equity'],
    ['Quel changement majeur de strategie s appelle un pivot ?', 'Pivot']
  ],
  Engineering: [
    ['Quelle grandeur mesure une force par surface ?', 'Pression'],
    ['Quel diagramme represente les forces sur un objet ?', 'Diagramme de corps libre'],
    ['Quelle unite mesure la resistance electrique ?', 'Ohm'],
    ['Quel materiau resiste bien a la traction dans le beton arme ?', 'Acier'],
    ['Quel rendement compare energie utile et energie fournie ?', 'Efficacite']
  ],
  Culture: [
    ['Quel auteur a ecrit Les Miserables ?', 'Victor Hugo'],
    ['Quel mouvement artistique est associe a Monet ?', 'Impressionnisme'],
    ['Quel compositeur a ecrit La Flute enchantee ?', 'Mozart'],
    ['Dans quel pays est ne le tango ?', 'Argentine'],
    ['Quel musee parisien abrite La Joconde ?', 'Louvre']
  ],
  Cinema: [
    ['Quel realisateur est associe au film Inception ?', 'Christopher Nolan'],
    ['Quel plan montre un personnage de tres pres ?', 'Gros plan'],
    ['Quelle recompense majeure est decernee a Cannes ?', 'Palme d Or'],
    ['Quel genre melange enquete et ambiance sombre ?', 'Film noir'],
    ['Quel metier coordonne le montage final du film ?', 'Monteur']
  ],
  Sports: [
    ['Combien de joueurs une equipe de basket aligne-t-elle sur le terrain ?', '5'],
    ['Quel tournoi de tennis se joue sur gazon a Londres ?', 'Wimbledon'],
    ['Dans quel sport utilise-t-on un scrum ?', 'Rugby'],
    ['Quel pays a remporte la Coupe du monde de football 2018 ?', 'France'],
    ['Quelle distance officielle fait un marathon ?', '42,195 km']
  ],
  'Mixed Challenges': [
    ['Quel protocole chiffre le plus souvent une connexion web HTTPS ?', 'TLS'],
    ['Quelle notation decrit une complexite lineaire ?', 'O(n)'],
    ['Quel pays abrite le site historique du Machu Picchu ?', 'Perou'],
    ['Combien vaut 15 pour cent de 240 ?', '36'],
    ['Quel organite produit le plus d energie dans la cellule ?', 'Mitochondrie']
  ],
  Mixed: [
    ['Quel protocole chiffre le plus souvent une connexion web HTTPS ?', 'TLS'],
    ['Quelle notation decrit une complexite lineaire ?', 'O(n)'],
    ['Quel pays abrite le site historique du Machu Picchu ?', 'Perou'],
    ['Combien vaut 15 pour cent de 240 ?', '36'],
    ['Quel organite produit le plus d energie dans la cellule ?', 'Mitochondrie']
  ]
};

const createScoreSeries = (base, spread, count) =>
  Array.from({ length: count }, (_, index) => base - (index * spread) - ((index % 2) * 3));

function buildMockRankings(teamCount = 6) {
  const source = DEV_TEAM_POOL.slice(0, teamCount);
  const scoreSeries = createScoreSeries(126, 8, source.length);

  return source.map((team, index) => ({
    id: team.id,
    name: team.name,
    tag: team.tag || '',
    color: team.color || '#17e9ff',
    avatar: team.avatar || createAvatarDataUri(team.tag || team.name.slice(0, 3), team.color || '#17e9ff'),
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

function createAvatarDataUri(tag, color) {
  const safeTag = String(tag || 'TM').slice(0, 3).toUpperCase();
  const safeColor = String(color || '#17e9ff');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="18" fill="${safeColor}"/><rect x="10" y="10" width="76" height="76" rx="14" fill="rgba(255,255,255,0.12)"/><text x="48" y="57" text-anchor="middle" font-family="Arial" font-size="28" font-weight="800" fill="white">${safeTag}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function buildPhase1TestQuestions(source = FALLBACK_PHASE1_QUESTIONS) {
  return source.slice(0, PHASE1_QUESTIONS_PER_ROUND).map((question, index) => ({
    id: question.id || `phase1-test-q-${index + 1}`,
    text: question.text || question.question,
    category: question.category || 'Qualification',
    points: Number(question.points || 10),
    type: 'Buzzer',
    options: [],
    choices: [],
    correctAnswer: question.correctAnswer || question.answer || '',
    answer: question.answer || question.correctAnswer || '',
    difficulty: question.difficulty || (index < 3 ? 'Medium' : 'Hard'),
    timeLimit: Number(question.timeLimit || 20)
  }));
}

function buildPhase1SimulationQuestions(roundNumber, category) {
  const bank = PHASE1_FAST_QUESTION_BANK[category] || PHASE1_FAST_QUESTION_BANK['Mixed Challenges'];
  const source = bank.map(([text, correctAnswer], index) => ({
    text,
    correctAnswer,
    category,
    type: 'short_answer',
    difficulty: index < 3 ? 'Medium' : 'Hard'
  }));

  return buildPhase1TestQuestions(source).map((question, index) => ({
    ...question,
    id: `phase1-sim-r${roundNumber}-q${index + 1}`,
    category,
    roundNumber
  }));
}

function pickPhase1Category(roundNumber = 1) {
  const seed = `${Date.now()}-${roundNumber}-${Math.random()}`;
  const score = seed.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return PHASE1_CATEGORIES[score % PHASE1_CATEGORIES.length];
}

function pickPhase1CategoryChoices(excludeCategory = null) {
  const pool = PHASE1_CATEGORIES.filter(category => category !== excludeCategory);
  const shuffled = pool
    .map(category => ({ category, score: Math.random() }))
    .sort((a, b) => a.score - b.score)
    .map(entry => entry.category);

  return shuffled.slice(0, 3);
}

function extractJsonArray(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

async function generateQuestionsWithLocalAI(roundNumber = 1, category = 'Mixed', force = false) {
  const generated = await generateRoundQuestions({ prisma, roundNumber, category, force });
  return {
    ...generated,
    questions: buildPhase1TestQuestions(generated.questions)
  };
}

async function storeGeneratedQuestions(questions) {
  const stored = [];

  for (const question of questions) {
    try {
      const created = await Promise.race([
        prisma.question.create({
        data: {
          text: question.text,
          category: question.category,
          points: question.points,
          type: question.type,
          options: question.options || undefined,
          correctAnswer: question.correctAnswer
        }
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Question persistence timeout')), 700))
      ]);
      stored.push(created);
    } catch (error) {
      console.warn('Generated question persistence unavailable:', error.message);
      return questions;
    }
  }

  return stored;
}

function ensurePhase1TestingAllowed() {
  if (!DEVELOPMENT_MODE) {
    throw new Error('Mode développement requis');
  }

  if (['phase2', 'phase2_complete', 'phase3'].includes(tournamentState.phase)) {
    throw new Error('Floor 1 testing is locked after Floor 2 starts');
  }
}

function applyPhase1Rankings(rankings, action, extra = {}) {
  const ranked = rankings
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .map((team, index) => ({ ...team, rank: index + 1 }));
  const qualified = ranked.slice(0, 4).map(team => ({ ...team, status: 'qualified' }));
  const eliminated = ranked.slice(4).map(team => ({ ...team, status: 'eliminated' }));

  tournamentState.phase1 = {
    ...tournamentState.phase1,
    rankings: ranked,
    qualified,
    eliminated,
    test: {
      ...(tournamentState.phase1.test || {}),
      lastAction: action,
      updatedAt: new Date().toISOString(),
      ...extra
    }
  };

  applyDevelopmentSnapshot(action, ranked, qualified, eliminated, {
    source: action,
    phase: 'phase1',
    ...extra
  });

  return { rankings: ranked, qualified, eliminated };
}

function syncActiveTeamsFromRankings(rankings) {
  rankings.forEach(team => {
    activeTeams[String(team.id)] = {
      ...(activeTeams[String(team.id)] || {}),
      id: String(team.id),
      name: team.name,
      score: team.score || 0,
      tag: team.tag || '',
      color: team.color || '#17e9ff',
      avatar: team.avatar || '',
      socketId: activeTeams[String(team.id)]?.socketId || null
    };
  });
}

function emitPhase1Scoreboard() {
  const sortedTeams = Object.values(activeTeams)
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  io.to('moderator-session').emit('score:refresh', { teams: sortedTeams });
  io.to('public-room').emit('score:refresh', { teams: sortedTeams });
}

function normalizePhase1Category(category) {
  return PHASE1_CATEGORIES.includes(category) ? category : 'Mixed Challenges';
}

async function generatePhase1TestQuestions({ startImmediately = false, category = null, fast = true } = {}) {
  ensurePhase1TestingAllowed();

  const nextRoundNumber = Math.min((tournamentState.phase1.test?.roundNumber || 0) + 1, PHASE1_ROUND_COUNT);
  const selectedCategory = tournamentState.phase1.test?.selectedNextCategory;
  if (tournamentState.phase1.test?.pendingCategoryChoice && !selectedCategory) {
    throw new Error('Le gagnant du round doit choisir la prochaine categorie.');
  }
  const roundCategory = normalizePhase1Category(
    tournamentState.phase1.test?.pendingCategoryChoice
      ? selectedCategory
      : category || selectedCategory || tournamentState.phase1.test?.roundCategory || 'Mixed'
  );
  const generated = fast
    ? {
        questions: buildPhase1SimulationQuestions(nextRoundNumber, roundCategory),
        source: 'local_french_fast',
        roundNumber: nextRoundNumber
      }
    : await generateQuestionsWithLocalAI(nextRoundNumber, roundCategory);
  const questions = generated.source === 'cache' || generated.source.startsWith('fallback_') || generated.source === 'local_french_fast'
    ? generated.questions
    : await storeGeneratedQuestions(generated.questions);
  tournamentState.phase = 'phase1';
  tournamentState.phase1 = {
    ...tournamentState.phase1,
    test: {
      ...(tournamentState.phase1.test || {}),
      generatedQuestions: questions,
      generatedQuestionSource: generated.source,
      roundCategory,
      selectedNextCategory: null,
      nextCategoryChoices: [],
      pendingCategoryChoice: false,
      totalRounds: PHASE1_ROUND_COUNT,
      questionsPerRound: PHASE1_QUESTIONS_PER_ROUND,
      preloadedRoundNumber: nextRoundNumber + 1,
      currentQuestionIndex: startImmediately ? 0 : -1,
      status: startImmediately ? 'live' : 'ready',
      lastAction: 'generate_test_questions',
      updatedAt: new Date().toISOString()
    }
  };
  tournamentState.development.lastAction = 'generate_test_questions';
  tournamentState.development.isSkipped = true;
  tournamentState.development.mockTournamentState = {
    phase: 'phase1',
    source: generated.source,
    generatedQuestions: questions
  };

  await persistTournamentDevelopmentState();

  if (startImmediately && questions[0]) {
    broadcastPhase1Question(questions[0]);
  }

  const preloadCategory = pickPhase1Category(nextRoundNumber + 1);
  generateQuestionsWithLocalAI(nextRoundNumber + 1, preloadCategory, true)
    .then((preloaded) => {
      tournamentState.phase1.test = {
        ...(tournamentState.phase1.test || {}),
        preloadedRoundNumber: preloaded.roundNumber,
        preloadedQuestionSource: preloaded.source,
        updatedAt: new Date().toISOString()
      };
      broadcastTournamentState('phase1:test_state_updated');
    })
    .catch((error) => {
      console.warn('Phase 1 next-round preload unavailable:', error.message);
    });

  return {
    questions,
    source: generated.source,
    category: roundCategory,
    roundNumber: nextRoundNumber,
    startImmediately,
    snapshot: getTournamentSnapshot()
  };
}

function announcePhase1({ category = 'Mixed' } = {}) {
  ensurePhase1TestingAllowed();
  const roundCategory = normalizePhase1Category(category);
  tournamentState.phase = 'phase1';
  tournamentState.phase1 = {
    ...(tournamentState.phase1 || {}),
    test: {
      ...(tournamentState.phase1.test || {}),
      roundCategory,
      selectedNextCategory: roundCategory,
      status: 'announced',
      totalRounds: PHASE1_ROUND_COUNT,
      questionsPerRound: PHASE1_QUESTIONS_PER_ROUND,
      lastAction: 'phase1_announced',
      updatedAt: new Date().toISOString()
    }
  };
  const snapshot = getTournamentSnapshot();
  io.emit('phase1:announced', snapshot);
  broadcastTournamentState('phase1:test_state_updated');
  return snapshot;
}

function generatePhase1MockTeams() {
  ensurePhase1TestingAllowed();

  const scores = [42, 38, 33, 29, 24, 18, 12, 8];
  const rankings = DEV_TEAM_POOL.map((team, index) => ({
    id: `phase1-test-${team.id}`,
    name: team.name,
    tag: team.tag,
    color: team.color,
    avatar: createAvatarDataUri(team.tag, team.color),
    score: scores[index] || Math.max(0, 42 - index * 5),
    streak: Math.max(0, 4 - index),
    penalties: 0,
    answerHistory: []
  }));

  syncActiveTeamsFromRankings(rankings);
  const result = applyPhase1Rankings(rankings, 'phase1_generate_mock_teams', {
    mockTeams: rankings
  });
  emitPhase1Scoreboard();
  return { ...result, snapshot: getTournamentSnapshot() };
}

function broadcastPhase1Question(question) {
  const payload = {
    id: question.id,
    text: question.text,
    question: question.text,
    category: question.category || 'Qualification',
    points: question.points || 10,
    type: 'Buzzer',
    options: [],
    choices: [],
    difficulty: question.difficulty || 'Easy',
    timeLimit: question.timeLimit || 20
  };

  tournamentState.phase1.test = {
    ...(tournamentState.phase1.test || {}),
    currentQuestion: payload,
    status: 'live',
    updatedAt: new Date().toISOString()
  };

  io.to('session-1').emit('game:new_question', payload);
  io.to('public-room').emit('game:new_question', payload);
  io.to('jury-room').emit('game:new_question', payload);
  io.to('moderator-session').emit('phase1:test_question_started', {
    question: {
      ...payload,
      correctAnswer: question.correctAnswer || question.answer || '',
      answer: question.answer || question.correctAnswer || ''
    },
    category: payload.category,
    snapshot: getTournamentSnapshot()
  });
}

function advancePhase1Question() {
  ensurePhase1TestingAllowed();
  const test = tournamentState.phase1.test || {};
  const questions = test.generatedQuestions || [];
  if (questions.length === 0) {
    throw new Error('Generate Questions before advancing.');
  }

  const nextIndex = (test.currentQuestionIndex ?? -1) + 1;
  if (nextIndex >= questions.length) {
    clearPhase1Question('round_finished');
    tournamentState.phase1.test = {
      ...test,
      currentQuestionIndex: questions.length - 1,
      status: 'round_finished',
      updatedAt: new Date().toISOString()
    };
    return { finishedRound: true, snapshot: getTournamentSnapshot() };
  }

  tournamentState.phase1.test = {
    ...test,
    currentQuestionIndex: nextIndex,
    status: 'live',
    updatedAt: new Date().toISOString()
  };
  broadcastPhase1Question(questions[nextIndex]);
  return { question: questions[nextIndex], snapshot: getTournamentSnapshot() };
}

function clearPhase1Question(status = 'idle') {
  tournamentState.phase1.test = {
    ...(tournamentState.phase1.test || {}),
    currentQuestion: null,
    status,
    updatedAt: new Date().toISOString()
  };

  io.emit('game:clear_question', { phase: 'phase1', status });
  broadcastTournamentState('phase1:test_state_updated');
}

function scorePhase1Round({ finish = false } = {}) {
  ensurePhase1TestingAllowed();

  const teams = Object.values(activeTeams);
  if (teams.length === 0) {
    generatePhase1MockTeams();
  }

  const question = tournamentState.phase1.test?.currentQuestion
    || tournamentState.phase1.test?.generatedQuestions?.[tournamentState.phase1.test?.currentQuestionIndex || 0]
    || FALLBACK_PHASE1_QUESTIONS[0];

  Object.values(activeTeams).forEach((team, index) => {
    const answeredCorrectly = index < 4 || Math.random() > 0.42;
    const gained = answeredCorrectly ? (question.points || 10) : 0;
    team.score = (team.score || 0) + gained;
    team.streak = answeredCorrectly ? (team.streak || 0) + 1 : 0;
    team.answerHistory = [
      ...(team.answerHistory || []),
      {
        round: tournamentState.phase1.test?.roundNumber || 1,
        result: answeredCorrectly ? 'correct' : 'wrong',
        points: gained
      }
    ].slice(-10);
  });

  const rankings = Object.values(activeTeams).map(team => ({
    id: String(team.id),
    name: team.name,
    tag: team.tag || '',
    color: team.color || '#17e9ff',
    avatar: team.avatar || '',
    score: team.score || 0,
    streak: team.streak || 0,
    penalties: 0,
    answerHistory: team.answerHistory || []
  }));

  const result = applyPhase1Rankings(rankings, finish ? 'phase1_finish_round' : 'phase1_auto_answer', {
    roundNumber: tournamentState.phase1.test?.roundNumber || 1
  });
  emitPhase1Scoreboard();
  broadcastTournamentState('phase1:test_state_updated');
  return result;
}

function preparePhase1NextCategoryChoice(roundResult) {
  ensurePhase1TestingAllowed();

  const test = tournamentState.phase1.test || {};
  const roundNumber = test.roundNumber || 1;
  if (roundNumber >= PHASE1_ROUND_COUNT) {
    return null;
  }

  const roundWinner = roundResult?.rankings?.[0] || tournamentState.phase1.rankings?.[0] || null;
  const choices = pickPhase1CategoryChoices(test.roundCategory);

  tournamentState.phase1.test = {
    ...test,
    currentQuestion: null,
    roundWinner,
    nextCategoryChoices: choices,
    pendingCategoryChoice: true,
    selectedNextCategory: null,
    status: 'category_choice',
    lastAction: 'phase1_category_choice',
    updatedAt: new Date().toISOString()
  };

  const payload = {
    roundWinner,
    choices,
    roundNumber,
    nextRoundNumber: Math.min(roundNumber + 1, PHASE1_ROUND_COUNT),
    snapshot: getTournamentSnapshot()
  };

  io.emit('phase1:category_choices', payload);
  broadcastTournamentState('phase1:test_state_updated');
  return payload;
}

function choosePhase1NextCategory({ category, teamId } = {}) {
  ensurePhase1TestingAllowed();

  const test = tournamentState.phase1.test || {};
  const choices = test.nextCategoryChoices || [];
  if (!test.pendingCategoryChoice || choices.length === 0) {
    throw new Error('Aucune categorie en attente.');
  }

  if (!choices.includes(category)) {
    throw new Error('Categorie non disponible.');
  }

  const requesterId = String(teamId || 'moderator');
  const winnerId = String(test.roundWinner?.id || '');
  if (requesterId !== 'moderator' && winnerId && requesterId !== winnerId) {
    throw new Error("Seul le gagnant du round peut choisir la categorie.");
  }

  tournamentState.phase1.test = {
    ...test,
    selectedNextCategory: category,
    pendingCategoryChoice: false,
    status: 'category_chosen',
    lastAction: 'phase1_category_chosen',
    updatedAt: new Date().toISOString()
  };

  const payload = {
    category,
    teamId: requesterId,
    nextRoundNumber: Math.min((test.roundNumber || 0) + 1, PHASE1_ROUND_COUNT),
    snapshot: getTournamentSnapshot()
  };

  io.emit('phase1:category_chosen', payload);
  broadcastTournamentState('phase1:test_state_updated');
  return payload;
}

async function finishPhase1ForTesting({ revealOnly = false } = {}) {
  ensurePhase1TestingAllowed();

  if (Object.keys(activeTeams).length === 0) {
    generatePhase1MockTeams();
  }

  const rankings = await getRankingsFromTeams();
  const result = applyPhase1Rankings(rankings, revealOnly ? 'phase1_jump_qualification_reveal' : 'phase1_finish_for_testing', {
    revealOnly,
    status: 'qualification_reveal'
  });

  tournamentState.phase = 'phase1_complete';
  tournamentState.phase1 = {
    ...tournamentState.phase1,
    rankings: result.rankings,
    qualified: result.qualified,
    eliminated: result.eliminated
  };
  resetPhase2State();
  resetPhase3State();
  tournamentState.phase2.qualifiedTeams = result.qualified;
  tournamentState.phase2.eliminatedTeams = result.eliminated;

  await persistPhaseResults(1, result.rankings, result.qualified, result.eliminated);
  await persistTournamentDevelopmentState();
  broadcastTournamentState('tournament:phase1_complete');
  return getTournamentSnapshot();
}

async function restartPhase1ForTesting() {
  ensurePhase1TestingAllowed();

  Object.keys(activeTeams).forEach(teamId => {
    if (teamId.startsWith('phase1-test-')) {
      delete activeTeams[teamId];
    } else {
      activeTeams[teamId] = { ...activeTeams[teamId], score: 0, streak: 0, answerHistory: [] };
    }
  });

  tournamentState.phase = 'phase1';
  tournamentState.phase1 = {
    rankings: [],
    qualified: [],
    eliminated: [],
    test: {
      generatedQuestions: [],
      currentQuestion: null,
      currentQuestionIndex: -1,
      roundNumber: 0,
      status: 'idle',
      lastAction: 'phase1_restart',
      updatedAt: new Date().toISOString()
    }
  };
  tournamentState.development.lastAction = 'phase1_restart';
  tournamentState.development.isSkipped = false;
  tournamentState.development.simulatedResults = null;
  tournamentState.development.generatedRankings = [];
  tournamentState.development.mockTournamentState = null;

  emitPhase1Scoreboard();
  clearPhase1Question('idle');
  await persistTournamentDevelopmentState();
  return getTournamentSnapshot();
}

async function simulatePhase1TournamentForTesting(speed = '5x') {
  ensurePhase1TestingAllowed();

  if (Object.keys(activeTeams).length === 0) {
    generatePhase1MockTeams();
  }

  const delayMs = PHASE1_TEST_SPEEDS[speed] ?? PHASE1_TEST_SPEEDS['5x'];
  tournamentState.phase = 'phase1';
  tournamentState.phase1.test = {
    ...(tournamentState.phase1.test || {}),
    speed,
    status: 'simulating',
    lastAction: 'phase1_simulate_tournament',
    updatedAt: new Date().toISOString()
  };

  for (let round = 1; round <= PHASE1_ROUND_COUNT; round += 1) {
    const selectedCategory = tournamentState.phase1.test?.selectedNextCategory;
    const category = PHASE1_CATEGORIES.includes(selectedCategory)
      ? selectedCategory
      : pickPhase1Category(round);
    const questions = buildPhase1SimulationQuestions(round, category);
    tournamentState.phase1.test = {
      ...(tournamentState.phase1.test || {}),
      generatedQuestions: questions,
      generatedQuestionSource: 'simulation_local_french',
      roundCategory: category,
      selectedNextCategory: null,
      nextCategoryChoices: [],
      pendingCategoryChoice: false,
      totalRounds: PHASE1_ROUND_COUNT,
      questionsPerRound: PHASE1_QUESTIONS_PER_ROUND,
      roundNumber: round,
      currentQuestionIndex: -1,
      status: 'simulating',
      updatedAt: new Date().toISOString()
    };
    let lastRoundResult = null;

    for (let index = 0; index < questions.length; index += 1) {
      tournamentState.phase1.test.currentQuestionIndex = index;
      broadcastPhase1Question(questions[index]);
      lastRoundResult = scorePhase1Round();

      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    const choicePayload = preparePhase1NextCategoryChoice(lastRoundResult);
    if (choicePayload?.choices?.[0]) {
      choosePhase1NextCategory({ category: choicePayload.choices[0], teamId: 'moderator' });
      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, Math.min(delayMs, 650)));
      }
    }
  }

  clearPhase1Question('qualification_reveal');
  return finishPhase1ForTesting({ revealOnly: false });
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
    const tournament = await dbTimeout(prisma.tournament.create({
      data: {
        name: `Crazy Challenge ${new Date().toISOString()}`,
        status: tournamentState.phase,
        developmentMode: DEVELOPMENT_MODE
      }
    }), 'Tournament create');
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
    await dbTimeout(prisma.tournament.update({
      where: { id: tournamentId },
      data: {
        status: tournamentState.phase,
        developmentMode: tournamentState.development.enabled,
        isSkipped: tournamentState.development.isSkipped,
        simulatedResults: tournamentState.development.simulatedResults,
        generatedRankings: tournamentState.development.generatedRankings,
        mockTournamentState: tournamentState.development.mockTournamentState
      }
    }), 'Tournament update');
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
        score: team.score || 0,
        tag: team.tag || '',
        color: team.color || '#17e9ff',
        avatar: team.avatar || ''
      });
    });
  } catch (error) {
    console.warn('Team database ranking unavailable:', error.message);
  }

  Object.values(activeTeams).forEach(team => {
    byId.set(String(team.id), {
      id: String(team.id),
      name: team.name || `Équipe ${team.id}`,
      score: team.score || 0,
      tag: team.tag || '',
      color: team.color || '#17e9ff',
      avatar: team.avatar || ''
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
      tag: team.tag || '',
      color: team.color || '#17e9ff',
      avatar: team.avatar || '',
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

socket.on('join', ({ room, role, teamId, teamName, tag, color, avatar }) => {
    socket.join(room);
    console.log(`${socket.id} -> ${room} (${role})`);

    if (role === 'team' && teamId) {
      activeTeams[teamId] = {
        id: teamId,
        name: teamName || `Équipe ${teamId}`,
        tag: tag || '',
        color: color || '#17e9ff',
        avatar: avatar || '',
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
      options: data.options || data.choices || [],
      choices: data.choices || data.options || [],
      difficulty: data.difficulty || 'Easy',
      timeLimit: data.timer || data.timeLimit || 30
    });
  io.to('public-room').emit('game:new_question', {
    id: data.id,
    text: data.text || data.question,
    category: data.category || 'Général',
    points: data.points || 10,
    type: data.type || 'multiple_choice',
    options: data.options || data.choices || [],
    choices: data.choices || data.options || [],
    difficulty: data.difficulty || 'Easy',
    timeLimit: data.timer || data.timeLimit || 30
  });
  io.to('jury-room').emit('game:new_question', {
    id: data.id,
    text: data.text || data.question,
    category: data.category || 'Général',
    points: data.points || 10,
    type: data.type || 'multiple_choice',
    options: data.options || data.choices || [],
    choices: data.choices || data.options || [],
    difficulty: data.difficulty || 'Easy',
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

  socket.on('phase1:announce', (payload = {}) => {
    try {
      const result = announcePhase1(payload);
      socket.emit('phase1:announced_ack', result);
    } catch (error) {
      console.error('Erreur annonce Phase 1:', error);
      socket.emit('phase:error', { error: error.message || 'Erreur annonce Phase 1' });
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

  socket.on('phase1:test_generate_questions', async (payload = {}) => {
    try {
      const result = await generatePhase1TestQuestions({
        startImmediately: Boolean(payload.startImmediately),
        category: payload.category,
        fast: payload.fast !== false
      });
      io.emit('phase1:test_questions_generated', result);
      broadcastTournamentState('phase1:test_state_updated');
    } catch (error) {
      console.error('Erreur generation questions Phase 1:', error);
      socket.emit('phase:error', { error: error.message || 'Erreur generation questions Phase 1' });
    }
  });

  socket.on('phase1:test_generate_mock_teams', async () => {
    try {
      const result = generatePhase1MockTeams();
      await persistTournamentDevelopmentState();
      io.emit('phase1:test_state_updated', result.snapshot);
    } catch (error) {
      console.error('Erreur mock teams Phase 1:', error);
      socket.emit('phase:error', { error: error.message || 'Erreur mock teams Phase 1' });
    }
  });

  socket.on('phase1:test_auto_answer', async () => {
    try {
      scorePhase1Round();
      await persistTournamentDevelopmentState();
    } catch (error) {
      console.error('Erreur auto answer Phase 1:', error);
      socket.emit('phase:error', { error: error.message || 'Erreur auto answer Phase 1' });
    }
  });

  socket.on('phase1:test_skip_question', () => {
    try {
      const result = advancePhase1Question();
      io.emit('phase1:test_state_updated', result.snapshot);
    } catch (error) {
      console.error('Erreur skip question Phase 1:', error);
      socket.emit('phase:error', { error: error.message || 'Erreur skip question Phase 1' });
    }
  });

  socket.on('phase1:test_skip_round', () => {
    try {
      ensurePhase1TestingAllowed();
      tournamentState.phase1.test = {
        ...(tournamentState.phase1.test || {}),
        roundNumber: Math.min((tournamentState.phase1.test?.roundNumber || 0) + 1, PHASE1_ROUND_COUNT),
        lastAction: 'phase1_skip_round'
      };
      clearPhase1Question('round_skipped');
    } catch (error) {
      console.error('Erreur skip round Phase 1:', error);
      socket.emit('phase:error', { error: error.message || 'Erreur skip round Phase 1' });
    }
  });

  socket.on('phase1:test_finish_round', async () => {
    try {
      const result = scorePhase1Round({ finish: true });
      clearPhase1Question('round_finished');
      preparePhase1NextCategoryChoice(result);
      await persistTournamentDevelopmentState();
    } catch (error) {
      console.error('Erreur finish round Phase 1:', error);
      socket.emit('phase:error', { error: error.message || 'Erreur finish round Phase 1' });
    }
  });

  socket.on('phase1:choose_category', async (payload = {}) => {
    try {
      const result = choosePhase1NextCategory(payload);
      await persistTournamentDevelopmentState();
      socket.emit('phase1:category_chosen_ack', result);
    } catch (error) {
      console.error('Erreur choix categorie Phase 1:', error);
      socket.emit('phase:error', { error: error.message || 'Erreur choix categorie Phase 1' });
    }
  });

  socket.on('phase1:test_finish_phase', async () => {
    try {
      const result = await finishPhase1ForTesting({ revealOnly: false });
      io.emit('tournament:phase1_complete', {
        ...getTournamentSnapshot(),
        result
      });
    } catch (error) {
      console.error('Erreur finish Phase 1 test:', error);
      socket.emit('phase:error', { error: error.message || 'Erreur finish Phase 1 test' });
    }
  });

  socket.on('phase1:test_jump_qualification', async () => {
    try {
      await finishPhase1ForTesting({ revealOnly: true });
    } catch (error) {
      console.error('Erreur qualification reveal Phase 1:', error);
      socket.emit('phase:error', { error: error.message || 'Erreur qualification reveal Phase 1' });
    }
  });

  socket.on('phase1:test_restart', async () => {
    try {
      const result = await restartPhase1ForTesting();
      io.emit('phase1:test_reset', result);
    } catch (error) {
      console.error('Erreur restart Phase 1:', error);
      socket.emit('phase:error', { error: error.message || 'Erreur restart Phase 1' });
    }
  });

  socket.on('phase1:test_simulate_tournament', async ({ speed } = {}) => {
    try {
      const result = await simulatePhase1TournamentForTesting(speed);
      io.emit('phase1:test_simulation_complete', result);
    } catch (error) {
      console.error('Erreur simulation Phase 1:', error);
      socket.emit('phase:error', { error: error.message || 'Erreur simulation Phase 1' });
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
          tag: team.tag || '',
          color: team.color || '#17e9ff',
          avatar: team.avatar || '',
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
          tag: activeTeams[id]?.tag || '',
          color: activeTeams[id]?.color || '#17e9ff',
          avatar: activeTeams[id]?.avatar || '',
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
        tag: activeTeams[id]?.tag || '',
        color: activeTeams[id]?.color || '#17e9ff',
        avatar: activeTeams[id]?.avatar || '',
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
