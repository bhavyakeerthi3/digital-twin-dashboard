// dashboard/TelemetryLineChart.jsx — Clean Recharts line chart
// Shows latency + PER over the last 60 ticks
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid #E5E7EB',
      borderRadius: 8,
      padding: '8px 12px',
      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)',
      fontSize: 12,
    }}>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color, fontVariantNumeric: 'tabular-nums', marginBottom: 2 }}>
          <span style={{ color: '#6B7280' }}>{p.name}: </span>
          <strong>{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</strong>
          {p.dataKey === 'latency' ? ' ms' : '%'}
        </div>
      ))}
    </div>
  );
};

export default function TelemetryLineChart({ data = [] }) {
  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid #E5E7EB',
      borderRadius: 12,
      boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)',
      padding: '20px 24px',
    }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>
          Telemetry Stream
        </div>
        <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
          Live latency and packet error rate · last 60 ticks
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#F3F4F6"
            vertical={false}
          />
          <XAxis dataKey="t" hide />
          <YAxis
            tick={{ fontSize: 11, fill: '#9CA3AF', fontFamily: 'Inter' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="plainline"
            iconSize={16}
            wrapperStyle={{ fontSize: 12, color: '#6B7280', paddingTop: 12 }}
          />
          <Line
            type="monotone"
            dataKey="latency"
            name="Latency"
            stroke="#3B82F6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
          <Line
            type="monotone"
            dataKey="per"
            name="PER"
            stroke="#F59E0B"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
