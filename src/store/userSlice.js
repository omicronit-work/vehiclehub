import { createSlice } from '@reduxjs/toolkit';
import firestore from '@react-native-firebase/firestore';
import { markSupersededServices } from '../util/dateStatus.js';
import { cancelReminder, reminderId } from '../util/notifications.js';
import { deleteImage } from '../util/imageStorage.js';
const initialState = {
  name: '',
  email: '',
  photo: '',
  termCondition:'',
  reload:false,

  userEmail:'',
  selectedCar:'',
  VehicalModal:false,
  Trigger:false,
  profileVersion:0,

};

/* ──────────────────────────────────────────────────────────────────────────
   EXPENSE DASHBOARD AGGREGATION
   Categories are derived from the fixed service-type list (service.name).
   Anything not in the map falls into "Others" so nothing is silently dropped.
────────────────────────────────────────────────────────────────────────── */

// Map each known service type → a display category
const SERVICE_CATEGORY_MAP = {
  'Engine Oil Refill':   'Oil & Fluids',
  'Oil Filter':          'Oil & Fluids',
  'Gear Oil':            'Oil & Fluids',
  'Tires Change':        'Tires & Parts',
  'Brake Pads':          'Brakes',
  'Full Body Servicing': 'Servicing',
};

// Order defines slice order + which color each gets in the dashboard
export const EXPENSE_CATEGORIES = ['Oil & Fluids', 'Tires & Parts', 'Brakes', 'Servicing', 'Fuel', 'Others'];

const FUEL_CATEGORY_INDEX = EXPENSE_CATEGORIES.indexOf('Fuel');

const categorizeService = s => {
  const cat = SERVICE_CATEGORY_MAP[(s.name || '').trim()] || 'Others';
  return EXPENSE_CATEGORIES.indexOf(cat);
};

const vehiclesRef = email => firestore().collection('users').doc(email).collection('vehicles');

const resolveVehicleIds = async (email, vehicleId) => {
  if (vehicleId) return [vehicleId];
  const vSnap = await vehiclesRef(email).get();
  return vSnap.docs.map(d => d.id);
};

// Aggregate service + fuel costs by month and category for a single year.
// vehicleId → that car only; omit → every vehicle the user owns.
export const getExpenseSummary = async (email, { vehicleId, year } = {}) => {
  if (!email) throw new Error('email is missing or empty');
  const targetYear = year ?? new Date().getFullYear();

  const vehicleIds = await resolveVehicleIds(email, vehicleId);

  const monthlyTotals = Array(12).fill(0);                                // line chart
  const categoryMonthly = EXPENSE_CATEGORIES.map(() => Array(12).fill(0)); // donut

  // Every vehicle's subcollections are fetched in parallel, not one car at a time.
  const snapshots = await Promise.all(vehicleIds.map(vId => Promise.all([
    vehiclesRef(email).doc(vId).collection('services').get(),
    vehiclesRef(email).doc(vId).collection('fuelLogs').get(),
  ])));

  for (const [sSnap, fSnap] of snapshots) {

    sSnap.forEach(doc => {
      const s = doc.data();
      const cost = Number(s.totalCost) || 0;
      if (!cost) return;

      // serviceDate is stored via new Date() → Firestore Timestamp
      const when = s.serviceDate?.toDate?.() || s.createdAt?.toDate?.() || null;
      if (!when || when.getFullYear() !== targetYear) return;

      const m = when.getMonth();
      monthlyTotals[m] += cost;
      categoryMonthly[categorizeService(s)][m] += cost;
    });

    fSnap.forEach(doc => {
      const f = doc.data();
      const cost = Number(f.totalCost) || 0;
      if (!cost) return;

      const when = f.date?.toDate?.() || f.createdAt?.toDate?.() || null;
      if (!when || when.getFullYear() !== targetYear) return;

      const m = when.getMonth();
      monthlyTotals[m] += cost;
      categoryMonthly[FUEL_CATEGORY_INDEX][m] += cost;
    });
  }

  return { year: targetYear, monthlyTotals, categoryMonthly, categories: EXPENSE_CATEGORIES };
};

