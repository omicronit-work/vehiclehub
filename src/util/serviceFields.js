import { formatKm } from './distance';
// Single source of truth for service types. Each type defines its chip icon
// (a ServiceTypeIcon glyph key),
// expense category, detail fields, form wording and next-due rule.
// AddService / ServiceUpdate render from this, userSlice persists the keys and
// buckets expenses with it, and the lists / view / export label from it —
// add or change a service type here only.
//
// Type flags: `odometer: false` drops the odometer from service records and
// schedules; `scheduleOdometer: false` drops it from schedules only.
//
// Field shape:
//   key          stored on the service document (flat)
//   label        shown above the input and in view/export
//   type         'text' | 'number' | 'choice' | 'multiline'   (default 'text')
//   placeholder  for text / number / multiline
//   suffix       unit shown inside a number input
//   options      for 'choice' — rendered as chips; an option may be
//                { label, sub: [{ label, value }] } to ask a follow-up
//                (Front → Left / Right / Both), stored as the sub value
//   suggest      for 'text' — { list, addLabel, dependsOn }: autocomplete
//                from the Firestore `serviceOptions/{list}` doc, with
//                "+ Add This <addLabel>" for a value that isn't listed.
//                With `dependsOn` (another field's key) the list is per
//                value of that field: tire models → `tireModels_michelin`
//   full         take the whole row instead of half

const choice = (label, options) => ({ label, type: 'choice', options, full: true });

// Choice option that asks which side: "Front" → "Front left" / "Front right" /
// "Front (both)".
const sided = label => ({
  label,
  sub: [
    { label: 'Left', value: `${label} left` },
    { label: 'Right', value: `${label} right` },
    { label: 'Both', value: `${label} (both)` },
  ],
});

const suggest = (list, addLabel, dependsOn) => ({ suggest: { list, addLabel, dependsOn } });

