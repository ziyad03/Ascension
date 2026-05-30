export const FLOOR_META = {
  phase1: {
    key: 'phase1',
    floor: 1,
    short: 'Floor 1',
    title: 'Phase de Qualification',
    theme: 'Open Ground',
    subtitle: 'Toutes les équipes entrent dans la tour.'
  },
  phase1_complete: {
    key: 'phase1_complete',
    floor: 1,
    short: 'Floor 1',
    title: 'Qualification Terminée',
    theme: 'Ascension',
    subtitle: 'Le Top 4 se prépare à monter.'
  },
  phase2: {
    key: 'phase2',
    floor: 2,
    short: 'Floor 2',
    title: "Phase d'Elimination",
    theme: 'Pressure Floor',
    subtitle: 'Top 4. Pression, pénalités et survie.'
  },
  phase2_complete: {
    key: 'phase2_complete',
    floor: 2,
    short: 'Floor 2',
    title: "Elimination Terminée",
    theme: 'Accès au Sommet',
    subtitle: 'Deux équipes montent encore.'
  },
  phase3: {
    key: 'phase3',
    floor: 3,
    short: 'Floor 3',
    title: 'La Grande Finale',
    theme: 'Summit',
    subtitle: 'Duel final au sommet.'
  }
};

export function getTowerPhase(phase) {
  return FLOOR_META[phase] || FLOOR_META.phase1;
}

export function getTowerProgress(phase) {
  const meta = getTowerPhase(phase);
  return Math.min(1, Math.max(0, (meta.floor - 1) / 2));
}

export function getTowerFloors() {
  return [
    FLOOR_META.phase1,
    FLOOR_META.phase2,
    FLOOR_META.phase3
  ];
}
