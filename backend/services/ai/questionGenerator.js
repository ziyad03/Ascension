const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const OLLAMA_ENDPOINT = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434';
const ROUND_SIZE = 5;
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 120000);
const CACHE_TIMEOUT_MS = Number(process.env.QUESTION_CACHE_TIMEOUT_MS || 150);
const OLLAMA_PREFLIGHT_TIMEOUT_MS = Number(process.env.OLLAMA_PREFLIGHT_TIMEOUT_MS || 250);
const LOCAL_CACHE_PATH = path.join(__dirname, '..', '..', '.local-data', 'phase1-question-cache.json');
const LOCAL_CACHE_VERSION = 'medium-v2';

process.env.OLLAMA_MODELS = process.env.OLLAMA_MODELS || 'D:\\Ollama\\models';

const OLLAMA_CONFIG = {
  model: 'phi3:latest',
  temperature: 0.5,
  num_ctx: 1024,
  num_predict: 1200,
  stream: false
};

const CATEGORIES = new Set([
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
]);

const FALLBACK_QUESTIONS = [
  { question: 'Quel protocole chiffre le plus souvent une connexion web HTTPS ?', type: 'Buzzer', choices: [], answer: 'TLS', category: 'Technology', difficulty: 'Medium', timeLimit: 20, points: 10 },
  { question: 'Quelle notation decrit une complexite lineaire ?', type: 'Buzzer', choices: [], answer: 'O(n)', category: 'Programming', difficulty: 'Medium', timeLimit: 20, points: 10 },
  { question: 'Quel pays abrite le site historique du Machu Picchu ?', type: 'Buzzer', choices: [], answer: 'Perou', category: 'General Knowledge', difficulty: 'Medium', timeLimit: 20, points: 10 },
  { question: 'Combien vaut 15 pour cent de 240 ?', type: 'Buzzer', choices: [], answer: '36', category: 'Mathematics', difficulty: 'Hard', timeLimit: 20, points: 10 },
  { question: 'Quel organite produit le plus d energie dans la cellule ?', type: 'Buzzer', choices: [], answer: 'Mitochondrie', category: 'Science', difficulty: 'Hard', timeLimit: 20, points: 10 }
];

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

function extractLooseQuestions(text, category = 'Mixed') {
  const raw = String(text || '');
  const blocks = raw.match(/\{[\s\S]*?\}/g) || [];

  return blocks.map((block) => {
    const question = block.match(/"question"\s*:\s*"([^"]+)"/i)?.[1];
    const answer = block.match(/"answer"\s*:\s*"([^"]+)"/i)?.[1];
    const difficulty = block.match(/"difficulty"\s*:\s*"([^"]+)"/i)?.[1];
    return question && answer
      ? {
          question,
          type: 'Buzzer',
          choices: [],
          answer,
          category,
          difficulty: difficulty === 'Hard' ? 'Hard' : 'Medium',
          timeLimit: 20,
          points: 10
        }
      : null;
  }).filter(Boolean);
}

function normalizeQuestion(item, index) {
  const type = 'Buzzer';
  const answer = String(item.answer || item.correctAnswer || '').trim();
  const question = String(item.question || item.text || '').trim();
  const category = CATEGORIES.has(item.category) ? item.category : 'Mixed Challenges';

  if (!question || !answer) {
    throw new Error(`Question ${index + 1} is missing text or answer`);
  }

  return {
    question,
    type,
    choices: [],
    answer,
    category,
    difficulty: item.difficulty === 'Hard' ? 'Hard' : 'Medium',
    timeLimit: 20,
    points: 10
  };
}

function validateQuestions(payload) {
  if (!Array.isArray(payload) || payload.length !== ROUND_SIZE) {
    throw new Error(`Ollama must return exactly ${ROUND_SIZE} questions`);
  }

  const seen = new Set();
  const questions = payload.map((item, index) => {
    const question = normalizeQuestion(item, index);
    const key = question.question.toLowerCase();
    if (seen.has(key)) {
      throw new Error(`Duplicate question at ${index + 1}`);
    }
    seen.add(key);
    return question;
  });

  const hardCount = questions.filter(question => question.difficulty === 'Hard').length;
  if (hardCount !== 2) {
    questions.forEach((question, index) => {
      question.difficulty = index >= 3 ? 'Hard' : 'Medium';
    });
  }

  return questions;
}

