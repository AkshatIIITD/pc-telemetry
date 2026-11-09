/**
 * Turns the Libre Hardware Monitor (LHM) `data.json` tree into the handful of
 * numbers the dashboard shows.
 *
 * Sensors are matched by their LHM `SensorId` (for example `/amdcpu/0/load/0`)
 * instead of by display text. Display text such as "Memory" appears on several
 * sensors (physical RAM is `/ram/load/0`, virtual memory is `/vram/load/1`),
 * so matching on text can silently pick the wrong one.
 */

export interface LhmNode {
  Text: string;
  Value?: string;
  SensorId?: string;
  Children?: LhmNode[];
}

export interface SystemMetrics {
  cpuName: string | null;
  cpuTemp: number | null;
  cpuLoad: number | null;
  cpuPowerW: number | null;
  cpuClockGhz: number | null;
  gpuName: string | null;
  gpuTemp: number | null;
  gpuLoad: number | null;
  gpuPowerW: number | null;
  gpuVramUsedGb: number | null;
  gpuVramTotalGb: number | null;
  ramUsage: number | null;
  ramUsedGb: number | null;
  ramTotalGb: number | null;
}

export interface ParseOptions {
  /** SensorId prefixes for the CPU, tried in order. Example: ['/amdcpu/0/'] */
  cpuIdPrefixes?: string[];
  /** SensorId prefixes for the GPU, tried in order. Example: ['/gpu-nvidia/0/'] */
  gpuIdPrefixes?: string[];
}

/** Used before the first successful read, and whenever LHM is unreachable. */
export const EMPTY_METRICS: SystemMetrics = {
  cpuName: null,
  cpuTemp: null,
  cpuLoad: null,
  cpuPowerW: null,
  cpuClockGhz: null,
  gpuName: null,
  gpuTemp: null,
  gpuLoad: null,
  gpuPowerW: null,
  gpuVramUsedGb: null,
  gpuVramTotalGb: null,
  ramUsage: null,
  ramUsedGb: null,
  ramTotalGb: null,
};

const DEFAULT_CPU_PREFIXES = ['/amdcpu/0/', '/intelcpu/0/'];
const DEFAULT_GPU_PREFIXES = ['/gpu-nvidia/0/', '/gpu-amd/0/', '/gpu-intel/0/'];

/** Physical memory sensors. (`/vram/...` is virtual memory, which we do not want.) */
const RAM_LOAD_ID = '/ram/load/0';
const RAM_USED_ID = '/ram/data/0';
const RAM_AVAILABLE_ID = '/ram/data/1';

/** CPU temperature sensor names, best match first. */
const CPU_TEMP_PREFERENCE = [/Tctl/i, /^CPU Package$/i, /Core \(?Max\)?/i, /Package/i];

interface Sensor {
  id: string;
  name: string;
  /** The value text exactly as LHM sends it, for example "12.9 GB". */
  raw: string;
  value: number | null;
  /** Name of the hardware node the sensor belongs to, e.g. "AMD Ryzen 7 9700X". */
  hardware: string | null;
}

/**
 * Reads the number out of an LHM value string such as "49.6 °C" or "4.4 %".
 * Accepts a decimal comma ("49,6 °C") because LHM formats values with the
 * system locale. Returns null for "-" and other non-numeric values.
 */
