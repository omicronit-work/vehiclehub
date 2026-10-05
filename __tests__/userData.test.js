import firestore from '@react-native-firebase/firestore';
import notifee from '@notifee/react-native';
import {
  saveUserToFirestore,
  addUserVehicle,
  deleteUserVehicle,
  updateUserService,
} from '../src/store/userSlice';

// Minimal in-memory Firestore: paths like "users/a@b.com/vehicles/v1".
let db;
let idSeq;

const makeDoc = path => ({
  id: path.split('/').pop(),
  ref: { path },
  exists: path in db,
  data: () => db[path],
});

const docRef = path => ({
  path,
  collection: name => collectionRef(`${path}/${name}`),
  get: async () => makeDoc(path),
  set: jest.fn(async (data, opts) => {
    db[path] = opts?.merge ? { ...db[path], ...data } : data;
  }),
  update: jest.fn(async data => { db[path] = { ...db[path], ...data }; }),
  delete: jest.fn(async () => { delete db[path]; }),
});

const collectionRef = path => ({
  doc: id => docRef(`${path}/${id}`),
  add: async data => {
    const id = `id${++idSeq}`;
    db[`${path}/${id}`] = data;
    return { id };
  },
  get: async () => {
    const docs = Object.keys(db)
      .filter(p => p.startsWith(`${path}/`) && !p.slice(path.length + 1).includes('/'))
      .map(makeDoc);
    return { docs, empty: docs.length === 0, forEach: fn => docs.forEach(fn) };
  },
});

beforeEach(() => {
  db = {};
  idSeq = 0;
  notifee.cancelNotification = jest.fn(() => Promise.resolve());
  firestore.mockImplementation(() => ({
    collection: name => collectionRef(name),
    batch: () => {
      const ops = [];
      return {
        delete: ref => ops.push(ref.path),
        commit: async () => ops.forEach(p => delete db[p]),
      };
    },
  }));
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
  expect(notifee.cancelNotification).toHaveBeenCalledWith('service-s1');
  expect(notifee.cancelNotification).toHaveBeenCalledWith('document-d1');
});

test('editing a service keeps an explicit zero cost', async () => {
  const path = 'users/a@b.com/vehicles/car1/services/s1';
  db[path] = { name: 'Oil', totalCost: 500 };
  await updateUserService('a@b.com', { name: 'Oil', totalCost: 0 }, 'car1', 's1');
  expect(db[path].totalCost).toBe(0);
});
