import React, { useMemo, useRef, useState } from 'react';
import { useUnsavedChanges, confirmDiscard } from '../util/methods/useUnsavedChanges';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import Modal from 'react-native-modal';
import AppDatePicker from '../components/ui/AppDatePicker';
import { useDispatch, useSelector } from 'react-redux';

import CloseX from '../assets/svg/CloseX.jsx';
import AddIcon from '../assets/svg/AddIcon.jsx';

import { setVehiclesInformation } from '../store/vehicleSlice.js';
import { addUserService, bumpVehicleOdometer } from '../store/userSlice.js';
import { reminderId } from '../util/notifications.js';
import { scheduleReminderWithFeedback } from '../util/reminderFeedback.js';

import { useTheme } from '../util/methods/useTheme.js';
import { sanitizeDecimal } from '../util/numberInput';
import { useKeyboardBehavior } from '../util/methods/useKeyboardBehavior';
import {
  useImagePicker,
} from '../util/methods/useImagePicker';
import { uploadImage } from '../util/imageStorage';
import { useCurrency, toBaseAmount } from '../util/methods/useCurrency';
import { shadow } from '../theme/tokens';
import { accent } from '../theme/accent';

const NAVY = 'rgba(4, 25, 51, 1)';

// Premium shadow profile — matches Vehicle.jsx / VehicleInformations.jsx

const SERVICE_TYPES = [
  { id: 1, name: 'Engine Oil Refill', icon: require('../assets/icons/oil.png'), Wicon: require('../assets/icons/whiteOil.png') },
  { id: 2, name: 'Oil Filter', icon: require('../assets/icons/filter.png'), Wicon: require('../assets/icons/whiteFilter.png') },
  { id: 3, name: 'Tires Change', icon: require('../assets/icons/tyre.png'), Wicon: require('../assets/icons/whiteTyre.png') },
  { id: 4, name: 'Gear Oil', icon: require('../assets/icons/oil.png'), Wicon: require('../assets/icons/whiteOil.png') },
  { id: 5, name: 'Brake Pads', icon: require('../assets/icons/break.png'), Wicon: require('../assets/icons/whiteBreak.png') },
  { id: 6, name: 'Full Body Servicing', icon: require('../assets/icons/service.png'), Wicon: require('../assets/icons/whiteService.png') },
];

const EXTRA_FIELDS_BY_SERVICE = {
  'Engine Oil Refill': [
    { key: 'oilType', label: 'Oil type', placeholder: 'e.g. Synthetic 5W-30' },
    { key: 'oilQuantity', label: 'Oil quantity', placeholder: 'e.g. 4 Liters', keyboard: 'numeric' },
  ],
  'Oil Filter': [
    { key: 'filterBrand', label: 'Filter brand', placeholder: 'e.g. Bosch, Mann' },
  ],
  'Tires Change': [
    { key: 'tireBrand', label: 'Tire brand', placeholder: 'e.g. Michelin' },
    { key: 'tireSize', label: 'Tire size', placeholder: 'e.g. 205/55 R16' },
    { key: 'quantity', label: 'Quantity', placeholder: 'e.g. 4', keyboard: 'numeric' },
  ],
  'Gear Oil': [
    { key: 'oilType', label: 'Oil type', placeholder: 'e.g. 75W-90' },
    { key: 'oilQuantity', label: 'Oil quantity', placeholder: 'e.g. 2 Liters', keyboard: 'numeric' },
  ],
  'Brake Pads': [
    { key: 'padBrand', label: 'Brake pad brand', placeholder: 'e.g. Brembo' },
    { key: 'frontOrRear', label: 'Position', placeholder: 'Front / Rear / Both' },
  ],
  'Full Body Servicing': [
    { key: 'servicePackage', label: 'Service package', placeholder: 'Basic / Premium' },
  ],
};