/* ──────────────────────────────────────────────────────────────────────────
   UPCOMING REMINDERS
   Pulls services (by nextServiceDate) and documents (by expiryDate) that are
   overdue or due within `withinDays`, across one vehicle or all of them.
────────────────────────────────────────────────────────────────────────── */
export const getUpcomingReminders = async (email, { vehicleId, withinDays = 30 } = {}) => {
  if (!email) throw new Error('email is missing or empty');

  const vehicleIds = await resolveVehicleIds(email, vehicleId);

  const horizon = new Date(Date.now() + withinDays * 24 * 60 * 60 * 1000);
  const items = [];

  const snapshots = await Promise.all(vehicleIds.map(vId => Promise.all([
    vehiclesRef(email).doc(vId).collection('services').get(),
    vehiclesRef(email).doc(vId).collection('documents').get(),
  ])));

  snapshots.forEach(([sSnap, dSnap], i) => {
    const vId = vehicleIds[i];

    const services = markSupersededServices(sSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    services.forEach(s => {
      if (s.superseded) return;
      const due = s.nextServiceDate?.toDate?.();
      if (!due || due > horizon) return;
      items.push({ id: s.id, vehicleId: vId, kind: 'service', title: s.name || 'Service', dueDate: due });
    });

    dSnap.forEach(doc => {
      const d = doc.data();
      const due = d.expiryDate?.toDate?.();
      if (!due || due > horizon) return;
      items.push({ id: doc.id, vehicleId: vId, kind: 'document', title: d.documentName || 'Document', dueDate: due });
    });
  });

  items.sort((a, b) => a.dueDate - b.dueDate);
  return items;
};


// Every service/document the user asked to be reminded about whose due date
// is still ahead — the input for rebuilding device reminders after sign-in.
export const getReminderRecords = async (email) => {
  if (!email) throw new Error('email is missing or empty');

  const vehicleIds = await resolveVehicleIds(email);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const records = [];

  const snapshots = await Promise.all(vehicleIds.map(vId => Promise.all([
    vehiclesRef(email).doc(vId).collection('services').get(),
    vehiclesRef(email).doc(vId).collection('documents').get(),
  ])));

  snapshots.forEach(([sSnap, dSnap]) => {
    const services = markSupersededServices(sSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    services.forEach(s => {
      if (s.superseded || !s.remindMe) return;
      const due = s.nextServiceDate?.toDate?.();
      if (!due || due < startOfToday) return;
      records.push({
        id: s.id,
        kind: 'service',
        subject: s.name || 'Service',
        body: s.workshopName ? `At ${s.workshopName}` : 'Next service reminder.',
        dueDate: due,
      });
    });

    dSnap.forEach(doc => {
      const d = doc.data();
      if (!d.remindMe) return;
      const due = d.expiryDate?.toDate?.();
      if (!due || due < startOfToday) return;
      records.push({
        id: doc.id,
        kind: 'document',
        subject: d.documentName || 'Document',
        body: 'Renew it before it expires.',
        dueDate: due,
      });
    });
  });

  return records;
};

// SAVE USER
// Passwords are never stored here — Firebase Auth owns them. Every write also
// strips the `pass` field older app versions saved in plaintext.
export const saveUserToFirestore = async (user) => {
  const { email, name, photo, termCondition } = user;

  await firestore()
    .collection('users')
    .doc(email)
    .set(
      {
        name: name || '',
        email,
        photo: photo || '',
        termCondition: !!termCondition,
        pass: firestore.FieldValue.delete(),
      },
      { merge: true },
    );
};

// Called on every Google sign-in: creates the profile the first time, but
// never overwrites a name/photo/terms choice the user has since changed.
export const ensureUserDocument = async (user) => {
  const ref = firestore().collection('users').doc(user.email);
  const snap = await ref.get();
  if (snap.exists) {
    if (snap.data()?.pass !== undefined) {
      await ref.update({ pass: firestore.FieldValue.delete() });
    }
    return snap.data();
  }
  await saveUserToFirestore(user);
  return user;
};




export const saveServicesToFirestore = async (servicesArray) => {
  try {
    await firestore()
      .collection('service')
      .doc('service_list')
      .set({
        services: servicesArray,
      });

    return { success: true };
  } catch (error) {
    console.error('Error saving services:', error);
    return { success: false, error };
  }
};


const normalize = v => String(v ?? '').trim().toLowerCase();

// Same brand + model + year (case/whitespace-insensitive) counts as a
// duplicate; two cars of the same model from different years do not.
const findDuplicateVehicle = async (email, vehicle, excludeId) => {
  const snap = await vehiclesRef(email).get();
  return snap.docs.find(d => {
    if (d.id === excludeId) return false;
    const v = d.data();
    return normalize(v.brand) === normalize(vehicle.brand)
      && normalize(v.model) === normalize(vehicle.model)
      && normalize(v.year) === normalize(vehicle.year);
  });
};

// ADD USER VEHICLE (with duplicate check)
export const addUserVehicle = async (email, vehicle) => {
  try {
    if (await findDuplicateVehicle(email, vehicle)) {
      return { success: false, message: 'Vehicle Already Exist' };
    }

    // Add new vehicle if no duplicate found
    await firestore()
  .collection('users')
  .doc(email)
  .collection('vehicles')
  .add({
    brand: vehicle.brand,
    model: vehicle.model,
    year: vehicle.year,
    imageUrl: vehicle.imageUrl || '',
    createdAt: firestore.FieldValue.serverTimestamp(),
  });

    return { success: true, message: 'Vehicle added successfully!' };

  } catch (error) {
    console.error('Error adding vehicle to Firestore:', error);
    throw error;
  }
};


// Raises the vehicle's stored odometer reading, never lowers it — a service
// or fuel log entered with an older/lower mileage (e.g. backfilling history)
// shouldn't roll back what "due in X km" alerts compare against.
export const bumpVehicleOdometer = async (email, vehicleId, mileage) => {
  const reading = Number(mileage);
  if (!email || !vehicleId || !Number.isFinite(reading) || reading <= 0) return;

  try {
    const ref = firestore()
      .collection('users').doc(email)
      .collection('vehicles').doc(vehicleId);

    const snap = await ref.get();
    const current = Number(snap.data()?.currentOdometer) || 0;
    if (reading > current) {
      await ref.update({ currentOdometer: reading });
    }
  } catch (error) {
    console.error('Error updating vehicle odometer:', error);
  }
};

// ADD SERVICE (subcollection)
export const addUserService = async (email, service, id) => {
  try {
    if (!id) {
      throw new Error('vehicleId (id) is missing or empty');
    }

    const data = {
      name: service.name,
      imageUrl: service.imageUrl || '',
      description: service.description,
      currentMileage: Number(service.currentMileage) || 0,
      totalCost: Number(service.totalCost) || 0,
      workshopName: service.workshopName,
      serviceDate: service.serviceDate ? new Date(service.serviceDate) : null,
      nextServiceDate: service.nextServiceDate ? new Date(service.nextServiceDate) : null,
      nextServiceMileage: Number(service.nextServiceMileage) || null,
      remindMe: !!service.remindMe,
      createdAt: firestore.FieldValue.serverTimestamp(),
      // Dynamic extra fields - only include if they have values
      ...(service.oilType && { oilType: service.oilType }),
      ...(service.oilQuantity && { oilQuantity: service.oilQuantity }),
      ...(service.filterBrand && { filterBrand: service.filterBrand }),
      ...(service.tireBrand && { tireBrand: service.tireBrand }),
      ...(service.tireSize && { tireSize: service.tireSize }),
      ...(service.quantity && { quantity: service.quantity }),
      ...(service.padBrand && { padBrand: service.padBrand }),
      ...(service.frontOrRear && { frontOrRear: service.frontOrRear }),
      ...(service.servicePackage && { servicePackage: service.servicePackage }),
    };

    const docRef = await firestore()
      .collection('users')
      .doc(email)
      .collection('vehicles')
      .doc(id)
      .collection('services')
      .add(data);

    return docRef.id;
  } catch (error) {
    console.error('Error adding service:', error);
    throw error;
  }
};

// ADD DOCUMENT (second subcollection)
// ADD DOCUMENT (subcollection inside vehicle)
export const addUserDocument = async (email, document, id) => {
  try {
    if (!id) {
      throw new Error('vehicleId (id) is missing or empty');
    }

    const data = {
      documentName: document.documentName,
      description: document.description || '',
      issueDate: document.issueDate
        ? new Date(document.issueDate)
        : null,
      expiryDate: document.expiryDate
        ? new Date(document.expiryDate)
        : null,
      remindMe: !!document.remindMe,
      imageUrl: document.imageUrl || '',
      file: document.file || null, // file url or object
      createdAt: firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await firestore()
      .collection('users')
      .doc(email)
      .collection('vehicles')
      .doc(id)
      .collection('documents')
      .add(data);

    return docRef.id;
  } catch (error) {
    console.error('Error adding document:', error);
    throw error;
  }
};

export const updateUserDocument = async (email, document, vehicleId, documentId) => {
  try {
    if (!vehicleId) {
      throw new Error('vehicleId (id) is missing or empty');
    }

    if (!documentId) {
      throw new Error('documentId is missing or empty');
    }

    const data = {
      documentName: document.documentName,
      description: document.description || '',
      issueDate: document.issueDate ? new Date(document.issueDate) : null,
      expiryDate: document.expiryDate ? new Date(document.expiryDate) : null,
      remindMe: !!document.remindMe,
      imageUrl: document.imageUrl || '',
      file: document.file || null,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    };

    await firestore()
      .collection('users')
      .doc(email)
      .collection('vehicles')
      .doc(vehicleId)
      .collection('documents')
      .doc(documentId)
      .update(data);

    return documentId;
  } catch (error) {
    console.error('Error updating document:', error);
    throw error;
  }
};

// Keeps an explicit 0 (a free service) instead of turning it into null.
const toNumberOrNull = v => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const updateUserService = async (email, dataSource, vehicleId, serviceId) => {
  try {
    if (!vehicleId) throw new Error('vehicleId (id) is missing or empty');
    if (!serviceId) throw new Error('serviceId is missing or empty');

    const data = {
      name: dataSource.name || '',
      description: dataSource.description || '',
      serviceDate: dataSource.serviceDate ? new Date(dataSource.serviceDate) : null,
      nextServiceDate: dataSource.nextServiceDate ? new Date(dataSource.nextServiceDate) : null,
      nextServiceMileage: Number(dataSource.nextServiceMileage) || null,
      remindMe: !!dataSource.remindMe,
      currentMileage: toNumberOrNull(dataSource.currentMileage),
      totalCost: toNumberOrNull(dataSource.totalCost),
      workshopName: dataSource.workshopName || '',
      imageUrl: dataSource.imageUrl || '',
      updatedAt: firestore.FieldValue.serverTimestamp(),
      // Dynamic extra fields — include even if empty to allow clearing old values
      oilType: dataSource.oilType || '',
      oilQuantity: dataSource.oilQuantity || '',
      filterBrand: dataSource.filterBrand || '',
      tireBrand: dataSource.tireBrand || '',
      tireSize: dataSource.tireSize || '',
      quantity: dataSource.quantity || '',
      padBrand: dataSource.padBrand || '',
      frontOrRear: dataSource.frontOrRear || '',
      servicePackage: dataSource.servicePackage || '',
    };

    await firestore()
      .collection('users')
      .doc(email)
      .collection('vehicles')
      .doc(vehicleId)
      .collection('services')
      .doc(serviceId)
      .update(data);

    return serviceId;
  } catch (error) {
    console.error('Error updating service:', error);
    throw error;
  }
};

// ADD FUEL LOG (subcollection inside vehicle)
export const addUserFuelLog = async (email, fuelLog, id) => {
  try {
    if (!id) {
      throw new Error('vehicleId (id) is missing or empty');
    }

    const data = {
      date: fuelLog.date ? new Date(fuelLog.date) : new Date(),
      odometer: Number(fuelLog.odometer) || 0,
      liters: Number(fuelLog.liters) || 0,
      pricePerLiter: Number(fuelLog.pricePerLiter) || 0,
      totalCost: Number(fuelLog.totalCost) || 0,
      fuelType: fuelLog.fuelType || 'Petrol',
      fullTank: !!fuelLog.fullTank,
      stationName: fuelLog.stationName || '',
      imageUrl: fuelLog.imageUrl || '',
      createdAt: firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await firestore()
      .collection('users')
      .doc(email)
      .collection('vehicles')
      .doc(id)
      .collection('fuelLogs')
      .add(data);

    return docRef.id;
  } catch (error) {
    console.error('Error adding fuel log:', error);
    throw error;
  }
};

export const updateUserFuelLog = async (email, fuelLog, vehicleId, fuelLogId) => {
  try {
    if (!vehicleId) throw new Error('vehicleId is missing or empty');
    if (!fuelLogId) throw new Error('fuelLogId is missing or empty');

    const data = {
      date: fuelLog.date ? new Date(fuelLog.date) : new Date(),
      odometer: Number(fuelLog.odometer) || 0,
      liters: Number(fuelLog.liters) || 0,
      pricePerLiter: Number(fuelLog.pricePerLiter) || 0,
      totalCost: Number(fuelLog.totalCost) || 0,
      fuelType: fuelLog.fuelType || 'Petrol',
      fullTank: !!fuelLog.fullTank,
      stationName: fuelLog.stationName || '',
      imageUrl: fuelLog.imageUrl || '',
      updatedAt: firestore.FieldValue.serverTimestamp(),
    };

    await firestore()
      .collection('users')
      .doc(email)
      .collection('vehicles')
      .doc(vehicleId)
      .collection('fuelLogs')
      .doc(fuelLogId)
      .update(data);

    return fuelLogId;
  } catch (error) {
    console.error('Error updating fuel log:', error);
    throw error;
  }
};

export const deleteUserFuelLog = async (email, vehicleId, fuelLogId) => {
  try {
    if (!email) throw new Error('email is missing or empty');
    if (!vehicleId) throw new Error('vehicleId is missing or empty');
    if (!fuelLogId) throw new Error('fuelLogId is missing or empty');

    await firestore()
      .collection('users')
      .doc(email)
      .collection('vehicles')
      .doc(vehicleId)
      .collection('fuelLogs')
      .doc(fuelLogId)
      .delete();

    return { success: true, fuelLogId };
  } catch (error) {
    console.error('Error deleting fuel log:', error);
    throw error;
  }
};

// DELETE SERVICE (subcollection inside vehicle)
export const deleteUserService =async (email, vehicleId, serviceId) => {
  try {
    if (!email) throw new Error('email is missing or empty');
    if (!vehicleId) throw new Error('vehicleId is missing or empty');
    if (!serviceId) throw new Error('serviceId is missing or empty');


    await firestore()
      .collection('users')
      .doc(email)
      .collection('vehicles')
      .doc(vehicleId)
      .collection('services')
      .doc(serviceId)
      .delete();

    return { success: true, serviceId };
  } catch (error) {
    console.error('Error deleting service:', error);
    throw error;
  }
};

// DELETE DOCUMENT (subcollection inside vehicle)
export const deleteUserDocument = async (email, vehicleId, documentId) => {
  try {
    if (!email) throw new Error('email is missing or empty');
    if (!vehicleId) throw new Error('vehicleId is missing or empty');
    if (!documentId) throw new Error('documentId is missing or empty');


    await firestore()
      .collection('users')
      .doc(email)
      .collection('vehicles')
      .doc(vehicleId)
      .collection('documents')
      .doc(documentId)
      .delete();

    return { success: true, documentId };
  } catch (error) {
    console.error('Error deleting document:', error);
    throw error;
  }
};

// UPDATE VEHICLE
export const updateUserVehicle = async (email, vehicleId, vehicleData) => {
  try {
    if (!vehicleId) {
      throw new Error('vehicleId is missing or empty');
    }

    if (await findDuplicateVehicle(email, vehicleData, vehicleId)) {
      return { success: false, message: 'Vehicle Already Exist' };
    }

    const data = {
      brand: vehicleData.brand || '',
      model: vehicleData.model || '',
      year: vehicleData.year || '',
      imageUrl: vehicleData.imageUrl || '',
      updatedAt: firestore.FieldValue.serverTimestamp(),
    };

    await firestore()
      .collection('users')
      .doc(email)
      .collection('vehicles')
      .doc(vehicleId)
      .update(data);

    return { success: true, vehicleId };
  } catch (error) {
    console.error('Error updating vehicle:', error);
    throw error;
  }
};

const VEHICLE_SUBCOLLECTIONS = ['services', 'documents', 'fuelLogs'];
const BATCH_LIMIT = 450; // Firestore caps a batch at 500 writes

const deleteDocs = async docs => {
  for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
    const batch = firestore().batch();
    docs.slice(i, i + BATCH_LIMIT).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
};

// Firestore doesn't cascade: a vehicle's services, documents and fuel logs
// are deleted explicitly, along with their images and scheduled reminders.
export const deleteUserVehicle = async (email, vehicleId) => {
  try {
    if (!email) throw new Error('email is missing or empty');
    if (!vehicleId) throw new Error('vehicleId is missing or empty');

    const vehicleRef = vehiclesRef(email).doc(vehicleId);
    const [vehicleSnap, ...subSnaps] = await Promise.all([
      vehicleRef.get(),
      ...VEHICLE_SUBCOLLECTIONS.map(name => vehicleRef.collection(name).get()),
    ]);

    const [services, documents] = subSnaps;
    services.docs.forEach(d => cancelReminder(reminderId('service', d.id)));
    documents.docs.forEach(d => cancelReminder(reminderId('document', d.id)));

    const imageUrls = [
      vehicleSnap.data()?.imageUrl,
      ...subSnaps.flatMap(snap => snap.docs.map(d => d.data()?.imageUrl)),
    ].filter(Boolean);

    await deleteDocs(subSnaps.flatMap(snap => snap.docs));
    await vehicleRef.delete();

    await Promise.all(imageUrls.map(deleteImage));
    return { success: true };
  } catch (error) {
    console.error('Error deleting vehicle:', error);
    throw error;
  }
};

// Removes everything the account owns in Firestore/Storage: every vehicle
// (with its records and images), the profile photo and the user document.
// The Firebase Auth user itself is deleted by the caller afterwards.
export const deleteUserAccountData = async (email) => {
  if (!email) throw new Error('email is missing or empty');

  const vSnap = await vehiclesRef(email).get();
  for (const v of vSnap.docs) {
    await deleteUserVehicle(email, v.id);
  }

  const userRef = firestore().collection('users').doc(email);
  const userSnap = await userRef.get();
  await deleteImage(userSnap.data()?.photo);
  await userRef.delete();
};



const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setUserInfo: (state, action) => {
      state.name = action.payload.name;
      state.email = action.payload.email;
      state.photo = action.payload.photo;
      state.termCondition=action.payload.termCondition;
    },

    setUserEmail:(state, action)=>{
      state.userEmail = action.payload;
    },

    setSelectedCar:(state, action)=>{
        state.selectedCar = action.payload
    },
    setaddVehicalModalRd:(state, action)=>{
        state.VehicalModal = action.payload
    },
    setTrigger:(state,action)=>{
        state.Trigger=action.payload
    },
    setReload:(state,action)=>{
      state.reload=action.payload

    },

    // Bumped whenever the profile (name/photo) is saved anywhere in the app,
    // so the persistently-mounted Header can refetch and refresh its greeting/avatar.
    bumpProfileVersion:(state)=>{
      state.profileVersion += 1;
    },

    // Full reset on logout / account deletion so nothing (selected car,
    // email, modal flags) leaks into the next session on this device.
    clearUser: () => initialState,
  },
});

export const { setUserInfo, clearUser, setUserEmail, setSelectedCar,setTrigger, setaddVehicalModalRd, setReload, bumpProfileVersion } = userSlice.actions;
export default userSlice.reducer;
