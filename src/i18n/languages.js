// The app languages: code, English name, and the name in that language
// (shown in the picker so people can find their own language).
export const LANGUAGES = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
  { code: 'th', name: 'Thai', native: 'ไทย' },
  { code: 'ms', name: 'Malay', native: 'Bahasa Melayu' },
  { code: 'de', name: 'German', native: 'Deutsch' },
  { code: 'es', name: 'Spanish', native: 'Español' },
];

export const LANGUAGE_CODES = LANGUAGES.map(l => l.code);

export const languageInfo = code => LANGUAGES.find(l => l.code === code) || LANGUAGES[0];