// Typical service intervals, used to suggest the next due date/mileage
// once a service type is picked — purely a starting point the user can
// override or ignore.
const SERVICE_INTERVALS = {
  'Engine Oil Refill': { months: 6, km: 5000 },
  'Oil Filter': { months: 6, km: 5000 },
  'Tires Change': { months: 36, km: 40000 },
  'Gear Oil': { months: 24, km: 40000 },
  'Brake Pads': { months: 12, km: 25000 },
  'Full Body Servicing': { months: 6, km: 10000 },
};

const addMonths = (date, months) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
};

const EMPTY_FORM = {
  name: '',
  serviceDate: null,
  currentMileage: '',
  totalCost: '',
  workshopName: '',
  nextServiceDate: null,
  nextServiceMileage: '',
  remindMe: false, // Explicitly false by default
  description: '',
};

const formatDate = d =>
  d
    ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;

const endOfToday = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
};
const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const AddService = ({ AddServiceModal, setAddServiceModal, onServiceAdded }) => {
  const dispatch = useDispatch();
  const isDark = useTheme();
  const behaviour = useKeyboardBehavior();
  const scrollViewRef = useRef(null);
  const { symbol: currencySymbol, fxRate, ready: currencyReady } = useCurrency(AddServiceModal);

  const vehicles = useSelector(state => state.vehicle.vehiclesInformation);
  const { userEmail, selectedCar } = useSelector(state => state.user);
  const activeVehicle = useMemo(
    () => vehicles?.find(v => v.id === selectedCar) || vehicles?.[0],
    [vehicles, selectedCar],
  );

  const [form, setForm] = useState(EMPTY_FORM);
  const [extras, setExtras] = useState({});
  const [isCustomType, setIsCustomType] = useState(false);
  const [datePicker, setDatePicker] = useState(null); 
  const [isLoading, setIsLoading] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [triedSave, setTriedSave] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));

  const { selectedImage, selectImage, clearImage } = useImagePicker(() => {});

  const t = useMemo(
    () => ({
      sheetBg: isDark ? '#0A1E38' : '#fff',
      text: isDark ? '#fff' : NAVY,
      muted: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(4,25,51,0.55)',
      label: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(4,25,51,0.7)',
      inputBg: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(4,25,51,0.03)',
      inputBorder: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(4,25,51,0.10)',
      inputBorderFocus: isDark ? accent.light : accent.primary,
      inputText: isDark ? '#fff' : NAVY,
      placeholder: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(4,25,51,0.35)',
      chipBg: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
      chipBorder: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(4,25,51,0.12)',
      chipText: isDark ? 'rgba(255,255,255,0.8)' : NAVY,
      handle: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(4,25,51,0.15)',
      divider: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(4,25,51,0.06)',
      closeBg: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(4,25,51,0.05)',
      accent: isDark ? accent.light : accent.primary,
      required: '#C24242',
      iconWell: isDark ? accent.lightAlpha(0.14) : accent.alpha(0.08),
    }),
    [isDark],
  );

  const isValid = form.name.trim().length > 0 && !!form.serviceDate;

  const activeExtraFields = useMemo(
    () => (!isCustomType && EXTRA_FIELDS_BY_SERVICE[form.name]) || [],
    [form.name, isCustomType],
  );

  // Suggest a next-service date (and, when mileage is known, a rough
  // mileage target) based on typical intervals for the chosen service type.
  const suggestion = useMemo(() => {
    const interval = !isCustomType && SERVICE_INTERVALS[form.name];
    if (!interval) return null;

    const baseDate = form.serviceDate || new Date();
    const dueDate = addMonths(baseDate, interval.months);

    const baseMileage = parseInt(form.currentMileage, 10);
    const dueMileage = Number.isFinite(baseMileage) ? baseMileage + interval.km : null;

    return { dueDate, dueMileage };
  }, [isCustomType, form.name, form.serviceDate, form.currentMileage]);

  const applySuggestion = () => {
    if (!suggestion) return;
    setForm(f => ({
      ...f,
      nextServiceDate: suggestion.dueDate,
      nextServiceMileage: suggestion.dueMileage ? String(suggestion.dueMileage) : f.nextServiceMileage,
      remindMe: true,
    }));
  };

  const setExtra = (key, value) => setExtras(e => ({ ...e, [key]: value }));

  const resetAll = () => {
    setForm(EMPTY_FORM);
    setExtras({});
    setIsCustomType(false);
    setTriedSave(false);
    setSaveError(null);
    clearImage?.();
  };

  const handleClose = () => {
    if (isLoading) return;
    setAddServiceModal(false);
    resetAll();
  };

  // Backdrop, back button and the close icon ask before throwing away input.
  const isDirty = useUnsavedChanges({ form, extras, isCustomType, selectedImage });
  const requestClose = () => confirmDiscard(isDirty, handleClose);

  const handlePickType = type => {
    setIsCustomType(false);
    setExtras({}); 
    set('name', type.name);
  };

  const handleDateChange = (event, date) => {
    const mode = datePicker;
    setDatePicker(null);
    // Android: closing the native date dialog can leave the soft keyboard
    // unable to attach to the next TextInput that's tapped — this call is a
    // no-op if nothing's showing, but it resets the stuck IME state so the
    // next natural focus works.
    Keyboard.dismiss();
    if (event?.type === 'dismissed' || !date) return;

    if (mode === 'service' && date > endOfToday()) {
      date = new Date(); 
    }
    if (mode === 'next' && date < startOfToday()) {
      date = new Date(); 
    }

    set(mode === 'service' ? 'serviceDate' : 'nextServiceDate', date);
  };

  const handleSave = async () => {
    if (isLoading || !currencyReady) return;

    if (!isValid) {
      setTriedSave(true);
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    setSaveError(null);
    setIsLoading(true);

    try {
      let uploadedImageUrl = null;
      if (selectedImage) {
        const uploadResult = await uploadImage(selectedImage, 'services');
        if (uploadResult?.success) {
          uploadedImageUrl = uploadResult.url;
        } else {
          setSaveError("The receipt photo couldn't be uploaded. Check your connection and try again.");
          setIsLoading(false);
          return;
        }
      }

      // STRICT USER AUTHORITY CHECK: Force remindMe to false if no due date is picked
      const cleanRemindMe = form.nextServiceDate ? form.remindMe : false;

      const serviceData = { 
        ...form, 
        ...extras, 
        remindMe: cleanRemindMe,
        imageUrl: uploadedImageUrl,
        // Typed in the display currency; stored in BASE_CURRENCY like fuel logs.
        totalCost: toBaseAmount(form.totalCost, fxRate),
      };

      const newServiceId = await addUserService(userEmail, serviceData, selectedCar);
      bumpVehicleOdometer(userEmail, selectedCar, form.currentMileage).catch(() => {});

      if (cleanRemindMe && form.nextServiceDate) {
        scheduleReminderWithFeedback({
          id: reminderId('service', newServiceId),
          kind: 'service',
          subject: form.name,
          body: form.workshopName ? `At ${form.workshopName}` : 'Next service reminder.',
          dueDate: form.nextServiceDate,
        });
      }

      onServiceAdded?.();

      const updatedVehicles = [...(vehicles || [])];
      const targetIndex = updatedVehicles.findIndex(v => v.id === selectedCar);
      if (targetIndex !== -1) {
        updatedVehicles[targetIndex] = {
          ...updatedVehicles[targetIndex],
          services: [...(updatedVehicles[targetIndex].services || []), serviceData],
        };
        dispatch(setVehiclesInformation(updatedVehicles));
      }

      setAddServiceModal(false);
      resetAll();
    } catch (error) {
      console.warn('Save service failed:', error);
      setSaveError("The record couldn't be saved. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const FieldLabel = ({ children, required }) => (
    <Text style={[styles.fieldLabel, { color: t.label }]}>
      {children}
      {required && <Text style={{ color: t.required }}> *</Text>}
    </Text>
  );

  const inputStyle = key => [
    styles.input,
    {
      backgroundColor: t.inputBg,
      borderColor: focusedField === key ? t.inputBorderFocus : t.inputBorder,
      color: t.inputText,
    },
  ];

  const missingType = triedSave && !form.name.trim();
  const missingDate = triedSave && !form.serviceDate;

  return (
    <Modal
      isVisible={AddServiceModal}
      statusBarTranslucent
      onBackdropPress={requestClose}
      onBackButtonPress={requestClose}
      style={styles.modal}
      coverScreen
      useNativeDriver={false}
      backdropTransitionOutTiming={1}
      hideModalContentWhileAnimating
      backdropOpacity={0.55}
      animationIn="slideInUp"
      animationOut="slideOutDown"
    >
      <KeyboardAvoidingView
        behavior={behaviour}
        style={[styles.sheet, shadow(4), { backgroundColor: t.sheetBg }]}
      >
        <View style={styles.handleWrapper}>
          <View style={[styles.handle, { backgroundColor: t.handle }]} />
        </View>

        <View style={styles.header}>
          <View style={[styles.iconWell, { backgroundColor: t.iconWell }]}>
            <Image
              source={isDark ? require('../assets/icons/whiteService.png') : require('../assets/icons/service.png')}
              style={styles.headerIcon}
            />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.title, { color: t.text }]}>Add service</Text>
            {!!activeVehicle && (
              <Text style={[styles.subtitle, { color: t.muted }]} numberOfLines={1}>
                {activeVehicle.brand} {activeVehicle.model}
              </Text>
            )}
          </View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close"
            onPress={requestClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[styles.closeButton, { backgroundColor: t.iconWell }]}
          >
            <CloseX size={12} color={t.accent} />
          </TouchableOpacity>
        </View>

        <View style={[styles.divider, { backgroundColor: t.divider }]} />

        <ScrollView
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          {missingType && (
            <Text style={[styles.inlineError, { color: t.required }]}>
              Choose a service type to continue.
            </Text>
          )}
          <FieldLabel required>Service type</FieldLabel>
          <View style={styles.chipGrid}>
            {SERVICE_TYPES.map(type => {
              const selected = !isCustomType && form.name === type.name;
              return (
                <TouchableOpacity
                  key={type.id}
                  activeOpacity={0.8}
                  onPress={() => handlePickType(type)}
                  style={[
                    styles.chip,
                    selected && shadow(1),
                    {
                      backgroundColor: selected ? accent.primary : t.chipBg,
                      borderColor: selected ? accent.primary : t.chipBorder,
                    },
                  ]}
                >
                  <Image
                    source={selected || isDark ? type.Wicon : type.icon}
                    style={styles.chipIcon}
                  />
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.chipText,
                      { color: selected ? '#fff' : t.chipText },
                    ]}
                  >
                    {type.name}
                  </Text>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                setIsCustomType(true);
                setExtras({});
                set('name', '');
              }}
              style={[
                styles.chip,
                isCustomType && shadow(1),
                {
                  backgroundColor: isCustomType ? accent.primary : t.chipBg,
                  borderColor: isCustomType ? accent.primary : t.chipBorder,
                },
              ]}
            >
              <AddIcon color={isCustomType ? '#fff' : t.accent} />
              <Text
                style={[styles.chipText, { color: isCustomType ? '#fff' : t.chipText }]}
              >
                Other
              </Text>
            </TouchableOpacity>
          </View>

          {isCustomType && (
            <TextInput
              value={form.name}
              onChangeText={v => set('name', v)}
              onFocus={() => setFocusedField('name')}
              onBlur={() => setFocusedField(null)}
              placeholder="Name the service"
              placeholderTextColor={t.placeholder}
              style={[...inputStyle('name'), { marginTop: 10 }]}
            />
          )}

          {activeExtraFields.length > 0 && (
            <View
              style={[
                styles.extrasBox,
                {
                  backgroundColor: t.inputBg,
                  borderColor: t.inputBorder,
                },
              ]}
            >
              <Text style={[styles.groupTitle, { color: t.muted, marginBottom: 4 }]}>
                {form.name.toUpperCase()} DETAILS
              </Text>
              <View style={styles.extrasWrap}>
                {activeExtraFields.map(field => (
                  <View key={field.key} style={styles.extraField}>
                    <FieldLabel>{field.label}</FieldLabel>
                    <View style={styles.suffixWrapper}>
                      <TextInput
                        value={extras[field.key] ?? ''}
                        onChangeText={v => setExtra(field.key, v)}
                        onFocus={() => setFocusedField(field.key)}
                        onBlur={() => setFocusedField(null)}
                        keyboardType={field.keyboard || 'default'}
                        placeholder={field.placeholder}
                        placeholderTextColor={t.placeholder}
                        style={[
                          ...inputStyle(field.key),
                          { backgroundColor: t.sheetBg },
                          field.suffix && { paddingRight: 36 },
                        ]}
                      />
                      {field.suffix && (
                        <Text style={[styles.suffix, { color: t.muted }]}>
                          {field.suffix}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={styles.fieldGroup}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <FieldLabel required>Service date</FieldLabel>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setDatePicker('service')}
                  style={[
                    styles.input,
                    styles.dateInput,
                    {
                      backgroundColor: t.inputBg,
                      borderColor: missingDate ? t.required : t.inputBorder,
                    },
                  ]}
                >
                  <Text style={{ color: form.serviceDate ? t.inputText : t.placeholder, fontSize: 14 }}>
                    {formatDate(form.serviceDate) || 'Select date'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={{ flex: 1 }}>
                <FieldLabel>Mileage</FieldLabel>
                <View style={styles.suffixWrapper}>
                  <TextInput
                    value={form.currentMileage}
                    onChangeText={v => set('currentMileage', v.replace(/[^0-9]/g, ''))}
                    onFocus={() => setFocusedField('currentMileage')}
                    onBlur={() => setFocusedField(null)}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={t.placeholder}
                    style={[...inputStyle('currentMileage'), { paddingRight: 42 }]}
                  />
                  <Text style={[styles.suffix, { color: t.muted }]}>km</Text>
                </View>
              </View>
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <FieldLabel>Total cost ({currencySymbol})</FieldLabel>
                <TextInput
                  value={form.totalCost}
                  onChangeText={v => set('totalCost', sanitizeDecimal(v))}
                  onFocus={() => setFocusedField('totalCost')}
                  onBlur={() => setFocusedField(null)}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={t.placeholder}
                  style={inputStyle('totalCost')}
                />
              </View>

              <View style={{ flex: 1 }}>
                <FieldLabel>Workshop</FieldLabel>
                <TextInput
                  value={form.workshopName}
                  onChangeText={v => set('workshopName', v)}
                  onFocus={() => setFocusedField('workshopName')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Workshop name"
                  placeholderTextColor={t.placeholder}
                  style={inputStyle('workshopName')}
                />
              </View>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.groupTitle, { color: t.muted }]}>NEXT SERVICE</Text>

            {suggestion && !form.nextServiceDate && (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={applySuggestion}
                style={[
                  styles.suggestionBanner,
                  { backgroundColor: t.inputBg, borderColor: t.inputBorderFocus },
                ]}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.suggestionTitle, { color: t.accent }]}>
                    Suggested: due {formatDate(suggestion.dueDate)}
                    {suggestion.dueMileage
                      ? ` · ~${suggestion.dueMileage.toLocaleString()} km`
                      : ''}
                  </Text>
                  <Text style={[styles.suggestionHint, { color: t.muted }]}>
                    Typical interval for {form.name}
                  </Text>
                </View>
                <Text style={[styles.suggestionAction, { color: t.accent }]}>Use</Text>
              </TouchableOpacity>
            )}

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <FieldLabel>Due date</FieldLabel>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setDatePicker('next')}
                  style={[
                    styles.input,
                    styles.dateInput,
                    { backgroundColor: t.inputBg, borderColor: t.inputBorder },
                  ]}
                >
                  <Text style={{ color: form.nextServiceDate ? t.inputText : t.placeholder, fontSize: 14 }}>
                    {formatDate(form.nextServiceDate) || 'Select date'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={{ flex: 1 }}>
                <FieldLabel>Due mileage</FieldLabel>
                <View style={styles.suffixWrapper}>
                  <TextInput
                    value={form.nextServiceMileage}
                    onChangeText={v => set('nextServiceMileage', v.replace(/[^0-9]/g, ''))}
                    onFocus={() => setFocusedField('nextServiceMileage')}
                    onBlur={() => setFocusedField(null)}
                    keyboardType="number-pad"
                    placeholder="Optional"
                    placeholderTextColor={t.placeholder}
                    style={[...inputStyle('nextServiceMileage'), { paddingRight: 42 }]}
                  />
                  <Text style={[styles.suffix, { color: t.muted }]}>km</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                if (!form.nextServiceDate) {
                  setSaveError("Please select a due date before enabling the reminder.");
                  return;
                }
                set('remindMe', !form.remindMe);
              }}
              style={[
                styles.reminderRow,
                {
                  backgroundColor: t.inputBg,
                  borderColor: form.remindMe && form.nextServiceDate ? t.inputBorderFocus : t.inputBorder,
                  opacity: form.nextServiceDate ? 1 : 0.65,
                },
              ]}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.reminderTitle, { color: t.inputText }]}>
                  Remind me when it's due
                </Text>
                <Text style={[styles.reminderHint, { color: t.muted }]}>
                  {form.nextServiceDate
                    ? `Due ${formatDate(form.nextServiceDate)}`
                    : 'Set a next service date to use reminders'}
                </Text>
              </View>
              <View
                style={[
                  styles.track,
                  {
                    backgroundColor: form.remindMe && form.nextServiceDate
                      ? accent.primary
                      : isDark
                      ? 'rgba(255,255,255,0.18)'
                      : accent.alpha(0.18),
                  },
                ]}
              >
                <View
                  style={[
                    styles.thumb,
                    { transform: [{ translateX: form.remindMe && form.nextServiceDate ? 14 : 0 }] },
                  ]}
                />
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.fieldGroup}>
            <FieldLabel>Notes</FieldLabel>
            <TextInput
              value={form.description}
              onChangeText={v => set('description', v)}
              onFocus={() => setFocusedField('description')}
              onBlur={() => setFocusedField(null)}
              placeholder="Parts replaced, warranty, anything worth remembering…"
              placeholderTextColor={t.placeholder}
              multiline
              textAlignVertical="top"
              style={[...inputStyle('description'), styles.multiline]}
            />

            <FieldLabel>Receipt photo</FieldLabel>
            {selectedImage ? (
              <View style={[styles.previewWrapper, shadow(2)]}>
                <Image source={{ uri: selectedImage }} style={styles.preview} />
                <TouchableOpacity
                  onPress={clearImage}
                  style={styles.removePhoto}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.removePhotoText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={selectImage}
                style={[styles.uploadZone, { borderColor: t.inputBorder }]}
              >
                <AddIcon color={t.accent} />
                <Text style={[styles.uploadText, { color: t.muted }]}>
                  Add a photo of the receipt
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {saveError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{saveError}</Text>
            </View>
          )}
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: t.divider, backgroundColor: t.sheetBg }]}>
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={isLoading || !currencyReady}
            style={[styles.saveButton, shadow(3), (!isValid || isLoading || !currencyReady) && { opacity: 0.5 }]}
            onPress={() => {
              Keyboard.dismiss();
              handleSave();
            }}
          >
            {isLoading ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.saveText}>Saving…</Text>
              </>
            ) : (
              <Text style={styles.saveText}>Save service</Text>
            )}
          </TouchableOpacity>
        </View>

        {datePicker && (
          <AppDatePicker
            value={
              (datePicker === 'service' ? form.serviceDate : form.nextServiceDate) ||
              new Date()
            }
            maximumDate={datePicker === 'service' ? endOfToday() : undefined}
            minimumDate={datePicker === 'next' ? startOfToday() : undefined}
            onChange={handleDateChange}
          />
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modal: { margin: 0, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
  },
  handleWrapper: { alignItems: 'center', paddingTop: 10 },
  handle: { width: 40, height: 4, borderRadius: 2 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 12,
  },
  iconWell: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: { width: 20, height: 20, resizeMode: 'contain' },
  title: { fontSize: 18, fontFamily: 'RobotoCondensed500' },
  subtitle: { fontSize: 13, fontFamily: 'RobotoCondensed400' },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: { height: 1, width: '100%' },
  scrollContent: { padding: 20, paddingBottom: 12 },

  fieldLabel: {
    fontSize: 13,
    fontFamily: 'RobotoCondensed500',
    marginBottom: 8,
  },
  inlineError: {
    fontSize: 12,
    fontFamily: 'RobotoCondensed400',
    marginTop: -4,
    marginBottom: 8,
  },
  groupTitle: {
    fontSize: 12,
    fontFamily: 'RobotoCondensed500',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  fieldGroup: { marginTop: 24 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 14 },

  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    maxWidth: '100%',
  },
  chipIcon: { width: 15, height: 15, resizeMode: 'contain' },
  chipText: { fontSize: 13, fontFamily: 'RobotoCondensed500' },

  extrasBox: {
    marginTop: 14,
    padding: 14,
    paddingBottom: 4,
    borderRadius: 14,
    borderWidth: 1,
  },
  extrasWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 12,
  },
  extraField: {
    flexBasis: '46%',
    flexGrow: 1,
    marginBottom: 12,
  },

  input: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: 'RobotoCondensed400',
  },
  dateInput: { justifyContent: 'center' },
  multiline: {
    height: 92,
    paddingTop: 12,
    marginBottom: 20,
  },
  suffixWrapper: { position: 'relative', justifyContent: 'center' },
  suffix: {
    position: 'absolute',
    right: 14,
    fontSize: 13,
    fontFamily: 'RobotoCondensed400',
  },

  suggestionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  suggestionTitle: { fontSize: 13, fontFamily: 'RobotoCondensed500' },
  suggestionHint: { fontSize: 12, fontFamily: 'RobotoCondensed400', marginTop: 1 },
  suggestionAction: { fontSize: 13, fontFamily: 'RobotoCondensed500' },

  reminderRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  reminderTitle: { fontSize: 14, fontFamily: 'RobotoCondensed500' },
  reminderHint: { fontSize: 12, fontFamily: 'RobotoCondensed400' },
  track: {
    width: 36,
    height: 22,
    borderRadius: 11,
    padding: 2,
    justifyContent: 'center',
  },
  thumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#fff',
  },

  uploadZone: {
    height: 88,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  uploadText: { fontSize: 13, fontFamily: 'RobotoCondensed400' },
  previewWrapper: { position: 'relative' },
  preview: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    resizeMode: 'cover',
  },
  removePhoto: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(4,25,51,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  removePhotoText: { color: '#fff', fontSize: 12, fontFamily: 'RobotoCondensed500' },

  errorBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(214, 60, 60, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(214, 60, 60, 0.25)',
  },
  errorText: {
    color: '#C24242',
    fontSize: 13,
    fontFamily: 'RobotoCondensed400',
    lineHeight: 18,
  },

  footer: {
    padding: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
  },
  saveButton: {
    get backgroundColor() { return accent.primary; },
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: { color: '#fff', fontFamily: 'RobotoCondensed500',  fontSize: 14, },
});

export default AddService;