import { fuelUnit } from './fuelEfficiency.js';
import { toMillis } from './dateStatus.js';
import { serviceLabel } from './serviceFields';
import { formatKm } from './distance';

// One-line summaries for the service and fuel cards (Home and the vehicle
// detail page), so the key figures are visible without opening the record.
// `money` formats an amount stored on that record, in the record's own currency.

// `unit` is the user's distance unit ('km' | 'mi'); readings are stored in km.
const km = (value, unit) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? formatKm(n, unit) : null;
};

const shortDate = value => {
  const ms = toMillis(value);
  return ms === null
    ? null
    : new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const join = parts => parts.filter(Boolean).join(' · ');

// "৳ 3,500.00 · 12,350 km · TEST Workshop"
export const serviceSummary = (item, money, unit = 'km') =>
  join([
    Number(item.totalCost) > 0 ? money(item.totalCost) : null,
    km(item.currentMileage, unit),
    item.workshopName?.trim(),
  ]);

// "Next due 26 Jan 2027 or 12,900 km", or '' when nothing is scheduled.
export const serviceNextDue = (item, unit = 'km') => {
  const due = [shortDate(item.nextServiceDate), km(item.nextServiceMileage, unit)].filter(Boolean);
  return due.length ? `Next due ${due.join(' or ')}` : '';
};

// "40.5 L at ৳ 125.00/L · 12,400 km · TEST Station"
export const fuelSummary = (item, money, distUnit = 'km') => {
  const unit = fuelUnit(item.fuelType);
  const qty = Number(item.liters);
  const price = Number(item.pricePerLiter);
  const amount = qty > 0
    ? `${qty.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${unit}${price > 0 ? ` at ${money(price)}/${unit}` : ''}`
    : null;
  // A 0 km first fill is a real reading (computeFuelEfficiency sets hasReading).
  const reading = item.hasReading && Number(item.odometer) === 0 ? `0 ${distUnit}` : km(item.odometer, distUnit);
  return join([amount, reading, item.stationName?.trim()]);
};

// Names a record in its delete dialog so two "Petrol" fills can be told apart:
// "Petrol, 28 Oct 2026, ৳ 4,940.00".
export const recordLabel = (item, kind, money) => {
  if (kind === 'fuel') {
    return [item.fuelName || item.fuelType || 'Fuel', shortDate(item.date), Number(item.totalCost) > 0 ? money(item.totalCost) : null]
      .filter(Boolean).join(', ');
  }
  if (kind === 'service') {
    return [serviceLabel(item.name), shortDate(item.serviceDate), Number(item.totalCost) > 0 ? money(item.totalCost) : null]
      .filter(Boolean).join(', ');
  }
  return [item.documentName, item.expiryDate ? `expires ${shortDate(item.expiryDate)}` : null]
    .filter(Boolean).join(', ');
};
