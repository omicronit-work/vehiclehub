import { vehicleAttention } from '../src/util/vehicleAttention';
import { todayYmd, addDays, addMonths } from '../src/util/schedule/scheduleMath';

const inDays = n => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d.getTime();
};
const today = todayYmd();

test('a document expiring in 10 days gets the Home "Expires in" badge', () => {
  const items = vehicleAttention({ documents: [{ id: 'd1', documentName: 'Insurance', expiryDate: inDays(10) }] });
  expect(items).toEqual([
    { key: 'document:d1', kind: 'document', title: 'Insurance', label: 'Expires in 10 days', tone: 'warning' },
  ]);
});

test('documents still valid beyond 30 days and completed services get no badge', () => {
  const items = vehicleAttention({
    documents: [{ id: 'd1', documentName: 'Tax token', expiryDate: inDays(90) }],
    services: [{ id: 's1', name: 'Tyre change', serviceDate: inDays(-40) }],
  });
  expect(items).toEqual([]);
});

test('service due badges: by date, by mileage, and from a schedule', () => {
  const items = vehicleAttention({
    vehicle: { currentOdometer: 10000 },
    services: [
      { id: 's1', name: 'Oil change', serviceDate: inDays(-170), nextServiceDate: inDays(-2) },
      { id: 's2', name: 'Brake pads', serviceDate: inDays(-60), nextServiceMileage: 10300 },
    ],
    schedules: [
      // Every 6 months, last done 6 months minus 5 days ago → due in 5 days.
      { id: 'r1', name: 'Air filter', mode: 'TIME', intervalMonths: 6, baseDate: addDays(addMonths(today, -6), 5) },
    ],
  });
  expect(items.map(i => [i.title, i.label, i.tone])).toEqual([
    ['Oil change', 'Overdue by 2 days', 'danger'],
    ['Brake pads', 'Due in ~300 km', 'warning'],
    ['Air filter', 'In 5 days', 'warning'],
  ]);
});

test('a service replaced by a newer one of the same type is not due', () => {
  const items = vehicleAttention({
    services: [
      { id: 'old', name: 'Oil change', serviceDate: inDays(-200), nextServiceDate: inDays(-20) },
      { id: 'new', name: 'Oil change', serviceDate: inDays(-5) },
    ],
  });
  expect(items).toEqual([]);
});