const FIELDS = {
  // Oil & fluids
  oilBase: choice('Oil type', ['Mineral', 'Semi-synthetic', 'Fully synthetic']),
  oilBrand: { label: 'Oil brand', placeholder: 'e.g. Castrol, Mobil 1', ...suggest('oilBrands', 'Brand') },
  oilType: { label: 'Oil grade', placeholder: 'e.g. 5W-30', ...suggest('engineOilGrades', 'Grade') },
  oilQuantity: { label: 'Quantity', type: 'number', placeholder: '0', suffix: 'L' },
  filterChanged: choice('Oil filter changed?', ['Yes', 'No']),
  gearOilProduct: { label: 'Oil product', placeholder: 'e.g. Transmax, Spirax', ...suggest('gearOilProducts', 'Product', 'oilBrand') },
  gearOilType: { label: 'Oil grade', placeholder: 'e.g. 75W-90, ATF', ...suggest('gearOilGrades', 'Grade') },
  transmission: choice('Transmission', ['Manual', 'Automatic', 'CVT']),
  // List set per type (coolant / brake / steering fluid products).
  fluidProduct: { label: 'Product', placeholder: 'Product name', ...suggest('coolantProducts', 'Product', 'fluidBrand') },
  coolantType: choice('Coolant', ['Ready-mix', 'Concentrate']),
  fluidBrand: { label: 'Fluid brand', placeholder: 'e.g. Prestone, Motul', ...suggest('fluidBrands', 'Brand') },
  brakeFluidType: choice('Fluid type', ['DOT 3', 'DOT 4', 'DOT 5.1']),
  flushType: choice('Work done', ['Top-up', 'Full flush']),

  // Filters
  filterBrand: { label: 'Filter brand', placeholder: 'e.g. Bosch, Mann', ...suggest('filterBrands', 'Brand') },
  filterPartNo: { label: 'Part number', placeholder: 'e.g. W 712/75' },

  // Tires & wheels
  tireBrand: { label: 'Tyre brand', placeholder: 'e.g. Michelin', ...suggest('tireBrands', 'Brand') },
  tireModel: { label: 'Tyre model', placeholder: 'e.g. Pilot Sport 4', ...suggest('tireModels', 'Model', 'tireBrand') },
  tireSize: { label: 'Tyre size', placeholder: 'e.g. 205/55 R16', ...suggest('tireSizes', 'Size') },
  quantity: { label: 'Quantity', type: 'number', placeholder: '0', suffix: 'pcs' },
  tirePosition: choice('Position', [sided('Front'), sided('Rear'), 'All four', 'Spare']),
  rotationPattern: choice('Pattern', ['Front ↔ Rear', 'Cross', 'Side to side']),
  tirePressure: { label: 'Pressure set', type: 'number', placeholder: '0', suffix: 'psi' },
  alignmentWork: choice('Work done', ['Alignment', 'Balancing', 'Both']),
  wheel: choice('Wheel', ['Front left', 'Front right', 'Rear left', 'Rear right', 'Spare']),
  repairType: choice('Repair', ['Plug', 'Patch', 'Tube replaced']),

  // Brakes
  padBrand: { label: 'Pad brand', placeholder: 'e.g. Brembo', ...suggest('brakeBrands', 'Brand') },
  padModel: { label: 'Pad model', placeholder: 'e.g. Xtra, Greenstuff', ...suggest('brakePadModels', 'Model', 'padBrand') },
  frontOrRear: choice('Position', [sided('Front'), sided('Rear'), 'Both']),
  discs: choice('Brake discs', ['Untouched', 'Resurfaced', 'Replaced']),
  discWork: choice('Work done', ['Resurfaced', 'Replaced']),

  // Electrical
  batteryBrand: { label: 'Battery brand', placeholder: 'e.g. Amaron, Exide', ...suggest('batteryBrands', 'Brand') },
  batteryModel: { label: 'Battery model', placeholder: 'e.g. Silver Dynamic', ...suggest('batteryModels', 'Model', 'batteryBrand') },
  batteryCapacity: { label: 'Capacity', type: 'number', placeholder: '0', suffix: 'Ah' },
  warrantyMonths: { label: 'Warranty', type: 'number', placeholder: '0', suffix: 'months' },
  plugBrand: { label: 'Plug brand', placeholder: 'e.g. NGK, Denso', ...suggest('sparkPlugBrands', 'Brand') },
  plugModel: { label: 'Plug model', placeholder: 'e.g. Laser Iridium', ...suggest('sparkPlugModels', 'Model', 'plugBrand') },
  plugType: choice('Plug type', ['Copper', 'Platinum', 'Iridium']),
  bulbPosition: choice('Light', [sided('Headlight'), sided('Tail light'), sided('Indicator'), sided('Fog light'), 'Interior']),
  bulbBrand: { label: 'Bulb brand', placeholder: 'e.g. Philips, Osram', ...suggest('bulbBrands', 'Brand') },
  bulbModel: { label: 'Bulb model', placeholder: 'e.g. Night Breaker', ...suggest('bulbModels', 'Model', 'bulbBrand') },
  bulbType: { label: 'Bulb type', placeholder: 'e.g. H4 halogen, LED', ...suggest('bulbTypes', 'Type') },

  // Engine & drivetrain
  partBrand: { label: 'Part brand', placeholder: 'e.g. Gates, Bosch', ...suggest('partBrands', 'Brand') },
  // Brand / model lists set per type (discs, wipers, belts, clutch, suspension).
  partModel: { label: 'Model', placeholder: 'Model / series', ...suggest('partModels', 'Model', 'partBrand') },
  beltKit: choice('Replaced', ['Belt only', 'Belt + tensioner', 'Full kit + water pump']),
  clutchWork: choice('Replaced', ['Clutch plate', 'Plate + pressure plate', 'Full kit']),
  suspensionPart: choice('Part', ['Shock absorbers', 'Struts', 'Bushings', 'Ball joints', 'Stabilizer links']),

  // Comfort & body
  acWork: choice('Work done', ['Gas refill', 'Cleaning', 'Compressor repair', 'Full AC service']),
  wiperSize: { label: 'Size', placeholder: 'e.g. 24" + 16"', ...suggest('wiperSizes', 'Size') },
  washPackage: choice('Package', ['Exterior wash', 'Interior cleaning', 'Full detailing', 'Wax / ceramic']),
  bodyArea: { label: 'Area', placeholder: 'e.g. Front bumper, left door', full: true, ...suggest('bodyAreas', 'Area') },
  inspectionResult: choice('Result', ['Passed', 'Passed with notes', 'Failed']),

  // General
  servicePackage: choice('Package', ['Basic', 'Standard', 'Premium']),
  workDone: { label: 'Work done', type: 'multiline', placeholder: 'What was checked, fixed or replaced', full: true },
  partsUsed: { label: 'Parts / brand', placeholder: 'e.g. Bosch wiper blades', full: true },
  partNumber: { label: 'Model / part no.', placeholder: 'e.g. Bosch EC6' },
  problem: { label: 'Problem', placeholder: 'What was wrong', full: true },
};

// Per-type lists for the shared part/fluid fields: [brandField, modelField].
const partPair = (brandLabel, brandList, modelList) => [
  ['partBrand', { label: brandLabel, ...suggest(brandList, 'Brand') }],
  ['partModel', suggest(modelList, 'Model', 'partBrand')],
];
const filterPartNo = list => ['filterPartNo', suggest(list, 'Part no.', 'filterBrand')];
const fluidProduct = list => ['fluidProduct', suggest(list, 'Product', 'fluidBrand')];

// Next-due rule: `requires` lists detail fields that must be filled first;
// `km(details)` is the distance interval (omit for time-only services);
// `months(details)` is the time limit — "whichever comes first" with km.
// `why(details)` names the reason in the suggestion hint.
const fixed = (km, months, why) => ({ requires: [], km: km && (() => km), months: () => months, why: () => why });

