const KEY = 'crazy:team-profile';

export function readTeamProfile() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function writeTeamProfile(profile) {
  const next = {
    avatar: profile.avatar || '',
    tag: profile.tag || '',
    color: profile.color || '#17e9ff'
  };

  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore storage failures
  }

  return next;
}

export function initialsFromName(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'TC';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}
