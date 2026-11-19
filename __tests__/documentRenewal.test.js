import { markSupersededDocuments, getDocumentStatus, sortDocuments } from '../src/util/dateStatus';
import { getDocumentBucket } from '../src/util/statusBuckets';
import { vehicleAttention } from '../src/util/vehicleAttention';
import { addMonthsToDate } from '../src/util/monthMath';

const inDays = n => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d.getTime();
};

const oldIns = { id: 'old', documentName: 'Insurance', expiryDate: inDays(-5) };
const newIns = { id: 'new', documentName: 'Insurance', expiryDate: inDays(360) };

test('a renewed document is superseded by the newer copy of its type', () => {
  const [o, n] = markSupersededDocuments([oldIns, newIns]);
  expect(o.superseded).toBe(true);
  expect(n.superseded).toBe(false);
  expect(getDocumentStatus(o)).toEqual({ label: 'Renewed', tone: 'neutral' });
  expect(getDocumentBucket(o)).toBe('other');
  expect(sortDocuments([o, n]).map(d => d.id)).toEqual(['new', 'old']);
});

test('different types and copies without expiry are left alone', () => {
  const docs = markSupersededDocuments([
    oldIns,
    { id: 'tax', documentName: 'Road tax', expiryDate: inDays(100) },
    { id: 'lic', documentName: 'Insurance' },
  ]);
  expect(docs.map(d => d.superseded)).toEqual([false, false, false]);
});

test('custom names match by name, ignoring case', () => {
  const docs = markSupersededDocuments([
    { id: 'a', documentName: 'Parking permit', expiryDate: inDays(-1) },
    { id: 'b', documentName: ' parking PERMIT', expiryDate: inDays(30) },
  ]);
  expect(docs[0].superseded).toBe(true);
});

test('the garage card no longer flags the renewed copy as expired', () => {
  expect(vehicleAttention({ documents: [oldIns, newIns] })).toEqual([]);
});

test('adding months clamps to the end of a shorter month', () => {
  const d = addMonthsToDate(new Date(2026, 7, 31, 10), 6);
  expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2027, 1, 28, 10]);
  const leap = addMonthsToDate(new Date(2028, 1, 29), 12);
  expect([leap.getFullYear(), leap.getMonth(), leap.getDate()]).toEqual([2029, 1, 28]);
  const plain = addMonthsToDate(new Date(2026, 0, 15), 13);
  expect([plain.getFullYear(), plain.getMonth(), plain.getDate()]).toEqual([2027, 1, 15]);
});
