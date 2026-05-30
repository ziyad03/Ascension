const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '.local-data');
const DATA_FILE = path.join(DATA_DIR, 'auth-store.json');

const initialState = {
  nextTeamId: 1,
  nextUserId: 1,
  teams: [],
  users: []
};

function readState() {
  try {
    if (!fs.existsSync(DATA_FILE)) return { ...initialState };
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return {
      ...initialState,
      ...parsed,
      teams: Array.isArray(parsed.teams) ? parsed.teams : [],
      users: Array.isArray(parsed.users) ? parsed.users : []
    };
  } catch {
    return { ...initialState };
  }
}

function writeState(state) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
}

function publicTeam(team, memberCount = 0) {
  return {
    id: team.id,
    name: team.name,
    tag: team.tag || '',
    color: team.color || '#17e9ff',
    avatar: team.avatar || '',
    score: team.score || 0,
    createdAt: team.createdAt,
    memberCount
  };
}

function listTeams() {
  const state = readState();
  return state.teams.map(team => publicTeam(
    team,
    state.users.filter(user => String(user.teamId) === String(team.id)).length
  ));
}

function createTeam({ name, tag, color, avatar }) {
  const state = readState();
  const teamName = String(name || '').trim();
  if (!teamName) {
    const error = new Error("Nom d'équipe requis");
    error.statusCode = 400;
    throw error;
  }

  if (state.teams.some(team => team.name.toLowerCase() === teamName.toLowerCase())) {
    const error = new Error('Cette équipe existe déjà');
    error.statusCode = 400;
    throw error;
  }

  const team = {
    id: state.nextTeamId,
    name: teamName,
    tag: String(tag || '').trim().slice(0, 4).toUpperCase(),
    color: color || '#17e9ff',
    avatar: avatar || '',
    score: 0,
    createdAt: new Date().toISOString()
  };

  state.nextTeamId += 1;
  state.teams.push(team);
  writeState(state);
  return publicTeam(team, 0);
}

function findTeamById(teamId) {
  const state = readState();
  const team = state.teams.find(entry => String(entry.id) === String(teamId));
  return team ? publicTeam(team, state.users.filter(user => String(user.teamId) === String(team.id)).length) : null;
}

function findUserByUsername(username) {
  const state = readState();
  return state.users.find(user => user.username === username) || null;
}

function createUser({ username, password, role, teamId }) {
  const state = readState();
  if (state.users.some(user => user.username === username)) {
    const error = new Error('Utilisateur existe deja');
    error.statusCode = 400;
    throw error;
  }

  let assignedTeamId = null;
  if (role === 'team') {
    const team = state.teams.find(entry => String(entry.id) === String(teamId));
    if (!team) {
      const error = new Error('Équipe introuvable');
      error.statusCode = 400;
      throw error;
    }

    const memberCount = state.users.filter(user => String(user.teamId) === String(team.id)).length;
    if (memberCount >= 4) {
      const error = new Error("L'équipe est complète (maximum 4 membres)");
      error.statusCode = 400;
      throw error;
    }
    assignedTeamId = team.id;
  }

  const user = {
    id: state.nextUserId,
    username,
    password,
    role,
    teamId: assignedTeamId,
    createdAt: new Date().toISOString()
  };
  state.nextUserId += 1;
  state.users.push(user);
  writeState(state);
  return user;
}

module.exports = {
  createTeam,
  createUser,
  findTeamById,
  findUserByUsername,
  listTeams
};
