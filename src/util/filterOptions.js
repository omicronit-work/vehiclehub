// Suggestions whose name starts with what's typed ("D" → Dacia, Daewoo…,
// not Audi). Case-insensitive; empty query returns the whole list.
export const filterOptions = (list, query) => {
  const q = String(query ?? '').trim().toLowerCase();
  return q ? list.filter(item => item.toLowerCase().startsWith(q)) : list;
};
