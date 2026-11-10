// Service schedule maths (spec "VehicleHub: Service Schedule Specification",
// sections 4.1–4.5). Pure functions only, so every rule is unit-tested in
// __tests__/scheduleMath.test.js.
//
// Dates are plain local calendar dates stored as 'YYYY-MM-DD' strings: no time
// of day, no time zone, so a clock or zone change can't move a due date.
// Distances are always whole kilometres; miles exist for display only.

export const MODES = { BOTH: 'BOTH', DISTANCE: 'DISTANCE', TIME: 'TIME' };
export const STATUS = { OVERDUE: 'overdue', SOON: 'soon', OK: 'ok' };

export const DEFAULTS = { warnKm: 500, warnDays: 14, repeatOverdueDays: 7 };
export const LIMITS = {
  nameMax: 40,
  kmMin: 100,
  kmMax: 100000,
  monthsMin: 1,
  monthsMax: 120,
};

export const KM_TO_MI = 0.621371;

const STATUS_RANK = { [STATUS.OVERDUE]: 2, [STATUS.SOON]: 1, [STATUS.OK]: 0 };
const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const usesDistance = mode => mode === MODES.BOTH || mode === MODES.DISTANCE;
export const usesTime = mode => mode === MODES.BOTH || mode === MODES.TIME;

/* ── Calendar dates ─────────────────────────────────────────────────────── */

const pad = n => String(n).padStart(2, '0');

export const isYmd = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** 'YYYY-MM-DD' → { y, m (1-12), d }, or null. */
export const parseYmd = s => {
  if (!isYmd(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  return { y, m, d };
};

export const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

/** The local calendar date of a Date / millis / Firestore Timestamp. */
export const toYmd = value => {
  if (isYmd(value)) return value;
  const date =
    typeof value?.toDate === 'function' ? value.toDate() : value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return ymd(date.getFullYear(), date.getMonth() + 1, date.getDate());
};

export const todayYmd = (now = Date.now()) => toYmd(new Date(now));

/** Local Date at hh:00 on a calendar date (for scheduling alarms). */
export const ymdToLocalDate = (s, hour = 0) => {
  const p = parseYmd(s);
  return p ? new Date(p.y, p.m - 1, p.d, hour, 0, 0, 0) : null;
};

const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/**
 * R2: add whole calendar months, keeping the day of the month; a shorter
 * target month uses its last day. 31 Oct + 6 → 30 Apr; 29 Feb + 12 → 28 Feb.
 */
export const addMonths = (s, months) => {
  const p = parseYmd(s);
  if (!p) return null;
  const index = p.y * 12 + (p.m - 1) + months;
  const y = Math.floor(index / 12);
  const m = (index % 12) + 1;
  return ymd(y, m, Math.min(p.d, daysInMonth(y, m)));
};

export const addDays = (s, days) => {
  const p = parseYmd(s);
  if (!p) return null;
  const t = new Date(Date.UTC(p.y, p.m - 1, p.d) + days * DAY_MS);
  return ymd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
};

/** R4: whole calendar days from `a` to `b` (b today → 0, b yesterday → -1). */
export const daysBetween = (a, b) => {
  const pa = parseYmd(a);
  const pb = parseYmd(b);
  if (!pa || !pb) return null;
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / DAY_MS);
};

/** '2027-04-30' → '30 Apr 2027'. */
export const formatYmd = s => {
  const p = parseYmd(s);
  return p ? `${p.d} ${MONTHS[p.m - 1]} ${p.y}` : '';
};

/* ── Units and numbers ──────────────────────────────────────────────────── */

export const formatNumber = n => Math.round(Number(n) || 0).toLocaleString('en-US');

/** Display-only conversion: stored km → whole km or whole miles. */
export const kmToUnit = (km, unit = 'km') => (unit === 'mi' ? Math.round(km * KM_TO_MI) : Math.round(km));

/** What the user typed in their unit → whole km for storage. */
export const unitToKm = (value, unit = 'km') => {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  if (!Number.isFinite(n)) return null;
  return Math.round(unit === 'mi' ? n / KM_TO_MI : n);
};

/** 8200 → '8,200 km' (or '5,095 mi'). */
export const formatDistance = (km, unit = 'km') => `${formatNumber(kmToUnit(km, unit))} ${unit}`;

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
export const formatDays = n => plural(n, 'day');

/**
 * What the owner needs to know, in plain words: "Due in 320 km or 12 days",
 * "Overdue by 1,200 km", "Due today". `e` is an evaluateRule() result.
 */
export const dueInWords = (e, unit = 'km') => {
  const d = e?.distance;
  const t = e?.time;
  if (!d && !t) return 'Add an odometer reading to see when it is due';
  const overdue = [
    d && d.left < 0 && formatDistance(-d.left, unit),
    t && t.left < 0 && formatDays(-t.left),
  ].filter(Boolean);
  if (overdue.length) return `Overdue by ${overdue.join(' and ')}`;
  if ((d && d.left === 0) || (t && t.left === 0)) return 'Due today';
  const left = [d && formatDistance(d.left, unit), t && formatDays(t.left)].filter(Boolean);
  return `Due in ${left.join(' or ')}`;
};

/* ── The rule's limits ──────────────────────────────────────────────────── */

const toInt = v => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
};