function buildPrompt(roundNumber, category = 'Mixed Challenges') {
  return [
    'Tu es un generateur JSON strict pour un quiz buzzer.',
    'Retourne uniquement un tableau JSON valide. Aucun markdown. Aucun texte avant ou apres.',
    `Cree exactement ${ROUND_SIZE} questions de competition en francais pour Crazy Challenge Floor 1 - Phase de Qualification, round ${roundNumber}.`,
    'Ambiance: OPEN GROUND, accueillante, rapide, ludique.',
    `Categorie exacte a utiliser dans chaque objet: ${category}.`,
    'Contraintes obligatoires:',
    '- type doit etre exactement "Buzzer"',
    '- choices doit etre exactement []',
    '- question et answer doivent etre en francais',
    '- answer doit etre courte: 1 a 4 mots',
    '- difficulty doit etre "Medium" pour 3 questions et "Hard" pour 2 questions',
    '- aucune question triviale: pas de capitale evidente, pas de calcul simple, pas de definition trop basique',
    '- chaque question doit demander raisonnement, connaissance appliquee ou discussion d equipe',
    '- timeLimit doit etre 20',
    '- points doit etre 10',
    '- pas de QCM, pas de choix, pas de sujets controverses',
    'Schema exact:',
    '[{"question":"Question de niveau moyen ?","type":"Buzzer","choices":[],"answer":"Reponse","category":"' + category + '","difficulty":"Medium","timeLimit":20,"points":10}]'
  ].join('\n');
}

function checkOllamaReady() {
  return new Promise((resolve, reject) => {
    const url = new URL('/api/tags', OLLAMA_ENDPOINT);
    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(url, { method: 'GET', timeout: OLLAMA_PREFLIGHT_TIMEOUT_MS }, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 500);
    });

    req.on('timeout', () => {
      req.destroy(new Error('Ollama preflight timeout'));
    });
    req.on('error', reject);
    req.end();
  });
}

function toAppQuestion(question, index, roundNumber, sourceId = null) {
  return {
    id: sourceId || `phase1-r${roundNumber}-q${index + 1}`,
    text: question.question,
    question: question.question,
    category: question.category,
    points: question.points,
    type: question.type,
    options: question.choices,
    choices: question.choices,
    correctAnswer: question.answer,
    answer: question.answer,
    difficulty: question.difficulty,
    timeLimit: question.timeLimit,
    roundNumber
  };
}

function withTimeout(promise, ms, label) {
  let timeout;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error(`${label} timeout`)), ms);
    })
  ]).finally(() => clearTimeout(timeout));
}

function localCacheKey(roundNumber, category = 'Mixed Challenges') {
  return `${LOCAL_CACHE_VERSION}:${roundNumber}:${category}`;
}

