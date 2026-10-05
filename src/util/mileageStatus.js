// Complements dateStatus.js: services also carry a suggested nextServiceMileage,
// but a mileage target can't schedule a push notification the way a due date
// can (there's no background odometer polling on mobile) — so this is
// surfaced as a passive "due in ~X km" chip only, computed from the vehicle's
// last known odometer reading, not a scheduled reminder.

export const getMileageStatus = (nextServiceMileage, currentOdometer) => {
  const target = Number(nextServiceMileage);
  const current = Number(currentOdometer);
  if (!Number.isFinite(target) || target <= 0 || !Number.isFinite(current)) return null;

  const remaining = target - current;
  if (remaining <= 0) {
    return { label: `Overdue by ${Math.abs(remaining).toLocaleString()} km`, tone: 'danger' };
  }
  if (remaining <= 500) {
    return { label: `Due in ~${remaining.toLocaleString()} km`, tone: 'warning' };
  }
  return { label: `Due in ~${remaining.toLocaleString()} km`, tone: 'neutral' };
};
