/** Hue of the accent colour #6702FC. Keep in sync with --color-accent in index.css. */
const ACCENT_HUE = 263;

/** Temperatures below this stay in the accent colour. */
const WARM_START_C = 60;
/** At or above this temperature the colour is fully red. */
const HOT_C = 85;

/**
 * Colour for a temperature reading: the accent purple while things are cool,
 * shifting through magenta to red as the hardware gets hot. The hue runs
 * upwards (263 to 360) so it never passes through green.
 */
export function tempColor(tempC: number): string {
  const warm = Math.min(Math.max((tempC - WARM_START_C) / (HOT_C - WARM_START_C), 0), 1);
  const hue = ACCENT_HUE + warm * (360 - ACCENT_HUE);
  return `hsl(${hue} 98% 50%)`;
}