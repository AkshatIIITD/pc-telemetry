import { describe, expect, it } from 'vitest';
import { EMPTY_METRICS, parseLhmData, parseSensorValue } from './parseMetrics';
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
  it('reads CPU, GPU and RAM, rounded to whole numbers', () => {
    expect(parseLhmData(load())).toEqual({
      cpuName: 'AMD Ryzen 7 9700X',
      cpuTemp: 50, // 49.6
      cpuLoad: 4, // 4.4
      gpuName: 'NVIDIA GeForce RTX 5070 Ti',
      gpuTemp: 39, // 39.4
      gpuLoad: 5, // 5.0
      ramUsage: 41, // 40.9
    });
  });

  it('reads physical RAM even when Virtual Memory is listed after it', () => {
    // Both hardware nodes contain a sensor called "Memory". Matching on that
    // text used to pick whichever came last.
    const root = load();
    const computer = root.Children![0];
    computer.Children!.reverse();
    expect(parseLhmData(root).ramUsage).toBe(41);
  });

  it('uses the Tctl package temperature, not another core or CCD sensor', () => {
    const root = load();
    sensor(hardware(root, 'AMD Ryzen 7 9700X'), 'Temperatures', 'CCD1 (Tdie)').Value = '99.0 °C';
    expect(parseLhmData(root).cpuTemp).toBe(50);
  });

  it('ignores the integrated GPU when a discrete NVIDIA GPU is present', () => {
    const metrics = parseLhmData(load());
    expect(metrics.gpuName).toBe('NVIDIA GeForce RTX 5070 Ti');
  });

  it('can be pointed at a different GPU through the id prefix option', () => {
    const metrics = parseLhmData(load(), { gpuIdPrefixes: ['/gpu-amd/0/'] });
    expect(metrics.gpuName).toBe('AMD Radeon(TM) Graphics');
    expect(metrics.gpuLoad).toBe(0);
    // This GPU has no "GPU Core" temperature, so the first temperature sensor is used.
    expect(metrics.gpuTemp).toBe(47);
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
