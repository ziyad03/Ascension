const {
  MODIFIERS,
  MODIFIER_LABELS,
  calculatePhase2Earned,
  calculatePhase2Penalty,
  applySuddenQuestionTimer,
  resolvePhase2Modifier
} = require('../services/phase2Scoring');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const ROUND_SCENARIOS = [
  {
    id: 'standard',
    label: 'Standard',
    modifier: 'standard',
    tests: [
      { name: 'correct', earned: calculatePhase2Earned({ usedHint: false }), expected: 10 },
      { name: 'hint', earned: calculatePhase2Earned({ usedHint: true }), expected: 8 },
      { name: 'wrong medium', penalty: calculatePhase2Penalty({ difficulty: 'Medium' }), expected: -3 }
    ]
  },
  {
    id: 'double_points',
    label: 'Double Points',
    modifier: 'double_points',
    tests: [
      { name: 'correct', earned: calculatePhase2Earned({ modifier: 'double_points', usedHint: false }), expected: 20 },
      { name: 'hint', earned: calculatePhase2Earned({ modifier: 'double_points', usedHint: true }), expected: 8 }
    ]
  },
  {
    id: 'fastest_bonus',
    label: 'Fast Answer Bonus',
    modifier: 'fastest_bonus',
    tests: [
      { name: 'first correct', earned: calculatePhase2Earned({ modifier: 'fastest_bonus', isFirstCorrect: true }), expected: 12 },
      { name: 'second correct', earned: calculatePhase2Earned({ modifier: 'fastest_bonus', isFirstCorrect: false }), expected: 10 }
    ]
  },
  {
    id: 'risk_round',
    label: 'Risk Round',
    modifier: 'risk_round',
    tests: [
      { name: 'win wager 15', earned: calculatePhase2Earned({ modifier: 'risk_round', wager: 15, currentScore: 30 }), expected: 15 },
      { name: 'lose wager 15', penalty: calculatePhase2Penalty({ modifier: 'risk_round', wager: 15, currentScore: 30 }), expected: -15 },
      { name: 'hint caps at 8', earned: calculatePhase2Earned({ modifier: 'risk_round', usedHint: true, wager: 15 }), expected: 8 }
    ]
  },
  {
    id: 'sudden_question',
    label: 'Sudden Question',
    modifier: 'sudden_question',
    tests: [
      { name: 'timer halved from 30', timer: applySuddenQuestionTimer(30), expected: 15 },
      { name: 'timer floor 10', timer: applySuddenQuestionTimer(12), expected: 10 }
    ]
  },
  {
    id: 'no_hint',
    label: 'No Hint Round',
    modifier: 'no_hint',
    tests: [
      { name: 'correct without hint path', earned: calculatePhase2Earned({ modifier: 'no_hint', usedHint: false }), expected: 10 }
    ]
  },
  {
    id: 'mystery_challenge',
    label: 'Mystery Challenge',
    modifier: 'mystery_challenge',
    tests: []
  }
];

function testModifierResolution() {
  for (const modifier of MODIFIERS) {
    const resolved = resolvePhase2Modifier(modifier);
    assert(resolved.modifierLabel, `${modifier} should resolve with a label`);
    if (modifier === 'mystery_challenge') {
      assert(resolved.modifier !== 'mystery_challenge', 'Mystery should resolve to another modifier');
    } else {
      assert(resolved.modifier === modifier, `${modifier} should resolve to itself`);
    }
  }

  const standard = resolvePhase2Modifier('standard');
  assert(standard.modifier === null, 'Standard round should have no modifier');
}

function runScenario(scenario) {
  for (const test of scenario.tests) {
    const actual = test.earned ?? test.penalty ?? test.timer;
    assert(actual === test.expected, `${scenario.label} · ${test.name} expected ${test.expected}, got ${actual}`);
  }

  const resolved = resolvePhase2Modifier(scenario.modifier);
  if (scenario.modifier === 'standard') {
    assert(resolved.modifier === null, `${scenario.label} resolution`);
  } else if (scenario.modifier === 'mystery_challenge') {
    assert(resolved.modifierLabel === 'Mystery Challenge', `${scenario.label} resolution`);
  } else {
    assert(resolved.modifier === scenario.modifier, `${scenario.label} resolution`);
  }
}

function printManualChecklist() {
  console.log('\nManual E2E checklist (Moderator → Round type dropdown → Lancer challenge):\n');
  for (const scenario of ROUND_SCENARIOS) {
    console.log(`- ${scenario.label} (${scenario.modifier})`);
    if (scenario.modifier === 'risk_round') {
      console.log('  Team UI: set wager 5-20 before LOCK IN');
    }
    if (scenario.modifier === 'fastest_bonus') {
      console.log('  First correct team should get +12 total');
    }
    if (scenario.modifier === 'no_hint') {
      console.log('  Hint button should be disabled');
    }
    if (scenario.modifier === 'sudden_question') {
      console.log('  Timer should be half the CSV timeLimit (min 10s)');
    }
  }
  console.log('\nDev API example:');
  console.log('POST /api/tournament/dev/phase2/start-challenge');
  console.log('{"challengeId":1,"modifier":"risk_round"}');
}

async function run() {
  const results = [];

  try {
    testModifierResolution();
    results.push({ name: 'modifier_resolution', ok: true });
    console.log('PASS · modifier_resolution');
  } catch (error) {
    results.push({ name: 'modifier_resolution', ok: false, error: error.message });
    console.log(`FAIL · modifier_resolution · ${error.message}`);
  }

  for (const scenario of ROUND_SCENARIOS) {
    try {
      runScenario(scenario);
      results.push({ name: scenario.id, ok: true });
      console.log(`PASS · ${scenario.id}`);
    } catch (error) {
      results.push({ name: scenario.id, ok: false, error: error.message });
      console.log(`FAIL · ${scenario.id} · ${error.message}`);
    }
  }

  printManualChecklist();

  const ok = results.every((entry) => entry.ok);
  console.log(`\nPhase 2 round types: ${ok ? 'PASS' : 'FAIL'} (${results.length} checks)`);
  console.log(`Available modifiers: ${MODIFIERS.map((key) => MODIFIER_LABELS[key]).join(', ')}`);
  process.exit(ok ? 0 : 1);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