function readLocalCache() {
  try {
    if (!fs.existsSync(LOCAL_CACHE_PATH)) return {};
    return JSON.parse(fs.readFileSync(LOCAL_CACHE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function writeLocalCache(cache) {
  fs.mkdirSync(path.dirname(LOCAL_CACHE_PATH), { recursive: true });
  fs.writeFileSync(LOCAL_CACHE_PATH, JSON.stringify(cache, null, 2));
}

function getCachedLocalRound(roundNumber, category) {
  const cache = readLocalCache();
  const cached = cache[localCacheKey(roundNumber, category)];
  if (!Array.isArray(cached) || cached.length !== ROUND_SIZE) return null;
  if (cached.some(question => question.difficulty !== 'Medium')) return null;
  return cached.map((question, index) => toAppQuestion(question, index, roundNumber));
}

function saveLocalRound(roundNumber, category, questions, source) {
  const cache = readLocalCache();
  cache[localCacheKey(roundNumber, category)] = questions.map(question => ({
    question: question.question,
    type: question.type,
    choices: question.choices,
    answer: question.answer,
    category: question.category || category,
    difficulty: question.difficulty,
    timeLimit: question.timeLimit,
    points: question.points,
    source,
    savedAt: new Date().toISOString()
  }));
  writeLocalCache(cache);
}

async function getCachedRound(prisma, roundNumber, category = 'Mixed Challenges') {
  const localCached = getCachedLocalRound(roundNumber, category);
  if (localCached) return localCached;
  if (!prisma?.roundQuestion) return null;

  const rows = await prisma.roundQuestion.findMany({
    where: { phaseNumber: 1, roundNumber },
    orderBy: { questionIndex: 'asc' }
  });

  if (
    rows.length !== ROUND_SIZE
    || rows.some(row => row.category !== category || row.payload?.difficulty !== 'Medium')
  ) return null;

  return rows.map(row => toAppQuestion(row.payload, row.questionIndex, roundNumber, row.id));
}

async function saveRound(prisma, roundNumber, category, questions, source) {
  saveLocalRound(roundNumber, category, questions, source);
  if (!prisma?.roundQuestion) return;

  await prisma.$transaction(async (tx) => {
    await tx.roundQuestion.deleteMany({ where: { phaseNumber: 1, roundNumber } });
    await Promise.all(questions.map((question, index) => tx.roundQuestion.create({
      data: {
        phaseNumber: 1,
        roundNumber,
        questionIndex: index,
        question: question.question,
        type: question.type,
        category: question.category,
        difficulty: question.difficulty,
        timeLimit: question.timeLimit,
        points: question.points,
        answer: question.answer,
        choices: question.choices,
        payload: question,
        source
      }
    })));
  });
}

async function callOllama(roundNumber, category) {
  const ready = await checkOllamaReady();
  if (!ready) {
    throw new Error('Ollama unavailable');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

  const response = await fetch(`${OLLAMA_ENDPOINT}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: controller.signal,
    body: JSON.stringify({
      model: OLLAMA_CONFIG.model,
      prompt: buildPrompt(roundNumber, category),
      stream: OLLAMA_CONFIG.stream,
      options: {
        temperature: OLLAMA_CONFIG.temperature,
        num_ctx: OLLAMA_CONFIG.num_ctx,
        num_predict: OLLAMA_CONFIG.num_predict
      }
    })
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    throw new Error(`Ollama ${response.status}`);
  }

  const payload = await response.json();
  const parsed = extractJsonArray(payload.response) || extractLooseQuestions(payload.response, category);
  return validateQuestions(parsed);
}

async function generateRoundQuestions({ prisma, roundNumber = 1, category = 'Mixed Challenges', force = false } = {}) {
  if (!force) {
    try {
      const cached = await withTimeout(getCachedRound(prisma, roundNumber, category), CACHE_TIMEOUT_MS, 'question cache read');
      if (cached) {
        return { questions: cached, source: 'cache', roundNumber };
      }
    } catch (error) {
      console.warn('Phase 1 question cache read unavailable:', error.message);
    }
  }

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const generated = await callOllama(roundNumber, category);
      await withTimeout(saveRound(prisma, roundNumber, category, generated, 'ollama_phi3'), CACHE_TIMEOUT_MS, 'question cache write').catch((error) => {
        console.warn('Phase 1 question cache write unavailable:', error.message);
      });
      return {
        questions: generated.map((question, index) => toAppQuestion(question, index, roundNumber)),
        source: 'ollama_phi3',
        roundNumber
      };
    } catch (error) {
      console.warn(`Ollama Phase 1 generation attempt ${attempt} failed:`, error.message);
      if (
        error.name === 'AbortError'
        || /timeout|fetch failed|ECONNREFUSED|Ollama \d+/i.test(error.message)
      ) {
        break;
      }
    }
  }

  const fallback = FALLBACK_QUESTIONS.map(question => ({ ...question, category }));
  await withTimeout(saveRound(prisma, roundNumber, category, fallback, 'fallback_ollama_unavailable'), CACHE_TIMEOUT_MS, 'question cache write').catch(() => {});
  return {
    questions: fallback.map((question, index) => toAppQuestion(question, index, roundNumber)),
    source: 'fallback_ollama_unavailable',
    roundNumber
  };
}

module.exports = {
  OLLAMA_CONFIG,
  generateRoundQuestions,
  validateQuestions
};
