import {
  accent,
  setAccentHex,
  DEFAULT_ACCENT,
  normalizeHex,
  hexToHsv,
  hsvToHex,
  contrastWithWhite,
} from '../src/theme/accent';

afterEach(() => setAccentHex(DEFAULT_ACCENT));

test('default teal keeps its hand-tuned variants', () => {
  expect(accent.primary).toBe('#0E7C7B');
  expect(accent.light).toBe('#5FC9C7');
  expect(accent.tint).toBe('#E0F2F1');
  expect(accent.alpha(0.08)).toBe('rgba(14,124,123,0.08)');
});

test('a custom accent derives its variants', () => {
  setAccentHex('#c2410c');
  expect(accent.primary).toBe('#C2410C');
  expect(accent.light).toMatch(/^#[0-9A-F]{6}$/);
  expect(accent.light).not.toBe('#5FC9C7');
  expect(accent.alpha(0.5)).toBe('rgba(194,65,12,0.5)');
});

test('invalid input falls back to the default', () => {
  setAccentHex('#c2410c');
  setAccentHex('nope');
  expect(accent.primary).toBe(DEFAULT_ACCENT);
});

test('normalizeHex accepts short and unprefixed forms', () => {
  expect(normalizeHex('fff')).toBe('#FFFFFF');
  expect(normalizeHex('#0e7c7b')).toBe('#0E7C7B');
  expect(normalizeHex('#12345')).toBeNull();
});

test('hsv round-trips', () => {
  for (const hex of ['#0E7C7B', '#FF0000', '#334155', '#FFFBFC', '#000000']) {
    const { h, s, v } = hexToHsv(hex);
    expect(hsvToHex(h, s, v)).toBe(hex);
  }
});

test('flags light colours as low contrast with white text', () => {
  expect(contrastWithWhite('#FFFBFC')).toBeLessThan(3);
  expect(contrastWithWhite('#0E7C7B')).toBeGreaterThan(3);
});
