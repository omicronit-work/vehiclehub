// The phone's time zone -> country. Used when GPS can't answer (location off,
// permission denied, no fix), so a phone in Dhaka still gets Bangladesh/BDT
// without any permission. Covers the countries with their own currency or
// fuel names in the app; anything else returns null (-> US Dollar).

const ZONES = {
  BD: ['Bangladesh', 'Asia/Dhaka', 'Asia/Dacca'],
  IN: ['India', 'Asia/Kolkata', 'Asia/Calcutta'],
  PK: ['Pakistan', 'Asia/Karachi'],
  NP: ['Nepal', 'Asia/Kathmandu', 'Asia/Katmandu'],
  LK: ['Sri Lanka', 'Asia/Colombo'],
  TH: ['Thailand', 'Asia/Bangkok'],
  MY: ['Malaysia', 'Asia/Kuala_Lumpur', 'Asia/Kuching'],
  ID: ['Indonesia', 'Asia/Jakarta', 'Asia/Pontianak', 'Asia/Makassar', 'Asia/Jayapura'],
  PH: ['Philippines', 'Asia/Manila'],
  VN: ['Vietnam', 'Asia/Ho_Chi_Minh', 'Asia/Saigon'],
  SG: ['Singapore', 'Asia/Singapore'],
  JP: ['Japan', 'Asia/Tokyo'],
  CN: ['China', 'Asia/Shanghai', 'Asia/Urumqi', 'Asia/Chongqing', 'Asia/Harbin'],
  HK: ['Hong Kong', 'Asia/Hong_Kong'],
  KR: ['South Korea', 'Asia/Seoul'],
  AE: ['United Arab Emirates', 'Asia/Dubai'],
  SA: ['Saudi Arabia', 'Asia/Riyadh'],
  QA: ['Qatar', 'Asia/Qatar'],
  KW: ['Kuwait', 'Asia/Kuwait'],
  OM: ['Oman', 'Asia/Muscat'],
  BH: ['Bahrain', 'Asia/Bahrain'],
  TR: ['Turkey', 'Europe/Istanbul', 'Asia/Istanbul'],
  RU: ['Russia', 'Europe/Moscow', 'Europe/Samara', 'Europe/Volgograd', 'Asia/Yekaterinburg',
    'Asia/Omsk', 'Asia/Novosibirsk', 'Asia/Krasnoyarsk', 'Asia/Irkutsk', 'Asia/Yakutsk',
    'Asia/Vladivostok', 'Asia/Magadan', 'Asia/Kamchatka', 'Europe/Kaliningrad'],
  GB: ['United Kingdom', 'Europe/London'],
  IE: ['Ireland', 'Europe/Dublin'],
  DE: ['Germany', 'Europe/Berlin'],
  FR: ['France', 'Europe/Paris'],
  IT: ['Italy', 'Europe/Rome'],
  ES: ['Spain', 'Europe/Madrid', 'Atlantic/Canary'],
  PT: ['Portugal', 'Europe/Lisbon'],
  NL: ['Netherlands', 'Europe/Amsterdam'],
  BE: ['Belgium', 'Europe/Brussels'],
  AT: ['Austria', 'Europe/Vienna'],
  CH: ['Switzerland', 'Europe/Zurich'],
  SE: ['Sweden', 'Europe/Stockholm'],
  PL: ['Poland', 'Europe/Warsaw'],
  FI: ['Finland', 'Europe/Helsinki'],
  GR: ['Greece', 'Europe/Athens'],
  EG: ['Egypt', 'Africa/Cairo'],
  NG: ['Nigeria', 'Africa/Lagos'],
  ZA: ['South Africa', 'Africa/Johannesburg'],
  AU: ['Australia', 'Australia/Sydney', 'Australia/Melbourne', 'Australia/Brisbane',
    'Australia/Perth', 'Australia/Adelaide', 'Australia/Hobart', 'Australia/Darwin'],
  NZ: ['New Zealand', 'Pacific/Auckland'],
  BR: ['Brazil', 'America/Sao_Paulo', 'America/Manaus', 'America/Fortaleza', 'America/Recife',
    'America/Bahia', 'America/Belem'],
  CA: ['Canada', 'America/Toronto', 'America/Vancouver', 'America/Edmonton', 'America/Winnipeg',
    'America/Halifax', 'America/St_Johns', 'America/Regina', 'America/Montreal'],
  US: ['United States', 'America/New_York', 'America/Chicago', 'America/Denver',
    'America/Los_Angeles', 'America/Phoenix', 'America/Anchorage', 'America/Detroit',
    'Pacific/Honolulu', 'America/Boise', 'America/Indiana/Indianapolis'],
};

const BY_ZONE = {};
Object.entries(ZONES).forEach(([code, [name, ...zones]]) => {
  zones.forEach(zone => { BY_ZONE[zone] = { code, name }; });
});

export const countryForTimezone = zone => BY_ZONE[zone] || null;

// { code, name } for the phone's current time zone, or null.
export const timezoneCountry = () => {
  try {
    return countryForTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    return null;
  }
};
