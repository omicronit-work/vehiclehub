// Shared by ServicesDcumentlist.jsx and VehicleInformations.jsx so both
// lists always agree on what "due" / "completed" / "expires" means for the
// same record — previously each file had its own copy and they drifted
// (VehicleInformations judged services off serviceDate alone, ignoring
// nextServiceDate, so a service with an upcoming next-due date still showed
// as "Completed X days ago").

export const DUE_SOON_DAYS = 30;

export const toMillis = (dateValue) => {
  if (!dateValue) return null;
  let date;
  if (typeof dateValue?.toDate === 'function') {
    date = dateValue.toDate();                    // Firestore client Timestamp
  } else if (dateValue._seconds != null) {
    date = new Date(dateValue._seconds * 1000);    // Admin / serialized
  } else if (dateValue.seconds != null) {
    date = new Date(dateValue.seconds * 1000);     // { seconds, nanoseconds }
  } else if (dateValue instanceof Date) {
    date = dateValue;
  } else {
    date = new Date(dateValue);                    // ISO string / number
  }
  const ms = date.getTime();
  return isNaN(ms) ? null : ms;
};

const startOfDay = (t) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export const daysFromToday = (ms) => {
  const DAY = 24 * 60 * 60 * 1000;
  return Math.round((startOfDay(ms) - startOfDay(Date.now())) / DAY);
};

// A service is superseded once a later service of the same type has been
// logged for the same vehicle — e.g. last year's oil change once this year's
// is recorded. Its nextServiceDate is then history, not a pending due date,
// so it must not keep showing as overdue or feed reminders.
const serviceKey = (s) => (s.name || '').trim().toLowerCase();
const performedAt = (s) => toMillis(s.serviceDate) ?? toMillis(s.createdAt) ?? 0;

export const markSupersededServices = (services = []) => {
  const latestByType = {};
  services.forEach((s) => {
    const key = serviceKey(s);
    if (!key) return;
    const current = latestByType[key];
    if (!current || performedAt(s) > performedAt(current)) latestByType[key] = s;
  });
  return services.map((s) => {
    const latest = latestByType[serviceKey(s)];
    return { ...s, superseded: !!latest && latest !== s };
  });
};

// Prioritizes nextServiceDate (when the next service is actually due).
// Only falls back to serviceDate ("Completed") when there's no next date set
// or a newer service of the same type has replaced this one.
export const getServiceStatus = (item) => {
  const nextMs = item.superseded ? null : toMillis(item.nextServiceDate);

  if (nextMs !== null) {
    const diff = daysFromToday(nextMs);
    if (diff < -1) return { label: `Overdue by ${-diff} days`, tone: 'danger' };
    if (diff === -1) return { label: 'Overdue since yesterday', tone: 'danger' };
    if (diff === 0) return { label: 'Due today', tone: 'danger' };
    if (diff === 1) return { label: 'Due tomorrow', tone: 'warning' };
    if (diff <= DUE_SOON_DAYS) return { label: `Due in ${diff} days`, tone: 'warning' };
    return { label: `Due in ${diff} days`, tone: 'success' };
  }

  const doneMs = toMillis(item.serviceDate);
  if (doneMs !== null) {
    const diff = daysFromToday(doneMs);
    if (diff === 0) return { label: 'Completed today', tone: 'success' };
    if (diff === -1) return { label: 'Completed yesterday', tone: 'success' };
    if (diff < 0 && diff > -30) return { label: `Completed ${-diff} days ago`, tone: 'success' };
    return { label: 'Completed', tone: 'success' };
  }

  return { label: 'No date', tone: 'neutral' };
};

export const getDocumentStatus = (item) => {
  const expiryMs = toMillis(item.expiryDate);

  if (expiryMs !== null) {
    const diff = daysFromToday(expiryMs);
    if (diff < -1) return { label: `Expired ${-diff} days ago`, tone: 'danger' };
    if (diff === -1) return { label: 'Expired yesterday', tone: 'danger' };
    if (diff === 0) return { label: 'Expires today', tone: 'danger' };
    if (diff === 1) return { label: 'Expires tomorrow', tone: 'warning' };
    if (diff <= DUE_SOON_DAYS) return { label: `Expires in ${diff} days`, tone: 'warning' };
    return { label: 'Valid', tone: 'success' };
  }

  if (toMillis(item.issueDate) !== null) {
    return { label: 'Issued', tone: 'neutral' };
  }

  return { label: 'No date', tone: 'neutral' };
};

// One date format for every record list, e.g. "2 Jul 2026".
export const formatDate = (dateValue) => {
  const ms = toMillis(dateValue);
  if (ms === null) return 'No date';
  return new Date(ms).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

// The date a document row shows, always labelled so it can't be mistaken
// for the date its status chip refers to: the expiry when there is one,
// otherwise the issue date.
export const documentDateLabel = (item) => {
  const expiryMs = toMillis(item.expiryDate);
  if (expiryMs !== null) {
    const verb = daysFromToday(expiryMs) < 0 ? 'Expired' : 'Expires';
    return `${verb} ${formatDate(expiryMs)}`;
  }
  if (toMillis(item.issueDate) !== null) return `Issued ${formatDate(item.issueDate)}`;
  return 'No date';
};

// Most urgent first: services with a pending next-due date by that date
// (overdue floats to the top), then the rest newest-first. A superseded
// service's next-due date is history, so it sorts with the completed ones.
// Shared by the Home and Vehicle screens so both list services in one order.
export const sortServices = (list) =>
  [...list].sort((a, b) => {
    const na = a.superseded ? null : toMillis(a.nextServiceDate);
    const nb = b.superseded ? null : toMillis(b.nextServiceDate);
    if (na !== null && nb !== null) return na - nb;
    if (na !== null) return -1;
    if (nb !== null) return 1;

    const da = toMillis(a.serviceDate);
    const db = toMillis(b.serviceDate);
    if (da === null && db === null) return 0;
    if (da === null) return 1;
    if (db === null) return -1;
    return db - da;
  });

// Most urgent first: by expiry date, so overdue / due-soon float to the top.
// Documents without an expiry can never be due, so they go last (newest
// issue first) instead of having their issue date compared against others'
// expiry dates.
export const sortDocuments = (list) =>
  [...list].sort((a, b) => {
    const ea = toMillis(a.expiryDate);
    const eb = toMillis(b.expiryDate);
    if (ea !== null && eb !== null) return ea - eb;
    if (ea !== null) return -1;
    if (eb !== null) return 1;
    return (toMillis(b.issueDate) ?? -Infinity) - (toMillis(a.issueDate) ?? -Infinity) || 0;
  });
