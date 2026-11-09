import { Cpu, Layers } from 'lucide-react';
import { useLhmMetrics } from './hooks/useLhmMetrics';
import type { ParseOptions } from './utils/parseMetrics';

// Configuration (see .env.example). Vite inlines these at build time,
// so run `npm run build` again after changing them.
const LHM_URL = import.meta.env.VITE_LHM_URL ?? 'http://localhost:8085/data.json';
const POLL_INTERVAL_MS = 1000;

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

interface GaugeProps {
  /** null means "no data": the gauge shows -- and stays empty. */
  value: number | null;
  max?: number;
  title: string;
  subtitle: string;
  unit: string;
}

function ThermalBar({ value, max = 100, title, subtitle, unit }: GaugeProps) {
  const cleanValue = Math.min(Math.max(value ?? 0, 0), max);
  const heightPct = (cleanValue / max) * 100;

  const thermalMax = 75;
  const colorScale = Math.min(cleanValue / thermalMax, 1);
  const hue = Math.max(0, 240 - (colorScale * 240));
  const dynamicColor = `hsl(${hue}, 100%, 50%)`;

  return (
    <div className="flex flex-col items-center justify-center p-3 bg-zinc-950/40 border border-zinc-900 rounded relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[3px] bg-zinc-900" />
      <div className="text-[11px] tracking-widest text-white font-bold uppercase mb-2 mt-1">{title}</div>

      <div className="relative flex items-center justify-center w-44 h-44 gap-5">
        <div className="w-5 h-full bg-zinc-900 rounded-full relative overflow-hidden flex flex-col justify-end border border-zinc-800">
          <div
            className="w-full rounded-full transition-all duration-700 ease-out"
            style={{
              height: `${heightPct}%`,
              backgroundColor: dynamicColor,
              boxShadow: `0 0 16px ${dynamicColor}`
            }}
          />
        </div>
        <div className="flex flex-col items-start justify-center w-20">
          <span className="text-6xl font-light tracking-tighter text-white">{value ?? '--'}</span>
          <span className="text-sm font-bold text-white uppercase tracking-wider">{unit}</span>
        </div>
      </div>
      <div className="text-[11px] text-white mt-3 font-mono uppercase font-bold">{subtitle}</div>
    </div>
  );
}

function CircularGauge({ value, max = 100, title, subtitle, unit }: GaugeProps) {
  const radius = 74;
  const circumference = 2 * Math.PI * radius;
  const cleanValue = Math.min(Math.max(value ?? 0, 0), max);
  const strokeDashoffset = circumference - (cleanValue / max) * circumference;

  return (
    <div className="flex flex-col items-center justify-center p-3 bg-zinc-950/40 border border-zinc-900 rounded relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[3px] bg-zinc-900" />
      <div className="text-[11px] tracking-widest text-white font-bold uppercase mb-2 mt-1">{title}</div>

      <div className="relative flex items-center justify-center w-44 h-44">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 176 176">
          <circle cx="88" cy="88" r={radius} className="stroke-zinc-900 fill-none" strokeWidth="10" />
          <circle
            cx="88"
            cy="88"
            r={radius}
            className="stroke-accent fill-none transition-all duration-700 ease-out"
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-5xl font-light tracking-tighter text-white">{value ?? '--'}</span>
          <span className="text-sm font-bold text-white uppercase tracking-wider mt-1">{unit}</span>
        </div>
      </div>
      <div className="text-[11px] text-white mt-3 font-mono uppercase font-bold">{subtitle}</div>
    </div>
  );
}

export default function App() {
  const { metrics, status } = useLhmMetrics(LHM_URL, POLL_INTERVAL_MS, PARSE_OPTIONS);

  return (
    <div className="w-[480px] h-[800px] bg-black text-white p-3 flex flex-col justify-between border border-zinc-900 select-none overflow-hidden">

      <div className="flex flex-col gap-4">

        {/* CPU section: the hardware name comes from the LHM data */}
        <div className="border border-zinc-900 p-4 rounded bg-zinc-950/20 relative">
          <div className="absolute top-3 left-4 flex items-center gap-2 text-xs font-bold text-white tracking-wider uppercase">
            <Cpu className="w-4 h-4 text-white" />
            <span>01 // {metrics.cpuName ?? 'CPU'}</span>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-8">
            <ThermalBar value={metrics.cpuTemp} title="Thermal Core" subtitle="Core Temp" unit="°C" />
            <CircularGauge value={metrics.cpuLoad} title="Compute Array" subtitle="Core Load" unit="%" />
          </div>
        </div>

        {/* GPU section */}
        <div className="border border-zinc-900 p-4 rounded bg-zinc-950/20 relative">
          <div className="absolute top-3 left-4 flex items-center gap-2 text-xs font-bold text-white tracking-wider uppercase">
            <Layers className="w-4 h-4 text-white" />
            <span>02 // {metrics.gpuName ?? 'GPU'}</span>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-8">
            <ThermalBar value={metrics.gpuTemp} title="Graphics Core" subtitle="GPU Temp" unit="°C" />
            <CircularGauge value={metrics.gpuLoad} title="Render Engine" subtitle="GPU Load" unit="%" />
          </div>
        </div>

      </div>

      <div className="border-t border-zinc-900 pt-3 flex flex-col gap-3 mb-1">
        <div className="flex justify-between items-center px-2">
          <div className="flex items-center gap-4">
            <span className="text-white font-bold text-sm tracking-widest uppercase">SYS_RAM_LOAD:</span>
            <span className="text-white font-black text-2xl tracking-tighter">
              {metrics.ramUsage === null ? '--' : `${metrics.ramUsage}%`}
            </span>
          </div>
          {status === 'offline' && (
            <span className="text-red-500 font-bold text-xs tracking-widest uppercase">LHM offline</span>
          )}
        </div>
        <div className="w-full bg-zinc-950 h-3 border border-zinc-900 rounded-full overflow-hidden">
          <div className="bg-accent h-full transition-all duration-500" style={{ width: `${metrics.ramUsage ?? 0}%` }} />
        </div>
      </div>

    </div>
  );
}
