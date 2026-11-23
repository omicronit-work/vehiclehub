/*
 * Adds sample vehicles, each with fuel logs, services and documents, to one
 * account (users/{email}/vehicles/...), in the same shape the app saves.
 * Every seeded vehicle carries `sample: true` so --remove can take them out
 * again without touching real records.
 *
 *   node scripts/seedSampleData.js --email you@example.com --key path/to/service-account.json
 *   node scripts/seedSampleData.js --email you@example.com --currency MYR --key ...
 *   node scripts/seedSampleData.js --email you@example.com --remove --key ...
 *   node scripts/seedSampleData.js --email you@example.com --dry-run   (prints, writes nothing)
 *
 * --currency (default BDT) is the currency every amount is saved in; records
 * are never converted, so pick the one the account uses or they'll be left
 * out of its totals. Dates are relative to today, so reminders show a mix of
 * expired / due soon / fine.
 *
 * Key: Firebase console → Project settings → Service accounts → Generate new
 * private key. Keep it out of the repo. GOOGLE_APPLICATION_CREDENTIALS works too.
 */
const fs = require('fs');
const path = require('path');
const currencies = require(path.join(__dirname, '../src/util/currencyData.json'));

const args = process.argv.slice(2);
const arg = name => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const dryRun = args.includes('--dry-run');
const remove = args.includes('--remove');
const email = (arg('--email') || '').trim().toLowerCase();
const currencyCode = (arg('--currency') || 'BDT').toUpperCase();
const keyArg = arg('--key');

const fail = message => {
  console.error(`\n${message}\n`);
  process.exit(1);
};

if (!email) fail('Pass the account to fill: --email you@example.com');
const currency = currencies.find(c => c.code === currencyCode);
if (!currency) fail(`Unknown currency "${currencyCode}" (not in src/util/currencyData.json).`);
const money = { currency: currency.code, selected_currency: currency.index };

// Prices below are in taka; scale them so other currencies look plausible.
const PER_BDT = { BDT: 1, INR: 0.7, MYR: 0.039, THB: 0.29, USD: 0.0083, EUR: 0.0077, GBP: 0.0066 };
const rate = PER_BDT[currency.code] ?? PER_BDT.USD;
const amount = bdt => Math.round(bdt * rate * 100) / 100;

const DAY = 24 * 60 * 60 * 1000;
const daysFromNow = n => new Date(Date.now() + n * DAY);

// ─── Sample data ─────────────────────────────────────────────────

