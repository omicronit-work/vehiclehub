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

// Last fetched reminders per account, shared by every hook instance (Home,
// the garage screen, the bell). A screen that mounts later shows these at
// once instead of starting empty, and the refresh runs in the background.
const cache = new Map(); // email -> items
const loads = new Map(); // email -> { running: Promise | null, again: boolean }
const listeners = new Set();

// One load per account at a time. A refetch that arrives mid-load (e.g. right
// after a save) can't trust the running load, which may predate the write, so
// it marks `again` and the loop runs one more pass when the current one ends.
const loadReminders = email => {
  let st = loads.get(email);
  if (!st) {
    st = { running: null, again: false };
    loads.set(email, st);
  }
  if (st.running) {
    st.again = true;
    return st.running;
  }
  st.running = (async () => {
    do {
      st.again = false;
      try {
        const res = await getUpcomingReminders(email, { withinDays: 30 });
        cache.set(email, res);
        listeners.forEach(fn => fn(email, res));
      } catch (e) {
        console.log('Failed to load upcoming reminders', e);
      }
    } while (st.again);
    st.running = null;
  })();
  return st.running;
};

// Shared data source for the notification bell (badge count) and its
// dropdown panel, so both read the exact same fetch instead of drifting.
// Deliberately global across every vehicle on the account — not scoped to
// whichever vehicle happens to be selected on Home — since the bell is
// meant to surface anything due anywhere, not just for the active car.
export function useUpcomingReminders(userEmail) {
  const [items, setItems] = useState(() => (userEmail && cache.get(userEmail)) || []);

  // Pick up results from any instance's fetch, not just this one's.
  useEffect(() => {
    setItems((userEmail && cache.get(userEmail)) || []);
    const onUpdate = (email, res) => {
      if (email === userEmail) setItems(res);
    };
    listeners.add(onUpdate);
    return () => listeners.delete(onUpdate);
  }, [userEmail]);

  const refetch = useCallback(async () => {
    if (!userEmail) {
      setItems([]);
      return;
    }
    await loadReminders(userEmail);
  }, [userEmail]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { items, refetch };
}
