const { generatePhase2RoundTestPack } = require('../services/ai/phase2ChallengeGenerator');
const phase2LocalStore = require('../services/phase2LocalStore');

async function run() {
  console.log('Generating Phase 2 Ollama mock pack (1 challenge per round type)...\n');

  const generated = await generatePhase2RoundTestPack();
  phase2LocalStore.clearGeneratedPacks();
  const pack = phase2LocalStore.savePack({
    name: generated.name,
    source: generated.source,
    challenges: generated.challenges
  });

  console.log(`Pack: ${pack.name}`);
  console.log(`Source: ${generated.source}`);
  console.log(`Ollama: ${generated.ollamaCount}/${generated.count} · Fallback: ${generated.count - generated.ollamaCount}`);
  console.log(`Ollama status: ${generated.ollamaStatus.ready ? 'ready' : 'unavailable'}\n`);

  for (const entry of generated.modifiers) {
    const challenge = pack.challenges.find((item) => item.recommendedModifier === entry.modifier);
    console.log(`- ${entry.label} (${entry.modifier})`);
    console.log(`  Q: ${challenge?.question || entry.question}`);
    console.log(`  A: ${challenge?.answer}`);
    console.log(`  id: ${challenge?.id}\n`);
  }

  console.log('Saved to backend/.local-data/phase2-packs.json');
  console.log('Use Moderator → Generate Ollama Test Pack, or GET /api/phase2/packs');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