const VEHICLES = [
  {
    brand: 'Toyota', model: 'Corolla', year: '2019', startOdometer: 48200,
    fuel: { type: 'Octane', name: '', priceBdt: 125, kmPerLitre: 13, litres: 35, stations: ['Padma Oil, Gulshan', 'Meghna Petroleum, Banani', 'Jamuna Oil, Tejgaon'] },
    services: [
      { name: 'Engine Oil Refill', daysAgo: 150, costBdt: 4800, workshopName: 'Navana Toyota Service', description: 'Regular oil change', nextDays: 30, nextKm: 5000, detail: { oilBase: 'Fully synthetic', oilBrand: 'Castrol', oilType: '5W-30', oilQuantity: '4', filterChanged: 'Yes' } },
      { name: 'Wheel Alignment', daysAgo: 90, costBdt: 1500, workshopName: 'Tyre House, Tejgaon', description: 'Pulling to the left', nextDays: null, nextKm: null, detail: { alignmentWork: 'Alignment & balancing' } },
      { name: 'Brake Pads', daysAgo: 20, costBdt: 3500, workshopName: 'Navana Toyota Service', description: 'Front pads worn', nextDays: 340, nextKm: 25000, detail: { padBrand: 'Brembo', frontOrRear: 'Front' } },
    ],
    documents: [
      { documentName: 'Insurance', issueDays: -355, expiryDays: 10, detail: { insurer: 'Green Delta Insurance', policyNumber: 'GDI-MV-238811', coverType: 'Comprehensive', insuredValue: '2200000' } },
      { documentName: 'Tax token', issueDays: -380, expiryDays: -15, detail: { documentNumber: 'TT-77812', validityYears: '1 year', issuingOffice: 'BRTA Mirpur' } },
      { documentName: 'Registration certificate', issueDays: -1800, expiryDays: null, detail: { registrationNumber: 'Dhaka Metro GA 23-4512', chassisNumber: 'NZE161-3112456', engineNumber: '1NZ-X823411', issuingOffice: 'BRTA Mirpur' } },
    ],
  },
  {
    brand: 'Honda', model: 'Civic', year: '2021', startOdometer: 22500,
    fuel: { type: 'Octane', name: '', priceBdt: 125, kmPerLitre: 12, litres: 40, stations: ['Trust Filling Station, Mohakhali', 'Padma Oil, Gulshan'] },
    services: [
      { name: 'Full Body Servicing', daysAgo: 120, costBdt: 9500, workshopName: 'Honda Service Centre, Tejgaon', description: '20,000 km service', nextDays: 60, nextKm: 10000, detail: { workDone: 'Oil, filters, brake check, AC check' } },
      { name: 'Battery', daysAgo: 45, costBdt: 11500, workshopName: 'Rahimafrooz Battery Point', description: 'Old battery would not hold charge', nextDays: null, nextKm: null, detail: { batteryBrand: 'Volvo', batteryCapacity: '45', warrantyMonths: '12' } },
    ],
    documents: [
      { documentName: 'Insurance', issueDays: -200, expiryDays: 165, detail: { insurer: 'Pragati Insurance', policyNumber: 'PIL-55102', coverType: 'Third party' } },
      { documentName: 'Fitness certificate', issueDays: -340, expiryDays: 25, detail: { documentNumber: 'FC-110932', validityYears: '1 year', fitnessResult: 'Passed', issuingOffice: 'BRTA Ikurial' } },
    ],
  },
  {
    brand: 'Yamaha', model: 'FZS V3', year: '2022', startOdometer: 9100,
    fuel: { type: 'Octane', name: '', priceBdt: 125, kmPerLitre: 45, litres: 9, stations: ['Meghna Petroleum, Banani', 'Jamuna Oil, Tejgaon'] },
    services: [
      { name: 'Engine Oil Refill', daysAgo: 70, costBdt: 950, workshopName: 'ACI Motors Yamaha', description: '', nextDays: -5, nextKm: 2000, detail: { oilBase: 'Semi-synthetic', oilBrand: 'Yamalube', oilType: '10W-40', oilQuantity: '1', filterChanged: 'No' } },
      { name: 'Tires Change', daysAgo: 30, costBdt: 4200, workshopName: 'Bike Tyre Corner', description: 'Rear tyre worn out', nextDays: null, nextKm: null, detail: { tireBrand: 'MRF', tireSize: '140/60 R17', quantity: '1', tirePosition: 'Rear' } },
    ],
    documents: [
      { documentName: 'Tax token', issueDays: -300, expiryDays: 65, detail: { documentNumber: 'TT-90213', validityYears: '1 year', issuingOffice: 'BRTA Mirpur' } },
      { documentName: 'Driving licence', issueDays: -1500, expiryDays: 2150, detail: { licenceNumber: 'DK0123456L00001', holderName: 'Sample Rider', licenceType: 'Non-professional', vehicleClass: 'Motorcycle' } },
    ],
  },
];

// Six fill-ups, oldest first, every ~3 weeks, odometer climbing with them.
const fuelLogsFor = v => {
  const logs = [];
  let odometer = v.startOdometer;
  for (let i = 0; i < 6; i += 1) {
    const litres = Math.round(v.fuel.litres * (0.8 + ((i * 37) % 30) / 100) * 10) / 10;
    odometer += Math.round(litres * v.fuel.kmPerLitre * (0.92 + ((i * 13) % 15) / 100));
    const pricePerLiter = amount(v.fuel.priceBdt);
    logs.push({
      date: daysFromNow(-150 + i * 26),
      odometer,
      liters: litres,
      pricePerLiter,
      totalCost: Math.round(litres * pricePerLiter * 100) / 100,
      ...money,
      fuelType: v.fuel.type,
      fuelName: v.fuel.name,
      stationName: v.fuel.stations[i % v.fuel.stations.length],
      imageUrl: '',
    });
  }
  return logs;
};

// The odometer on a given day, read off the fuel-log timeline (the vehicle
// sits at startOdometer one fill-up interval before the first log).
const odometerOn = (v, logs, date) => {
  const points = [{ date: daysFromNow(-176), odometer: v.startOdometer }, ...logs];
  const after = points.findIndex(p => p.date >= date);
  if (after === -1) return points[points.length - 1].odometer;
  if (after === 0) return v.startOdometer;
  const a = points[after - 1];
  const b = points[after];
  return Math.round(a.odometer + ((b.odometer - a.odometer) * (date - a.date)) / (b.date - a.date));
};

const servicesFor = (v, logs) => v.services.map(s => ({
  name: s.name,
  imageUrl: '',
  description: s.description,
  currentMileage: odometerOn(v, logs, daysFromNow(-s.daysAgo)),
  totalCost: amount(s.costBdt),
  ...money,
  workshopName: s.workshopName,
  serviceDate: daysFromNow(-s.daysAgo),
  nextServiceDate: s.nextDays == null ? null : daysFromNow(s.nextDays),
  nextServiceMileage: s.nextKm ? odometerOn(v, logs, daysFromNow(-s.daysAgo)) + s.nextKm : null,
  remindMe: s.nextDays != null,
  ...s.detail,
}));

