import React from 'react';
import { AlertTriangle, TrendingDown, TrendingUp, Minus } from 'lucide-react';

const COLORS = {
  sky:     { icon: '#0ea5e9', bg: 'rgba(14,165,233,0.1)',  border: 'rgba(14,165,233,0.2)'  },
  blue:    { icon: '#60a5fa', bg: 'rgba(96,165,250,0.1)',  border: 'rgba(96,165,250,0.2)'  },
  rose:    { icon: '#fb7185', bg: 'rgba(251,113,133,0.1)', border: 'rgba(251,113,133,0.2)' },
  indigo:  { icon: '#818cf8', bg: 'rgba(129,140,248,0.1)', border: 'rgba(129,140,248,0.2)' },
  amber:   { icon: '#fbbf24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.2)'  },
  emerald: { icon: '#34d399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.2)'  },
  violet:  { icon: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.2)' },
};

export function StatCard({ icon, title, value, sub, trend = 'neutral', color = 'sky' }) {
  const c = COLORS[color];
  return (
    <div className="stat-card">
      <div className="stat-icon-wrap" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
        {React.cloneElement(icon, { size: 16, color: c.icon })}
      </div>
      <div className="stat-label">{title}</div>
      <div className="stat-value" style={{ color: c.icon }}>{value}</div>
      <div className="stat-sub">{sub}</div>
      {trend === 'bad' && (
        <div className="stat-badge" style={{ background: 'rgba(244,63,94,0.12)' }}>
          <AlertTriangle size={12} color="#fb7185" />
        </div>
      )}
      {trend === 'good' && (
        <div className="stat-badge" style={{ background: 'rgba(52,211,153,0.12)' }}>
          <TrendingDown size={12} color="#34d399" />
        </div>
      )}
    </div>
  );
}

export function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#0a1628', border: '1px solid #1e293b',
      borderRadius: 10, padding: '10px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    }}>
      <p style={{ fontSize: 9, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{label}</p>
      {payload.map((e, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, marginBottom: 4 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: e.color, fontWeight: 600 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: e.color, display: 'inline-block' }} />
            {e.name}
          </span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 700, color: '#e2e8f0' }}>
            {typeof e.value === 'number' ? e.value.toFixed(1) : e.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function LegendChip({ color, label }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: 'inline-block' }} />
      {label}
    </span>
  );
}
