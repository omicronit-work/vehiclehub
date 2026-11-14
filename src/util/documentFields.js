import { t } from '../i18n';
import { t as tr } from '../i18n';
// Single source of truth for document types — the documents counterpart of
// util/serviceFields.js. Each type defines its chip icon (a DocumentTypeIcon
// glyph key), detail fields, form wording and validity rule.
// AddDocument / DocumentUpdate render from this, userSlice persists the keys,
// and the lists / view / export label from it — add or change a document type
// here only.
//
// Field shape: same as serviceFields.js (key, label, type, placeholder,
// suffix, options, suggest, full). `suggest` lists load from the shared
// Firestore `serviceOptions/{list}` docs, so document lists use a `doc…` name.

const choice = (label, options) => ({ label, type: 'choice', options, full: true });
const suggest = (list, addLabel, dependsOn) => ({ suggest: { list, addLabel, dependsOn } });


// Field definitions and wording are written in English (the translation keys);
// labels/placeholders/copy are put in the app language when they're handed out.
const localizeStrings = (obj, keys) => {
  const out = { ...obj };
  (keys || Object.keys(out)).forEach(k => { if (typeof out[k] === 'string') out[k] = tr(out[k]); });
  return out;
};

const FIELDS = {
  documentNumber: { get label() { return tr('Document no.'); }, get placeholder() { return tr('Number on the paper'); } },
  issuingOffice: { get label() { return tr('Issuing office'); }, get placeholder() { return tr('e.g. Transport office'); }, ...suggest('docIssuingOffices', 'Office') },

  // Tax token / fitness / permit
  validityYears: choice('Valid for', ['1 year', '2 years', '3 years', '5 years']),
  fitnessResult: choice('Result', ['Passed', 'Passed with notes']),
  route: { get label() { return tr('Route'); }, get placeholder() { return tr('e.g. City A – City B'); }, full: true },
  permitType: choice('Permit type', ['Route permit', 'Contract carriage', 'Goods carriage']),

  // Insurance
  insurer: { get label() { return tr('Insurance company'); }, get placeholder() { return tr('Insurer name'); }, ...suggest('docInsurers', 'Company') },
  policyNumber: { get label() { return tr('Policy no.'); }, get placeholder() { return tr('Policy number'); } },
  coverType: choice('Cover', ['Third party', 'Comprehensive']),
  insuredValue: { get label() { return tr('Insured value'); }, type: 'number', placeholder: '0' },

  // Registration
  registrationNumber: { get label() { return tr('Registration no.'); }, get placeholder() { return tr('Number plate'); } },
  chassisNumber: { get label() { return tr('Chassis no.'); }, get placeholder() { return tr('Chassis number'); } },
  engineNumber: { get label() { return tr('Engine no.'); }, get placeholder() { return tr('Engine number'); } },

  // Driving licence
  licenceNumber: { get label() { return tr('Licence no.'); }, get placeholder() { return tr('Licence number'); } },
  licenceType: choice('Licence type', ['Non-professional', 'Professional']),
  // Thailand: a first licence is temporary (2 years), then a 5-year one.
  licenceTypeTH: choice('Licence type', ['Temporary (2 years)', 'Private (5 years)']),
  vehicleClass: choice('Vehicle class', ['Motorcycle', 'Light', 'Medium', 'Heavy']),
  holderName: { get label() { return tr('Holder name'); }, get placeholder() { return tr('Name on the licence'); } },

  // Emission
  emissionResult: choice('Result', ['Passed', 'Failed']),

  // Warranty
  warrantyProvider: { get label() { return tr('Provider'); }, get placeholder() { return tr('Dealer or manufacturer'); }, ...suggest('docWarrantyProviders', 'Provider') },
  warrantyMonths: { get label() { return tr('Warranty'); }, type: 'number', placeholder: '0', suffix: 'months' },
  warrantyCoverage: { get label() { return tr('Covers'); }, get placeholder() { return tr('e.g. Engine & gearbox'); }, full: true },

  // Loan / finance
  lender: { get label() { return tr('Bank / lender'); }, get placeholder() { return tr('Bank or finance company'); }, ...suggest('docLenders', 'Lender') },
  loanAccount: { get label() { return tr('Account no.'); }, get placeholder() { return tr('Loan account number'); } },
  tenureMonths: { get label() { return tr('Tenure'); }, type: 'number', placeholder: '0', suffix: 'months' },
};

