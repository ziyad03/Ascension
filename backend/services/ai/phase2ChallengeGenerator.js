const {
  OLLAMA_CONFIG,
  OLLAMA_ENDPOINT,
  getOllamaStatus
} = require('./questionGenerator');
const { MODIFIER_LABELS } = require('../phase2Scoring');

const OLLAMA_TIMEOUT_MS = Number(process.env.PHASE2_OLLAMA_TIMEOUT_MS || 90000);
const OLLAMA_SINGLE_TIMEOUT_MS = Number(process.env.PHASE2_OLLAMA_SINGLE_TIMEOUT_MS || 45000);

const ROUND_TEST_SPECS = [
  {
    modifier: 'standard',
    label: 'Standard',
    category: 'Technology',
    difficulty: 'Medium',
    theme: 'question ouverte tech accessible mais pas triviale'
  },
  {
    modifier: 'double_points',
    label: 'Double Points',
    category: 'Cybersecurity',
    difficulty: 'Hard',
    theme: 'question difficile a fort enjeu, reponse technique precise'
  },
  {
    modifier: 'fastest_bonus',
    label: 'Fast Answer Bonus',
    category: 'Networking',
    difficulty: 'Medium',
    theme: 'question rapide a identifier pour tester la reaction'
  },
  {
    modifier: 'risk_round',
    label: 'Risk Round',
    category: 'Cloud Computing',
    difficulty: 'Medium',
    theme: 'question strategique ou architecture cloud avec reponse courte'
  },
  {
    modifier: 'sudden_question',
    label: 'Sudden Question',
    category: 'Databases',
    difficulty: 'Medium',
    theme: 'question concise sur les bases de donnees ou transactions'
  },
  {
    modifier: 'no_hint',
    label: 'No Hint Round',
    category: 'Programming',
    difficulty: 'Hard',
    theme: 'question algorithmique ou concept dev sans indice utile'
  },
  {
    modifier: 'mystery_challenge',
    label: 'Mystery Challenge',
    category: 'Artificial Intelligence',
    difficulty: 'Medium',
    theme: 'question IA ou ML avec reponse courte'
  }
];

const FALLBACK_BY_MODIFIER = {
  standard: {
    question: 'Quel protocole chiffre le plus souvent une session HTTPS moderne ?',
    answer: 'TLS',
    hint: 'Pense transport securise sur le web.',
    category: 'Technology',
    difficulty: 'Medium'
  },
  double_points: {
    question: 'Quel modele Zero Trust refuse la confiance implicite au reseau interne ?',
    answer: 'Zero trust',
    hint: 'Aucun acces automatique par zone.',
    category: 'Cybersecurity',
    difficulty: 'Hard'
  },
  fastest_bonus: {
    question: 'Quel protocole traduit un nom de domaine en adresse IP ?',
    answer: 'DNS',
    hint: 'Resolution de noms.',
    category: 'Networking',
    difficulty: 'Medium'
  },
  risk_round: {
    question: 'Quel service AWS stocke des objets dans des buckets ?',
    answer: 'S3',
    hint: 'Stockage objet cloud.',
    category: 'Cloud Computing',
    difficulty: 'Medium'
  },
  sudden_question: {
    question: 'Quelle propriete ACID garantit tout ou rien dans une transaction ?',
    answer: 'Atomicite',
    hint: 'Une seule lettre du mot ACID.',
    category: 'Databases',
    difficulty: 'Medium'
  },
  no_hint: {
    question: 'Quelle notation decrit une complexite lineaire en fonction de n ?',
    answer: 'O(n)',
    hint: 'Indice desactive pour ce round.',
    category: 'Programming',
    difficulty: 'Hard'
  },
  mystery_challenge: {
    question: 'Quel phenomene IA produit une reponse plausible mais fausse ?',
    answer: 'Hallucination',
    hint: 'Erreur de generation de modele.',
    category: 'Artificial Intelligence',
    difficulty: 'Medium'
  }
};

