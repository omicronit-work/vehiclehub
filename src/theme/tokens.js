import { accent, hexToRgb } from './accent';
// Single source for colours, sizes and elevation. New and touched code should
// read from here (via useAppTheme) instead of defining per-file palettes;
// remaining per-file palettes are migrated as screens are worked on.

export const brand = {
  // User-chosen accent (Settings → App Color) — buttons, links on light bg
  get primary() { return accent.primary; },
  get primaryBright() { return accent.primary; }, // legacy; buttons use primary
  navy: '#041933',
  danger: '#C62828',
  warning: '#B45309',
  success: '#15803D',
};

const light = {
  isDark: false,
  screenBg: '#F4F7FB',
  surface: '#FFFFFF',
  text: brand.navy,
  textMuted: 'rgba(4,25,51,0.62)',
  border: 'rgba(4,25,51,0.12)',
  inputBorder: '#E2E6EC',
  get inputBorderFilled() { return accent.primary; },
  placeholder: 'rgba(4,25,51,0.5)',
  get link() { return accent.primary; },
  get primary() { return accent.primary; },
  onPrimary: '#FFFFFF',
  danger: '#B91C1C',
  dangerBg: '#FDECEC',
  divider: 'rgba(4,25,51,0.2)',
  statusBar: 'dark-content',
};

const dark = {
  isDark: true,
  screenBg: '#061530',
  surface: '#0A1E38',
  text: '#FFFFFF',
  textMuted: 'rgba(255,255,255,0.7)',
  border: 'rgba(255,255,255,0.14)',
  inputBorder: 'rgba(255,255,255,0.22)',
  get inputBorderFilled() { return accent.light; },
  placeholder: 'rgba(255,255,255,0.55)',
  // The accent itself is too dark on navy; its lighter variant stays readable.
  get link() { return accent.light; },
  get primary() { return accent.primary; },
  onPrimary: '#FFFFFF',
  danger: '#FF9C90',
  dangerBg: 'rgba(229,72,77,0.16)',
  divider: 'rgba(255,255,255,0.28)',
  statusBar: 'light-content',
};

export const themes = { light, dark };

// Minimum comfortable touch target (Apple HIG 44pt / Material 48dp).
export const MIN_TOUCH = 44;
export const hitSlop = (size, target = MIN_TOUCH) => {
  const pad = Math.max(0, Math.ceil((target - size) / 2));
  return { top: pad, bottom: pad, left: pad, right: pad };
};

// Hex (#RRGGBB) → rgba() so shadow colours can carry their own opacity.
const rgba = (hex, alpha) => `rgba(${hexToRgb(hex).join(', ')}, ${alpha})`;

// Cross-platform soft shadow via boxShadow (New Architecture). Unlike Android
// elevation, an outset boxShadow is clipped outside the view, so it never
// shows through translucent dark-mode surfaces as a black box.
export const shadow = (level = 2, color = '#002B5B') => ({
  boxShadow: `0px ${level * 2}px ${level * 9}px ${rgba(color, 0.05 + level * 0.025)}`,
});

// Lighter variant used on Home and Settings cards.
export const shadowSoft = (level = 2, color = '#0A2A55') => ({
  boxShadow: `0px ${level}px ${level * 6}px ${rgba(color, 0.07 + level * 0.02)}`,
});