export const SERVICE_TYPES = [
  {
    name: 'Engine Oil Refill', aliases: ['engine oil', 'oil change', 'oil refill', 'motor oil', 'mobil'], icon: 'oil', category: 'Oil & fluids', popular: true,
    dueDate: false,
    fields: ['oilBase', 'oilBrand', 'oilType', 'oilQuantity', 'filterChanged'],
    copy: { dateLabel: 'Oil changed on', shopLabel: 'Workshop / station', nextTitle: 'NEXT OIL CHANGE', remindLabel: 'Remind me to change the oil', notesPlaceholder: 'e.g. Topped up coolant, oil looked dark…' },
    next: {
      requires: ['oilBase'],
      km: d => ({ Mineral: 5000, 'Semi-synthetic': 7500, 'Fully synthetic': 10000 }[d.oilBase]),
      months: () => 12,
      why: d => `${d.oilBase.toLowerCase()} oil`,
    },
  },
  {
    name: 'Oil Filter', aliases: ['oil filter'], icon: 'oilFilter', category: 'Oil & fluids', popular: true,
    dueDate: false,
    fields: ['filterBrand', filterPartNo('oilFilterParts')],
    copy: { dateLabel: 'Replaced on', nextTitle: 'NEXT FILTER CHANGE', remindLabel: 'Remind me to replace the filter' },
    next: fixed(10000, 12, 'oil filter'),
  },
  {
    name: 'Air Filter', aliases: ['air filter'], icon: 'airFilter', category: 'Oil & fluids', popular: true,
    dueDate: false,
    fields: ['filterBrand', filterPartNo('airFilterParts')],
    copy: { dateLabel: 'Replaced on', nextTitle: 'NEXT AIR FILTER CHANGE', remindLabel: 'Remind me to replace the air filter' },
    next: fixed(15000, 12, 'air filter'),
  },
  {
    name: 'Cabin / AC Filter', aliases: ['cabin filter', 'ac filter', 'pollen filter'], icon: 'cabinFilter', category: 'Oil & fluids',
    dueDate: false,
    fields: ['filterBrand', filterPartNo('cabinFilterParts')],
    copy: { dateLabel: 'Replaced on', nextTitle: 'NEXT CABIN FILTER CHANGE', remindLabel: 'Remind me to replace the cabin filter' },
    next: fixed(15000, 12, 'cabin filter'),
  },
  {
    name: 'Fuel Filter', aliases: ['fuel filter', 'diesel filter', 'petrol filter'], icon: 'fuelFilter', category: 'Oil & fluids',
    dueDate: false,
    fields: ['filterBrand', filterPartNo('fuelFilterParts')],
    copy: { dateLabel: 'Replaced on', nextTitle: 'NEXT FUEL FILTER CHANGE', remindLabel: 'Remind me to replace the fuel filter' },
    next: fixed(30000, 24, 'fuel filter'),
  },
  {
    name: 'Gear Oil', aliases: ['gear oil', 'gearbox oil', 'transmission oil', 'transmission fluid', 'atf'], icon: 'gearOil', category: 'Oil & fluids',
    dueDate: false,
    fields: ['oilBrand', 'gearOilProduct', 'gearOilType', 'oilQuantity', 'transmission'],
    copy: { dateLabel: 'Changed on', nextTitle: 'NEXT GEAR OIL CHANGE', remindLabel: 'Remind me to change the gear oil' },
    next: {
      requires: ['transmission'],
      km: d => ({ Manual: 60000, Automatic: 50000, CVT: 40000 }[d.transmission]),
      months: () => 48,
      why: d => `${d.transmission.toLowerCase()} transmission`,
    },
  },
  {
    name: 'Coolant', aliases: ['coolant', 'antifreeze', 'radiator water', 'radiator fluid'], icon: 'coolant', category: 'Oil & fluids',
    dueDate: false,
    fields: ['fluidBrand', fluidProduct('coolantProducts'), 'oilQuantity', 'coolantType', 'flushType'],
    copy: { dateLabel: 'Changed on', nextTitle: 'NEXT COOLANT CHANGE', remindLabel: 'Remind me to change the coolant' },
    next: {
      requires: ['flushType'],
      km: d => (d.flushType === 'Full flush' ? 40000 : 10000),
      months: d => (d.flushType === 'Full flush' ? 24 : 6),
      why: d => (d.flushType === 'Full flush' ? 'coolant flush' : 'coolant level check'),
    },
  },
  {
    name: 'Brake Fluid', aliases: ['brake fluid', 'brake oil'], icon: 'brakeFluid', category: 'Brakes',
    dueDate: false,
    fields: ['fluidBrand', fluidProduct('brakeFluidProducts'), 'brakeFluidType', 'flushType'],
    copy: { dateLabel: 'Changed on', nextTitle: 'NEXT BRAKE FLUID CHANGE', remindLabel: 'Remind me to change the brake fluid' },
    next: {
      requires: ['flushType'],
      km: d => (d.flushType === 'Full flush' ? 40000 : 10000),
      months: d => (d.flushType === 'Full flush' ? 24 : 6),
      why: d => (d.flushType === 'Full flush' ? 'brake fluid flush' : 'brake fluid check'),
    },
  },
  {
    name: 'Power Steering Fluid', aliases: ['steering fluid', 'steering oil', 'power steering'], icon: 'steering', category: 'Oil & fluids',
    odometer: false, dueDate: false,
    fields: ['fluidBrand', fluidProduct('steeringFluidProducts'), 'oilQuantity', 'flushType'],
    copy: { dateLabel: 'Changed on', nextTitle: 'NEXT STEERING FLUID CHECK', remindLabel: 'Remind me to check the steering fluid' },
    next: {
      requires: ['flushType'],
      km: d => (d.flushType === 'Full flush' ? 50000 : 10000),
      months: d => (d.flushType === 'Full flush' ? 36 : 6),
      why: d => (d.flushType === 'Full flush' ? 'steering fluid flush' : 'steering fluid check'),
    },
  },
  {
    name: 'Tires Change', aliases: ['tire', 'tyre', 'tires', 'tyres'], icon: 'tire', category: 'Tyres & parts', popular: true,
    dueDate: false,
    fields: ['tireBrand', 'tireModel', 'tireSize', 'quantity', 'tirePosition'],
    copy: { dateLabel: 'Fitted on', shopLabel: 'Tyre shop', shopPlaceholder: 'Shop name', nextTitle: 'NEXT TYRE CHECK', nextDateLabel: 'Check / rotate by', remindLabel: 'Remind me to check the tyres', notesPlaceholder: 'e.g. Wheel alignment done, balancing, warranty…' },
    next: fixed(10000, 12, 'tyre rotation'),
  },
  {
    name: 'Tire Rotation', aliases: ['tire rotation', 'tyre rotation', 'rotation', 'rotate'], icon: 'rotation', category: 'Tyres & parts',
    dueDate: false,
    fields: ['rotationPattern', 'tirePressure'],
    copy: { dateLabel: 'Rotated on', shopLabel: 'Tyre shop', shopPlaceholder: 'Shop name', nextTitle: 'NEXT ROTATION', remindLabel: 'Remind me to rotate the tyres' },
    next: fixed(10000, 12, 'tyre rotation'),
  },
  {
    name: 'Wheel Alignment', aliases: ['alignment', 'balancing', 'wheel balance'], icon: 'alignment', category: 'Tyres & parts', popular: true,
    odometer: false, dueDate: false,
    fields: ['alignmentWork'],
    copy: { dateLabel: 'Done on', shopLabel: 'Tyre shop', shopPlaceholder: 'Shop name', nextTitle: 'NEXT ALIGNMENT', remindLabel: 'Remind me about wheel alignment' },
    next: fixed(10000, 12, 'wheel alignment'),
  },
  {
    name: 'Puncture Repair', aliases: ['puncture', 'flat tire', 'flat tyre'], icon: 'puncture', category: 'Tyres & parts',
    odometer: false,
    fields: ['wheel', 'repairType'],
    copy: { dateLabel: 'Repaired on', shopLabel: 'Tyre shop', shopPlaceholder: 'Shop name' },
  },
  {
    name: 'Brake Pads', aliases: ['brake pad', 'brake shoe', 'brake'], icon: 'brakePads', category: 'Brakes', popular: true,
    dueDate: false,
    fields: ['padBrand', 'padModel', 'frontOrRear', 'discs'],
    copy: { dateLabel: 'Replaced on', nextTitle: 'NEXT BRAKE CHECK', nextDateLabel: 'Inspect by', remindLabel: 'Remind me to check the brakes', notesPlaceholder: 'e.g. Brake fluid topped up, squeaking fixed…' },
    next: fixed(15000, 12, 'brake inspection'),
  },
  {
    name: 'Brake Discs', aliases: ['brake disc', 'disc', 'rotor'], icon: 'brakeDisc', category: 'Brakes',
    dueDate: false,
    fields: [...partPair('Disc brand', 'brakeDiscBrands', 'brakeDiscModels'), 'frontOrRear', 'discWork'],
    copy: { dateLabel: 'Done on', nextTitle: 'NEXT BRAKE CHECK', nextDateLabel: 'Inspect by', remindLabel: 'Remind me to check the brakes' },
    next: fixed(15000, 12, 'brake inspection'),
  },
  {
    name: 'Battery', aliases: ['battery'], icon: 'battery', category: 'Tyres & parts', popular: true,
    // Batteries age by time, not km: schedules ask for months only. Service
    // records still take the odometer reading.
    scheduleOdometer: false,
    fields: ['batteryBrand', 'batteryModel', 'batteryCapacity', 'warrantyMonths'],
    copy: { dateLabel: 'Installed on', shopLabel: 'Shop', shopPlaceholder: 'Shop name', nextTitle: 'BATTERY WARRANTY', nextDateLabel: 'Warranty ends', remindLabel: 'Remind me before the warranty ends', notesPlaceholder: 'e.g. Old battery exchanged, serial number…' },
    next: {
      requires: ['warrantyMonths'],
      months: d => Number(d.warrantyMonths),
      why: d => `${d.warrantyMonths}-month battery warranty`,
    },
  },
  {
    name: 'Spark Plugs', aliases: ['spark plug', 'plug'], icon: 'sparkPlug', category: 'Tyres & parts',
    fields: ['plugBrand', 'plugModel', 'plugType', 'quantity'],
    copy: { dateLabel: 'Replaced on', nextTitle: 'NEXT SPARK PLUG CHANGE', remindLabel: 'Remind me to replace the spark plugs' },
    next: {
      requires: ['plugType'],
      km: d => ({ Copper: 30000, Platinum: 60000, Iridium: 100000 }[d.plugType]),
      months: () => 48,
      why: d => `${d.plugType.toLowerCase()} plugs`,
    },
  },
  {
    name: 'Lights / Bulbs', aliases: ['bulb', 'light', 'headlight', 'lamp'], icon: 'bulb', category: 'Tyres & parts',
    odometer: false,
    fields: ['bulbPosition', 'bulbBrand', 'bulbModel', 'bulbType', 'quantity'],
    copy: { dateLabel: 'Replaced on' },
  },
  {
    name: 'Wiper Blades', aliases: ['wiper'], icon: 'wiper', category: 'Tyres & parts',
    odometer: false,
    fields: [...partPair('Blade brand', 'wiperBrands', 'wiperModels'), 'wiperSize'],
    copy: { dateLabel: 'Replaced on', shopLabel: 'Shop', shopPlaceholder: 'Shop name', nextTitle: 'NEXT WIPER CHANGE', remindLabel: 'Remind me to replace the wipers' },
    next: fixed(null, 12, 'wiper blades'),
  },
  {
    name: 'Timing Belt', aliases: ['timing belt', 'timing chain', 'cam belt'], icon: 'timingBelt', category: 'Tyres & parts',
    fields: [...partPair('Belt brand', 'timingBeltBrands', 'timingBeltModels'), 'beltKit'],
    copy: { dateLabel: 'Replaced on', nextTitle: 'NEXT TIMING BELT CHANGE', remindLabel: 'Remind me to replace the timing belt' },
    next: fixed(80000, 60, 'timing belt'),
  },
  {
    name: 'Clutch', aliases: ['clutch'], icon: 'clutch', category: 'Tyres & parts',
    fields: [...partPair('Clutch brand', 'clutchBrands', 'clutchModels'), 'clutchWork'],
    copy: { dateLabel: 'Replaced on' },
  },
  {
    name: 'Suspension', aliases: ['suspension', 'shock', 'strut', 'bush', 'ball joint'], icon: 'suspension', category: 'Tyres & parts',
    dueDate: false,
    fields: ['suspensionPart', 'frontOrRear', ...partPair('Part brand', 'suspensionBrands', 'suspensionModels')],
    copy: { dateLabel: 'Repaired on', nextTitle: 'NEXT SUSPENSION CHECK', nextDateLabel: 'Inspect by', remindLabel: 'Remind me to check the suspension' },
    next: fixed(20000, 12, 'suspension inspection'),
  },
  {
    name: 'AC Service', aliases: ['ac', 'a/c', 'air condition', 'aircon', 'ac gas'], icon: 'ac', category: 'Servicing', popular: true,
    odometer: false,
    fields: ['acWork'],
    copy: { dateLabel: 'Serviced on', nextTitle: 'NEXT AC SERVICE', remindLabel: 'Remind me about the AC service' },
    next: { requires: ['acWork'], months: () => 12, why: () => 'yearly AC service' },
  },
  {
    name: 'Engine Tune-up', aliases: ['tune', 'tuning'], icon: 'tuneUp', category: 'Servicing',
    fields: ['workDone'],
    copy: { dateLabel: 'Tuned on', nextTitle: 'NEXT TUNE-UP', remindLabel: 'Remind me about the next tune-up' },
    next: fixed(20000, 12, 'engine tune-up'),
  },
  {
    name: 'Full Body Servicing', aliases: ['full service', 'general service', 'full body', 'servicing'], icon: 'service', category: 'Servicing', popular: true,
    fields: ['servicePackage', 'workDone'],
    copy: { dateLabel: 'Serviced on', shopLabel: 'Service center', shopPlaceholder: 'Service center name', nextTitle: 'NEXT FULL SERVICE', remindLabel: 'Remind me about the next service' },
    next: {
      requires: ['servicePackage'],
      km: d => ({ Basic: 5000, Standard: 10000, Premium: 15000 }[d.servicePackage]),
      months: () => 12,
      why: d => `${d.servicePackage.toLowerCase()} package`,
    },
  },
  {
    name: 'Inspection / Fitness', aliases: ['inspection', 'fitness', 'emission', 'pollution test', 'roadworthy'], icon: 'inspection', category: 'Servicing',
    fields: ['inspectionResult', 'workDone'],
    copy: { dateLabel: 'Inspected on', shopLabel: 'Inspection center', shopPlaceholder: 'Center name', nextTitle: 'NEXT INSPECTION', remindLabel: 'Remind me about the next inspection' },
    next: { requires: ['inspectionResult'], months: () => 12, why: () => 'yearly inspection' },
  },
  {
    name: 'Wash & Detailing', aliases: ['wash', 'detailing', 'polish', 'wax', 'ceramic'], icon: 'wash', category: 'Servicing',
    odometer: false,
    fields: ['washPackage'],
    copy: { dateLabel: 'Washed on', shopLabel: 'Car wash', shopPlaceholder: 'Car wash name' },
  },
  {
    name: 'Body / Paint Repair', aliases: ['paint', 'dent', 'scratch', 'body work', 'bodywork'], icon: 'paint', category: 'Servicing',
    odometer: false,
    fields: ['bodyArea', 'workDone'],
    copy: { dateLabel: 'Repaired on', shopLabel: 'Body shop', shopPlaceholder: 'Body shop name' },
  },
].map((type, i) => ({ id: i + 1, ...type }));

