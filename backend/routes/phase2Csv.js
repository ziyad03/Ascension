const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage() });

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
  try {
    const packs = await prisma.challengePack.findMany({
      orderBy: { createdAt: 'desc' },
      include: { challenges: { orderBy: { id: 'asc' } } }
    });
    res.json(packs);
  } catch (error) {
    console.error('Erreur packs Phase 2:', error);
    res.status(500).json({ error: 'Erreur recuperation packs' });
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

router.post('/hints/generate', (req, res) => {
  const { question, answer, difficulty } = req.body || {};
  res.json({ hint: generateHint(question, answer, difficulty) });
});

module.exports = { router, generateHint };
