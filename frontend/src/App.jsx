import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, 
  Cpu, 
  Signal, 
  Zap, 
  Settings, 
  Terminal,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Play,
  Share2,
  RefreshCw,
  Info
} from 'lucide-react';
import { 
  ComposedChart,
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Area,
  Bar,
  Legend
} from 'recharts';

const API_BASE = "http://localhost:8000";
const WS_URL = "ws://localhost:8000/telemetry";

// Custom Tooltip Component for Premium Feel
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 p-4 rounded-xl shadow-2xl">
        <p className="text-slate-400 text-xs font-bold mb-2 uppercase tracking-widest">{label}</p>
        <div className="space-y-1.5">
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center justify-between gap-8">
              <span className="flex items-center gap-2 text-xs font-medium" style={{ color: entry.color }}>
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
                {entry.name}
              </span>
              <span className="text-slate-100 font-mono text-xs font-bold">
                {entry.value}{entry.unit || (entry.name === 'Latency' ? 'ms' : '%')}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export default function App() {
  const [data, setData] = useState([]);
  const [currentMetrics, setCurrentMetrics] = useState(null);
  const [noise, setNoise] = useState(10);
  const [mlActive, setMlActive] = useState(false);
  const [logs, setLogs] = useState([]);
  const [wsStatus, setWsStatus] = useState("disconnected");
  
  const ws = useRef(null);

  useEffect(() => {
    const connect = () => {
      ws.current = new WebSocket(WS_URL);
      setWsStatus("connecting");

      ws.current.onopen = () => {
        setWsStatus("connected");
        addLog("SYSTEM", "Modbus-Gateway established connection.");
      };

      ws.current.onmessage = (event) => {
        const metrics = JSON.parse(event.data);
        setCurrentMetrics(metrics);
        setData(prev => {
          const newData = [...prev, {
            time: new Date().toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' }),
            latency: metrics.latency_ms,
            per: metrics.predicted_per,
            plc: metrics.temperature
          }].slice(-20); // Longer history
          return newData;
        });

        if (metrics.tuning_action && metrics.tuning_action.includes("Reducing")) {
          addLog("ML TUNER", metrics.tuning_action, "warning");
        }
      };

      ws.current.onclose = () => {
        setWsStatus("disconnected");
        addLog("SYSTEM", "Link lost. Attempting reconnection...");
        setTimeout(connect, 3000);
      };
    };

    connect();
    return () => ws.current?.close();
  }, []);

  const addLog = (comp, msg, type = "info") => {
    setLogs(prev => [{
      id: Date.now(),
      comp,
      msg,
      type,
      time: new Date().toLocaleTimeString()
    }, ...prev].slice(0, 15));
  };

  const handleNoiseChange = async (val) => {
    const noiseVal = parseInt(val);
    setNoise(noiseVal);
    try {
      await fetch(`${API_BASE}/set-noise?value=${noiseVal}`, { method: 'POST' });
    } catch (e) {
      console.error("API Error:", e);
    }
  };

  const toggleML = async () => {
    const newState = !mlActive;
    try {
      await fetch(`${API_BASE}/toggle-ml?active=${newState}`, { method: 'POST' });
      setMlActive(newState);
      addLog("ML ENGINE", `Optimization Loop ${newState ? 'LOCKED' : 'RELEASED'}`);
    } catch (e) {
      console.error("API Error:", e);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] p-6 md:p-10 space-y-8 max-w-7xl mx-auto selection:bg-sky-500/30">
      {/* Header Overhaul */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 bg-slate-900/40 rounded-3xl border border-slate-800/60 backdrop-blur-md shadow-2xl gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-sky-500/10 rounded-2xl border border-sky-500/20 shadow-[0_0_15px_rgba(14,165,233,0.1)]">
            <Share2 className="text-sky-400 animate-pulse" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black flex items-center gap-2 tracking-tight">
              DIGITAL TWIN
              <span className="px-2 py-0.5 bg-sky-500/10 text-sky-400 text-[10px] font-black border border-sky-500/20 rounded-md tracking-[0.2em] uppercase">V2.0 PRO</span>
            </h1>
            <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
              <div className={`w-1.5 h-1.5 rounded-full ${wsStatus === 'connected' ? 'bg-emerald-500 animate-[pulse_2s_infinite]' : 'bg-red-500'}`} />
              <span className="uppercase tracking-widest">{wsStatus === 'connected' ? 'Live Telemetry Active' : 'Waiting for link'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={toggleML}
            className={`group relative flex items-center gap-2 px-6 py-3 rounded-2xl font-black transition-all duration-500 overflow-hidden ${
              mlActive 
              ? "bg-emerald-500 text-slate-950 shadow-[0_0_30px_rgba(16,185,129,0.2)]" 
              : "bg-slate-800 text-slate-400 border border-slate-700/50 hover:border-sky-500/50"
            }`}
          >
            <div className={`absolute inset-0 bg-white/10 translate-y-full transition-transform group-hover:translate-y-0`} />
            <Zap className={`${mlActive ? "fill-current" : ""} relative z-10 transition-transform group-hover:scale-110`} size={18} />
            <span className="relative z-10">{mlActive ? "OPTIMIZATION ACTIVE" : "ENABLE PREDICTIVE TUNING"}</span>
          </button>
        </div>
      </header>

      {/* Bento Grid Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          icon={<Cpu />} 
          title="Modbus Data" 
          value={currentMetrics?.temperature ? `${currentMetrics.temperature}°C` : "--"}
          sub="Register 40001 (Temp Sensor)"
          color="sky"
        />
        <StatCard 
          icon={<Signal />} 
          title="E2E Latency" 
          value={currentMetrics?.latency_ms ? `${currentMetrics.latency_ms}ms` : "--"}
          sub={`Jitter: ±${currentMetrics?.jitter_ms || 0}ms`}
          color="blue"
        />
        <StatCard 
          icon={<ShieldCheck />} 
          title="Network PER" 
          value={currentMetrics?.predicted_per ? `${currentMetrics.predicted_per}%` : "--"}
          sub="Predicted Error Rate"
          trend={currentMetrics?.predicted_per > 5 ? "bad" : "good"}
          color="rose"
        />
        <StatCard 
          icon={<Activity />} 
          title="Polling rate" 
          value={currentMetrics?.polling_interval ? `${currentMetrics.polling_interval}s` : "--"}
          sub="Gateway Cycle Interval"
          color="indigo"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Advanced Chart System */}
        <div className="lg:col-span-2 glass-card-premium overflow-hidden transition-all duration-700 hover:shadow-sky-500/5 border border-slate-800/40">
          <div className="p-8 space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-xl font-black flex items-center gap-3">
                  <TrendingUp className="text-sky-400" />
                  Performance Analytics
                </h2>
                <p className="text-slate-500 text-xs font-bold mt-1 uppercase tracking-widest">Composite Telemetry View</p>
              </div>
              <div className="flex gap-4 p-2 bg-slate-900/60 rounded-xl border border-slate-800/50">
                <LegendItem color="#0ea5e9" label="Latency" />
                <LegendItem color="#f43f5e" label="Error Rate" />
              </div>
            </div>

            <div className="h-[400px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data}>
                  <defs>
                    <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="#1e293b" vertical={false} />
                  <XAxis 
                    dataKey="time" 
                    stroke="#475569" 
                    fontSize={11} 
                    axisLine={false} 
                    tickLine={false}
                    padding={{ left: 20, right: 20 }}
                  />
                  <YAxis 
                    yAxisId="left"
                    name="ms"
                    type="number"
                    domain={[0, 'auto']}
                    stroke="#0ea5e9" 
                    fontSize={11} 
                    axisLine={false} 
                    tickLine={false}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    name="%"
                    type="number"
                    domain={[0, 20]}
                    stroke="#f43f5e" 
                    fontSize={11} 
                    axisLine={false} 
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="latency" 
                    name="Latency"
                    stroke="#0ea5e9" 
                    strokeWidth={4}
                    fillOpacity={1} 
                    fill="url(#latencyGradient)"
                    animationDuration={1000}
                  />
                  <Line 
                    yAxisId="right"
                    type="stepAfter" 
                    dataKey="per" 
                    name="PER"
                    stroke="#f43f5e" 
                    strokeWidth={4} 
                    dot={{ r: 4, fill: '#f43f5e', strokeWidth: 2, stroke: '#020617' }}
                    activeDot={{ r: 6, fill: '#fff', strokeWidth: 3, stroke: '#f43f5e' }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Control and Console Sidebar */}
        <div className="space-y-8">
          <div className="p-8 bg-slate-900/40 rounded-[2.5rem] border border-slate-800/40 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
                <Settings className="text-slate-500" size={20} />
                IMPAIRMENT ENGINE
              </h3>
              <Info className="text-slate-600" size={16} />
            </div>
            
            <div className="space-y-10">
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">GSM Link Noise</label>
                  <span className={`text-2xl font-mono font-black ${noise > 45 ? "text-rose-500" : "text-sky-500"}`}>{noise}%</span>
                </div>
                <div className="relative flex items-center group">
                  <input 
                    type="range" min="0" max="100" value={noise} 
                    onChange={(e) => handleNoiseChange(e.target.value)}
                    className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-sky-500 group-hover:h-2 transition-all"
                  />
                </div>
                <div className="flex justify-between text-[9px] font-black tracking-widest text-slate-600">
                  <span>IDEAL LINK</span>
                  <span>TOTAL FAILURE</span>
                </div>
              </div>

              <div className="p-5 bg-black/30 rounded-2xl border border-slate-800/50">
                <div className="flex gap-4 items-center">
                  <RefreshCw className={`text-sky-500 ${mlActive ? 'animate-spin' : ''}`} size={20} />
                  <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dynamic Polling</h4>
                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-0.5">
                      {mlActive ? "ML Controller is actively modulating polling rate." : "Fixed 1Hz polling interval active (manual mode)."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 bg-slate-900/90 rounded-[2.5rem] border border-slate-800 shadow-2xl flex-1 flex flex-col overflow-hidden">
            <h3 className="text-xs font-black mb-4 flex items-center gap-2 text-slate-500 uppercase tracking-[0.2em]">
              <Terminal size={14} />
              Protocol Terminal
            </h3>
            <div className="flex-1 font-mono text-[10px] space-y-2 overflow-y-auto max-h-[250px] scrollbar-hide">
              {logs.map(log => (
                <div key={log.id} className="group flex gap-3 p-2 hover:bg-slate-800/30 rounded-lg transition-colors border-l-2 border-transparent hover:border-sky-500/50">
                  <span className="text-slate-600 shrink-0 font-bold tracking-tighter">{log.time.split(' ')[0]}</span>
                  <div className="flex flex-col gap-0.5">
                    <span className={`font-black uppercase tracking-widest text-[8px] ${
                      log.type === 'error' ? 'text-rose-500' : 
                      log.type === 'warning' ? 'text-amber-500' : 'text-sky-500'
                    }`}>
                      {log.comp}
                    </span>
                    <span className="text-slate-300 leading-normal">{log.msg}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, title, value, sub, trend = "neutral", color = "sky" }) {
  const colors = {
    sky: "text-sky-400 bg-sky-500/10 border-sky-500/20",
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    rose: "text-rose-400 bg-rose-500/10 border-rose-500/20",
    indigo: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20"
  };

  return (
    <div className="bg-slate-900/40 p-6 rounded-[2rem] border border-slate-800/60 shadow-xl backdrop-blur-md relative overflow-hidden group transition-all hover:-translate-y-1 hover:border-slate-700">
      <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity translate-x-2 -translate-y-2">
        {React.cloneElement(icon, { size: 64 })}
      </div>
      
      <div className="flex items-center gap-3 mb-6">
        <div className={`p-2.5 rounded-xl border ${colors[color]}`}>
          {React.cloneElement(icon, { size: 18 })}
        </div>
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{title}</span>
      </div>

      <div className="flex items-end justify-between px-1">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-100 tracking-tighter leading-none">{value}</span>
          </div>
          <div className="mt-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest">{sub}</div>
        </div>
        {trend === 'bad' && (
          <div className="p-2 bg-rose-500/10 rounded-lg animate-bounce">
            <AlertTriangle className="text-rose-500" size={16} />
          </div>
        )}
      </div>
    </div>
  );
}

function LegendItem({ color, label }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em]">{label}</span>
    </div>
  );
}