export const getServiceType = name => {
  const key = (name || '').trim().toLowerCase();
  return key ? SERVICE_TYPES.find(t => t.name.toLowerCase() === key) || null : null;
};

// Whether a schedule for this service type tracks distance. Types flagged
// `odometer: false` (body / paint, wash, bulbs…) repeat by time only, so the
// schedule form and Mark as done never ask for km. A custom name (no type)
// leaves it to the user.
// `scheduleOdometer` overrides `odometer` for schedules only (Battery).
export const serviceUsesOdometer = name => {
  const type = getServiceType(name);
  return (type?.scheduleOdometer ?? type?.odometer) !== false;
};

// A saved schedule asks for the odometer unless it's a time-only type on a
// time-only rule (an older rule that still has a distance keeps asking).
export const scheduleUsesOdometer = rule =>
  serviceUsesOdometer(rule?.serviceType) || (rule?.mode || 'BOTH') !== 'TIME';

// How a service name reads on screen and in exports: built-in types in
// sentence case with UK spelling ("Tires Change" → "Tyre change"). Records
// keep the stored name, so existing services still match their type; names
// the user typed show exactly as typed.
const LABEL_OVERRIDES = {
  'Tires Change': 'Tyre change',
  'Tire Rotation': 'Tyre rotation',
  'Cabin / AC Filter': 'Cabin / AC filter',
  'AC Service': 'AC service',
};

