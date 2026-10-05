import { useCallback, useEffect, useState } from 'react';
import { getUpcomingReminders } from '../store/userSlice.js';
import { accent } from '../theme/accent';

export const REMINDER_RED = '#CC3333';
export const REMINDER_AMBER = '#C77700';

const dayStart = d => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const reminderStatus = dueDate => {
  const days = Math.round((dayStart(dueDate) - dayStart(new Date())) / 86400000);
  if (days < 0) return { color: REMINDER_RED, label: `Overdue ${Math.abs(days)}d` };
  if (days === 0) return { color: REMINDER_AMBER, label: 'Due today' };
  if (days <= 3) return { color: REMINDER_AMBER, label: `Due in ${days}d` };
  return { color: accent.primary, label: `Due in ${days}d` };
};

export const formatReminderDate = date =>
  date ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';

// Collapses a flat reminders list into a per-vehicle badge: color is red if
// any reminder for that vehicle is overdue, amber if the soonest is due
// within 3 days, and vehicles with only far-out (30-day-window) reminders
// get no badge at all — matches the urgency cutoff reminderStatus draws.
export function getVehicleBadgeMap(items) {
  const map = {};
  items.forEach(item => {
    const status = reminderStatus(item.dueDate);
    if (status.color === accent.primary) return;

    const existing = map[item.vehicleId];
    if (!existing) {
      map[item.vehicleId] = { color: status.color, count: 1, items: [item] };
    } else {
      existing.count += 1;
      existing.items.push(item);
      if (status.color === REMINDER_RED) existing.color = REMINDER_RED;
    }
  });
  return map;
}

// Shared data source for the notification bell (badge count) and its
// dropdown panel, so both read the exact same fetch instead of drifting.
// Deliberately global across every vehicle on the account — not scoped to
// whichever vehicle happens to be selected on Home — since the bell is
// meant to surface anything due anywhere, not just for the active car.
export function useUpcomingReminders(userEmail) {
  const [items, setItems] = useState([]);

  const refetch = useCallback(async () => {
    if (!userEmail) {
      setItems([]);
      return;
    }
    try {
      const res = await getUpcomingReminders(userEmail, { withinDays: 30 });
      setItems(res);
    } catch (e) {
      console.log('Failed to load upcoming reminders', e);
    }
  }, [userEmail]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { items, refetch };
}
