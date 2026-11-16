// "Sadik Siqdar" -> "SS", "Sadik" -> "SA", "সাদিক সিকদার" -> "সাসি". Shared so the
// header avatar and the profile sheet always show the same initials.

// Vowel signs, viramas and other marks that belong to the letter before them
// (Devanagari, Bengali, Tamil, Sinhala, Thai, Arabic): a letter is the first
// character plus these.
const MARKS = /^[̀-ًͯ-ٰٟऀ-ःऺ-ॏ॑-ॗॢॣঁ-ঃ়-্ৗৢৣஂா-்ௗඁ-ඃ්-ෟัิ-ฺ็-๎‌‍]+/;

const letters = (word, count) => {
  let out = '';
  let rest = [...word];
  for (let i = 0; i < count && rest.length; i += 1) {
    out += rest.shift();
    const marks = rest.join('').match(MARKS);
    if (marks) {
      out += marks[0];
      rest = [...rest.join('').slice(marks[0].length)];
    }
  }
  return out;
};

export const getInitials = (name = '') => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return letters(parts[0], 2).toUpperCase();
  return (letters(parts[0], 1) + letters(parts[parts.length - 1], 1)).toUpperCase();
};