const LICENCE_MONTHS = {
  'Non-professional': 120,
  Professional: 60,
  'Temporary (2 years)': 24,
  'Private (5 years)': 60,
};

const years = d => {
  const n = parseInt(d.validityYears, 10);
  return Number.isFinite(n) ? n * 12 : null;
};

// Validity rule: `months(details)` is how long the document stays valid from
// its issue date; `requires` lists details that must be filled first;
// `fallback` is used while they aren't; `why(details)` names the reason in
// the suggestion hint.
export const DOCUMENT_TYPES = [
  {
    name: 'Tax token', aliases: ['tax token', 'tax', 'token'], icon: 'taxToken', popular: true,
    fields: ['documentNumber', 'validityYears', 'issuingOffice'],
    copy: { get issueLabel() { return tr('Paid on'); }, get expiryLabel() { return tr('Valid until'); }, get remindLabel() { return tr('Remind me before the tax token expires'); }, get notesPlaceholder() { return tr('e.g. Amount paid, receipt number…'); } },
    validity: { requires: ['validityYears'], months: years, fallback: 12, why: d => (d.validityYears ? tr('{0} tax token', { 0: d.validityYears }) : tr('yearly tax token')) },
  },
  {
    name: 'Fitness certificate', aliases: ['fitness'], icon: 'fitness', popular: true,
    fields: ['documentNumber', 'validityYears', 'fitnessResult', 'issuingOffice'],
    copy: { get issueLabel() { return tr('Inspected on'); }, get expiryLabel() { return tr('Valid until'); }, get remindLabel() { return tr('Remind me before the fitness expires'); }, get notesPlaceholder() { return tr('e.g. Inspector notes, items fixed…'); } },
    validity: { requires: ['validityYears'], months: years, fallback: 24, why: d => (d.validityYears ? tr('{0} fitness', { 0: d.validityYears }) : tr('usual fitness term')) },
  },
  {
    name: 'Insurance', aliases: ['insurance', 'policy', 'cover'], icon: 'insurance', popular: true,
    fields: ['insurer', 'policyNumber', 'coverType', 'insuredValue'],
    copy: { get issueLabel() { return tr('Starts on'); }, get expiryLabel() { return tr('Ends on'); }, get remindLabel() { return tr('Remind me before the policy ends'); }, get notesPlaceholder() { return tr('e.g. Agent contact, claim history…'); } },
    validity: { requires: [], months: () => 12, why: d => (d.coverType ? tr('yearly {0} policy', { 0: d.coverType.toLowerCase() }) : tr('yearly policy')) },
  },
  {
    // Thailand: compulsory third-party cover (พ.ร.บ.), renewed every year
    // together with the road tax.
    name: 'Compulsory insurance (Por Ror Bor)', aliases: ['compulsory insurance', 'por ror bor', 'prb', 'พ.ร.บ', 'act insurance', 'ctp'], icon: 'insurance',
    fields: ['insurer', 'policyNumber'],
    copy: { get issueLabel() { return tr('Starts on'); }, get expiryLabel() { return tr('Ends on'); }, get remindLabel() { return tr('Remind me before the Por Ror Bor ends'); }, get notesPlaceholder() { return tr('e.g. Bought with the road tax at…'); } },
    validity: { requires: [], months: () => 12, why: () => tr('yearly compulsory insurance') },
  },
  {
    // Yearly vehicle tax (Thailand: ภาษีรถยนต์ and the tax sticker).
    name: 'Road tax', aliases: ['road tax', 'vehicle tax', 'tax sticker', 'ภาษี', 'ป้ายภาษี'], icon: 'taxToken',
    fields: ['documentNumber', 'issuingOffice'],
    copy: { get issueLabel() { return tr('Paid on'); }, get expiryLabel() { return tr('Due again'); }, get remindLabel() { return tr('Remind me before the road tax is due'); }, get notesPlaceholder() { return tr('e.g. Amount paid, where it was paid…'); } },
    validity: { requires: [], months: () => 12, why: () => tr('yearly road tax') },
  },
  {
    // Thailand: ตรอ. inspection, needed yearly for cars 7+ years old (5+ for
    // motorcycles) before the road tax can be renewed.
    name: 'Vehicle inspection', aliases: ['vehicle inspection', 'inspection', 'tor ror or', 'ตรอ', 'roadworthy', 'mot'], icon: 'fitness',
    fields: ['documentNumber', 'emissionResult', 'issuingOffice'],
    copy: { get issueLabel() { return tr('Inspected on'); }, get expiryLabel() { return tr('Valid until'); }, get remindLabel() { return tr('Remind me before the next inspection'); }, get notesPlaceholder() { return tr('e.g. Inspection centre, items fixed…'); } },
    validity: { requires: [], months: () => 12, why: () => tr('yearly inspection') },
  },
  {
    name: 'Registration certificate', aliases: ['registration', 'rc book', 'blue book', 'rc'], icon: 'registration', popular: true,
    fields: ['registrationNumber', 'chassisNumber', 'engineNumber', 'issuingOffice'],
    copy: { get issueLabel() { return tr('Registered on'); }, get expiryLabel() { return tr('Valid until'); }, get remindLabel() { return tr('Remind me before it expires'); }, get notesPlaceholder() { return tr('e.g. Owner name, ownership transfer…'); } },
    validity: { requires: [], months: () => 12, why: () => tr('registration renewal') },
  },
  {
    name: 'Route permit', aliases: ['permit'], icon: 'permit',
    fields: ['documentNumber', 'permitType', 'route', 'issuingOffice'],
    copy: { get issueLabel() { return tr('Issued on'); }, get expiryLabel() { return tr('Valid until'); }, get remindLabel() { return tr('Remind me before the permit expires'); } },
    validity: { requires: [], months: () => 12, why: () => tr('yearly permit') },
  },
  {
    name: 'Driving licence', aliases: ['licence', 'license', 'driving', 'dl'], icon: 'licence', popular: true,
    fields: ['licenceNumber', 'holderName', 'licenceType', 'vehicleClass'],
    copy: { get issueLabel() { return tr('Issued on'); }, get expiryLabel() { return tr('Expires on'); }, get remindLabel() { return tr('Remind me before the licence expires'); }, get notesPlaceholder() { return tr('e.g. Blood group, endorsements…'); } },
    validity: {
      requires: ['licenceType'],
      months: d => LICENCE_MONTHS[d.licenceType] ?? 120,
      fallback: 120,
      why: d => (d.licenceType ? tr('{0} licence', { 0: d.licenceType.toLowerCase() }) : tr('driving licence')),
    },
  },
  {
    name: 'Emission certificate', aliases: ['emission', 'pollution', 'puc'], icon: 'emission',
    fields: ['documentNumber', 'emissionResult'],
    copy: { get issueLabel() { return tr('Tested on'); }, get expiryLabel() { return tr('Valid until'); }, get remindLabel() { return tr('Remind me before the next test'); } },
    validity: { requires: [], months: () => 6, why: () => tr('emission test') },
  },
  {
    name: 'Warranty', aliases: ['warranty', 'guarantee'], icon: 'warranty',
    fields: ['warrantyProvider', 'warrantyMonths', 'warrantyCoverage'],
    copy: { get issueLabel() { return tr('Starts on'); }, get expiryLabel() { return tr('Ends on'); }, get remindLabel() { return tr('Remind me before the warranty ends'); }, get notesPlaceholder() { return tr('e.g. Service conditions, claim contact…'); } },
    validity: { requires: ['warrantyMonths'], months: d => Number(d.warrantyMonths), why: d => tr('{0}-month warranty', { 0: d.warrantyMonths }) },
  },
  {
    name: 'Loan / finance', aliases: ['loan', 'finance', 'emi', 'lease'], icon: 'loan',
    fields: ['lender', 'loanAccount', 'tenureMonths'],
    copy: { get issueLabel() { return tr('Started on'); }, get expiryLabel() { return tr('Ends on'); }, get remindLabel() { return tr('Remind me before the loan ends'); }, get notesPlaceholder() { return tr('e.g. Monthly instalment, NOC status…'); } },
    validity: { requires: ['tenureMonths'], months: d => Number(d.tenureMonths), why: d => tr('{0}-month tenure', { 0: d.tenureMonths }) },
  },
].map((type, i) => ({ id: i + 1, ...type }));

