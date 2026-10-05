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
  oilType:        { label: 'Oil Type',          placeholder: 'e.g., Synthetic 5W-30', keyboard: 'default' },
  oilQuantity:    { label: 'Oil Quantity',       placeholder: 'e.g., 4 Liters',        keyboard: 'numeric' },
  filterBrand:    { label: 'Filter Brand',       placeholder: 'e.g., Bosch, Mann',     keyboard: 'default' },
  tireBrand:      { label: 'Tire Brand',         placeholder: 'e.g., Michelin',        keyboard: 'default' },
  tireSize:       { label: 'Tire Size',          placeholder: 'e.g., 205/55 R16',      keyboard: 'default' },
  quantity:       { label: 'Quantity',           placeholder: 'e.g., 4',               keyboard: 'numeric' },
  padBrand:       { label: 'Brake Pad Brand',    placeholder: 'e.g., Brembo',          keyboard: 'default' },
  frontOrRear:    { label: 'Position',           placeholder: 'Front / Rear / Both',   keyboard: 'default' },
  servicePackage: { label: 'Service Package',    placeholder: 'Basic / Premium',       keyboard: 'default' },
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
