import { getTowerFloors, getTowerPhase, getTowerProgress } from './towerModel';

export default function TowerRail({
  phase = 'phase1',
  title = 'Tournament Tower',
  subtitle = 'Enter. Compete. Climb.',
  compact = false
}) {
  const meta = getTowerPhase(phase);
  const floors = getTowerFloors();
  const progress = getTowerProgress(phase);

  return (
    <div
      style={{
        position: 'relative',
        padding: compact ? '1rem' : '1.4rem',
        borderRadius: 24,
        background: 'rgba(8,14,28,0.72)',
        border: '1px solid rgba(255,255,255,0.08)',
        overflow: 'hidden',
        minHeight: compact ? 260 : 420
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 50% 0%, rgba(251,191,36,0.12), transparent 32%), radial-gradient(circle at 50% 100%, rgba(99,102,241,0.12), transparent 36%)',
          pointerEvents: 'none'
        }}
      />

      <div style={{ position: 'relative', zIndex: 1, marginBottom: compact ? 14 : 20 }}>
        <div style={{ color: '#a5f3fc', fontSize: 11, letterSpacing: '0.24em', textTransform: 'uppercase', fontWeight: 700 }}>
          The Tournament Tower
        </div>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: compact ? 22 : 28, fontWeight: 800, color: '#f8fafc', marginTop: 6 }}>
          {title}
        </div>
        <div style={{ color: 'rgba(226,232,240,0.64)', fontSize: 14, marginTop: 6, maxWidth: 260 }}>
          {subtitle}
        </div>
      </div>

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'grid',
          gridTemplateColumns: compact ? '58px 1fr' : '72px 1fr',
          gap: compact ? 12 : 16,
          alignItems: 'stretch'
        }}
      >
        <div style={{ position: 'relative', minHeight: compact ? 180 : 300 }}>
          <div
            style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              top: 16,
              bottom: 16,
              width: compact ? 10 : 14,
              borderRadius: 999,
              background: 'linear-gradient(180deg, rgba(251,191,36,0.45), rgba(99,102,241,0.65))',
              boxShadow: '0 0 28px rgba(99,102,241,0.24)'
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: '50%',
              transform: 'translate(-50%, 0)',
              bottom: `calc(${progress * 100}% + 2px)`,
              width: compact ? 26 : 32,
              height: compact ? 26 : 32,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #f8fafc, #67e8f9)',
              boxShadow: '0 0 30px rgba(103,232,249,0.55)',
              transition: 'bottom 0.7s cubic-bezier(.22,1,.36,1)'
            }}
          />
        </div>

        <div style={{ display: 'grid', gap: compact ? 10 : 14 }}>
          {floors.slice().reverse().map((floor) => {
            const active = floor.floor === meta.floor;
            const reached = floor.floor <= meta.floor;

            return (
              <div
                key={floor.key}
                style={{
                  padding: compact ? '0.8rem 0.9rem' : '1rem 1.05rem',
                  borderRadius: 18,
                  border: active
                    ? '1px solid rgba(103,232,249,0.32)'
                    : '1px solid rgba(255,255,255,0.07)',
                  background: active
                    ? 'linear-gradient(135deg, rgba(14,165,233,0.16), rgba(124,58,237,0.12))'
                    : reached
                      ? 'rgba(255,255,255,0.05)'
                      : 'rgba(255,255,255,0.025)',
                  opacity: reached ? 1 : 0.55,
                  transform: active ? 'translateX(2px)' : 'translateX(0)',
                  transition: 'all 0.35s ease'
                }}
              >
                <div style={{ color: active ? '#a5f3fc' : 'rgba(226,232,240,0.58)', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700 }}>
                  {floor.short}
                </div>
                <div style={{ fontFamily: "'Syne', sans-serif", color: '#f8fafc', fontWeight: 800, fontSize: compact ? 15 : 17, marginTop: 4 }}>
                  {floor.title}
                </div>
                <div style={{ color: 'rgba(226,232,240,0.62)', fontSize: 13, marginTop: 3 }}>
                  {floor.theme}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
