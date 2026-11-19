// `date` + `months` calendar months, keeping the time of day. A day the
// target month doesn't have is clamped to its last day — 31 Aug + 6 months
// is 28 Feb (29 in a leap year), not 3 Mar as Date#setMonth would give.
export const addMonthsToDate = (date, months) => {
  const d = new Date(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
};
