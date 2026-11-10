// "Sadik Siqdar" -> "SS", "Sadik" -> "SA". Shared so the header avatar and
// the profile sheet always show the same initials.
export const getInitials = (name = '') => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};
