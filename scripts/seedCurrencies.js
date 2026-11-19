/*
 * Uploads src/util/currencyData.json to the Firestore `currencies` collection
 * (one doc per currency, id = ISO code). Existing docs are merged, so fields
 * edited in the console (e.g. `hidden`) are kept unless the JSON sets them.
 *
 *   npm i -D firebase-admin
 *   GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json node scripts/seedCurrencies.js
 *
 * Add --dry-run to print what would be written.
 */
const path = require('path');
const data = require(path.join(__dirname, '../src/util/currencyData.json'));

const dryRun = process.argv.includes('--dry-run');

(async () => {
  if (dryRun) {
    data.forEach(({ code, ...fields }) => console.log(`currencies/${code}`, JSON.stringify(fields)));
    console.log(`${data.length} currencies (dry run, nothing written)`);
    return;
  }
  const admin = require('firebase-admin');
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
  const db = admin.firestore();
  const batch = db.batch();
  data.forEach(({ code, ...fields }) => {
    batch.set(db.collection('currencies').doc(code), fields, { merge: true });
  });
  await batch.commit();
  console.log(`Wrote ${data.length} currencies`);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
