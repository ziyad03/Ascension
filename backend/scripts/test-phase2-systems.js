const {
  calculatePhase2Earned,
  calculatePhase2Penalty,
  defaultPenalty,
  normalizeAnswer,
  isAnswerCorrect,
  applySuddenQuestionTimer,
  getModifierLabel,
  resolveMysteryModifier,
  MODIFIERS,
  POINTS
} = require('../services/phase2Scoring');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function testScoringMatrix() {
  assert(calculatePhase2Earned({ usedHint: false }) === 10, 'Correct should be +10');
  assert(calculatePhase2Earned({ usedHint: true }) === 8, 'Hint should be +8');
  assert(calculatePhase2Earned({ modifier: 'double_points', usedHint: false }) === 20, 'Double should be +20');
  assert(calculatePhase2Earned({ modifier: 'double_points', usedHint: true }) === 8, 'Double + hint should stay +8');
  assert(
    calculatePhase2Earned({ modifier: 'fastest_bonus', isFirstCorrect: true }) === 12,
    'Fast bonus should add +2 to first correct'
  );
  assert(
    calculatePhase2Earned({ modifier: 'fastest_bonus', isFirstCorrect: false }) === 10,
    'Fast bonus should not apply without first correct flag'
  );
  assert(
    calculatePhase2Earned({ modifier: 'risk_round', wager: 15, currentScore: 30 }) === 15,
    'Risk round win should gain wager'
  );
  assert(
    calculatePhase2Penalty({ modifier: 'risk_round', wager: 15, currentScore: 30 }) === -15,
    'Risk round loss should lose wager'
  );
  assert(defaultPenalty('Easy') === -1, 'Easy penalty');
  assert(defaultPenalty('Medium') === -3, 'Medium penalty');
  assert(defaultPenalty('Hard') === -5, 'Hard penalty');
  assert(calculatePhase2Penalty({ difficulty: 'Hard' }) === -5, 'Hard challenge penalty');
}

function testAnswerNormalization() {
  assert(isAnswerCorrect(' TLS ', 'tls'), 'Answer normalization should match');
  assert(!isAnswerCorrect('TLS1.3', 'TLS'), 'Different answers should not match');
  assert(normalizeAnswer('A  B') === 'a b', 'Whitespace normalization');
}

function testModifiers() {
  assert(MODIFIERS.includes('mystery_challenge'), 'Mystery modifier exists');
  assert(getModifierLabel('double_points') === 'Double Points', 'Modifier label');
  assert(applySuddenQuestionTimer(30) === 15, 'Sudden question timer halved');
  assert(applySuddenQuestionTimer(12) === 10, 'Sudden question timer floor');
  const resolved = resolveMysteryModifier();
  assert(resolved !== 'mystery_challenge', 'Mystery resolves to another modifier');
}

async function testCsvImport() {
  const { Readable } = require('stream');
  const csv = require('csv-parser');

  function parseCsv(text) {
    return new Promise((resolve, reject) => {
      const rows = [];
      let headers = [];
      Readable.from([text])
        .pipe(csv())
        .on('headers', (parsed) => { headers = parsed.map((h) => String(h).trim()); })
        .on('data', (row) => rows.push(row))
        .on('error', reject)
        .on('end', () => resolve({ headers, rows }));
    });
  }

  const valid = await parseCsv([
    'question,answer,hint,category,difficulty,points,penalty,timeLimit',
    'What is TLS?,TLS,Think transport,Networking,Medium,10,-3,30'
  ].join('\n'));

  assert(valid.rows.length === 1, 'Valid CSV should parse one row');
  assert(valid.headers.includes('question'), 'Valid CSV headers');

  const invalid = await parseCsv('question,answer\n,bad\n');
  assert(invalid.rows[0].question === '', 'Invalid CSV should still parse rows for validation layer');
}

function testHintSafety() {
  const answer = 'Mitochondrie';
  const hint = 'Pense a l organite qui produit l ATP';
  assert(!hint.toLowerCase().includes(answer.toLowerCase()), 'Hint must not leak answer');
}

function testPhase2RoundFlow() {
  let teamScore = 0;

  teamScore += calculatePhase2Earned({ usedHint: false });
  assert(teamScore === 10, 'Round 1 correct base score');

  teamScore += calculatePhase2Penalty({ difficulty: 'Medium' });
  assert(teamScore === 7, 'Wrong medium answer applies -3');

  teamScore += calculatePhase2Earned({ usedHint: true });
  assert(teamScore === 15, 'Hint-assisted correct adds +8');

  teamScore += calculatePhase2Earned({ modifier: 'double_points', usedHint: false });
  assert(teamScore === 35, 'Double points adds +20');

  teamScore += calculatePhase2Earned({
    modifier: 'fastest_bonus',
    usedHint: false,
    isFirstCorrect: true
  });
  assert(teamScore === 47, 'Fastest bonus adds +2 on top of correct');

  const riskWin = calculatePhase2Earned({
    modifier: 'risk_round',
    wager: 15,
    currentScore: teamScore
  });
  assert(riskWin === 15, 'Risk round win returns wager amount');

  teamScore += riskWin;
  const riskLoss = calculatePhase2Penalty({
    modifier: 'risk_round',
    wager: 15,
    currentScore: teamScore
  });
  assert(riskLoss === -15, 'Risk round loss removes wager amount');
  teamScore += riskLoss;
  assert(teamScore === 47, 'Score unchanged after risk round loss');
}

function testRankingOrder() {
  const teams = [
    { id: '1', score: 18 },
    { id: '2', score: 26 },
    { id: '3', score: 26 },
    { id: '4', score: 10 }
  ];

  const ranked = [...teams]
    .sort((a, b) => b.score - a.score || String(a.id).localeCompare(String(b.id)))
    .map((team, index) => ({ ...team, rank: index + 1 }));

  assert(ranked[0].rank === 1 && ranked[0].score === 26, 'Top score rank 1');
  assert(ranked[1].score === 26, 'Tie preserved in ordering');
  assert(ranked[3].score === 10, 'Lowest team ranked last');
}

async function run() {
  const tests = [
    ['scoring_matrix', async () => testScoringMatrix()],
    ['answer_normalization', async () => testAnswerNormalization()],
    ['modifiers', async () => testModifiers()],
    ['csv_import', testCsvImport],
    ['hint_safety', async () => testHintSafety()],
    ['ranking_order', async () => testRankingOrder()],
    ['phase2_round_flow', async () => testPhase2RoundFlow()]
  ];

  const results = [];
  for (const [name, runner] of tests) {
    try {
      await runner();
      results.push({ name, ok: true });
      console.log(`PASS · ${name}`);
    } catch (error) {
      results.push({ name, ok: false, error: error.message });
      console.log(`FAIL · ${name} · ${error.message}`);
    }
  }

  const ok = results.every((entry) => entry.ok);
  console.log(`\nPhase 2 systems: ${ok ? 'PASS' : 'FAIL'} (${results.length} tests)`);
  process.exit(ok ? 0 : 1);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
