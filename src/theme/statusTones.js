// Colours for status chips and icon wells (overdue, due soon, done, none),
// shared by Home's record rows and the garage cards so a badge looks the
// same everywhere.
export const statusTones = isDark => ({
  danger: {
    text: isDark ? '#FF9C90' : '#B91C1C',
    bg: isDark ? 'rgba(229,72,77,0.16)' : '#FDECEC',
    well: isDark ? 'rgba(229,72,77,0.16)' : '#FDEEEE',
  },
  warning: {
    text: isDark ? '#FFD180' : '#B45309',
    bg: isDark ? 'rgba(245,165,36,0.16)' : '#FEF3E2',
    well: isDark ? 'rgba(245,165,36,0.16)' : '#FEF4E4',
  },
  success: {
    text: isDark ? '#9CE6B0' : '#15803D',
    bg: isDark ? 'rgba(43,170,109,0.16)' : '#E6F6EC',
    well: isDark ? 'rgba(43,170,109,0.16)' : '#E9F7EF',
  },
  neutral: {
    text: isDark ? 'rgba(255,255,255,0.6)' : '#64748B',
    bg: isDark ? 'rgba(255,255,255,0.08)' : '#EEF2F7',
    well: isDark ? 'rgba(255,255,255,0.08)' : '#EEF2F7',
  },
});
