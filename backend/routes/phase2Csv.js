const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');
const { PrismaClient } = require('@prisma/client');
const phase2LocalStore = require('../services/phase2LocalStore');
const { generatePhase2RoundTestPack } = require('../services/ai/phase2ChallengeGenerator');

const router = express.Router();
const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage() });

const OLLAMA_ENDPOINT = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434';

async function generateAIHint(question, answer, difficulty = 'Medium') {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(`${OLLAMA_ENDPOINT}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'phi3:latest',
        prompt: `Tu es un assistant de quiz de haut niveau. Génère un indice utile en français pour la question suivante sans JAMAIS révéler la réponse.
Question: "${question}"
Réponse: "${answer}"
Difficulté: ${difficulty}
L'indice doit être subtil, axé sur le raisonnement ou l'étymologie, et faire maximum 12 mots. Ne donne aucune explication avant ou après, retourne uniquement l'indice brut.`,
        stream: false,
        options: { temperature: 0.4, num_predict: 50 }
      })
    }).finally(() => clearTimeout(timeout));

    if (response.ok) {
      const data = await response.json();
      const hint = String(data.response || '').trim().replace(/^"|"$/g, '');
      if (hint && !hint.toLowerCase().includes(String(answer).toLowerCase())) {
        return hint;
      }
    }
  } catch (err) {
    console.warn('AI Hint generation failed, using procedural fallback:', err.message);
  }
  return null;
}

const REQUIRED_FIELDS = [
  'question',
  'answer',
  'hint',
  'category',
  'difficulty',
  'points',
  'penalty',
  'timeLimit'
];

function generateHint(question, answer, difficulty = 'Medium') {
  const level = String(difficulty || 'Medium').toLowerCase();
  const answerText = String(answer || '').trim();
  const questionText = String(question || '').trim();

  if (level === 'hard') {
    return `Look for the hidden pattern in the prompt. The answer has ${answerText.length || 'a few'} characters.`;
  }

  if (level === 'easy') {
    return `Focus on the direct clue in the question. Avoid overthinking it.`;
  }

  if (/cipher|decode|encode|base64|hash/i.test(questionText)) {
    return 'Think about common encoding or alphabet transformation techniques.';
  }

  return `Break the question into its key terms before answering.`;
}

function normalizeChallenge(row) {
  const difficulty = String(row.difficulty || 'Medium').trim();
  const defaultPenalty = difficulty.toLowerCase() === 'hard'
    ? -5
    : difficulty.toLowerCase() === 'medium'
      ? -3
      : -1;

  return {
    question: String(row.question || '').trim(),
    answer: String(row.answer || '').trim(),
    hint: String(row.hint || '').trim() || generateHint(row.question, row.answer, difficulty),
    category: String(row.category || 'General').trim(),
    difficulty,
    points: Number.parseInt(row.points, 10) || 10,
    penalty: Number.parseInt(row.penalty, 10) || defaultPenalty,
    timeLimit: Number.parseInt(row.timeLimit, 10) || 30
  };
}

function sanitizeChallengePayload(payload = {}) {
  return normalizeChallenge({
    question: payload.question,
    answer: payload.answer,
    hint: payload.hint,
    category: payload.category,
    difficulty: payload.difficulty,
    points: payload.points,
    penalty: payload.penalty,
    timeLimit: payload.timeLimit
  });
}

function validateRows(rows, headers) {
  const missingFields = REQUIRED_FIELDS.filter(field => !headers.includes(field));
  const rowErrors = [];

  rows.forEach((row, index) => {
    const missing = REQUIRED_FIELDS.filter(field => {
      if (field === 'hint') return false;
      return row[field] === undefined || row[field] === null || String(row[field]).trim() === '';
    });

    if (missing.length > 0) {
      rowErrors.push({ row: index + 2, missing });
    }
  });

  return {
    valid: missingFields.length === 0 && rowErrors.length === 0,
    missingFields,
    rowErrors
  };
}

function parseCsvBuffer(buffer) {
  return new Promise((resolve, reject) => {
    const rows = [];
    let headers = [];

    Readable.from([buffer.toString('utf8')])
      .pipe(csv())
      .on('headers', parsedHeaders => {
        headers = parsedHeaders.map(h => String(h).trim());
      })
      .on('data', row => rows.push(row))
      .on('error', reject)
      .on('end', () => {
        const validation = validateRows(rows, headers);
        resolve({
          ...validation,
          headers,
          rows,
          challenges: rows.map(normalizeChallenge)
        });
      });
  });
}

router.post('/packs/preview', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier CSV fourni' });
    const parsed = await parseCsvBuffer(req.file.buffer);

    res.json({
      filename: req.file.originalname,
      valid: parsed.valid,
      headers: parsed.headers,
      missingFields: parsed.missingFields,
      rowErrors: parsed.rowErrors,
      count: parsed.challenges.length,
      challenges: parsed.challenges
    });
  } catch (error) {
    console.error('Erreur preview CSV Phase 2:', error);
    res.status(500).json({ error: 'Erreur lecture CSV' });
  }
});

