import { daysFromToday, getDocumentStatus, getServiceStatus, markSupersededServices, toMillis } from './dateStatus.js';
import { getMileageStatus } from './mileageStatus.js';
import { serviceLabel, ruleName } from './serviceFields';
import { chipLabel, currentOdometer, evaluateRule, STATUS, todayYmd } from './schedule/scheduleMath';
import { t as tr } from '../i18n';

// What needs attention on one vehicle, for the garage cards: the same due /
// expiry badges Home shows on its service, schedule and document rows, using
// the same rules (dateStatus, mileageStatus, scheduleMath). Only overdue
// ('danger') and due-soon ('warning') items count; anything comfortably ahead
// is left out, as on Home's chips.
//
// Returns the items most urgent first:
//   [{ key, kind: 'schedule' | 'service' | 'document', title, label, tone }]
const TONE_RANK = { danger: 0, warning: 1 };
const urgent = tone => tone === 'danger' || tone === 'warning';
// Undated items (distance-only) sort before dated ones within a tone. Finite,
// so the comparator never gets Infinity - Infinity = NaN.
const FIRST = -1e9;

export const vehicleAttention = (
  { vehicle = null, services = [], documents = [], schedules = [], fuelLogs = [] },
  { unit = 'km', today = todayYmd() } = {},
) => {
  const items = [];
  const odometer = currentOdometer({ vehicle, services, fuelLogs });

  // Service schedules (Home → Services → Upcoming).
  schedules.forEach(rule => {
    const e = evaluateRule(rule, { today, odometer });
    if (e.status === STATUS.OK) return;
    items.push({
      key: `schedule:${rule.id}`,
      kind: 'schedule',
      title: ruleName(rule) || tr('Service'),
      label: chipLabel(e.chip, unit),
      tone: e.status === STATUS.OVERDUE ? 'danger' : 'warning',
      // Days left (negative when overdue), to sort with dated items; a
      // distance-only rule sorts first within its tone.
      order: e.time ? e.time.left : FIRST,
    });
  });

  // Logged services with a next-service date or mileage (Home → History).
  markSupersededServices(services).forEach(s => {
    if (s.superseded) return;
    const title = serviceLabel(s.name) || tr('Service');
    const byDate = s.nextServiceDate ? getServiceStatus(s) : null;
    const byKm = getMileageStatus(s.nextServiceMileage, odometer, unit);
    // The more urgent of the two, as one badge per service.
    const pick = [byDate, byKm]
      .filter(st => st && urgent(st.tone))
      .sort((a, b) => TONE_RANK[a.tone] - TONE_RANK[b.tone])[0];
    if (!pick) return;
    const ms = pick === byDate ? toMillis(s.nextServiceDate) : null;
    items.push({ key: `service:${s.id}`, kind: 'service', title, label: pick.label, tone: pick.tone, order: ms === null ? FIRST : daysFromToday(ms) });
  });

  // Documents (Home → Documents).
  documents.forEach(d => {
    const st = getDocumentStatus(d);
    if (!urgent(st.tone)) return;
    items.push({ key: `document:${d.id}`, kind: 'document', title: d.documentName || tr('Document'), label: st.label, tone: st.tone, order: daysFromToday(toMillis(d.expiryDate)) });
  });

  return items
    .sort((a, b) => TONE_RANK[a.tone] - TONE_RANK[b.tone] || a.order - b.order)
    .map(({ order, ...item }) => item);
};