/** Normalised copy of a stored rule with defaults filled in. */
export const normalizeRule = rule => ({
  ...rule,
  mode: rule.mode || MODES.BOTH,
  intervalKm: usesDistance(rule.mode || MODES.BOTH) ? toInt(rule.intervalKm) : null,
  intervalMonths: usesTime(rule.mode || MODES.BOTH) ? toInt(rule.intervalMonths) : null,
  baseOdo: toInt(rule.baseOdo) ?? 0,
  warnKm: toInt(rule.warnKm) ?? DEFAULTS.warnKm,
  warnDays: toInt(rule.warnDays) ?? DEFAULTS.warnDays,
  repeatOverdueDays: toInt(rule.repeatOverdueDays) ?? DEFAULTS.repeatOverdueDays,
  remindersOn: rule.remindersOn !== false,
});

/** R1 / R2 — due distance and due date, null when the mode doesn't use them. */
export const dueValues = rule => {
  const r = normalizeRule(rule);
  return {
    dueKm: usesDistance(r.mode) && r.intervalKm ? r.baseOdo + r.intervalKm : null,
    dueDate: usesTime(r.mode) && r.intervalMonths && isYmd(r.baseDate) ? addMonths(r.baseDate, r.intervalMonths) : null,
  };
};

const limitStatus = (left, warn) =>
  left < 0 ? STATUS.OVERDUE : left <= warn ? STATUS.SOON : STATUS.OK;

/**
 * Everything the screens need about one rule on `today` with the vehicle at
 * `odometer` km (null = no reading at all).
 *
 * Returns { dueKm, dueDate, distance, time, status, headline, chip,
 * needsOdometer } where distance / time are null when that limit doesn't
 * apply, else { left, status, progress (0..∞), fill (0..1) }.
 */
export const evaluateRule = (rule, { today, odometer }) => {
  const r = normalizeRule(rule);
  const { dueKm, dueDate } = dueValues(r);
  const hasOdo = odometer !== null && odometer !== undefined && Number.isFinite(Number(odometer));

  let distance = null;
  if (dueKm !== null && hasOdo) {
    const K = Number(odometer);
    const left = dueKm - K; // R3
    const progress = (K - r.baseOdo) / r.intervalKm;
    distance = { left, status: limitStatus(left, r.warnKm), progress, fill: clamp01(progress) };
  }

  let time = null;
  if (dueDate !== null) {
    const left = daysBetween(today, dueDate); // R4
    const span = daysBetween(r.baseDate, dueDate);
    const progress = span > 0 ? daysBetween(r.baseDate, today) / span : 1;
    time = { left, status: limitStatus(left, r.warnDays), progress, fill: clamp01(progress) };
  }

  // R5 worst status wins; R6 ties go to the limit further along.
  const limits = [distance && { key: 'distance', ...distance }, time && { key: 'time', ...time }].filter(Boolean);
  limits.sort((a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status] || b.progress - a.progress);
  const head = limits[0] || null;

  return {
    rule: r,
    dueKm,
    dueDate,
    distance,
    time,
    status: head ? head.status : STATUS.OK,
    headline: head ? head.key : null,
    needsOdometer: dueKm !== null && !hasOdo,
    chip: chipFor(head),
  };
};

const clamp01 = n => Math.max(0, Math.min(1, n));

