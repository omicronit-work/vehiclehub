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
    if (diff < -1) return { label: `Overdue by ${-diff} days`, tone: 'danger' };
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
