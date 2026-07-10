import React from 'react';

export function HealthRing({ score }) {
  const r = 32, circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : score >= 40 ? '#f97316' : '#f43f5e';
  const label = score >= 80 ? 'GOOD' : score >= 60 ? 'FAIR' : 'POOR';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ position: 'relative', width: 72, height: 72 }}>
        <svg width="72" height="72" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="36" cy="36" r={r} fill="none" stroke="#1e293b" strokeWidth="5" />
          <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="5"
            strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1.2s ease, stroke 0.5s ease' }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 17, fontWeight: 900, color, lineHeight: 1 }}>{Math.round(score)}</span>
        </div>
      </div>
      <div>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: '#475569', textTransform: 'uppercase', marginBottom: 2 }}>System Health</div>
        <div style={{ fontSize: 13, fontWeight: 800, color }}>{label}</div>
      </div>
    </div>
  );
}

export function AlertsPortal({ alerts, onDismiss }) {
  if (!alerts?.length) return null;
  return (
    <div className="alerts-portal">
      {alerts.map(a => (
        <div key={a.id} onClick={() => onDismiss(a.id)}
          className={`alert-toast ${a.severity === 2 ? 'critical' : 'warning'}`}>
          <div style={{
            width: 32, height: 32, borderRadius: 10, flexShrink: 0,
            background: a.severity === 2 ? 'rgba(244,63,94,0.2)' : 'rgba(245,158,11,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <span style={{ fontSize: 14 }}>{a.severity === 2 ? '🚨' : '⚠️'}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
              color: a.severity === 2 ? '#fb7185' : '#fbbf24', marginBottom: 3 }}>
              {a.severity === 2 ? 'Critical Anomaly Detected' : 'Warning — Elevated Readings'}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {a.message}
            </div>
          </div>
          <span style={{ fontSize: 16, color: '#334155', flexShrink: 0, alignSelf: 'flex-start' }}>×</span>
        </div>
      ))}
    </div>
  );
}

export function NodesGrid({ nodes }) {
  if (!nodes?.length) return null;
  const getColor = (flag) => flag === 'CRITICAL' ? '#f43f5e' : flag === 'WARNING' ? '#f59e0b' : '#10b981';
  const getHealthColor = (s) => s >= 80 ? '#10b981' : s >= 60 ? '#f59e0b' : '#f43f5e';
  return (
    <div className="node-grid">
      {nodes.map(n => (
        <div key={n.node_id} className={`node-card ${n.anomaly_flag?.toLowerCase?.() || ''}`}>
          <div className="node-name">
            {n.node_name}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50%',
                background: getColor(n.anomaly_flag),
                boxShadow: `0 0 6px ${getColor(n.anomaly_flag)}`,
                animation: n.anomaly_flag !== 'NORMAL' ? 'pulse-dot 1.5s infinite' : 'none'
              }} />
              <span style={{ fontSize: 8, fontWeight: 700, color: getColor(n.anomaly_flag), letterSpacing: '0.06em' }}>
                {n.anomaly_flag}
              </span>
            </div>
          </div>
          <div className="node-metrics">
            {[
              { label: 'TEMP', value: `${n.temperature}°C`, color: '#94a3b8' },
              { label: 'LATENCY', value: `${n.latency_ms}ms`, color: '#94a3b8' },
              { label: 'HEALTH', value: `${n.health_score}`, color: getHealthColor(n.health_score) },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div className="node-metric-label">{label}</div>
                <div className="node-metric-value" style={{ color }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function exportCSV(dataBuffer) {
  if (!dataBuffer?.length) return;
  const headers = ['Time', 'Temperature_C', 'Latency_ms', 'PER_%', 'Failure_Prob_%', 'Health_Score', 'Anomaly'];
  const rows = dataBuffer.map(d =>
    [d.time, d.temperature ?? '', d.latency ?? '', d.per ?? '', d.failureProb ?? '', d.healthScore ?? '', d.anomaly ?? ''].join(',')
  );
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv' })),
    download: `dt_report_${Date.now()}.csv`
  });
  a.click();
  URL.revokeObjectURL(a.href);
}
