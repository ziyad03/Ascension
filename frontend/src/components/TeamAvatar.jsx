import { initialsFromName } from './teamIdentity';

export default function TeamAvatar({
  name,
  avatar,
  color = '#17e9ff',
  size = 48,
  tag = ''
}) {
  const initials = tag || initialsFromName(name);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        flexShrink: 0,
        background: `linear-gradient(135deg, ${color}, rgba(15,23,42,0.92))`,
        display: 'grid',
        placeItems: 'center',
        border: '2px solid rgba(255,255,255,0.16)',
        boxShadow: '0 10px 24px rgba(15,23,42,0.26)'
      }}
    >
      {avatar ? (
        <img
          src={avatar}
          alt={name || 'Team avatar'}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <span
          style={{
            fontFamily: "'Syne', sans-serif",
            fontWeight: 800,
            letterSpacing: '0.08em',
            color: '#f8fafc',
            fontSize: Math.max(12, size * 0.28)
          }}
        >
          {initials}
        </span>
      )}
    </div>
  );
}