export function parseSensorValue(raw: string | undefined): number | null {
  if (!raw) return null;
  const match = raw.match(/-?\d+(?:[.,]\d+)?/);
  if (!match) return null;
  const n = Number(match[0].replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Reads a data size such as "12.9 GB" or "1617.0 MB" and returns gigabytes. */
export function parseSizeGb(raw: string | undefined): number | null {
  const n = parseSensorValue(raw);
  if (n === null || !raw) return null;
  if (/TB/i.test(raw)) return n * 1024;
  if (/GB/i.test(raw)) return n;
  if (/MB/i.test(raw)) return n / 1024;
  if (/KB/i.test(raw)) return n / 1024 / 1024;
  return null;
}

/**
 * Walks the tree and collects every sensor. The tree looks like:
 *   Sensor > <computer> > <hardware> > <group, e.g. "Load"> > <sensor>
 * so a sensor's hardware is its grandparent.
 */
function collectSensors(node: LhmNode, ancestors: LhmNode[], out: Sensor[]): void {
  if (node.SensorId) {
    out.push({
      id: node.SensorId,
      name: node.Text,
      raw: node.Value ?? '',
      value: parseSensorValue(node.Value),
      hardware: ancestors.length >= 2 ? ancestors[ancestors.length - 2].Text : null,
    });
  }
  for (const child of node.Children ?? []) {
    collectSensors(child, [...ancestors, node], out);
  }
}

/** Sensors of the first hardware device whose SensorId starts with one of the prefixes. */
function sensorsForHardware(sensors: Sensor[], prefixes: string[]): Sensor[] {
  for (const prefix of prefixes) {
    const matches = sensors.filter((s) => s.id.startsWith(prefix));
    if (matches.length > 0) return matches;
  }
  return [];
}

function pickCpuTemp(cpu: Sensor[]): Sensor | undefined {
  const temps = cpu.filter((s) => s.id.includes('/temperature/'));
  for (const pattern of CPU_TEMP_PREFERENCE) {
    const found = temps.find((s) => pattern.test(s.name));
    if (found) return found;
  }
  return temps[0];
}

function pickByName(
  sensors: Sensor[],
  kind: 'temperature' | 'load' | 'power',
  name: string,
): Sensor | undefined {
  const ofKind = sensors.filter((s) => s.id.includes(`/${kind}/`));
  return ofKind.find((s) => s.name === name) ?? ofKind[0];
}

const round = (n: number | null | undefined): number | null =>
  n === null || n === undefined ? null : Math.round(n);

const tenth = (n: number | null | undefined): number | null =>
  n === null || n === undefined ? null : Math.round(n * 10) / 10;

export function parseLhmData(root: LhmNode | null | undefined, options: ParseOptions = {}): SystemMetrics {
  if (!root) return { ...EMPTY_METRICS };

  const sensors: Sensor[] = [];
  collectSensors(root, [], sensors);

  const cpuPrefixes = options.cpuIdPrefixes?.length ? options.cpuIdPrefixes : DEFAULT_CPU_PREFIXES;
  const gpuPrefixes = options.gpuIdPrefixes?.length ? options.gpuIdPrefixes : DEFAULT_GPU_PREFIXES;

  const cpu = sensorsForHardware(sensors, cpuPrefixes);
  const gpu = sensorsForHardware(sensors, gpuPrefixes);

  const cpuLoad = cpu.find((s) => s.id.includes('/load/') && s.name === 'CPU Total');
  const cpuPower = cpu.find((s) => s.id.includes('/power/') && /^(CPU )?Package$/i.test(s.name));
  const cpuClock = cpu.find((s) => s.id.includes('/clock/') && s.name === 'Cores (Average)');

  const vramUsed = gpu.find((s) => s.id.includes('/smalldata/') && s.name === 'GPU Memory Used');
  const vramTotal = gpu.find((s) => s.id.includes('/smalldata/') && s.name === 'GPU Memory Total');

  const ram =
    sensors.find((s) => s.id === RAM_LOAD_ID) ?? sensors.find((s) => s.id.startsWith('/ram/load/'));
  const ramUsedGb = parseSizeGb(sensors.find((s) => s.id === RAM_USED_ID)?.raw);
  const ramAvailableGb = parseSizeGb(sensors.find((s) => s.id === RAM_AVAILABLE_ID)?.raw);
  const ramTotalGb = ramUsedGb !== null && ramAvailableGb !== null ? ramUsedGb + ramAvailableGb : null;

  const clockMhz = cpuClock?.value ?? null;

  return {
    cpuName: cpu[0]?.hardware ?? null,
    cpuTemp: round(pickCpuTemp(cpu)?.value),
    cpuLoad: round(cpuLoad?.value),
    cpuPowerW: round(cpuPower?.value),
    cpuClockGhz: clockMhz === null ? null : tenth(clockMhz / 1000),
    gpuName: gpu[0]?.hardware ?? null,
    gpuTemp: round(pickByName(gpu, 'temperature', 'GPU Core')?.value),
    gpuLoad: round(pickByName(gpu, 'load', 'GPU Core')?.value),
    gpuPowerW: round(pickByName(gpu, 'power', 'GPU Package')?.value),
    gpuVramUsedGb: tenth(parseSizeGb(vramUsed?.raw)),
    gpuVramTotalGb: tenth(parseSizeGb(vramTotal?.raw)),
    ramUsage: round(ram?.value),
    ramUsedGb: tenth(ramUsedGb),
    ramTotalGb: tenth(ramTotalGb),
  };
}