// ─── Which types each country sees ──────────────────────────────
// Type names stay the same everywhere (they are what records store), so a
// record made in one country still opens anywhere. Each region lists the
// types to offer, which ones show before "More types", and example text
// that fits there. Unlisted countries get DEFAULT.
const REGION_DOCS = {
  BD: {
    types: ['Tax token', 'Fitness certificate', 'Insurance', 'Registration certificate', 'Driving licence',
      'Route permit', 'Emission certificate', 'Warranty', 'Loan / finance'],
    popular: ['Tax token', 'Fitness certificate', 'Insurance', 'Registration certificate', 'Driving licence'],
    placeholders: {
      issuingOffice: 'e.g. BRTA Mirpur', insurer: 'e.g. Green Delta', route: 'e.g. Dhaka – Chattogram',
      registrationNumber: 'e.g. Dhaka Metro-GA 11-2233', lender: 'e.g. City Bank',
    },
    notes: { 'Tax token': 'e.g. Amount paid, BRTA receipt number…' },
  },
  TH: {
    types: ['Compulsory insurance (Por Ror Bor)', 'Road tax', 'Insurance', 'Vehicle inspection',
      'Registration certificate', 'Driving licence', 'Warranty', 'Loan / finance'],
    popular: ['Compulsory insurance (Por Ror Bor)', 'Road tax', 'Insurance', 'Vehicle inspection', 'Driving licence'],
    placeholders: {
      issuingOffice: 'e.g. DLT Bangkok Area 1', insurer: 'e.g. Viriyah Insurance',
      registrationNumber: 'e.g. 1กข 1234 Bangkok', lender: 'e.g. Krungsri Auto',
    },
    fields: { licenceType: 'licenceTypeTH' },
    labels: { Insurance: 'Voluntary insurance' },
  },
  IN: {
    types: ['Insurance', 'Registration certificate', 'Emission certificate', 'Driving licence', 'Road tax',
      'Vehicle inspection', 'Route permit', 'Warranty', 'Loan / finance'],
    popular: ['Insurance', 'Registration certificate', 'Emission certificate', 'Driving licence'],
    placeholders: {
      issuingOffice: 'e.g. RTO Pune', insurer: 'e.g. ICICI Lombard',
      registrationNumber: 'e.g. MH 12 AB 1234', lender: 'e.g. HDFC Bank',
    },
    labels: { 'Emission certificate': 'PUC certificate' },
  },
  DEFAULT: {
    types: ['Insurance', 'Registration certificate', 'Driving licence', 'Road tax', 'Vehicle inspection',
      'Emission certificate', 'Warranty', 'Loan / finance'],
    popular: ['Insurance', 'Registration certificate', 'Driving licence', 'Road tax'],
    placeholders: {},
  },
};
const regionDocs = country => REGION_DOCS[country] || REGION_DOCS.DEFAULT;

