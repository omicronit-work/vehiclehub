import { toMillis, daysFromToday, DUE_SOON_DAYS } from './dateStatus.js';

// Groups services / documents into the buckets the Home filter chips and the
// hero stat tiles share, so a chip count and the matching stat can't drift.
//   overdue  → past its next-due / expiry date
//   upcoming → still ahead (documents: only while expiring within DUE_SOON_DAYS)
//   done     → completed service (no next date) / document that's comfortably valid
//   other    → no usable date; only shows under "All"

export const getServiceBucket = (item) => {
  const nextMs = item.superseded ? null : toMillis(item.nextServiceDate);
  if (nextMs !== null) return daysFromToday(nextMs) < 0 ? 'overdue' : 'upcoming';
  if (toMillis(item.serviceDate) !== null) return 'done';
  return 'other';
};

export const getDocumentBucket = (item) => {
  const expiryMs = toMillis(item.expiryDate);
  if (expiryMs === null) return 'other';
  const diff = daysFromToday(expiryMs);
  if (diff < 0) return 'overdue';
  return diff <= DUE_SOON_DAYS ? 'upcoming' : 'done';
};

// `dueSoon` is the subset of services that are due within DUE_SOON_DAYS —
// what the hero calls "Due soon" (the chip's "Upcoming" includes further-out ones).
export const countServiceBuckets = (services) => {
  const counts = { all: services.length, overdue: 0, upcoming: 0, done: 0, dueSoon: 0 };
  services.forEach((s) => {
    const bucket = getServiceBucket(s);
    if (bucket in counts) counts[bucket] += 1;
    if (bucket === 'upcoming' && daysFromToday(toMillis(s.nextServiceDate)) <= DUE_SOON_DAYS) {
      counts.dueSoon += 1;
    }
  });
  return counts;
};

export const countDocumentBuckets = (documents) => {
  const counts = { all: documents.length, overdue: 0, upcoming: 0, done: 0 };
  documents.forEach((d) => {
    const bucket = getDocumentBucket(d);
    if (bucket in counts) counts[bucket] += 1;
  });
  return counts;
};
