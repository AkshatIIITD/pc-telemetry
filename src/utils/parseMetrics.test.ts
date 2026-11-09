import { describe, expect, it } from 'vitest';
import { EMPTY_METRICS, parseLhmData, parseSensorValue, parseSizeGb } from './parseMetrics';
import type { LhmNode } from './parseMetrics';
import sample from './__fixtures__/lhm-sample.json';

// Fresh copy for each test so mutations never leak between tests.
const load = (): LhmNode => structuredClone(sample) as LhmNode;

/** Finds a hardware node by name, e.g. "Total Memory". */
function hardware(root: LhmNode, name: string): LhmNode {
  const computer = root.Children![0];
  const node = computer.Children!.find((c) => c.Text === name);
  if (!node) throw new Error(`fixture has no hardware named ${name}`);
  return node;
}

/** Finds a sensor under a hardware node by group and name. */
function sensor(hw: LhmNode, group: string, name: string): LhmNode {
  const found = hw.Children!.find((g) => g.Text === group)?.Children!.find((s) => s.Text === name);
  if (!found) throw new Error(`fixture has no sensor ${group}/${name}`);
  return found;
}

describe('parseLhmData with the sample from a Ryzen 7 9700X + RTX 5070 Ti machine', () => {
  it('reads every metric, rounded for display', () => {
    expect(parseLhmData(load())).toEqual({
      cpuName: 'AMD Ryzen 7 9700X',
      cpuTemp: 50, // 49.6
      cpuLoad: 4, // 4.4
      cpuPowerW: 35, // 34.5
      cpuClockGhz: 5.1, // 5142 MHz
      gpuName: 'NVIDIA GeForce RTX 5070 Ti',
      gpuTemp: 39, // 39.4
      gpuLoad: 5, // 5.0
      gpuPowerW: 25, // 25.4
      gpuVramUsedGb: 1.6, // 1617 MB
      gpuVramTotalGb: 15.9, // 16303 MB
      ramUsage: 41, // 40.9
      ramUsedGb: 12.9,
      ramTotalGb: 31.5, // used 12.9 + available 18.6
    });
  });

  it('reads physical RAM even when Virtual Memory is listed after it', () => {
    // Both hardware nodes contain a sensor called "Memory". Matching on that
    // text used to pick whichever came last.
    const root = load();
    const computer = root.Children![0];
    computer.Children!.reverse();
    const metrics = parseLhmData(root);
    expect(metrics.ramUsage).toBe(41);
    expect(metrics.ramUsedGb).toBe(12.9);
    expect(metrics.ramTotalGb).toBe(31.5);
  });

  it('uses the Tctl package temperature, not another core or CCD sensor', () => {
    const root = load();
    sensor(hardware(root, 'AMD Ryzen 7 9700X'), 'Temperatures', 'CCD1 (Tdie)').Value = '99.0 °C';
    expect(parseLhmData(root).cpuTemp).toBe(50);
  });

  it('uses the package power, not a single core', () => {
    const root = load();
    sensor(hardware(root, 'AMD Ryzen 7 9700X'), 'Powers', 'Core #1 (SMU)').Value = '99.0 W';
    expect(parseLhmData(root).cpuPowerW).toBe(35);
  });

  it('uses the average core clock, not a single core', () => {
    const root = load();
    sensor(hardware(root, 'AMD Ryzen 7 9700X'), 'Clocks', 'Core #1').Value = '1000.0 MHz';
    expect(parseLhmData(root).cpuClockGhz).toBe(5.1);
  });

  it('reads VRAM used and total, not the free amount', () => {
    const metrics = parseLhmData(load());
    expect(metrics.gpuVramUsedGb).toBe(1.6);
    expect(metrics.gpuVramTotalGb).toBe(15.9);
  });

  it('ignores the integrated GPU when a discrete NVIDIA GPU is present', () => {
    const metrics = parseLhmData(load());
    expect(metrics.gpuName).toBe('NVIDIA GeForce RTX 5070 Ti');
  });

  it('can be pointed at a different GPU through the id prefix option', () => {
    const metrics = parseLhmData(load(), { gpuIdPrefixes: ['/gpu-amd/0/'] });
    expect(metrics.gpuName).toBe('AMD Radeon(TM) Graphics');
    expect(metrics.gpuLoad).toBe(0);
    // This GPU has no "GPU Core" temperature or "GPU Package" power sensor,
    // so the first sensor of each kind is used.
    expect(metrics.gpuTemp).toBe(47);
    expect(metrics.gpuPowerW).toBe(16);
    // It also exposes no VRAM sensors in this sample.
    expect(metrics.gpuVramUsedGb).toBeNull();
  });

  it('accepts a decimal comma from a localized LHM', () => {
    const root = load();
    sensor(hardware(root, 'AMD Ryzen 7 9700X'), 'Temperatures', 'Core (Tctl/Tdie)').Value = '49,6 °C';
    expect(parseLhmData(root).cpuTemp).toBe(50);
  });
});

describe('parseLhmData when data is missing', () => {
  it('returns nulls, not zeros, for an empty tree', () => {
    expect(parseLhmData({ Text: 'Sensor', Children: [] })).toEqual(EMPTY_METRICS);
  });

  it('returns nulls for null or undefined input', () => {
    expect(parseLhmData(null)).toEqual(EMPTY_METRICS);
    expect(parseLhmData(undefined)).toEqual(EMPTY_METRICS);
  });

  it('returns null for a sensor whose value is not a number', () => {
    const root = load();
    sensor(hardware(root, 'Total Memory'), 'Load', 'Memory').Value = '-';
    expect(parseLhmData(root).ramUsage).toBeNull();
  });

  it('returns null total RAM when one of the two data sensors is missing', () => {
    const root = load();
    const data = hardware(root, 'Total Memory').Children!.find((g) => g.Text === 'Data')!;
    data.Children = data.Children!.filter((s) => s.Text !== 'Memory Available');
    const metrics = parseLhmData(root);
    expect(metrics.ramTotalGb).toBeNull();
    expect(metrics.ramUsedGb).toBe(12.9);
  });
});

describe('parseSensorValue', () => {
  it.each([
    ['49.6 °C', 49.6],
    ['4.4 %', 4.4],
    ['1318 RPM', 1318],
    ['49,6 °C', 49.6],
    ['-1.000', -1],
  ])('parses %s', (raw, expected) => {
    expect(parseSensorValue(raw)).toBe(expected);
  });

  it.each([['-'], [''], [undefined]])('returns null for %s', (raw) => {
    expect(parseSensorValue(raw)).toBeNull();
  });
});

describe('parseSizeGb', () => {
  it.each([
    ['12.9 GB', 12.9],
    ['2048.0 MB', 2],
    ['1.0 TB', 1024],
  ])('converts %s to gigabytes', (raw, expected) => {
    expect(parseSizeGb(raw)).toBeCloseTo(expected, 5);
  });

  it.each([['5 RPM'], ['-'], [''], [undefined]])('returns null for %s', (raw) => {
    expect(parseSizeGb(raw)).toBeNull();
  });
});