export const serviceLabel = name => {
  const type = getServiceType(name);
  if (!type) return name;
  return LABEL_OVERRIDES[type.name] || type.name.charAt(0) + type.name.slice(1).toLowerCase();
};

const escapeRe = str => str.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

// Built-in type whose alias best (longest) matches a typed custom name,
// e.g. "Tyre puncture" → Puncture Repair, "oil change" → Engine Oil Refill.
const matchTypeByAlias = name => {
  const text = ` ${name.trim().toLowerCase()} `;
  let best = null;
  let bestLen = 0;
  SERVICE_TYPES.forEach(type => {
    (type.aliases || []).forEach(alias => {
      // Short aliases (ac, atf) must be whole words; longer ones may prefix ("brakes").
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

const ACTION_WORDS = new Set([
  'change', 'changed', 'changing', 'replace', 'replaced', 'replacement', 'replacing', 'new',
  'install', 'installed', 'installation', 'fit', 'fitted', 'fitting', 'add', 'added',
  'repair', 'repaired', 'repairing', 'fix', 'fixed', 'fixing', 'service', 'servicing',
  'check', 'checked', 'checkup', 'work', 'job', 'the', 'a', 'an', 'of', 'and', 'my', 'car',
]);

// The thing being worked on, from the typed name: "Horn change" → "Horn".
const subjectOf = name => {
  const words = name.trim().split(/\s+/).filter(w => !ACTION_WORDS.has(w.toLowerCase()));
  const subject = words.join(' ');
  return subject ? subject.charAt(0).toUpperCase() + subject.slice(1) : 'Part';
};

const has = (name, re) => re.test(name.toLowerCase());

// Form for a custom ("Other") name with no matching built-in type, shaped
// by what the user typed: what kind of job it is and what part it's about.
const customProfile = name => {
  const subject = subjectOf(name);
  const lower = subject.toLowerCase();
  const warrantyNext = {
    requires: ['warrantyMonths'],
    months: d => Number(d.warrantyMonths),
    why: d => `${d.warrantyMonths}-month ${lower} warranty`,
  };

  if (has(name, /\b(repair|fix|weld|leak|noise|broken|damage|not working)/)) {
    return {
      fields: [['problem', { placeholder: `What was wrong with the ${lower}` }], ['workDone', { placeholder: 'What the mechanic did' }]],
      copy: {
        dateLabel: 'Repaired on', shopLabel: 'Mechanic / shop', shopPlaceholder: 'Mechanic or shop name',
        nextTitle: 'FOLLOW-UP', nextDateLabel: 'Recheck by', remindLabel: `Remind me to recheck the ${lower}`,
        notesPlaceholder: 'e.g. Repair warranty, parts reused…',
      },
    };
  }

  if (has(name, /\b(check|inspect|scan|diagnos|test)/)) {
    return {
      fields: ['inspectionResult', ['workDone', { label: 'Findings', placeholder: `What was found on the ${lower}` }]],
      copy: {
        dateLabel: 'Checked on', shopLabel: 'Mechanic / shop', shopPlaceholder: 'Mechanic or shop name',
        nextTitle: 'NEXT CHECK', nextDateLabel: 'Check again by', remindLabel: `Remind me to check the ${lower} again`,
      },
    };
  }

  if (has(name, /\b(install|fit|add|accessor|dash ?cam|camera|tint|cover|alarm|gps|tracker|stereo|speaker|mat)/)) {
    return {
      fields: [['partBrand', { label: `${subject} brand`, placeholder: 'Brand' }], ['partNumber', { label: 'Model' }], 'warrantyMonths'],
      copy: {
        dateLabel: 'Installed on', shopLabel: 'Shop / installer', shopPlaceholder: 'Shop name',
        nextTitle: 'WARRANTY', nextDateLabel: 'Warranty ends', remindLabel: 'Remind me before the warranty ends',
        notesPlaceholder: 'e.g. Serial number, where it was wired…',
      },
      next: warrantyNext,
    };
  }

  // Default: a part was replaced ("Horn change", "Side mirror", "Starter motor").
  return {
    // Kept minimal: no part number, warranty or due date/reminder.
    fields: [
      ['partBrand', { label: `${subject} brand`, placeholder: 'Brand' }],
      'quantity',
    ],
    copy: {
      dateLabel: 'Date of purchase', shopLabel: 'Shop / mechanic', shopPlaceholder: 'Shop or mechanic name',
      notesPlaceholder: `e.g. Why the ${lower} was replaced…`,
    },
  };
};

// Everything the form needs for a service name: built-in type, a built-in
// type matched from a typed name, or a profile generated from the name.
export const getServiceProfile = name => {
  if (!name || !name.trim()) return null;
  const type = getServiceType(name) || matchTypeByAlias(name);
  return type
    ? { fields: type.fields, copy: type.copy, next: type.next, odometer: type.odometer !== false, dueDate: type.dueDate !== false }
    : { ...customProfile(name), odometer: false, dueDate: true };
};

// Parts that wear with distance driven: a custom schedule naming one of
// these repeats by distance and time; anything else (carpet, seat cover,
// insurance, cleaning…) wears with age and repeats by time only.
const DISTANCE_WORDS = /\b(oil|lube|lubric|grease|fluid|coolant|filter|belt|chain|sprocket|pad|shoe|disc|rotor|brake|tyre|tire|wheel|rim|bearing|hub|clutch|gear|transmission|axle|cv ?joint|drive ?shaft|differential|diff|plug|ignition|injector|valve|tappet|piston|engine|motor|pump|hose|radiator|exhaust|muffler|silencer|catalytic|suspension|shock|strut|bush|joint|spring|steering|tie ?rod|rack|alternator|starter|dynamo|cable|tune|carb|throttle|odo|mileage)/;

// How a schedule for this name should repeat: 'TIME' when it doesn't depend
// on distance, 'BOTH' when it does, null while there's no name yet.
export const scheduleModeForName = name => {
  if (!name || name.trim().length < 3) return null;
  const type = getServiceType(name) || matchTypeByAlias(name);
  if (type) return serviceUsesOdometer(type.name) ? 'BOTH' : 'TIME';
  // A seat belt is a belt that doesn't wear with driving.
  return DISTANCE_WORDS.test(name.toLowerCase().replace(/seat ?belt/g, '')) ? 'BOTH' : 'TIME';
};

export const SERVICE_DETAIL_KEYS = Object.keys(FIELDS);

export const getServiceFields = name => {
  const profile = getServiceProfile(name);
  if (!profile) return [];
  return profile.fields.map(entry => {
    const [key, overrides] = Array.isArray(entry) ? entry : [entry, null];
    return { key, ...FIELDS[key], ...overrides };
  });
};

// ServiceTypeIcon glyph for a service name (wrench when unknown).
export const getServiceIconKey = name =>
  (getServiceType(name) || (name && matchTypeByAlias(name)))?.icon || 'service';

// Expense dashboard bucket for a service name ('Others' when unknown).
// Built-in type a service name belongs to: exact name, else best alias match.
export const resolveServiceType = name => getServiceType(name) || (name ? matchTypeByAlias(name) : null);

export const getServiceCategory = name => resolveServiceType(name)?.category || 'Others';

// Labels for display/export. Includes keys only older records carry.
export const SERVICE_DETAIL_LABELS = {
  ...Object.fromEntries(Object.entries(FIELDS).map(([k, f]) => [k, f.label])),
  oilQuantity: 'Oil quantity',
  servicePackage: 'Service package',
};

// Value as it should read in view/export (adds the unit to numeric fields).
export const formatServiceDetail = (key, value) => {
  const suffix = FIELDS[key]?.suffix;
  return suffix && /^\d+(\.\d+)?$/.test(String(value)) ? `${value} ${suffix}` : String(value);
};

// Wording for the shared parts of the form (date, odometer, cost, shop,
// next service, notes) so every section reads in terms of the chosen type.
const DEFAULT_COPY = {
  dateLabel: 'Service date',
  mileageLabel: 'Odometer',
  costLabel: 'Total cost',
  shopLabel: 'Workshop',
  shopPlaceholder: 'Workshop name',
  nextTitle: 'NEXT SERVICE',
  nextDateLabel: 'Due date',
  nextMileageLabel: 'Due at',
  remindLabel: "Remind me when it's due",
  notesPlaceholder: 'Warranty, issues found, anything worth remembering…',
};

// Also says which shared inputs apply: the odometer, and a km-based due
// mileage (only when the next-due rule is distance based).
export const getServiceCopy = name => {
  const profile = getServiceProfile(name);
  return {
    ...DEFAULT_COPY,
    ...profile?.copy,
    // Types flagged `odometer: false` (wash, paint, bulbs, custom names…) skip the reading.
    showOdometer: profile ? profile.odometer : true,
    // Types flagged `dueDate: false` (filters, fluids, brakes, tires…) are tracked by km
    // only, so no due date and no reminder (reminders are scheduled on the date).
    showDueDate: profile ? profile.dueDate : true,
    showDueKm: profile ? profile.odometer && !!profile.next?.km : true,
    // Types with no next-due rule (puncture, bulbs…), or nothing left to show, skip the section.
    showNext: profile
      ? !!profile.next && (profile.dueDate || (profile.odometer && !!profile.next.km))
      : true,
  };
};

const DAY_MS = 24 * 60 * 60 * 1000;

// Average km driven per day, from every dated odometer reading of the
// vehicle (fuel logs, past services, and this entry). Null when the
// readings don't span at least two weeks — too little to judge.
export const averageKmPerDay = readings => {
  const pts = readings
    .filter(r => r.ms && r.km > 0)
    .sort((a, b) => a.ms - b.ms);
  if (pts.length < 2) return null;
  const first = pts[0];
  const last = pts[pts.length - 1];
  const days = (last.ms - first.ms) / DAY_MS;
  const km = last.km - first.km;
  if (days < 14 || km <= 0) return null;
  return km / days;
};

// Returns null until the user has filled in everything the rule needs:
// the date, the odometer (for distance-based rules) and the required details.
// `unit` ('km' | 'mi') only changes the hint wording; figures stay in km.
export const suggestNextDue = ({ name, serviceDate, odometer, details, kmPerDay, unit = 'km' }) => {
  const rule = getServiceProfile(name)?.next;
  if (!rule || !serviceDate) return null;
  if (rule.requires.some(k => !details?.[k])) return null;

  const months = Number(rule.months(details)) || 0;
  const interval = rule.km ? rule.km(details) : null;
  const km0 = Number(odometer);
  if (interval && !(km0 > 0)) return null;
  if (!interval && !months) return null;

  let dueDate = null;
  if (months) {
    dueDate = new Date(serviceDate);
    dueDate.setMonth(dueDate.getMonth() + months);
  }
  if (interval && kmPerDay) {
    const byUsage = new Date(new Date(serviceDate).getTime() + (interval / kmPerDay) * DAY_MS);
    if (!dueDate || byUsage < dueDate) dueDate = byUsage;
  }
  if (!dueDate) return null;

  const why = rule.why(details);
  let hint;
  if (!interval) hint = `Based on the ${why}`;
  else if (kmPerDay) hint = `${formatKm(interval, unit)} for ${why} · you drive ~${formatKm(kmPerDay, unit)}/day`;
  else hint = `${formatKm(interval, unit)} for ${why}, or ${months} months — whichever comes first`;

  return { dueDate, dueMileage: interval ? km0 + interval : null, hint };
};