router.post('/packs/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier CSV fourni' });
    const parsed = await parseCsvBuffer(req.file.buffer);

    if (!parsed.valid) {
      return res.status(400).json({
        error: 'CSV invalide',
        missingFields: parsed.missingFields,
        rowErrors: parsed.rowErrors
      });
    }

    const packName = req.body.name || req.file.originalname.replace(/\.csv$/i, '');
    const pack = await prisma.challengePack.create({
      data: {
        name: packName,
        sourceFilename: req.file.originalname,
        challengeCount: parsed.challenges.length,
        challenges: {
          create: parsed.challenges
        }
      },
      include: { challenges: true }
    });

    res.status(201).json({ message: 'Challenge pack importe', pack });
  } catch (error) {
    console.error('Erreur import CSV Phase 2:', error);
    res.status(500).json({ error: 'Erreur import CSV Phase 2' });
  }
});

router.get('/packs', async (req, res) => {
  const localPacks = phase2LocalStore.listPacks();

  try {
    const packs = await prisma.challengePack.findMany({
      orderBy: { createdAt: 'desc' },
      include: { challenges: { orderBy: { id: 'asc' } } }
    });
    res.json([...localPacks, ...packs]);
  } catch (error) {
    console.warn('Phase 2 DB packs unavailable, using local store:', error.message);
    res.json(localPacks);
  }
});

router.post('/packs/generate-mock-ollama', async (req, res) => {
  try {
    const generated = await generatePhase2RoundTestPack({
      modifiers: req.body?.modifiers
    });

    phase2LocalStore.clearGeneratedPacks();
    const pack = phase2LocalStore.savePack({
      name: generated.name,
      source: generated.source,
      challenges: generated.challenges
    });

    let dbPack = null;
    try {
      dbPack = await prisma.challengePack.create({
        data: {
          name: pack.name,
          sourceFilename: 'ollama-round-test.json',
          challengeCount: pack.challenges.length,
          challenges: {
            create: pack.challenges.map((challenge) => ({
              question: challenge.question,
              answer: challenge.answer,
              hint: challenge.hint,
              category: challenge.category,
              difficulty: challenge.difficulty,
              points: challenge.points,
              penalty: challenge.penalty,
              timeLimit: challenge.timeLimit
            }))
          }
        },
        include: { challenges: true }
      });
    } catch (error) {
      console.warn('Phase 2 DB pack save skipped:', error.message);
    }

    res.status(201).json({
      message: 'Pack de test Ollama genere (1 question par type de round)',
      pack,
      dbPack,
      ollama: generated.ollamaStatus,
      ollamaCount: generated.ollamaCount,
      fallbackCount: generated.count - generated.ollamaCount,
      modifiers: generated.modifiers
    });
  } catch (error) {
    console.error('Erreur generation pack Ollama Phase 2:', error);
    res.status(500).json({ error: error.message || 'Erreur generation pack Ollama Phase 2' });
  }
});

router.put('/packs/:packId/challenges/:challengeId', async (req, res) => {
  try {
    const packId = Number.parseInt(req.params.packId, 10);
    const challengeId = Number.parseInt(req.params.challengeId, 10);

    if (Number.isNaN(packId) || Number.isNaN(challengeId)) {
      return res.status(400).json({ error: 'Identifiants invalides' });
    }

    const existing = await prisma.importedChallenge.findFirst({
      where: { id: challengeId, packId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Challenge introuvable' });
    }

    const challenge = sanitizeChallengePayload(req.body || {});
    if (!challenge.question || !challenge.answer) {
      return res.status(400).json({ error: 'Question et réponse requises' });
    }

    const updated = await prisma.importedChallenge.update({
      where: { id: challengeId },
      data: challenge
    });

    res.json({ message: 'Challenge mis à jour', challenge: updated });
  } catch (error) {
    console.error('Erreur mise à jour challenge Phase 2:', error);
    res.status(500).json({ error: 'Erreur mise à jour challenge' });
  }
});

router.post('/packs/:packId/challenges/:challengeId/regenerate-hint', async (req, res) => {
  try {
    const packId = Number.parseInt(req.params.packId, 10);
    const challengeId = Number.parseInt(req.params.challengeId, 10);

    if (Number.isNaN(packId) || Number.isNaN(challengeId)) {
      return res.status(400).json({ error: 'Identifiants invalides' });
    }

    const existing = await prisma.importedChallenge.findFirst({
      where: { id: challengeId, packId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Challenge introuvable' });
    }

    const hint = generateHint(existing.question, existing.answer, existing.difficulty);
    const updated = await prisma.importedChallenge.update({
      where: { id: challengeId },
      data: { hint }
    });

    res.json({ message: 'Indice régénéré', challenge: updated, hint });
  } catch (error) {
    console.error('Erreur régénération indice Phase 2:', error);
    res.status(500).json({ error: 'Erreur régénération indice' });
  }
});

router.post('/hints/generate', async (req, res) => {
  const { question, answer, difficulty } = req.body || {};
  const aiHint = await generateAIHint(question, answer, difficulty);
  res.json({ hint: aiHint || generateHint(question, answer, difficulty) });
});

module.exports = { router, generateHint, generateAIHint };
