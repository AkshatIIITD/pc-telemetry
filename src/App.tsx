import { Cpu, Layers } from 'lucide-react';
import type { ReactNode } from 'react';
import { useLhmMetrics } from './hooks/useLhmMetrics';
import type { ParseOptions } from './utils/parseMetrics';
import { tempColor } from './utils/tempColor';

// Configuration (see .env.example). Vite inlines these at build time,
// so run `npm run build` again after changing them.
const LHM_URL = import.meta.env.VITE_LHM_URL ?? 'http://localhost:8085/data.json';
const POLL_INTERVAL_MS = 1000;
const HISTORY_POINTS = 60;

const splitList = (value: string | undefined): string[] | undefined =>
  value
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);

// Module-level constant so the polling hook gets a stable reference.
const PARSE_OPTIONS: ParseOptions = {
  cpuIdPrefixes: splitList(import.meta.env.VITE_CPU_ID_PREFIXES),
  gpuIdPrefixes: splitList(import.meta.env.VITE_GPU_ID_PREFIXES),
};

// Muted style for labels, so the numbers stand out.
const LABEL = 'text-sm leading-4 font-bold tracking-widest uppercase text-zinc-200';

const fmt = (value: number | null, unit: string): string => (value === null ? '--' : `${value} ${unit}`);

interface GaugeProps {
  /** null means "no data": the gauge shows -- and stays empty. */
  value: number | null;
  label: string;
  unit: string;
  max?: number;
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center p-3 bg-zinc-950/40 border border-zinc-800 rounded relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[3px] bg-accent/60" />
      {children}
    </div>
  );
}

function ThermalBar({ value, label, unit, max = 100 }: GaugeProps) {
  const clean = Math.min(Math.max(value ?? 0, 0), max);
  const color = tempColor(clean);

  return (
    <Card>
      <div className="relative flex items-center justify-center w-32 h-32 gap-4 mt-1">
        <div className="w-5 h-full bg-zinc-900 rounded-full relative overflow-hidden flex flex-col justify-end border border-zinc-800">
          <div
            className="w-full rounded-full transition-all duration-700 ease-out"
            style={{
              height: `${(clean / max) * 100}%`,
              backgroundColor: color,
              boxShadow: `0 0 16px ${color}`,
            }}
          />
        </div>
        <div className="flex flex-col items-start justify-center w-20">
          <span className="text-5xl font-light tracking-tighter text-white">{value ?? '--'}</span>
          <span className="text-base font-bold text-zinc-200 uppercase tracking-wider">{unit}</span>
        </div>
      </div>
      <div className={`${LABEL} mt-2`}>{label}</div>
    </Card>
  );
}

