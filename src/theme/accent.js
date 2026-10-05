// User-chosen accent colour (Settings → App Color).
//
// Every accent read in the app goes through `accent.*` at render time. App
// calls setAccentHex() from Redux and remounts the navigator when it changes,
// so module-level palettes, useMemo'd theme objects and SVG fills all pick up
// the new colour without each screen subscribing to it.

export const DEFAULT_ACCENT = '#0E7C7B';

// The hand-tuned variants of the default teal, kept exact so the default look
// doesn't drift from what was designed.
const DEFAULT_VARIANTS = { light: '#5FC9C7', soft: '#AAE4E2', tint: '#E0F2F1' };

export const isValidHex = (value) => /^#[0-9a-f]{6}$/i.test(value);

export const normalizeHex = (value) => {
  let v = String(value || '').trim().replace(/^#?/, '#');
  if (/^#[0-9a-f]{3}$/i.test(v)) v = '#' + v.slice(1).split('').map((ch) => ch + ch).join('');
  return isValidHex(v) ? v.toUpperCase() : null;
};

export const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

export const rgbToHex = (r, g, b) =>
  '#' + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('').toUpperCase();

// h: 0–360, s/v: 0–1
export const hsvToHex = (h, s, v) => {
  const f = (n) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return rgbToHex(f(5) * 255, f(3) * 255, f(1) * 255);
};

export const hexToHsv = (hex) => {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max ? d / max : 0, v: max };
};

const hslToHex = (h, s, l) => {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
};

const hexToHsl = (hex) => {
  const { h, s: sv, v } = hexToHsv(hex);
  const l = v * (1 - sv / 2);
  const s = l === 0 || l === 1 ? 0 : (v - l) / Math.min(l, 1 - l);
  return { h, s, l };
};

const mixWithWhite = (hex, amount) =>
  rgbToHex(...hexToRgb(hex).map((v) => v + (255 - v) * amount));

// WCAG contrast of white text on this colour.
export const contrastWithWhite = (hex) => {
  const lum = hexToRgb(hex)
    .map((v) => v / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const L = 0.2126 * lum[0] + 0.7152 * lum[1] + 0.0722 * lum[2];
  return 1.05 / (L + 0.05);
};

const buildVariants = (hex) => {
  if (hex === DEFAULT_ACCENT) return DEFAULT_VARIANTS;
  const { h, s, l } = hexToHsl(hex);
  // Readable on the navy dark-mode surfaces: lift lightness, tame saturation.
  const light = hslToHex(h, Math.min(s, 0.5), Math.max(l, 0.58));
  return { light, soft: mixWithWhite(light, 0.5), tint: mixWithWhite(hex, 0.88) };
};

const rgba = (hex, a) => `rgba(${hexToRgb(hex).join(',')},${a})`;

let current = DEFAULT_ACCENT;
let variants = DEFAULT_VARIANTS;

export const setAccentHex = (hex) => {
  const next = normalizeHex(hex) || DEFAULT_ACCENT;
  if (next === current) return;
  current = next;
  variants = buildVariants(next);
};

export const accent = {
  /** Main accent: buttons, header, active states (light mode). */
  get primary() { return current; },
  /** Lighter accent for text/icons on dark-mode surfaces. */
  get light() { return variants.light; },
  /** Muted pale accent for secondary text in dark mode. */
  get soft() { return variants.soft; },
  /** Very pale accent background (pills, chips) in light mode. */
  get tint() { return variants.tint; },
  alpha: (a) => rgba(current, a),
  lightAlpha: (a) => rgba(variants.light, a),
  softAlpha: (a) => rgba(variants.soft, a),
};
