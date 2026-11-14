import { t as tr } from '../i18n';
export const SERVICE_NAME = [
  {
    id: 1,
    name: 'Engine Oil Refill',
    icon: 'https://apidailysalah.zecodeek-it.com/media/icon/oil.png',
    extraFields: ['oilType', 'oilQuantity'],
  },
  {
    id: 2,
    name: 'Oil Filter',
    icon: 'https://apidailysalah.zecodeek-it.com/media/icon/filter.png',
    extraFields: ['filterBrand'],
  },
  {
    id: 3,
    name: 'Tires Change',
    icon: 'https://apidailysalah.zecodeek-it.com/media/icon/tyre.png',
    extraFields: ['tireBrand', 'tireSize', 'quantity'],
  },
  {
    id: 4,
    name: 'Gear Oil',
    icon: 'https://apidailysalah.zecodeek-it.com/media/icon/oil.png',
    extraFields: ['oilType', 'oilQuantity'],
  },
  {
    id: 5,
    name: 'Brake Pads',
    icon: 'https://apidailysalah.zecodeek-it.com/media/icon/break.png',
    extraFields: ['padBrand', 'frontOrRear'],
  },
  {
    id: 6,
    name: 'Full Body Servicing',
    icon: 'https://apidailysalah.zecodeek-it.com/media/icon/service.png',
    extraFields: ['servicePackage'],
  },
];

export const FIELD_CONFIG = {
  oilType:        { get label() { return tr('Oil Type'); },          get placeholder() { return tr('e.g., Synthetic 5W-30'); }, keyboard: 'default' },
  oilQuantity:    { get label() { return tr('Oil Quantity'); },       get placeholder() { return tr('e.g., 4 Liters'); },        keyboard: 'numeric' },
  filterBrand:    { get label() { return tr('Filter Brand'); },       get placeholder() { return tr('e.g., Bosch, Mann'); },     keyboard: 'default' },
  tireBrand:      { get label() { return tr('Tire Brand'); },         get placeholder() { return tr('e.g., Michelin'); },        keyboard: 'default' },
  tireSize:       { get label() { return tr('Tire Size'); },          placeholder: 'e.g., 205/55 R16',      keyboard: 'default' },
  quantity:       { get label() { return tr('Quantity'); },           placeholder: 'e.g., 4',               keyboard: 'numeric' },
  padBrand:       { get label() { return tr('Brake Pad Brand'); },    get placeholder() { return tr('e.g., Brembo'); },          keyboard: 'default' },
  frontOrRear:    { get label() { return tr('Position'); },           get placeholder() { return tr('Front / Rear / Both'); },   keyboard: 'default' },
  servicePackage: { get label() { return tr('Service Package'); },    get placeholder() { return tr('Basic / Premium'); },       keyboard: 'default' },
};

export const INITIAL_FORM = {
  name: '',
  description: '',
  currentMileage: '',
  totalCost: '',
  img: '',
  workshopName: '',
  serviceDate: null,
  nextServiceDate: null,
  remindMe: false,
  oilType: '',
  oilQuantity: '',
  filterBrand: '',
  tireBrand: '',
  tireSize: '',
  quantity: '',
  padBrand: '',
  frontOrRear: '',
  servicePackage: '',
};

// Selectable vehicle years, newest first — virtually everyone adds a recent
// car. Next year's models go on sale during the current year, so the range
// runs to next year (this also keeps it valid if the app stays open over New
// Year, since it's computed once at load).
export const OLDEST_VEHICLE_YEAR = 1930;
export const NEWEST_VEHICLE_YEAR = new Date().getFullYear() + 1;
export const VEHICLE_YEARS = Array.from(
  { length: NEWEST_VEHICLE_YEAR - OLDEST_VEHICLE_YEAR + 1 },
  (_, i) => (NEWEST_VEHICLE_YEAR - i).toString(),
);
// A function, so it reads the current language.
export const vehicleYearError = () => tr('Enter a year between {0} and {1}.', { 0: OLDEST_VEHICLE_YEAR, 1: NEWEST_VEHICLE_YEAR });
