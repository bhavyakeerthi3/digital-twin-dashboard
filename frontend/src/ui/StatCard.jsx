// ui/StatCard.jsx — KPI metric card
// Props: label, value, subtitle, trend (+/-/null)

export default function StatCard({ label, value, subtitle, trend, icon }) {
  const trendColor = trend === 'up' ? '#16A34A' : trend === 'down' ? '#DC2626' : '#6B7280';

  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid #E5E7EB',
      borderRadius: 12,
      padding: '20px 24px',
      boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      {/* Label */}
      <span style={{
        fontSize: 11,
        fontWeight: 600,
        color: '#6B7280',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
      }}>
        {label}
      </span>

      {/* Value */}
      <span style={{
        fontSize: 28,
        fontWeight: 700,
        color: '#111827',
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '-0.5px',
        lineHeight: 1.15,
      }}>
        {value ?? '—'}
      </span>

      {/* Subtitle */}
      {subtitle && (
        <span style={{ fontSize: 12, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 4 }}>
          {trend === 'up' && <span style={{ color: '#16A34A', fontWeight: 600 }}>↑</span>}
          {trend === 'down' && <span style={{ color: '#DC2626', fontWeight: 600 }}>↓</span>}
          {subtitle}
        </span>
      )}
    </div>
  );
}
