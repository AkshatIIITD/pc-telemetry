import { describe, expect, it } from 'vitest';
import { tempColor } from './tempColor';

describe('tempColor', () => {
  it('stays in the accent colour when cool', () => {
    expect(tempColor(0)).toBe('hsl(263 98% 50%)');
    expect(tempColor(45)).toBe('hsl(263 98% 50%)');
    expect(tempColor(60)).toBe('hsl(263 98% 50%)');
  });

  it('moves towards magenta part-way through the warm range', () => {
    expect(tempColor(72.5)).toBe('hsl(311.5 98% 50%)');
  });

  it('is fully red from 85 degrees up', () => {
    expect(tempColor(85)).toBe('hsl(360 98% 50%)');
    expect(tempColor(110)).toBe('hsl(360 98% 50%)');
  });
});