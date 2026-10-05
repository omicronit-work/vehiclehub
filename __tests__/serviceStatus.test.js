import { markSupersededServices, getServiceStatus, getDocumentStatus } from '../src/util/dateStatus';
import { countServiceBuckets } from '../src/util/statusBuckets';

const DAY = 24 * 60 * 60 * 1000;
const daysFromNow = n => new Date(Date.now() + n * DAY);

test('an older service of the same type is superseded by a newer one', () => {
  const services = markSupersededServices([
    { id: 'old', name: 'Engine Oil Refill', serviceDate: daysFromNow(-200), nextServiceDate: daysFromNow(-20) },
    { id: 'new', name: ' engine oil refill ', serviceDate: daysFromNow(-10), nextServiceDate: daysFromNow(80) },
    { id: 'other', name: 'Brake Pads', serviceDate: daysFromNow(-300), nextServiceDate: daysFromNow(-5) },
  ]);
  const byId = Object.fromEntries(services.map(s => [s.id, s]));

  expect(byId.old.superseded).toBe(true);
  expect(byId.new.superseded).toBe(false);
  expect(byId.other.superseded).toBe(false);

  expect(getServiceStatus(byId.old).tone).toBe('success'); // no longer "Overdue"
  expect(getServiceStatus(byId.other).tone).toBe('danger'); // genuinely overdue

  const counts = countServiceBuckets(services);
  expect(counts.overdue).toBe(1);
  expect(counts.done).toBe(1);
  expect(counts.upcoming).toBe(1);
});

test('document status', () => {
  expect(getDocumentStatus({ expiryDate: daysFromNow(-3) }).tone).toBe('danger');
  expect(getDocumentStatus({ expiryDate: daysFromNow(10) }).tone).toBe('warning');
  expect(getDocumentStatus({ expiryDate: daysFromNow(90) }).label).toBe('Valid');
});
