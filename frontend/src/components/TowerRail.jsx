import { getTowerFloors, getTowerPhase, getTowerProgress } from './towerModel';

export default function TowerRail({
  phase = 'phase1',
  title = 'Phase Progress',
  subtitle = 'Qualification. Elimination. Finale.',
  compact = false
}) {
  const meta = getTowerPhase(phase);
  const phases = getTowerFloors();
  const progress = getTowerProgress(phase);

  return (
    <div
      style={{
        padding: compact ? '1rem' : '1.3rem',
        borderRadius: 18,
        background: 'rgba(6,3,63,0.84)',
        border: '1px solid rgba(23,233,255,0.14)',
        boxShadow: '0 0 18px rgba(23,233,255,0.08)'
      }}
    >
      <div style={{ marginBottom: compact ? 12 : 16 }}>
        <div style={{ color: '#a5f3fc', fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700 }}>
          Competition flow
        </div>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: compact ? 22 : 28, fontWeight: 800, color: '#f8fafc', marginTop: 6 }}>
          {title}
        </div>
        <div style={{ color: 'rgba(226,232,240,0.68)', fontSize: 14, marginTop: 6, maxWidth: 320 }}>
          {subtitle}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ height: 10, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          <div
            style={{
              width: `${Math.max(8, progress * 100)}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #17e9ff, #c6b9ff)',
              borderRadius: 999,
              transition: 'width 220ms ease'
            }}
          />
        </div>

        <div style={{ display: 'grid', gap: 8 }}>
          {phases.map((item) => {
            const active = item.key === phase;
            return (
              <div
                key={item.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '0.72rem 0.85rem',
                  borderRadius: 14,
                  background: active ? 'rgba(23,233,255,0.12)' : 'rgba(255,255,255,0.04)',
                  border: active ? '1px solid rgba(23,233,255,0.3)' : '1px solid rgba(255,255,255,0.08)'
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: '#fffde8', fontWeight: 800, fontSize: 14 }}>{item.short}</div>
                  <div style={{ color: 'rgba(255,253,232,0.66)', fontSize: 12, marginTop: 2 }}>{item.title}</div>
                </div>
                <div style={{ color: active ? '#17e9ff' : 'rgba(255,253,232,0.6)', fontSize: 12, fontWeight: 700 }}>
                  {active ? meta.theme : item.theme}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
