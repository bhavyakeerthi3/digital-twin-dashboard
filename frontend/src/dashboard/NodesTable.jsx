// dashboard/NodesTable.jsx — Clean enterprise-grade nodes data table
import StatusPill from '../ui/StatusPill.jsx';

function getStatusType(node) {
  const flag = node.anomaly_flag ?? 'NORMAL';
  if (flag === 'CRITICAL') return 'critical';
  if (flag === 'WARNING')  return 'warning';
  return 'online';
}

function fmt(val, decimals = 1, suffix = '') {
  if (val == null) return '—';
  return `${Number(val).toFixed(decimals)}${suffix}`;
}

const TH = ({ children, align = 'left' }) => (
  <th style={{
    padding: '10px 16px',
    textAlign: align,
    fontSize: 11,
    fontWeight: 600,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    borderBottom: '1px solid #E5E7EB',
    background: '#FAFAFA',
    whiteSpace: 'nowrap',
  }}>
    {children}
  </th>
);

const TD = ({ children, align = 'left', mono = false }) => (
  <td style={{
    padding: '12px 16px',
    textAlign: align,
    fontSize: 13,
    color: '#374151',
    borderBottom: '1px solid #F3F4F6',
    fontVariantNumeric: mono ? 'tabular-nums' : undefined,
    whiteSpace: 'nowrap',
  }}>
    {children}
  </td>
);

export default function NodesTable({ nodes = [], activeNodeId, onSelectNode }) {
  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid #E5E7EB',
      borderRadius: 12,
      boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)',
      overflow: 'hidden',
    }}>
      {/* Card header */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid #E5E7EB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>PLC Nodes</span>
          <span style={{
            marginLeft: 8,
            fontSize: 12, fontWeight: 500, color: '#6B7280',
            background: '#F3F4F6', borderRadius: 99,
            padding: '1px 8px',
          }}>
            {nodes.length} nodes
          </span>
        </div>
        <div style={{ fontSize: 12, color: '#6B7280' }}>
          Modbus / GSM · 1Hz polling
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <TH>Node</TH>
              <TH>Status</TH>
              <TH align="right">Temperature</TH>
              <TH align="right">Latency</TH>
              <TH align="right">Health Score</TH>
              <TH>ML Engine</TH>
              <TH>Register</TH>
            </tr>
          </thead>
          <tbody>
            {nodes.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                  Waiting for telemetry stream...
                </td>
              </tr>
            )}
            {nodes.map(node => {
              const isActive = node.node_id === activeNodeId;
              const statusType = getStatusType(node);
              return (
                <tr
                  key={node.node_id}
                  onClick={() => onSelectNode?.(node.node_id)}
                  style={{
                    background: isActive ? '#F0F9FF' : 'transparent',
                    cursor: 'pointer',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#F9FAFB'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                >
                  <TD>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {isActive && (
                        <span style={{
                          width: 3, height: 16, background: '#2563EB',
                          borderRadius: 2, flexShrink: 0,
                        }} />
                      )}
                      <div>
                        <div style={{ fontWeight: 500, color: '#111827', fontSize: 13 }}>
                          {node.node_name ?? node.node_id}
                        </div>
                        <div style={{ fontSize: 11, color: '#9CA3AF' }}>{node.node_id}</div>
                      </div>
                    </div>
                  </TD>
                  <TD>
                    <StatusPill
                      type={statusType}
                      text={node.anomaly_flag ?? 'NORMAL'}
                    />
                  </TD>
                  <TD align="right" mono>{fmt(node.temperature, 1, '°C')}</TD>
                  <TD align="right" mono>{fmt(node.latency_ms, 0, ' ms')}</TD>
                  <TD align="right" mono>
                    <span style={{
                      fontWeight: 600,
                      color: (node.health_score ?? 50) >= 70 ? '#16A34A'
                           : (node.health_score ?? 50) >= 40 ? '#D97706'
                           : '#DC2626',
                    }}>
                      {fmt(node.health_score, 1, ' / 100')}
                    </span>
                  </TD>
                  <TD>
                    <span style={{
                      fontSize: 11, color: '#6B7280',
                      background: '#F3F4F6',
                      border: '1px solid #E5E7EB',
                      borderRadius: 6, padding: '2px 8px',
                      fontFamily: 'monospace',
                    }}>
                      MTL+ONNX
                    </span>
                  </TD>
                  <TD>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#6B7280' }}>
                      {node.register ?? '—'}
                    </span>
                  </TD>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