/**
 * The document type chips for a country: [{ ...type, label, popular }].
 * `include` keeps a record's own type selectable when editing one made
 * elsewhere (e.g. a Bangladeshi tax token opened in Thailand).
 */
export const documentTypesFor = (country, include) => {
  const region = regionDocs(country);
  const names = [...region.types];
  if (include && DOCUMENT_TYPES.some(t => t.name === include) && !names.includes(include)) names.push(include);
  return names
    .map(name => DOCUMENT_TYPES.find(t => t.name === name))
    .filter(Boolean)
    .map(type => ({
      ...type,
      label: region.labels?.[type.name] || type.name,
      popular: region.popular.includes(type.name),
    }));
};

export const getDocumentType = name => {
  const key = (name || '').trim().toLowerCase();
  return key ? DOCUMENT_TYPES.find(t => t.name.toLowerCase() === key) || null : null;
};

const escapeRe = str => str.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

// Built-in type whose alias best (longest) matches a typed name, e.g.
// "Car insurance 2026" → Insurance, "DL" → Driving licence.
const matchTypeByAlias = name => {
  const text = ` ${name.trim().toLowerCase()} `;
  let best = null;
  let bestLen = 0;
  DOCUMENT_TYPES.forEach(type => {
    (type.aliases || []).forEach(alias => {
      // Short aliases (dl, rc, tax) must be whole words; longer ones may prefix.
      const re = alias.length <= 3
        ? new RegExp(`[^a-z]${escapeRe(alias)}[^a-z]`)
        : new RegExp(`[^a-z]${escapeRe(alias)}`);
      if (re.test(text) && alias.length > bestLen) {
        best = type;
        bestLen = alias.length;
      }
    });
  });
  return best;
};

// Built-in type a document name belongs to: exact name, else best alias match.
export const resolveDocumentType = name => getDocumentType(name) || (name ? matchTypeByAlias(name) : null);