function CircularGauge({ value, label, unit, max = 100 }: GaugeProps) {
  const radius = 74;
  const circumference = 2 * Math.PI * radius;
  const clean = Math.min(Math.max(value ?? 0, 0), max);
  const dashOffset = circumference - (clean / max) * circumference;

  return (
    <Card>
      <div className="relative flex items-center justify-center w-32 h-32 mt-1">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 176 176">
          <circle cx="88" cy="88" r={radius} className="stroke-zinc-800 fill-none" strokeWidth="10" />
          <circle
            cx="88"
            cy="88"
            r={radius}
            className="stroke-accent fill-none transition-all duration-700 ease-out"
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{ filter: 'drop-shadow(0 0 6px rgba(103, 2, 252, 0.7))' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-5xl font-light tracking-tighter text-white">{value ?? '--'}</span>
          <span className="text-base font-bold text-zinc-200 uppercase tracking-wider mt-1">{unit}</span>
        </div>
      </div>
      <div className={`${LABEL} mt-2`}>{label}</div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className={LABEL}>{label}</span>
      <span className="text-base font-bold text-white">{value}</span>
    </div>
  );
}

/** Last minute of load as a filled line. New readings enter from the right. */
function Sparkline({ values }: { values: number[] }) {
  const width = 400;
  const height = 36;

  if (values.length < 2) return <div className="h-9" />;

  const step = width / (HISTORY_POINTS - 1);
  const offset = (HISTORY_POINTS - values.length) * step;
  const points = values.map((v, i) => {
    const y = height - (Math.min(Math.max(v, 0), 100) / 100) * height;
    return `${(offset + i * step).toFixed(1)},${y.toFixed(1)}`;
  });
  const line = points.join(' ');
  const area = `${offset.toFixed(1)},${height} ${line} ${width},${height}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full h-9" aria-hidden="true">
      <polygon points={area} className="fill-accent/20" />
      <polyline
        points={line}
        className="fill-none stroke-accent"
        strokeWidth="2"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

interface PanelProps {
  index: string;
  name: string;
  icon: ReactNode;
  gauges: ReactNode;
  stats: ReactNode;
  history: number[];
}

function Panel({ index, name, icon, gauges, stats, history }: PanelProps) {
  return (
    <section className="border border-zinc-800 rounded bg-zinc-950/30 p-3 flex flex-col gap-3">
      <header className="flex items-center gap-2 text-[13px] leading-4 font-bold tracking-wider uppercase text-white">
        {icon}
        <span className="truncate">
          <span className="text-zinc-300">{index} // </span>
          {name}
        </span>
      </header>
      <div className="grid grid-cols-2 gap-3">{gauges}</div>
      <div className="flex justify-between px-1">{stats}</div>
      <Sparkline values={history} />
    </section>
  );
}

export default function App() {
  const { metrics, history, status } = useLhmMetrics(LHM_URL, POLL_INTERVAL_MS, PARSE_OPTIONS);

  const vram =
    metrics.gpuVramUsedGb !== null && metrics.gpuVramTotalGb !== null
      ? `${metrics.gpuVramUsedGb} / ${metrics.gpuVramTotalGb} GB`
      : '--';
  const ramDetail =
    metrics.ramUsedGb !== null && metrics.ramTotalGb !== null
      ? `${metrics.ramUsedGb} / ${metrics.ramTotalGb} GB`
      : null;

  return (
    <div className="w-[480px] h-[800px] bg-black text-white p-3 flex flex-col justify-between border border-zinc-800 select-none overflow-hidden">

      <div className="flex flex-col gap-3">
        <Panel
          index="01"
          name={metrics.cpuName ?? 'CPU'}
          icon={<Cpu className="w-4 h-4 text-white shrink-0" />}
          gauges={
            <>
              <ThermalBar value={metrics.cpuTemp} label="Temp" unit="°C" />
              <CircularGauge value={metrics.cpuLoad} label="Load" unit="%" />
            </>
          }
          stats={
            <>
              <Stat label="Power" value={fmt(metrics.cpuPowerW, 'W')} />
              <Stat label="Clock" value={fmt(metrics.cpuClockGhz, 'GHz')} />
            </>
          }
          history={history.cpu}
        />

        <Panel
          index="02"
          name={metrics.gpuName ?? 'GPU'}
          icon={<Layers className="w-4 h-4 text-white shrink-0" />}
          gauges={
            <>
              <ThermalBar value={metrics.gpuTemp} label="Temp" unit="°C" />
              <CircularGauge value={metrics.gpuLoad} label="Load" unit="%" />
            </>
          }
          stats={
            <>
              <Stat label="Power" value={fmt(metrics.gpuPowerW, 'W')} />
              <Stat label="VRAM" value={vram} />
            </>
          }
          history={history.gpu}
        />
      </div>

      <div className="border-t border-zinc-800 pt-3 flex flex-col gap-3 mb-1">
        <div className="flex justify-between items-center px-1">
          <div className="flex items-baseline gap-3">
            <span className={LABEL}>SYS_RAM_LOAD:</span>
            <span className="text-white font-black text-2xl tracking-tighter">
              {metrics.ramUsage === null ? '--' : `${metrics.ramUsage}%`}
            </span>
            {ramDetail && <span className="text-zinc-200 text-sm">{ramDetail}</span>}
          </div>
          {status === 'offline' && (
            <span className="text-red-500 font-bold text-xs tracking-widest uppercase">LHM offline</span>
          )}
        </div>
        <div className="w-full bg-zinc-950 h-3 border border-zinc-800 rounded-full overflow-hidden">
          <div
            className="bg-accent h-full transition-all duration-500"
            style={{ width: `${metrics.ramUsage ?? 0}%` }}
          />
        </div>
      </div>

    </div>
  );
}