const documentsFor = v => v.documents.map(d => ({
  documentName: d.documentName,
  description: '',
  issueDate: daysFromNow(d.issueDays),
  expiryDate: d.expiryDays == null ? null : daysFromNow(d.expiryDays),
  remindMe: d.expiryDays != null,
  reminderDays: 7,
  imageUrl: '',
  file: null,
  ...d.detail,
}));

const build = () => VEHICLES.map(v => {
  const fuelLogs = fuelLogsFor(v);
  const services = servicesFor(v, fuelLogs);
  const readings = [...fuelLogs.map(f => f.odometer), ...services.map(s => s.currentMileage)];
  return {
    vehicle: {
      brand: v.brand,
      model: v.model,
      year: v.year,
      currentOdometer: Math.max(...readings),
      initialOdometer: v.startOdometer,
      imageUrl: '',
      sample: true,
    },
    fuelLogs,
    services,
    documents: documentsFor(v),
  };
});

// ─── Firestore ───────────────────────────────────────────────────

const projectId = (() => {
  try {
    const gs = path.join(__dirname, '../android/app/google-services.json');
    return JSON.parse(fs.readFileSync(gs, 'utf8')).project_info.project_id;
  } catch {
    return undefined;
  }
})();

const connect = () => {
  const keyPath = keyArg || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyPath) {
    fail([
      'No service-account key given.',
      '1. Firebase console → Project settings → Service accounts → Generate new private key',
      '2. Save the file outside this repo, e.g. ~/keys/vehiclehub-admin.json',
      '3. node scripts/seedSampleData.js --email you@example.com --key ~/keys/vehiclehub-admin.json',
    ].join('\n'));
  }
  const resolved = path.resolve(keyPath.replace(/^~(?=\/)/, process.env.HOME || '~'));
  if (!fs.existsSync(resolved)) fail(`Key file not found: ${resolved}`);

  const appApi = require('firebase-admin/app');
  const firestoreApi = require('firebase-admin/firestore');
  const key = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  if (projectId && key.project_id && key.project_id !== projectId) {
    fail(`The key is for project "${key.project_id}", but the app uses "${projectId}".`);
  }
  const app = appApi.initializeApp({ credential: appApi.cert(key), projectId: key.project_id || projectId });
  return { db: firestoreApi.getFirestore(app), FieldValue: firestoreApi.FieldValue, key };
};

const SUBCOLLECTIONS = ['fuelLogs', 'services', 'documents', 'schedules'];

(async () => {
  const data = build();

  if (dryRun) {
    data.forEach(({ vehicle, ...records }) => {
      console.log(`\n${vehicle.brand} ${vehicle.model} ${vehicle.year}`, JSON.stringify(vehicle));
      Object.entries(records).forEach(([name, list]) => {
        list.forEach(r => console.log(`  ${name}`, JSON.stringify(r)));
      });
    });
    console.log(`\n${data.length} vehicles for users/${email} in ${currency.code} (dry run, nothing written)`);
    return;
  }

  const { db, FieldValue, key } = connect();
  const vehicles = db.collection('users').doc(email).collection('vehicles');

  if (remove) {
    const snap = await vehicles.where('sample', '==', true).get();
    for (const v of snap.docs) {
      for (const name of SUBCOLLECTIONS) {
        const sub = await v.ref.collection(name).get();
        const batch = db.batch();
        sub.docs.forEach(d => batch.delete(d.ref));
        if (sub.size) await batch.commit();
      }
      await v.ref.delete();
    }
    console.log(`Removed ${snap.size} sample vehicles from users/${email}`);
    return;
  }

  const user = await db.collection('users').doc(email).get();
  if (!user.exists) fail(`users/${email} doesn't exist in ${key.project_id || projectId}. Sign in to the app with that account first.`);

  // Same duplicate rule as addUserVehicle: brand + model + year.
  const existing = (await vehicles.get()).docs.map(d => d.data());
  const norm = s => String(s ?? '').trim().toLowerCase();
  const stamp = { createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() };

  let added = 0;
  for (const { vehicle, ...records } of data) {
    const label = `${vehicle.brand} ${vehicle.model} ${vehicle.year}`;
    if (existing.some(e => ['brand', 'model', 'year'].every(k => norm(e[k]) === norm(vehicle[k])))) {
      console.log(`Skipped ${label} (already in the garage)`);
      continue;
    }
    const ref = vehicles.doc();
    const batch = db.batch();
    batch.set(ref, { ...vehicle, ...stamp });
    Object.entries(records).forEach(([name, list]) => {
      list.forEach(r => batch.set(ref.collection(name).doc(), { ...r, ...stamp }));
    });
    await batch.commit();
    added += 1;
    console.log(`Added ${label}: ${records.fuelLogs.length} fuel logs, ${records.services.length} services, ${records.documents.length} documents`);
  }
  console.log(`\n${added} vehicles added to users/${email} in ${currency.code}. Pull to refresh in the app.`);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