// Form for a custom ("Other") name with no matching type.
const CUSTOM_PROFILE = {
  fields: ['documentNumber', ['issuingOffice', { get label() { return tr('Issued by'); }, get placeholder() { return tr('Office or company'); } }]],
  copy: {},
};

export const getDocumentProfile = name => {
  if (!name || !name.trim()) return null;
  const type = resolveDocumentType(name);
  return type ? { fields: type.fields, copy: type.copy, validity: type.validity } : CUSTOM_PROFILE;
};

// Region-only field variants (licenceTypeTH) store under their base key.
export const DOCUMENT_DETAIL_KEYS = Object.keys(FIELDS).filter(k => k !== 'licenceTypeTH');

// `country` (optional) swaps in that country's examples and choices; the
// stored key never changes (e.g. licenceType keeps its key in Thailand).
export const getDocumentFields = (name, country) => {
  const profile = getDocumentProfile(name);
  if (!profile) return [];
  const region = country ? regionDocs(country) : null;
  return profile.fields.map(entry => {
    const [key, overrides] = Array.isArray(entry) ? entry : [entry, null];
    const def = FIELDS[region?.fields?.[key] || key];
    const placeholder = region?.placeholders?.[key];
    return localizeStrings({ key, ...def, ...(placeholder ? { placeholder } : null), ...overrides }, ['label', 'placeholder']);
  });
};

// DocumentTypeIcon glyph for a document name (plain document when unknown).
// A built-in document type in the app language; a name the user typed stays as typed.
export const documentLabel = name => {
  const type = getDocumentType(name);
  if (!type) return name;
  const key = `doc.${type.name}`;
  const label = t(key);
  return label === key ? name : label;
};

export const getDocumentIconKey = name => resolveDocumentType(name)?.icon || 'document';

// Getters, so each read is in the current language.
export const DOCUMENT_DETAIL_LABELS = Object.defineProperties(
  {},
  Object.fromEntries(DOCUMENT_DETAIL_KEYS.map(k => [k, { get: () => tr(FIELDS[k].label), enumerable: true }])),
);

// Value as it should read in view/export (adds the unit to numeric fields).
export const formatDocumentDetail = (key, value) => {
  const suffix = FIELDS[key]?.suffix;
  // Choice values are saved in English; tr() shows them in the app language
  // and leaves anything typed by the user as it is.
  return suffix && /^\d+(\.\d+)?$/.test(String(value)) ? `${value} ${suffix}` : tr(String(value));
};

// "Policy no. 12345 · Viriyah" — the key details for list cards.
export const documentSummary = item => {
  const fields = getDocumentFields(item?.documentName).filter(f => f.type !== 'choice' && f.type !== 'number');
  return fields
    .map(f => item?.[f.key])
    .filter(v => v && String(v).trim())
    .slice(0, 2)
    .join(' · ');
};

const DEFAULT_COPY = {
  get issueLabel() { return tr('Issue date'); },
  get expiryLabel() { return tr('Expiry date'); },
  get remindLabel() { return tr('Remind me before it expires'); },
  get notesPlaceholder() { return tr('Anything worth remembering…'); },
};

export const getDocumentCopy = (name, country) => {
  const copy = { ...DEFAULT_COPY, ...getDocumentProfile(name)?.copy };
  const note = country && regionDocs(country).notes?.[resolveDocumentType(name)?.name];
  return localizeStrings(note ? { ...copy, notesPlaceholder: note } : copy);
};

// Suggested expiry from the issue date (today when not set yet) and the
// type's validity rule. Null when the type has no rule or the details the
// rule depends on are missing and there's no fallback.
export const suggestExpiry = ({ name, issueDate, details }) => {
  const rule = getDocumentProfile(name)?.validity;
  if (!rule) return null;
  const ready = rule.requires.every(k => details?.[k]);
  const months = ready ? Number(rule.months(details || {})) : rule.fallback;
  if (!months || months <= 0) return null;

  const expiryDate = new Date(issueDate || new Date());
  expiryDate.setMonth(expiryDate.getMonth() + months);
  const span = months % 12 === 0
    ? (months === 12 ? tr('1 year') : tr('{0} years', { 0: months / 12 }))
    : tr('{0} months', { 0: months });
  const why = rule.why(ready ? details : {});
  return {
    expiryDate,
    hint: issueDate
      ? tr('{0} for the {1}', { 0: span, 1: why })
      : tr('{0} for the {1} · from today, set the issue date to adjust', { 0: span, 1: why }),
  };
};
