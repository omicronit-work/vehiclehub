/*
 * Uploads src/util/currencyData.json to the Firestore `currencies` collection
 * (one doc per currency, id = ISO code; `index` is the number records save).
 * Existing docs are merged, so fields edited in the console (e.g. `hidden`)
 * are kept unless the JSON sets them.
 *
 *   node scripts/seedCurrencies.js --key path/to/service-account.json
 *   node scripts/seedCurrencies.js --dry-run      (prints, writes nothing)
 *
 * The key: Firebase console → Project settings → Service accounts →
 * Generate new private key. Keep it out of the repo.
 * GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json also works instead of --key.
 */
const fs = require('fs');
const path = require('path');
const data = require(path.join(__dirname, '../src/util/currencyData.json'));

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const keyArg = args.includes('--key') ? args[args.indexOf('--key') + 1] : null;

const fail = message => {
  console.error(`\n${message}\n`);
  process.exit(1);
};

const projectId = (() => {
  try {
    const gs = path.join(__dirname, '../android/app/google-services.json');
    return JSON.parse(fs.readFileSync(gs, 'utf8')).project_info.project_id;
  } catch {
    return undefined;
  }
})();

(async () => {
  if (dryRun) {
    data.forEach(({ code, ...fields }) => console.log(`currencies/${code}`, JSON.stringify(fields)));
    console.log(`${data.length} currencies (dry run, nothing written)`);
    return;
  }

  const keyPath = keyArg || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyPath) {
    fail([
      'No service-account key given.',
      '1. Firebase console → Project settings → Service accounts → Generate new private key',
      '2. Save the file outside this repo, e.g. ~/keys/vehiclehub-admin.json',
      '3. node scripts/seedCurrencies.js --key ~/keys/vehiclehub-admin.json',
    ].join('\n'));
  }
  const resolved = path.resolve(keyPath.replace(/^~(?=\/)/, process.env.HOME || '~'));
  if (!fs.existsSync(resolved)) fail(`Key file not found: ${resolved}`);

  let appApi;
  let firestoreApi;
  try {
    appApi = require('firebase-admin/app');
    firestoreApi = require('firebase-admin/firestore');
  } catch {
    fail('firebase-admin is not installed. Run: npm i -D firebase-admin');
  }

  const key = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  if (projectId && key.project_id && key.project_id !== projectId) {
    fail(`The key is for project "${key.project_id}", but the app uses "${projectId}".`);
  }
  const app = appApi.initializeApp({ credential: appApi.cert(key), projectId: key.project_id || projectId });
  const db = firestoreApi.getFirestore(app);
  const batch = db.batch();
  data.forEach(({ code, ...fields }) => {
    batch.set(db.collection('currencies').doc(code), fields, { merge: true });
  });
  await batch.commit();
  console.log(`Wrote ${data.length} currencies to project ${key.project_id || projectId}`);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
