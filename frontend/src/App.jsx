import { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from './layout/Sidebar.jsx';
import StatCard from './ui/StatCard.jsx';
import StatusPill from './ui/StatusPill.jsx';
import TelemetryLineChart from './dashboard/TelemetryLineChart.jsx';
import HealthDonut from './dashboard/HealthDonut.jsx';
import NodesTable from './dashboard/NodesTable.jsx';
import AIMLAnalysisPage from './dashboard/AIMLAnalysisPage.jsx';

const WS_URL   = 'ws://localhost:8000/telemetry';
const API_BASE = 'http://localhost:8000';
const MAX_HISTORY = 60;

function fmt(v, d = 1, s = '') {
  return v != null && !isNaN(v) ? `${Number(v).toFixed(d)}${s}` : '—';
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE: Node Management
// ─────────────────────────────────────────────────────────────────────────────
function NodeManagementPage({ nodes, activeNodeId, onSelectNode, noise, onNoiseChange }) {
  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>Node Management</h1>
        <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
          Configure and monitor individual PLC nodes on the Modbus / GSM network.
        </p>
      </div>

      {/* Node cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {nodes.map(node => {
          const isActive = node.node_id === activeNodeId;
          const h = node.health_score ?? 50;
          const statusType = node.anomaly_flag === 'CRITICAL' ? 'critical'
                           : node.anomaly_flag === 'WARNING'  ? 'warning' : 'online';
          return (
            <div
              key={node.node_id}
              onClick={() => onSelectNode(node.node_id)}
              style={{
                background: '#FFFFFF',
                border: `2px solid ${isActive ? '#2563EB' : '#E5E7EB'}`,
                borderRadius: 12,
                padding: 20,
                cursor: 'pointer',
                boxShadow: isActive ? '0 0 0 3px #DBEAFE' : '0 1px 2px rgba(0,0,0,0.05)',
                transition: 'all 0.15s',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{node.node_name}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', fontFamily: 'monospace', marginTop: 2 }}>
                    {node.node_id} · Reg {node.register ?? '—'}
                  </div>
                </div>
                <StatusPill type={statusType} text={node.anomaly_flag ?? 'NORMAL'} />
              </div>

              {/* Metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Temperature', value: fmt(node.temperature, 1, '°C') },
                  { label: 'Latency',     value: fmt(node.latency_ms,  0, ' ms') },
                  { label: 'Health',      value: fmt(h, 1, '%') },
                  { label: 'Status',      value: node.anomaly_flag ?? 'NORMAL' },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: '#F9FAFB', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                      {label}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Health bar */}
              <div style={{ marginTop: 12 }}>
                <div style={{ height: 4, background: '#F3F4F6', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 2,
                    width: `${Math.min(100, h)}%`,
                    background: h >= 70 ? '#16A34A' : h >= 40 ? '#D97706' : '#DC2626',
                    transition: 'width 0.5s ease',
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: '#9CA3AF' }}>
                  <span>Health Score</span><span>{fmt(h, 1)}%</span>
                </div>
              </div>

              {isActive && (
                <div style={{ marginTop: 10, fontSize: 12, color: '#2563EB', fontWeight: 500 }}>
                  ● Active monitoring node
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Network Controls */}
      <div style={{
        background: '#FFFFFF', border: '1px solid #E5E7EB',
        borderRadius: 12, padding: '20px 24px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 16 }}>
          Network Impairment Controls
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>GSM Noise Level</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{noise}%</span>
            </div>
            <input
              type="range" min={0} max={100} value={noise}
              onChange={e => onNoiseChange(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#2563EB' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
              <span>0% (Clean)</span><span>50% (Noisy)</span><span>100% (Critical)</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {[0, 25, 50, 75, 100].map(v => (
              <button key={v} onClick={() => onNoiseChange(v)} style={{
                padding: '6px 12px', borderRadius: 8,
                border: `1px solid ${noise === v ? '#BFDBFE' : '#E5E7EB'}`,
                background: noise === v ? '#EFF6FF' : '#FAFAFA',
                fontSize: 12, fontWeight: 500,
                color: noise === v ? '#2563EB' : '#6B7280', cursor: 'pointer',
              }}>
                {v}%
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE: Alerts
// ─────────────────────────────────────────────────────────────────────────────
function AlertsPage({ alerts }) {
  const levelStyle = {
    CRITICAL: { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', pill: 'critical' },
    WARNING:  { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', pill: 'warning'  },
    INFO:     { color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', pill: 'online'   },
  };

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>Alerts</h1>
        <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
          Real-time anomaly events from the MTL+ONNX detection engine.
        </p>
      </div>

      {/* Summary pills */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {['CRITICAL','WARNING','INFO'].map(lvl => {
          const count = alerts.filter(a => a.level === lvl).length;
          const s = levelStyle[lvl];
          return (
            <div key={lvl} style={{
              background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12, padding: '16px 20px',
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: s.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{lvl}</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>{count}</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>events this session</div>
            </div>
          );
        })}
      </div>

      {/* Alert log table */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #E5E7EB', fontSize: 14, fontWeight: 600, color: '#111827' }}>
          Event Log
        </div>
        {alerts.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
            No alerts yet. Monitoring in progress...
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Time', 'Level', 'Node', 'Event', 'Health'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #E5E7EB', background: '#FAFAFA' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...alerts].reverse().map((a, i) => {
                const s = levelStyle[a.level] ?? levelStyle.INFO;
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: '#6B7280', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{a.time}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <StatusPill type={s.pill} text={a.level} />
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 13, color: '#374151', fontWeight: 500 }}>{a.node}</td>
                    <td style={{ padding: '10px 16px', fontSize: 13, color: '#374151' }}>{a.message}</td>
                    <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{a.health != null ? `${a.health.toFixed(1)}%` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE: Settings
// ─────────────────────────────────────────────────────────────────────────────
function SettingsPage({ noise, onNoiseChange, mlActive, onToggleML }) {
  const Row = ({ label, desc, children }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid #F3F4F6' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>{label}</div>
        <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{desc}</div>
      </div>
      <div style={{ flexShrink: 0, marginLeft: 24 }}>{children}</div>
    </div>
  );

  const Section = ({ title, children }) => (
    <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, padding: '0 24px', marginBottom: 24, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
      <div style={{ padding: '16px 0', borderBottom: '1px solid #E5E7EB', fontSize: 14, fontWeight: 600, color: '#111827' }}>{title}</div>
      {children}
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>Settings</h1>
        <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>Configure the Digital Twin monitoring platform.</p>
      </div>

      <Section title="ML Optimization Engine">
        <Row label="Closed-Loop ML Control" desc="Automatically adjust polling rate based on ONNX health predictions.">
          <button onClick={onToggleML} style={{
            padding: '6px 16px', borderRadius: 8, cursor: 'pointer',
            border: `1px solid ${mlActive ? '#BFDBFE' : '#E5E7EB'}`,
            background: mlActive ? '#EFF6FF' : '#F9FAFB',
            color: mlActive ? '#2563EB' : '#374151',
            fontSize: 13, fontWeight: 500,
          }}>
            {mlActive ? '⚡ Enabled' : 'Disabled'}
          </button>
        </Row>
        <Row label="Inference Engine" desc="Runtime used for forward-pass predictions.">
          <span style={{ fontSize: 13, fontFamily: 'monospace', color: '#6B7280', background: '#F3F4F6', padding: '4px 10px', borderRadius: 6 }}>
            ONNX Runtime v1.24.3
          </span>
        </Row>
        <Row label="Model Architecture" desc="Unified multi-task backbone with 3 output heads.">
          <span style={{ fontSize: 13, fontFamily: 'monospace', color: '#6B7280', background: '#F3F4F6', padding: '4px 10px', borderRadius: 6 }}>
            MTL · Conv1D + MHA
          </span>
        </Row>
        <Row label="Speedup vs PyTorch" desc="Measured over 200 inference runs on CPU.">
          <span style={{ fontSize: 14, fontWeight: 700, color: '#16A34A' }}>11.4×</span>
        </Row>
      </Section>

      <Section title="Network Simulation">
        <Row label="GSM Noise Level" desc={`Current injection: ${noise}% — affects latency, jitter, and packet loss.`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input type="range" min={0} max={100} value={noise}
              onChange={e => onNoiseChange(Number(e.target.value))}
              style={{ width: 140, accentColor: '#2563EB' }} />
            <span style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#111827', minWidth: 36 }}>
              {noise}%
            </span>
          </div>
        </Row>
        <Row label="Protocol" desc="Industrial communication standard.">
          <span style={{ fontSize: 13, fontFamily: 'monospace', color: '#6B7280', background: '#F3F4F6', padding: '4px 10px', borderRadius: 6 }}>
            Modbus over GSM
          </span>
        </Row>
        <Row label="Telemetry Frequency" desc="WebSocket push rate.">
          <span style={{ fontSize: 13, fontFamily: 'monospace', color: '#6B7280', background: '#F3F4F6', padding: '4px 10px', borderRadius: 6 }}>
            1 Hz
          </span>
        </Row>
      </Section>

      <Section title="Thresholds">
        <Row label="PER Slowdown Trigger" desc="Polling slows to 2s only when PER exceeds this AND health is below 60%.">
          <span style={{ fontSize: 14, fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>15%</span>
        </Row>
        <Row label="Critical Temperature" desc="Anomaly flag triggers above this threshold.">
          <span style={{ fontSize: 14, fontWeight: 700, color: '#DC2626', fontVariantNumeric: 'tabular-nums' }}>35°C</span>
        </Row>
        <Row label="Warning Temperature" desc="Warning flag triggers above this threshold.">
          <span style={{ fontSize: 14, fontWeight: 700, color: '#D97706', fontVariantNumeric: 'tabular-nums' }}>30°C</span>
        </Row>
        <Row label="Critical Latency" desc="Anomaly flag triggers above this threshold.">
          <span style={{ fontSize: 14, fontWeight: 700, color: '#DC2626', fontVariantNumeric: 'tabular-nums' }}>300 ms</span>
        </Row>
      </Section>

      <Section title="System Information">
        <Row label="Backend" desc="FastAPI async WebSocket server."><span style={{ fontSize: 13, color: '#6B7280' }}>http://localhost:8000</span></Row>
        <Row label="Frontend" desc="React 18 + Vite."><span style={{ fontSize: 13, color: '#6B7280' }}>http://localhost:5173</span></Row>
        <Row label="ML Models" desc="Trained on 5,000 synthetic samples."><span style={{ fontSize: 13, color: '#6B7280' }}>Best Val Loss: 1.9593</span></Row>
      </Section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE: Dashboard (main)
// ─────────────────────────────────────────────────────────────────────────────
function DashboardPage({ metrics, history, nodes, activeNodeId, onSelectNode, noise, onNoiseChange, mlActive, onToggleML, connected, onExportCSV }) {
  const health   = metrics?.health_score;
  const per      = metrics?.predicted_per;
  const failRisk = metrics?.failure_probability;
  const inferMs  = metrics?.inference_ms;
  const bufFill  = metrics?.buffer_fill ?? 0;
  const warming  = bufFill < 20;
  const pollInt  = metrics?.polling_interval;

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', lineHeight: 1.3 }}>System Overview</h1>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
            Predictive Digital Twin · Modbus / GSM · MTL+ONNX inference engine
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <StatusPill type={connected ? 'online' : 'critical'} text={connected ? 'Live' : 'Disconnected'} />
          <button onClick={onExportCSV} style={{
            padding: '6px 14px', borderRadius: 8, border: '1px solid #E5E7EB',
            background: '#FFFFFF', fontSize: 13, fontWeight: 500, color: '#374151',
            cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          }}>
            ↓ Export CSV
          </button>
          <button onClick={onToggleML} style={{
            padding: '6px 14px', borderRadius: 8,
            border: `1px solid ${mlActive ? '#BFDBFE' : '#E5E7EB'}`,
            background: mlActive ? '#EFF6FF' : '#FFFFFF',
            fontSize: 13, fontWeight: 500,
            color: mlActive ? '#2563EB' : '#374151',
            cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          }}>
            {mlActive ? '⚡ ML Active' : 'Enable ML'}
          </button>
        </div>
      </div>

      {/* Warm-up notice */}
      {warming && connected && (
        <div style={{ padding: '10px 16px', marginBottom: 20, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, fontSize: 13, color: '#92400E', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>⏳</span>
          <span>Warming up ONNX window — collecting telemetry ({bufFill}/20 ticks). Using fallback estimates.</span>
        </div>
      )}

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard label="System Health" value={health != null ? `${fmt(health, 1)}%` : '—'} subtitle="MTL sigmoid health head" trend={health != null ? (health >= 70 ? 'up' : 'down') : null} />
        <StatCard label="Predicted PER"  value={per != null ? `${fmt(per, 2)}%` : '—'}    subtitle="MTL conv-backbone → PER head" trend={per != null ? (per < 5 ? 'up' : 'down') : null} />
        <StatCard label="Failure Risk"   value={failRisk != null ? `${fmt(failRisk, 1)}%` : '—'} subtitle="Inverse of health score" trend={failRisk != null ? (failRisk < 30 ? 'up' : 'down') : null} />
        <StatCard label="ONNX Latency"  value={inferMs != null && inferMs > 0 ? `${fmt(inferMs, 2)} ms` : '—'} subtitle="11.4× faster than PyTorch" trend={inferMs != null && inferMs > 0 ? 'up' : null} />
      </div>

      {/* Chart Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 24 }}>
        <TelemetryLineChart data={history} />
        <HealthDonut nodes={nodes} />
      </div>

      {/* Controls Card */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.05)', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 24, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 200 }}>
          <div style={{ minWidth: 100 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>GSM Noise</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{noise}%</div>
          </div>
          <input type="range" min={0} max={100} value={noise} onChange={e => onNoiseChange(Number(e.target.value))} style={{ flex: 1, accentColor: '#2563EB', height: 4, cursor: 'pointer' }} />
          <div style={{ display: 'flex', gap: 6 }}>
            {[0, 25, 50, 75, 100].map(v => (
              <button key={v} onClick={() => onNoiseChange(v)} style={{
                padding: '3px 8px', borderRadius: 6,
                border: `1px solid ${noise === v ? '#BFDBFE' : '#E5E7EB'}`,
                background: noise === v ? '#EFF6FF' : '#FAFAFA',
                fontSize: 11, fontWeight: 500,
                color: noise === v ? '#2563EB' : '#6B7280', cursor: 'pointer',
              }}>{v}%</button>
            ))}
          </div>
        </div>
        <div style={{ width: 1, height: 40, background: '#E5E7EB', flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Polling Rate</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
            {pollInt != null ? `${fmt(pollInt, 1)}s` : '—'}
          </div>
        </div>
        {mlActive && metrics?.tuning_action && (
          <>
            <div style={{ width: 1, height: 40, background: '#E5E7EB', flexShrink: 0 }} />
            <div style={{ fontSize: 12, color: '#6B7280', fontStyle: 'italic', maxWidth: 260 }}>{metrics.tuning_action}</div>
          </>
        )}
      </div>

      {/* Nodes Table */}
      <NodesTable nodes={nodes} activeNodeId={activeNodeId} onSelectNode={onSelectNode} />

      {/* Footer */}
      <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: '#9CA3AF' }}>Digital Twin v2.0 · MTL+ONNX · {history.length} ticks recorded</span>
        <span style={{ fontSize: 12, color: '#9CA3AF' }}>{metrics?.ml_models?.engine ?? 'ONNX Runtime'}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [metrics, setMetrics]       = useState(null);
  const [history, setHistory]       = useState([]);
  const [nodes, setNodes]           = useState([]);
  const [alerts, setAlerts]         = useState([]);
  const [activeNav, setActiveNav]   = useState('dashboard');
  const [activeNode, setActiveNode] = useState('node_a');
  const [noise, setNoise]           = useState(10);
  const [mlActive, setMlActive]     = useState(false);
  const [connected, setConnected]   = useState(false);
  const wsRef   = useRef(null);
  const tickRef = useRef(0);
  const prevFlagRef = useRef({});

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    ws.onopen  = () => setConnected(true);
    ws.onclose = () => { setConnected(false); setTimeout(connect, 2000); };
    ws.onerror = () => ws.close();
    ws.onmessage = ({ data }) => {
      const m = JSON.parse(data);
      setMetrics(m);
      setNodes(m.nodes_summary ?? []);
      tickRef.current += 1;

      // History for charts
      setHistory(h => {
        const pt = { t: tickRef.current, latency: +(m.latency_ms ?? 0).toFixed(1), per: +(m.predicted_per ?? 0).toFixed(2) };
        return [...h.slice(-MAX_HISTORY + 1), pt];
      });

      // Auto-generate alerts from anomaly flag changes
      const nowTime = new Date().toLocaleTimeString();
      const summary = m.nodes_summary ?? [];
      summary.forEach(node => {
        const prev = prevFlagRef.current[node.node_id];
        const curr = node.anomaly_flag ?? 'NORMAL';
        if (curr !== prev) {
          const level = curr === 'CRITICAL' ? 'CRITICAL' : curr === 'WARNING' ? 'WARNING' : 'INFO';
          const message = curr === 'NORMAL'
            ? `${node.node_name} returned to normal operation`
            : `${node.node_name} triggered ${curr} — temp ${fmt(node.temperature, 1)}°C`;
          setAlerts(a => [...a.slice(-99), {
            time: nowTime, level, node: node.node_name,
            message, health: node.health_score,
          }]);
          prevFlagRef.current[node.node_id] = curr;
        }
      });
    };
  }, []);

  useEffect(() => { connect(); return () => wsRef.current?.close(); }, [connect]);

  const setNoiseAPI = async (v) => {
    setNoise(v);
    await fetch(`${API_BASE}/set-noise?value=${v}`, { method: 'POST' }).catch(() => {});
  };
  const toggleML = async () => {
    const next = !mlActive;
    setMlActive(next);
    await fetch(`${API_BASE}/toggle-ml?active=${next}`, { method: 'POST' }).catch(() => {});
  };
  const selectNode = async (id) => {
    setActiveNode(id);
    await fetch(`${API_BASE}/set-node?node_id=${id}`, { method: 'POST' }).catch(() => {});
  };
  const exportCSV = () => {
    if (!history.length) return;
    const rows = history.map(h => [h.t, h.latency, h.per].join(','));
    const blob = new Blob([['tick,latency_ms,predicted_per', ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'telemetry.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const sharedProps = { noise, onNoiseChange: setNoiseAPI, mlActive, onToggleML: toggleML };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#F9FAFB' }}>
      <Sidebar active={activeNav} onNavigate={setActiveNav} />
      <main style={{ flex: 1, overflow: 'auto', padding: 32, minWidth: 0 }}>
        {activeNav === 'dashboard' && (
          <DashboardPage
            metrics={metrics} history={history} nodes={nodes}
            activeNodeId={activeNode} onSelectNode={selectNode}
            connected={connected} onExportCSV={exportCSV}
            {...sharedProps}
          />
        )}
        {activeNav === 'nodes' && (
          <NodeManagementPage
            nodes={nodes} activeNodeId={activeNode} onSelectNode={selectNode}
            {...sharedProps}
          />
        )}
        {activeNav === 'alerts' && (
          <AlertsPage alerts={alerts} />
        )}
        {activeNav === 'analysis' && (
          <AIMLAnalysisPage metrics={metrics} />
        )}
        {activeNav === 'settings' && (
          <SettingsPage {...sharedProps} />
        )}
      </main>
    </div>
  );
}
