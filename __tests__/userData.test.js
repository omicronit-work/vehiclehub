import * as fs from '@react-native-firebase/firestore';
import ReminderScheduler from '../specs/NativeReminderScheduler';
import {
  saveUserToFirestore,
  addUserVehicle,
  deleteUserVehicle,
  updateUserService,
} from '../src/store/userSlice';

// Minimal in-memory Firestore behind the modular API: refs are just
// { path } objects, e.g. "users/a@b.com/vehicles/v1".
let db;
let idSeq;

const ref = (kind, parent, segments) => {
  const base = parent && parent.path ? [parent.path] : [];
  return { kind, path: [...base, ...segments].join('/') };
};

const makeDoc = path => ({
  id: path.split('/').pop(),
  ref: { path },
  exists: () => path in db,
  data: () => db[path],
});

beforeEach(() => {
  db = {};
  idSeq = 0;
  ReminderScheduler.cancel.mockClear();
  // Like RNFB (and unlike the web SDK), collection() can't take a collection.
  fs.collection.mockImplementation((parent, ...segments) => {
    if (parent?.kind === 'collection') throw new TypeError("Cannot read property 'call' of undefined");
    return ref('collection', parent, segments);
  });
  // Like the real SDK, doc(collectionRef) with no path gets a new auto id.
  fs.doc.mockImplementation((parent, ...segments) =>
    ref('doc', parent, parent?.kind === 'collection' && !segments.length ? [`id${++idSeq}`] : segments));
  fs.getDoc.mockImplementation(async ({ path }) => makeDoc(path));
  fs.getDocs.mockImplementation(async ({ path }) => {
    const docs = Object.keys(db)
      .filter(p => p.startsWith(`${path}/`) && !p.slice(path.length + 1).includes('/'))
      .map(makeDoc);
    return { docs, empty: docs.length === 0, forEach: fn => docs.forEach(fn) };
  });
  fs.addDoc.mockImplementation(async ({ path }, data) => {
    const id = `id${++idSeq}`;
    db[`${path}/${id}`] = data;
    return { id };
  });
  fs.setDoc.mockImplementation(async ({ path }, data, opts) => {
    db[path] = opts?.merge ? { ...db[path], ...data } : data;
  });
  fs.updateDoc.mockImplementation(async ({ path }, data) => {
    db[path] = { ...db[path], ...data };
  });
  fs.deleteDoc.mockImplementation(async ({ path }) => {
    delete db[path];
  });
  fs.writeBatch.mockImplementation(() => {
    const ops = [];
    return {
      delete: r => ops.push(r.path),
      commit: async () => ops.forEach(p => delete db[p]),
    };
  });
});

test('saving a profile never stores a password and strips a legacy one', async () => {
  db['users/a@b.com'] = { name: 'Old', pass: 'secret123' };
  await saveUserToFirestore({ email: 'a@b.com', name: 'New', photo: '', termCondition: true, pass: 'hunter2' });

  expect(db['users/a@b.com'].pass).toBe('DELETE_FIELD');
  expect(db['users/a@b.com'].name).toBe('New');
});

test('same brand + model is only a duplicate when the year matches too', async () => {
  const email = 'a@b.com';
  expect((await addUserVehicle(email, { brand: 'Toyota', model: 'Corolla', year: '2018' })).success).toBe(true);
  expect((await addUserVehicle(email, { brand: 'toyota ', model: 'corolla', year: '2018' })).success).toBe(false);
  expect((await addUserVehicle(email, { brand: 'Toyota', model: 'Corolla', year: '2022' })).success).toBe(true);
});

test('deleting a vehicle removes its records and cancels their reminders', async () => {
  const v = 'users/a@b.com/vehicles/car1';
  db[v] = { brand: 'Toyota' };
  db[`${v}/services/s1`] = { name: 'Oil' };
  db[`${v}/documents/d1`] = { documentName: 'Insurance' };
  db[`${v}/fuelLogs/f1`] = { liters: 10 };
  db['users/a@b.com/vehicles/car2/services/s2'] = { name: 'Keep me' };

  await deleteUserVehicle('a@b.com', 'car1');

  expect(Object.keys(db)).toEqual(['users/a@b.com/vehicles/car2/services/s2']);
  expect(ReminderScheduler.cancel).toHaveBeenCalledWith('service-s1');
  expect(ReminderScheduler.cancel).toHaveBeenCalledWith('document-d1');
});

test('editing a service keeps an explicit zero cost', async () => {
  const path = 'users/a@b.com/vehicles/car1/services/s1';
  db[path] = { name: 'Oil', totalCost: 500 };
  await updateUserService('a@b.com', { name: 'Oil', totalCost: 0 }, 'car1', 's1');
  expect(db[path].totalCost).toBe(0);
});