function extractJsonObject(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed[0] : parsed;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function defaultPenalty(difficulty = 'Medium') {
  const level = String(difficulty || 'Medium').toLowerCase();
  if (level === 'easy') return -1;
  if (level === 'hard') return -5;
  return -3;
}

function normalizeGeneratedChallenge(item, spec) {
  const fallback = FALLBACK_BY_MODIFIER[spec.modifier] || FALLBACK_BY_MODIFIER.standard;
  const difficulty = item?.difficulty === 'Hard' ? 'Hard' : spec.difficulty || 'Medium';
  const question = String(item?.question || fallback.question).trim();
  const answer = String(item?.answer || item?.correctAnswer || fallback.answer).trim();
  const hint = String(item?.hint || fallback.hint).trim();

  if (!question || !answer) {
    throw new Error(`Invalid challenge for ${spec.modifier}`);
  }

  if (hint.toLowerCase().includes(answer.toLowerCase())) {
    throw new Error(`Hint leaks answer for ${spec.modifier}`);
  }

  return {
    question,
    answer,
    hint,
    category: String(item?.category || spec.category || fallback.category).trim(),
    difficulty,
    points: Number.parseInt(item?.points, 10) || 10,
    penalty: Number.parseInt(item?.penalty, 10) || defaultPenalty(difficulty),
    timeLimit: Number.parseInt(item?.timeLimit, 10) || 30,
    recommendedModifier: spec.modifier,
    modifierLabel: spec.label,
    source: 'ollama_phi3'
  };
}

function buildPhase2BatchPrompt(specs = ROUND_TEST_SPECS) {
  const lines = specs.map((spec, index) => (
    `${index + 1}. modifier="${spec.modifier}" label="${spec.label}" category="${spec.category}" difficulty="${spec.difficulty}" theme="${spec.theme}"`
  ));

  return [
    'Tu es un generateur JSON strict pour ISGA Summit Challenge Phase 2.',
    'Retourne uniquement un tableau JSON valide de exactement 7 objets. Aucun markdown.',
    'Chaque objet correspond a un type de round distinct, dans cet ordre:',
    ...lines,
    'Contraintes pour chaque objet:',
    '- question en francais, competition universitaire',
    '- answer courte: 1 a 4 mots',
    '- hint subtil, max 12 mots, sans reveler la reponse',
    '- points: 10',
    '- penalty: -3 pour Medium, -5 pour Hard',
    '- timeLimit: 30',
    '- inclure recommendedModifier avec la cle modifier exacte du round',
    'Schema objet:',
    '{"question":"...","answer":"...","hint":"...","category":"...","difficulty":"Medium","points":10,"penalty":-3,"timeLimit":30,"recommendedModifier":"standard"}'
  ].join('\n');
}

async function callOllamaBatch(specs = ROUND_TEST_SPECS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

  const response = await fetch(`${OLLAMA_ENDPOINT}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: controller.signal,
    body: JSON.stringify({
      model: OLLAMA_CONFIG.model,
      prompt: buildPhase2BatchPrompt(specs),
      stream: false,
      options: {
        temperature: 0.55,
        num_ctx: 2048,
        num_predict: 1800
      }
    })
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    throw new Error(`Ollama ${response.status}`);
  }

  const payload = await response.json();
  let parsed = null;
  try {
    parsed = JSON.parse(String(payload.response || '').trim());
  } catch {
    const match = String(payload.response || '').match(/\[[\s\S]*\]/);
    if (match) parsed = JSON.parse(match[0]);
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Ollama batch must return a JSON array');
  }

  const byModifier = new Map();
  for (const item of parsed) {
    const key = String(item?.recommendedModifier || item?.modifier || '').trim();
    if (key) byModifier.set(key, item);
  }

  return specs.map((spec, index) => {
    try {
      const item = byModifier.get(spec.modifier) || parsed[index];
      return normalizeGeneratedChallenge(item, spec);
    } catch {
      const fallback = FALLBACK_BY_MODIFIER[spec.modifier] || FALLBACK_BY_MODIFIER.standard;
      return normalizeGeneratedChallenge(fallback, spec);
    }
  });
}

function buildPhase2Prompt(spec) {
  return [
    'Tu es un generateur JSON strict pour ISGA Summit Challenge Phase 2 elimination.',
    'Retourne uniquement un objet JSON valide. Aucun markdown. Aucun texte avant ou apres.',
    `Round type cible: ${spec.label} (${spec.modifier})`,
    `Categorie: ${spec.category}`,
    `Difficulte cible: ${spec.difficulty}`,
    `Theme: ${spec.theme}`,
    'Contraintes obligatoires:',
    '- question en francais, competition universitaire, pas triviale',
    '- answer courte: 1 a 4 mots maximum',
    '- hint subtil en francais, maximum 12 mots, ne jamais contenir la reponse',
    '- points: 10',
    `- penalty: ${spec.difficulty === 'Hard' ? -5 : -3}`,
    '- timeLimit: 30',
    '- pas de choix multiples, reponse libre courte',
    'Schema exact:',
    '{"question":"...","answer":"...","hint":"...","category":"' + spec.category + '","difficulty":"' + spec.difficulty + '","points":10,"penalty":' + (spec.difficulty === 'Hard' ? -5 : -3) + ',"timeLimit":30}'
  ].join('\n');
}

async function callOllamaForChallenge(spec) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OLLAMA_SINGLE_TIMEOUT_MS);

  const response = await fetch(`${OLLAMA_ENDPOINT}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: controller.signal,
    body: JSON.stringify({
      model: OLLAMA_CONFIG.model,
      prompt: buildPhase2Prompt(spec),
      stream: false,
      options: {
        temperature: 0.55,
        num_ctx: 1024,
        num_predict: 500
      }
    })
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    throw new Error(`Ollama ${response.status}`);
  }

  const payload = await response.json();
  const parsed = extractJsonObject(payload.response);
  return normalizeGeneratedChallenge(parsed, spec);
}

async function generateRoundTestChallenge(spec) {
  try {
    const generated = await callOllamaForChallenge(spec);
    return { ...generated, source: 'ollama_phi3' };
  } catch (error) {
    console.warn(`Ollama Phase 2 mock ${spec.modifier} failed:`, error.message);
    const fallback = FALLBACK_BY_MODIFIER[spec.modifier] || FALLBACK_BY_MODIFIER.standard;
    return {
      ...normalizeGeneratedChallenge(fallback, spec),
      source: 'fallback_local'
    };
  }
}

async function generatePhase2RoundTestPack({ modifiers = null } = {}) {
  const ollamaStatus = await getOllamaStatus();
  const requested = Array.isArray(modifiers) && modifiers.length > 0
    ? ROUND_TEST_SPECS.filter((spec) => modifiers.includes(spec.modifier))
    : ROUND_TEST_SPECS;

  const specs = requested.length > 0 ? requested : ROUND_TEST_SPECS;
  let challenges = [];
  let ollamaCount = 0;
  let source = 'fallback_round_test';

  if (ollamaStatus.ready && ollamaStatus.modelAvailable) {
    try {
      if (specs.length === ROUND_TEST_SPECS.length) {
        challenges = (await callOllamaBatch(specs)).map((challenge) => ({
          ...challenge,
          source: 'ollama_phi3'
        }));
        ollamaCount = challenges.length;
        source = 'ollama_phi3_round_test';
      } else {
        for (const spec of specs) {
          const challenge = await generateRoundTestChallenge(spec);
          if (challenge.source === 'ollama_phi3') ollamaCount += 1;
          challenges.push(challenge);
        }
        source = ollamaCount > 0 ? 'ollama_phi3_round_test' : 'fallback_round_test';
      }
    } catch (error) {
      console.warn('Ollama Phase 2 batch failed, falling back per-round:', error.message);
      challenges = [];
    }
  }

  if (challenges.length === 0) {
    for (const spec of specs) {
      if (process.env.PHASE2_FORCE_OLLAMA_SINGLE === 'true' && ollamaStatus.ready && ollamaStatus.modelAvailable) {
        const challenge = await generateRoundTestChallenge(spec);
        if (challenge.source === 'ollama_phi3') ollamaCount += 1;
        challenges.push(challenge);
      } else {
        const fallback = FALLBACK_BY_MODIFIER[spec.modifier] || FALLBACK_BY_MODIFIER.standard;
        challenges.push({
          ...normalizeGeneratedChallenge(fallback, spec),
          source: 'fallback_local'
        });
      }
    }
    source = ollamaCount > 0 ? 'ollama_phi3_round_test' : 'fallback_round_test';
  }

  return {
    name: `Ollama Round Test · ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
    source,
    challenges,
    ollamaStatus,
    ollamaCount,
    count: challenges.length,
    modifiers: specs.map((spec) => ({
      modifier: spec.modifier,
      label: spec.label,
      question: challenges.find((entry) => entry.recommendedModifier === spec.modifier)?.question
    }))
  };
}

module.exports = {
  ROUND_TEST_SPECS,
  MODIFIER_LABELS,
  generatePhase2RoundTestPack,
  generateRoundTestChallenge
};
