// dashboard/HealthDonut.jsx — Recharts donut chart for health distribution
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = {
  Healthy:  '#16A34A',
  Warning:  '#D97706',
  Critical: '#DC2626',
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#FFFFFF', border: '1px solid #E5E7EB',
      borderRadius: 8, padding: '8px 12px',
      boxShadow: '0 4px 6px rgba(0,0,0,0.07)', fontSize: 12,
    }}>
      <strong>{payload[0].name}</strong>: {payload[0].value} node{payload[0].value !== 1 ? 's' : ''}
    </div>
  );
};

export default function HealthDonut({ nodes = [] }) {
  const counts = { Healthy: 0, Warning: 0, Critical: 0 };
  nodes.forEach(n => {
    const h = n.health_score ?? 50;
    if (h >= 70)      counts.Healthy++;
    else if (h >= 40) counts.Warning++;
    else              counts.Critical++;
  });

  const data = Object.entries(counts)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));

  // If no data yet, show a placeholder
  const chartData = data.length ? data : [{ name: 'Loading', value: 1 }];
  const isLoading = !data.length;

  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid #E5E7EB',
      borderRadius: 12,
      boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)',
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Health Distribution</div>
        <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Across {nodes.length} PLC nodes</div>
      </div>

      {/* Chart + Legend side by side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1 }}>
        <ResponsiveContainer width={130} height={130}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%" cy="50%"
              innerRadius={38} outerRadius={58}
              paddingAngle={3}
              dataKey="value"
              strokeWidth={0}
            >
              {chartData.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={isLoading ? '#E5E7EB' : (COLORS[entry.name] ?? '#9CA3AF')}
                />
              ))}
            </Pie>
            {!isLoading && <Tooltip content={<CustomTooltip />} />}
          </PieChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Object.entries(COLORS).map(([label, color]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>{label}</span>
              <span style={{
                marginLeft: 'auto', paddingLeft: 12,
                fontSize: 13, fontWeight: 700, color: '#111827',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {counts[label]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
