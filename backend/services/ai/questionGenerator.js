const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const OLLAMA_ENDPOINT = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434';
const ROUND_SIZE = 10;
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 120000);
const CACHE_TIMEOUT_MS = Number(process.env.QUESTION_CACHE_TIMEOUT_MS || 150);
const OLLAMA_PREFLIGHT_TIMEOUT_MS = Number(process.env.OLLAMA_PREFLIGHT_TIMEOUT_MS || 5000);
const CATEGORY_BANK_BATCH_SIZE = Number(process.env.OLLAMA_BANK_BATCH_SIZE || ROUND_SIZE);
const LOCAL_CACHE_PATH = path.join(__dirname, '..', '..', '.local-data', 'phase1-question-cache.json');
const LOCAL_CACHE_VERSION = 'bank-v1';

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
  'Mobile Development',
  'Machine Learning',
  'Cloud Computing',
  'Electronics',
  'General Knowledge',
  'Mixed Challenges'
]);

const FALLBACK_QUESTIONS = [
  { question: 'Quel protocole protege une session HTTPS moderne contre l ecoute passive ?', answer: 'TLS', category: 'Technology', difficulty: 'Medium' },
  { question: 'Quelle notation decrit un algorithme dont le temps grandit lineairement avec n ?', answer: 'O(n)', category: 'Programming', difficulty: 'Medium' },
  { question: 'Quelle propriete ACID garantit tout ou rien dans une transaction ?', answer: 'Atomicite', category: 'Databases', difficulty: 'Medium' },
  { question: 'Quel protocole traduit un nom de domaine en adresse IP ?', answer: 'DNS', category: 'Networking', difficulty: 'Medium' },
  { question: 'Quel indicateur mesure la hausse generale des prix ?', answer: 'Inflation', category: 'Economics', difficulty: 'Medium' },
  { question: 'Quel phenomene IA produit une reponse plausible mais fausse ?', answer: 'Hallucination', category: 'Artificial Intelligence', difficulty: 'Medium' },
  { question: 'Quel modele securite ne fait jamais confiance automatiquement au reseau interne ?', answer: 'Zero trust', category: 'Cybersecurity', difficulty: 'Hard' },
  { question: 'Quel pattern protege un service instable en coupant temporairement les appels ?', answer: 'Circuit breaker', category: 'Technology', difficulty: 'Hard' },
  { question: 'Quel protocole annonce des routes entre grands reseaux Internet ?', answer: 'BGP', category: 'Networking', difficulty: 'Hard' },
  { question: 'Quel indicateur SRE mesure le temps moyen de retablissement ?', answer: 'MTTR', category: 'Technology', difficulty: 'Hard' }
];

