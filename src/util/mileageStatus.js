// Complements dateStatus.js: services also carry a suggested nextServiceMileage,
// but a mileage target can't schedule a push notification the way a due date
// can (there's no background odometer polling on mobile) — so this is
// surfaced as a passive "due in ~X km" chip only, computed from the vehicle's
// last known odometer reading, not a scheduled reminder.

import { formatKm } from './distance';
import { t } from '../i18n';

export const getMileageStatus = (nextServiceMileage, currentOdometer, unit = 'km') => {
  const target = Number(nextServiceMileage);
  const current = Number(currentOdometer);
  if (!Number.isFinite(target) || target <= 0 || !Number.isFinite(current)) return null;

  const remaining = target - current;
  if (remaining <= 0) {
    return { label: t('st.overdueBy', { dist: formatKm(Math.abs(remaining), unit) }), tone: 'danger' };
  }
  if (remaining <= 500) {
    return { label: t('st.dueInApprox', { dist: formatKm(remaining, unit) }), tone: 'warning' };
  }
  return { label: t('st.dueInApprox', { dist: formatKm(remaining, unit) }), tone: 'neutral' };
};