/** 4.4 — chip text and tone. Distance is formatted by the caller's unit. */
const chipFor = head => {
  if (!head) return { status: STATUS.OK, kind: 'ok' };
  if (head.status === STATUS.OK) return { status: STATUS.OK, kind: 'ok' };
  return { status: head.status, kind: head.key, left: head.left };
};

export const chipLabel = (chip, unit = 'km') => {
  if (!chip || chip.kind === 'ok') return 'OK';
  const { status, kind, left } = chip;
  if (status === STATUS.OVERDUE) {
    return kind === 'distance' ? `Overdue ${formatDistance(-left, unit)}` : `Overdue ${formatDays(-left)}`;
  }
  if (kind === 'time') return left === 0 ? 'Due today' : `In ${formatDays(left)}`;
  return left === 0 ? 'Due now' : `In ${formatDistance(left, unit)}`;
};

/* ── Text used on cards and detail ──────────────────────────────────────── */

/** 'Every 10,000 km or 6 months, whichever first' */
export const ruleText = (rule, unit = 'km') => {
  const r = normalizeRule(rule);
  const km = r.intervalKm ? formatDistance(r.intervalKm, unit) : null;
  const months = r.intervalMonths ? plural(r.intervalMonths, 'month') : null;
  if (r.mode === MODES.BOTH && km && months) return `Every ${km} or ${months}, whichever first`;
  return `Every ${km || months || '—'}`;
};

/** Short rule for the "how it's worked out" box: '10,000 km or 6 months'. */
export const ruleShort = (rule, unit = 'km') => {
  const r = normalizeRule(rule);
  return [r.intervalKm && formatDistance(r.intervalKm, unit), r.intervalMonths && plural(r.intervalMonths, 'month')]
    .filter(Boolean)
    .join(' or ');
};

/** "Next due: 30 Apr 2027 or 10,010 km, whichever comes first." pieces. */
export const nextDueParts = (rule, unit = 'km') => {
  const { dueKm, dueDate } = dueValues(rule);
  return {
    date: dueDate ? formatYmd(dueDate) : null,
    distance: dueKm !== null ? formatDistance(dueKm, unit) : null,
  };
};

/** Sort for lists: overdue, due soon, OK; then the most urgent first. */
export const compareEvaluations = (a, b) => {
  const rank = STATUS_RANK[b.status] - STATUS_RANK[a.status];
  if (rank) return rank;
  const urgency = e => Math.max(e.distance?.progress ?? -Infinity, e.time?.progress ?? -Infinity);
  return urgency(b) - urgency(a);
};

/** 'n overdue · n due soon' summary counts. */
export const countStatuses = evaluations =>
  evaluations.reduce(
    (acc, e) => {
      if (e.status === STATUS.OVERDUE) acc.overdue += 1;
      else if (e.status === STATUS.SOON) acc.soon += 1;
      else acc.ok += 1;
      return acc;
    },
    { overdue: 0, soon: 0, ok: 0 },
  );

/* ── 4.6 Current odometer ───────────────────────────────────────────────── */

/**
 * K: the highest reading among the vehicle's odometer field, fuel logs and
 * services. null when there's no positive reading anywhere.
 */
export const currentOdometer = ({ vehicle, services = [], fuelLogs = [] }) => {
  const readings = [
    vehicle?.currentOdometer,
    ...services.map(s => s.currentMileage),
    ...fuelLogs.map(f => f.odometer),
  ]
    .map(Number)
    .filter(n => Number.isFinite(n) && n > 0);
  return readings.length ? Math.max(...readings) : null;
};

/* ── Validation ─────────────────────────────────────────────────────────── */

/**
 * Add / edit schedule. Values are already in km and whole months. Every
 * interval the mode uses is required, and so is the starting odometer. A
 * reading lower than earlier ones is allowed: the service may be backdated
 * (the form only flags it, like every other odometer field).
 * Returns { ok, errors: { field: message } }.
 */