function buildChoices(answer, choices = [], index = 0) {
  const cleanAnswer = String(answer || '').trim();
  const fallbackPool = FALLBACK_QUESTIONS.map(question => question.answer);
  const pool = [...choices, ...fallbackPool]
    .map(choice => String(choice || '').trim())
    .filter(choice => choice && choice.toLowerCase() !== cleanAnswer.toLowerCase());
  const selected = [];
  const seen = new Set([cleanAnswer.toLowerCase()]);

  for (let offset = 0; offset < pool.length && selected.length < 3; offset += 1) {
    const choice = pool[(index + offset) % pool.length];
    const key = choice.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    selected.push(choice);
  }

  while (selected.length < 3) {
    selected.push(`Option ${selected.length + 1}`);
  }

  selected.splice(index % 4, 0, cleanAnswer);
  return selected.slice(0, 4);
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
          type: 'MCQ',
          choices: buildChoices(answer, [], 0),
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
  const type = 'MCQ';
  const answer = String(item.answer || item.correctAnswer || '').trim();
  const question = String(item.question || item.text || '').trim();
  const category = CATEGORIES.has(item.category) ? item.category : 'Mixed Challenges';
  const choices = buildChoices(answer, item.choices || item.options || [], index);

  if (!question || !answer) {
    throw new Error(`Question ${index + 1} is missing text or answer`);
  }

  return {
    question,
    type,
    choices,
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
  if (hardCount !== 4) {
    questions.forEach((question, index) => {
      question.difficulty = index >= 6 ? 'Hard' : 'Medium';
    });
  }

  return questions;
}

function buildPrompt(roundNumber, category = 'Mixed Challenges') {
  return [
    'Tu es un generateur JSON strict pour un quiz MCQ.',
    'Retourne uniquement un tableau JSON valide. Aucun markdown. Aucun texte avant ou apres.',
    `Cree exactement ${ROUND_SIZE} questions de competition en francais pour ISGA Summit Challenge, phase de qualification, round ${roundNumber}.`,
    'Ambiance: OPEN GROUND, accueillante, rapide, ludique.',
    `Categorie exacte a utiliser dans chaque objet: ${category}.`,
    'Contraintes obligatoires:',
    '- type doit etre exactement "MCQ"',
    '- choices doit contenir exactement 4 propositions courtes',
    '- choices doit contenir la bonne reponse',
    '- question et answer doivent etre en francais',
    '- answer doit etre courte: 1 a 4 mots',
    '- difficulty doit etre "Medium" pour 6 questions et "Hard" pour 4 questions',
    '- aucune question triviale: pas de capitale evidente, pas de calcul simple, pas de definition trop basique',
    '- chaque question doit demander raisonnement, connaissance appliquee ou discussion d equipe',
    '- timeLimit doit etre 20',
    '- points doit etre 10',
    '- pas de sujets controverses',
    'Schema exact:',
    '[{"question":"Question de niveau moyen ?","type":"MCQ","choices":["Reponse","Option A","Option B","Option C"],"answer":"Reponse","category":"' + category + '","difficulty":"Medium","timeLimit":20,"points":10}]'
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

async function fetchOllamaTags() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OLLAMA_PREFLIGHT_TIMEOUT_MS);

  try {
    const response = await fetch(`${OLLAMA_ENDPOINT}/api/tags`, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Ollama tags ${response.status}`);
    }
    const payload = await response.json();
    return (payload.models || []).map((entry) => entry.name || entry.model).filter(Boolean);
  } finally {
    clearTimeout(timeout);
  }
}

async function getOllamaStatus() {
  const model = OLLAMA_CONFIG.model;
  try {
    const ready = await checkOllamaReady();
    if (!ready) {
      return {
        ready: false,
        endpoint: OLLAMA_ENDPOINT,
        model,
        modelAvailable: false,
        models: [],
        error: 'Ollama endpoint unreachable'
      };
    }

    const models = await fetchOllamaTags();
    const modelAvailable = models.some((name) => {
      const normalized = String(name).toLowerCase();
      return normalized === model.toLowerCase() || normalized.startsWith('phi3');
    });

    return {
      ready: true,
      endpoint: OLLAMA_ENDPOINT,
      model,
      modelAvailable,
      models,
      error: modelAvailable ? null : `Model ${model} not found. Run: ollama pull phi3`
    };
  } catch (error) {
    return {
      ready: false,
      endpoint: OLLAMA_ENDPOINT,
      model,
      modelAvailable: false,
      models: [],
      error: error.message
    };
  }
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
  if (cached.some(question => !['Medium', 'Hard'].includes(question.difficulty))) return null;
  if (cached.filter(question => question.difficulty === 'Hard').length !== 4) return null;
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
    || rows.some(row => row.category !== category || !['Medium', 'Hard'].includes(row.payload?.difficulty))
    || rows.filter(row => row.payload?.difficulty === 'Hard').length !== 4
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

async function generateCategoryBankBatch({ prisma, category = 'Mixed Challenges', targetCount = 50 } = {}) {
  const normalizedCategory = CATEGORIES.has(category) ? category : 'Mixed Challenges';
  const targetBankSize = Math.max(20, Number(targetCount) || 50);
  const bank = [];
  const seen = new Set();
  let roundNumber = 1;
  let source = 'ollama_phi3';
  let ollamaCalls = 0;

  while (bank.length < targetBankSize && ollamaCalls < 12) {
    ollamaCalls += 1;
    try {
      const generated = await callOllama(roundNumber, normalizedCategory);
      for (const question of generated) {
        const key = question.question.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        bank.push(question);
      }
      roundNumber += 1;
    } catch (error) {
      console.warn(`Ollama category bank batch ${ollamaCalls} failed:`, error.message);
      if (bank.length === 0) {
        source = 'fallback_ollama_unavailable';
        const fallback = FALLBACK_QUESTIONS.map((question, index) => normalizeQuestion({
          ...question,
          category: normalizedCategory
        }, index));
        for (const question of fallback) {
          const key = question.question.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          bank.push(question);
        }
      }
      break;
    }
  }

  const questions = bank.slice(0, targetBankSize).map((question, index) => toAppQuestion(question, index, 1));
  if (questions.length > 0) {
    await withTimeout(
      saveRound(prisma, 99, normalizedCategory, bank.slice(0, targetBankSize), source),
      CACHE_TIMEOUT_MS,
      'category bank cache write'
    ).catch((error) => {
      console.warn('Category bank cache write unavailable:', error.message);
    });
  }

  return {
    questions,
    source,
    category: normalizedCategory,
    count: questions.length,
    ollamaCalls
  };
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

  const fallback = FALLBACK_QUESTIONS.map((question, index) => ({
    question: question.question,
    type: 'MCQ',
    choices: buildChoices(question.answer, [], index),
    answer: question.answer,
    category: CATEGORIES.has(category) ? category : question.category,
    difficulty: index >= 6 ? 'Hard' : 'Medium',
    timeLimit: 20,
    points: 10
  }));
  await withTimeout(saveRound(prisma, roundNumber, category, fallback, 'fallback_ollama_unavailable'), CACHE_TIMEOUT_MS, 'question cache write').catch(() => {});
  return {
    questions: fallback.map((question, index) => toAppQuestion(question, index, roundNumber)),
    source: 'fallback_ollama_unavailable',
    roundNumber
  };
}

module.exports = {
  OLLAMA_CONFIG,
  OLLAMA_ENDPOINT,
  checkOllamaReady,
  getOllamaStatus,
  generateRoundQuestions,
  generateCategoryBankBatch,
  validateQuestions
};
