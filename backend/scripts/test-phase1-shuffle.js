const { buildFreshCategorySelection, buildCategorySelection, normalizeBankKey } = require('../services/phase1QuestionBank');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function run() {
  const prisma = null;
  const category = 'Technology';
  const first = await buildCategorySelection(prisma, category, 10, false, 1);
  assert(first.length === 10, 'Load should return 10 questions');

  const exclude = first.map((question) => normalizeBankKey(question));
  const shuffled = await buildFreshCategorySelection(prisma, category, 10, exclude);
  assert(shuffled.length === 10, 'Shuffle should return 10 questions');

  const overlap = shuffled.filter((question) => exclude.includes(normalizeBankKey(question)));
  assert(overlap.length === 0, 'Shuffle should avoid currently loaded questions');

  const shuffledKeys = new Set(shuffled.map((question) => normalizeBankKey(question)));
  assert(shuffledKeys.size === 10, 'Shuffle should not duplicate within batch');

  console.log('PASS · phase1_shuffle_fast');
  console.log(`Loaded sample: ${first[0].question || first[0].text}`);
  console.log(`Fresh sample: ${shuffled[0].question || shuffled[0].text}`);
}

run().catch((error) => {
  console.error(`FAIL · phase1_shuffle_fast · ${error.message}`);
  process.exit(1);
});