// `requireOdo: false` for time-only service types that never ask for km.
export const validateRule = (rule, { requireOdo = true } = {}) => {
  const errors = {};
  const name = (rule.name || '').trim();
  if (!name) errors.name = 'Choose or type a service type.';
  else if (name.length > LIMITS.nameMax) errors.name = `Keep it under ${LIMITS.nameMax} characters.`;

  const mode = rule.mode || MODES.BOTH;
  const km = toInt(rule.intervalKm);
  const months = toInt(rule.intervalMonths);

  if (usesDistance(mode)) {
    if (km === null) errors.intervalKm = 'Enter the distance.';
    else if (km < LIMITS.kmMin || km > LIMITS.kmMax) {
      errors.intervalKm = `Between ${formatNumber(LIMITS.kmMin)} and ${formatNumber(LIMITS.kmMax)} km.`;
    }
  }
  if (usesTime(mode)) {
    if (months === null) errors.intervalMonths = 'Enter the months.';
    else if (months < LIMITS.monthsMin || months > LIMITS.monthsMax) {
      errors.intervalMonths = `Between ${LIMITS.monthsMin} and ${LIMITS.monthsMax} months.`;
    }
  }
  if (!isYmd(rule.baseDate)) errors.baseDate = 'Pick the date it was last done.';
  const odo = toInt(rule.baseOdo);
  if (!requireOdo) {
    // Nothing to check: the form doesn't show the reading.
  } else if (odo === null) errors.baseOdo = 'Enter the odometer reading.';
  else if (odo < 0) errors.baseOdo = "Can't be negative.";
  if (toInt(rule.warnKm) !== null && toInt(rule.warnKm) < 0) errors.warnKm = "Can't be negative.";
  if (toInt(rule.warnDays) !== null && toInt(rule.warnDays) < 0) errors.warnDays = "Can't be negative.";
  return { ok: Object.keys(errors).length === 0, errors };
};

/**
 * R8 / R11 — Mark as done. `odo` in km. Returns
 * { ok, errors: { date?, odo? }, warning? }.
 */
export const validateMarkDone = ({ dateDone, odo, today, rule, vehicleOdo, requireOdo = true }) => {
  const errors = {};
  const r = normalizeRule(rule);
  const reading = toInt(odo);

  if (!isYmd(dateDone)) errors.date = 'Pick the date it was done.';
  else if (daysBetween(today, dateDone) > 0) errors.date = "The date can't be in the future.";
  else if (isYmd(r.baseDate) && daysBetween(r.baseDate, dateDone) < 0) {
    errors.date = `It was last done on ${formatYmd(r.baseDate)}. Pick that day or later.`;
  }

  if (!requireOdo) {
    // Time-only service type: no reading asked for.
  } else if (reading === null) errors.odo = 'Enter the odometer reading.';
  else if (reading < r.baseOdo) {
    errors.odo = `This is lower than the ${formatNumber(r.baseOdo)} km when it was last done. Check the reading.`;
  }

  let warning = null;
  if (!errors.odo && reading !== null && vehicleOdo && reading < vehicleOdo) {
    warning = `Odometer is lower than your last reading (${formatNumber(vehicleOdo)} km). Check it? It's fine if this is an older entry.`;
  }
  return { ok: Object.keys(errors).length === 0, errors, warning };
};

/** R9 — the rule after Mark as done: new baseline, intervals unchanged. */
export const restartRule = (rule, { dateDone, odo }) => ({
  ...rule,
  baseDate: dateDone,
  baseOdo: Math.round(Number(odo)) || 0,
});

/* ── Estimated date for distance-only rules ─────────────────────────────── */

/**
 * Average km per day from dated odometer readings ([{ date: ymd, km }]).
 * Null unless the readings span at least 14 days and some distance.
 */
export const kmPerDayFrom = readings => {
  const pts = readings
    .filter(r => isYmd(r.date) && Number(r.km) > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (pts.length < 2) return null;
  const first = pts[0];
  const last = pts[pts.length - 1];
  const days = daysBetween(first.date, last.date);
  const km = last.km - first.km;
  if (days < 14 || km <= 0) return null;
  return km / days;
};

/**
 * When a distance will probably be reached: `today` plus the km still to
 * go at the owner's average daily driving. Null without a driving rate.
 */
export const estimateDateForKm = ({ dueKm, odometer, kmPerDay, today }) => {
  if (!kmPerDay || dueKm === null || dueKm === undefined) return null;
  const left = dueKm - (Number(odometer) || 0);
  if (left <= 0) return today;
  return addDays(today, Math.ceil(left / kmPerDay));
};
