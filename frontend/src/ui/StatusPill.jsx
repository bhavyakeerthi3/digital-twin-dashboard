// ui/StatusPill.jsx — Rounded status badge component
// Props: type = "online" | "warning" | "critical" | "normal", text: string

const PILL_STYLES = {
  online:   { color: '#16A34A', background: '#F0FDF4', border: '1px solid #BBF7D0' },
  normal:   { color: '#16A34A', background: '#F0FDF4', border: '1px solid #BBF7D0' },
  warning:  { color: '#D97706', background: '#FFFBEB', border: '1px solid #FDE68A' },
  critical: { color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA' },
  idle:     { color: '#6B7280', background: '#F3F4F6', border: '1px solid #E5E7EB' },
};

export default function StatusPill({ type = 'normal', text }) {
  const s = PILL_STYLES[type] ?? PILL_STYLES.idle;
  return (
    <span style={{
      ...s,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: '2px 10px',
      borderRadius: 9999,
      fontSize: 12,
      fontWeight: 500,
      letterSpacing: '0.01em',
      whiteSpace: 'nowrap',
    }}>
      {/* Dot */}
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: s.color, flexShrink: 0,
      }} />
      {text}
    </span>
  );
}
