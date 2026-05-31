const POINTS = {
  correct: 10,
  hint: 8,
  double: 20,
  fastestBonus: 2
};

const MODIFIER_LABELS = {
  double_points: 'Double Points',
  sudden_question: 'Sudden Question',
  no_hint: 'No Hint Round',
  risk_round: 'Risk Round',
  fastest_bonus: 'Fast Answer Bonus',
  mystery_challenge: 'Mystery Challenge'
};

const MODIFIERS = Object.keys(MODIFIER_LABELS);

function normalizeAnswer(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function defaultPenalty(difficulty = 'Medium') {
  const level = String(difficulty || 'Medium').toLowerCase();
  if (level === 'easy') return -1;
  if (level === 'hard') return -5;
  return -3;
}

function clampWager(wager, currentScore = 0) {
  let amount = Number(wager);
  if (Number.isNaN(amount) || amount < 5) amount = 5;
  if (amount > 20) amount = 20;
  if (currentScore > 5 && amount > currentScore) amount = currentScore;
  return amount;
}

function calculatePhase2Earned({
  modifier = null,
  usedHint = false,
  isFirstCorrect = false,
  wager = 10,
  currentScore = 0
} = {}) {
  let earned;

  if (modifier === 'risk_round') {
    const wagerAmount = clampWager(wager, currentScore);
    earned = usedHint ? POINTS.hint : wagerAmount;
  } else if (modifier === 'double_points') {
    earned = usedHint ? POINTS.hint : POINTS.double;
  } else {
    earned = usedHint ? POINTS.hint : POINTS.correct;
  }

  if (modifier === 'fastest_bonus' && isFirstCorrect) {
    earned += POINTS.fastestBonus;
  }

  return earned;
}

function calculatePhase2Penalty({
  modifier = null,
  wager = 10,
  currentScore = 0,
  challengePenalty,
  difficulty = 'Medium'
} = {}) {
  if (modifier === 'risk_round') {
    return -clampWager(wager, currentScore);
  }

  return Number.isFinite(Number(challengePenalty))
    ? Number(challengePenalty)
    : defaultPenalty(difficulty);
}

function pickPhase2Modifier() {
  if (Math.random() > 0.5) return null;
  return MODIFIERS[Math.floor(Math.random() * MODIFIERS.length)];
}

function resolveMysteryModifier() {
  const pool = MODIFIERS.filter((item) => item !== 'mystery_challenge');
  return pool[Math.floor(Math.random() * pool.length)];
}

function resolvePhase2Modifier(requestedModifier = 'random') {
  const key = String(requestedModifier || 'random').trim().toLowerCase();

  if (!key || key === 'random') {
    const modifier = pickPhase2Modifier();
    if (modifier === 'mystery_challenge') {
      const resolved = resolveMysteryModifier();
      return {
        modifier: resolved,
        modifierLabel: 'Mystery Challenge',
        mysteryResolved: resolved
      };
    }
    return { modifier, modifierLabel: getModifierLabel(modifier) };
  }

  if (key === 'standard' || key === 'none' || key === 'normal') {
    return { modifier: null, modifierLabel: null };
  }

  if (key === 'mystery_challenge' || key === 'mystery') {
    const resolved = resolveMysteryModifier();
    return {
      modifier: resolved,
      modifierLabel: 'Mystery Challenge',
      mysteryResolved: resolved
    };
  }

  if (MODIFIERS.includes(key)) {
    return { modifier: key, modifierLabel: getModifierLabel(key) };
  }

  return { modifier: null, modifierLabel: null };
}

function getModifierLabel(modifier) {
  return MODIFIER_LABELS[modifier] || null;
}

function applySuddenQuestionTimer(timeLimit = 30) {
  return Math.max(10, Math.floor(timeLimit / 2));
}

function isAnswerCorrect(answer, expected) {
  return normalizeAnswer(answer) === normalizeAnswer(expected);
}

module.exports = {
  POINTS,
  MODIFIERS,
  MODIFIER_LABELS,
  normalizeAnswer,
  defaultPenalty,
  clampWager,
  calculatePhase2Earned,
  calculatePhase2Penalty,
  pickPhase2Modifier,
  resolveMysteryModifier,
  resolvePhase2Modifier,
  getModifierLabel,
  applySuddenQuestionTimer,
  isAnswerCorrect
};
