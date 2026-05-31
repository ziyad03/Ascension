const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '.local-data');
const DATA_FILE = path.join(DATA_DIR, 'phase2-packs.json');

const initialState = {
  nextPackId: 1,
  nextChallengeId: 1,
  packs: []
};

function readState() {
  try {
    if (!fs.existsSync(DATA_FILE)) return { ...initialState, packs: [] };
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return {
      ...initialState,
      ...parsed,
      packs: Array.isArray(parsed.packs) ? parsed.packs : []
    };
  } catch {
    return { ...initialState, packs: [] };
  }
}

function writeState(state) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
}

function listPacks() {
  return readState().packs.map((pack) => ({
    ...pack,
    challenges: [...(pack.challenges || [])].sort((a, b) => String(a.id).localeCompare(String(b.id)))
  }));
}

function findChallenge(challengeId) {
  const state = readState();
  for (const pack of state.packs) {
    const challenge = (pack.challenges || []).find((entry) => String(entry.id) === String(challengeId));
    if (challenge) {
      return {
        ...challenge,
        pack: { id: pack.id, name: pack.name },
        packId: pack.id
      };
    }
  }
  return null;
}

function savePack({ name, source = 'local', challenges = [] }) {
  const state = readState();
  const packId = `local-pack-${state.nextPackId}`;
  state.nextPackId += 1;

  const normalizedChallenges = challenges.map((challenge) => {
    const challengeId = `local-challenge-${state.nextChallengeId}`;
    state.nextChallengeId += 1;
    return {
      id: challengeId,
      packId,
      ...challenge
    };
  });

  const pack = {
    id: packId,
    name,
    source,
    sourceFilename: `${name}.ollama.json`,
    challengeCount: normalizedChallenges.length,
    createdAt: new Date().toISOString(),
    challenges: normalizedChallenges
  };

  state.packs.unshift(pack);
  writeState(state);
  return pack;
}

function clearGeneratedPacks() {
  const state = readState();
  state.packs = state.packs.filter((pack) => pack.source !== 'ollama_phi3_round_test');
  writeState(state);
  return listPacks();
}

module.exports = {
  listPacks,
  findChallenge,
  savePack,
  clearGeneratedPacks
};
