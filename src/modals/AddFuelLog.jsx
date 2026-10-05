import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { useSelector } from 'react-redux';

import CloseX from '../assets/svg/CloseX.jsx';
import AddIcon from '../assets/svg/AddIcon.jsx';
import FuelIcon from '../assets/svg/FuelIcon.jsx';

import { addUserFuelLog, bumpVehicleOdometer } from '../store/userSlice.js';

import { useTheme } from '../util/methods/useTheme.js';
import { sanitizeDecimal } from '../util/numberInput';
import { useKeyboardBehavior } from '../util/methods/useKeyboardBehavior';
import {
  useImagePicker,
} from '../util/methods/useImagePicker';
import { useCurrency } from '../util/methods/useCurrency';
import { uploadImage } from '../util/imageStorage';
import { shadow } from '../theme/tokens';
import { accent } from '../theme/accent';

const NAVY = 'rgba(4, 25, 51, 1)';

// Premium shadow profile — matches AddService.jsx / VehicleInformations.jsx

const FUEL_TYPES = [
  { id: 1, name: 'Petrol', unit: 'L' },
  { id: 2, name: 'Diesel', unit: 'L' },
  { id: 3, name: 'CNG', unit: 'kg' },
  { id: 4, name: 'EV Charge', unit: 'kWh' },
];

const EMPTY_FORM = {
  fuelType: 'Petrol',
  date: null,
  odometer: '',
  liters: '',
  pricePerLiter: '',
  stationName: '',
  fullTank: false,
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

const AddFuelLog = ({ AddFuelLogModal, setAddFuelLogModal, onFuelLogAdded }) => {
  const isDark = useTheme();
  const behaviour = useKeyboardBehavior();
  const scrollViewRef = useRef(null);

  const vehicles = useSelector(state => state.vehicle.vehiclesInformation);
  const { userEmail, selectedCar } = useSelector(state => state.user);
  const activeVehicle = useMemo(
    () => vehicles?.find(v => v.id === selectedCar) || vehicles?.[0],
    [vehicles, selectedCar],
  );

  const [form, setForm] = useState(EMPTY_FORM);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [triedSave, setTriedSave] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const { symbol: currencySymbol, fxRate, ready: currencyReady } = useCurrency(AddFuelLogModal);

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
      accent: isDark ? accent.light : accent.primary,
      required: '#C24242',
      iconWell: isDark ? accent.lightAlpha(0.14) : accent.alpha(0.08),
    }),
    [isDark],
  );

  const activeUnit = FUEL_TYPES.find(f => f.name === form.fuelType)?.unit || 'L';
  const isElectric = form.fuelType === 'EV Charge';

  const totalCost = useMemo(() => {
    const amount = parseFloat(form.liters);
    const price = parseFloat(form.pricePerLiter);
    if (!Number.isFinite(amount) || !Number.isFinite(price)) return null;
    return amount * price;
  }, [form.liters, form.pricePerLiter]);

  const isValid = !!form.date && parseFloat(form.odometer) > 0 && parseFloat(form.liters) > 0;

  const resetAll = () => {
    setForm(EMPTY_FORM);
    setTriedSave(false);
    setSaveError(null);
    clearImage?.();
  };

  const handleClose = () => {
    if (isLoading) return;
    setAddFuelLogModal(false);
    resetAll();
  };

  // Backdrop, back button and the close icon ask before throwing away input.
  const isDirty = useUnsavedChanges({ form, selectedImage });
  const requestClose = () => confirmDiscard(isDirty, handleClose);

  const handleDateChange = (event, date) => {
    setDatePickerOpen(false);
    // Android: closing the native date dialog can leave the soft keyboard
    // unable to attach to the next TextInput that's tapped — this call is a
    // no-op if nothing's showing, but it resets the stuck IME state so the
    // next natural focus works.
    Keyboard.dismiss();
    if (event?.type === 'dismissed' || !date) return;
    set('date', date > endOfToday() ? new Date() : date);
  };

  const handleSave = async () => {
    // Wait for the currency lookup so typed amounts are converted with the right rate.
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
        const uploadResult = await uploadImage(selectedImage, 'fuel');
        if (uploadResult?.success) {
          uploadedImageUrl = uploadResult.url;
        } else {
          setSaveError("The receipt photo couldn't be uploaded. Check your connection and try again.");
          setIsLoading(false);
          return;
        }
      }

      const priceInBaseCurrency = parseFloat(form.pricePerLiter) / fxRate;
      const fuelData = {
        ...form,
        pricePerLiter: Number.isFinite(priceInBaseCurrency) ? priceInBaseCurrency : 0,
        totalCost: totalCost != null ? totalCost / fxRate : 0,
        imageUrl: uploadedImageUrl,
      };

      await addUserFuelLog(userEmail, fuelData, selectedCar);
      bumpVehicleOdometer(userEmail, selectedCar, form.odometer).catch(() => {});

      onFuelLogAdded?.();
      setAddFuelLogModal(false);
      resetAll();
    } catch (error) {
      console.warn('Save fuel log failed:', error);
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

  const missingDate = triedSave && !form.date;
  const missingOdometer = triedSave && !(parseFloat(form.odometer) > 0);
  const missingAmount = triedSave && !(parseFloat(form.liters) > 0);

  return (
    <Modal
      isVisible={AddFuelLogModal}
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
            <FuelIcon color={t.accent} size={20} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.title, { color: t.text }]}>Log fuel</Text>
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
          <FieldLabel required>Fuel type</FieldLabel>
          <View style={styles.chipGrid}>
            {FUEL_TYPES.map(type => {
              const selected = form.fuelType === type.name;
              return (
                <TouchableOpacity
                  key={type.id}
                  activeOpacity={0.8}
                  onPress={() => set('fuelType', type.name)}
                  style={[
                    styles.chip,
                    selected && shadow(1),
                    {
                      backgroundColor: selected ? accent.primary : t.chipBg,
                      borderColor: selected ? accent.primary : t.chipBorder,
                    },
                  ]}
                >
                  <Text
                    style={[styles.chipText, { color: selected ? '#fff' : t.chipText }]}
                  >
                    {type.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.fieldGroup}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <FieldLabel required>Date</FieldLabel>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setDatePickerOpen(true)}
                  style={[
                    styles.input,
                    styles.dateInput,
                    {
                      backgroundColor: t.inputBg,
                      borderColor: missingDate ? t.required : t.inputBorder,
                    },
                  ]}
                >
                  <Text style={{ color: form.date ? t.inputText : t.placeholder, fontSize: 14 }}>
                    {formatDate(form.date) || 'Select date'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={{ flex: 1 }}>
                <FieldLabel required>Odometer</FieldLabel>
                <View style={styles.suffixWrapper}>
                  <TextInput
                    value={form.odometer}
                    onChangeText={v => set('odometer', v.replace(/[^0-9]/g, ''))}
                    onFocus={() => setFocusedField('odometer')}
                    onBlur={() => setFocusedField(null)}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={t.placeholder}
                    style={[
                      ...inputStyle('odometer'),
                      { paddingRight: 42, borderColor: missingOdometer ? t.required : (focusedField === 'odometer' ? t.inputBorderFocus : t.inputBorder) },
                    ]}
                  />
                  <Text style={[styles.suffix, { color: t.muted }]}>km</Text>
                </View>
              </View>
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <FieldLabel required>{isElectric ? 'Energy added' : 'Quantity'}</FieldLabel>
                <View style={styles.suffixWrapper}>
                  <TextInput
                    value={form.liters}
                    onChangeText={v => set('liters', sanitizeDecimal(v))}
                    onFocus={() => setFocusedField('liters')}
                    onBlur={() => setFocusedField(null)}
                    keyboardType="decimal-pad"
                    placeholder="0.0"
                    placeholderTextColor={t.placeholder}
                    style={[
                      ...inputStyle('liters'),
                      { paddingRight: 42, borderColor: missingAmount ? t.required : (focusedField === 'liters' ? t.inputBorderFocus : t.inputBorder) },
                    ]}
                  />
                  <Text style={[styles.suffix, { color: t.muted }]}>{activeUnit}</Text>
                </View>
              </View>

              <View style={{ flex: 1 }}>
                <FieldLabel>{`Price / ${activeUnit}`}</FieldLabel>
                <View style={styles.prefixWrapper}>
                  <Text style={[styles.prefix, { color: t.muted }]}>{currencySymbol}</Text>
                  <TextInput
                    value={form.pricePerLiter}
                    onChangeText={v => set('pricePerLiter', sanitizeDecimal(v))}
                    onFocus={() => setFocusedField('pricePerLiter')}
                    onBlur={() => setFocusedField(null)}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={t.placeholder}
                    style={[...inputStyle('pricePerLiter'), { paddingLeft: 30 }]}
                  />
                </View>
              </View>
            </View>

            {totalCost !== null && (
              <View style={[styles.totalBanner, { backgroundColor: t.inputBg, borderColor: t.inputBorder }]}>
                <Text style={[styles.totalLabel, { color: t.muted }]}>Total cost</Text>
                <Text style={[styles.totalValue, { color: t.text }]}>{currencySymbol} {totalCost.toFixed(2)}</Text>
              </View>
            )}
          </View>

          {!isElectric && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => set('fullTank', !form.fullTank)}
              style={[
                styles.reminderRow,
                { backgroundColor: t.inputBg, borderColor: form.fullTank ? t.inputBorderFocus : t.inputBorder },
              ]}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.reminderTitle, { color: t.inputText }]}>Filled to full</Text>
                <Text style={[styles.reminderHint, { color: t.muted }]}>
                  Marks this fill-up as a full tank rather than a top-up
                </Text>
              </View>
              <View
                style={[
                  styles.track,
                  { backgroundColor: form.fullTank ? accent.primary : isDark ? 'rgba(255,255,255,0.18)' : accent.alpha(0.18) },
                ]}
              >
                <View style={[styles.thumb, { transform: [{ translateX: form.fullTank ? 14 : 0 }] }]} />
              </View>
            </TouchableOpacity>
          )}

          <View style={styles.fieldGroup}>
            <FieldLabel>{isElectric ? 'Charging station' : 'Station name'}</FieldLabel>
            <TextInput
              value={form.stationName}
              onChangeText={v => set('stationName', v)}
              onFocus={() => setFocusedField('stationName')}
              onBlur={() => setFocusedField(null)}
              placeholder={isElectric ? 'e.g. Tata Power charger' : 'e.g. Indian Oil, Shell'}
              placeholderTextColor={t.placeholder}
              style={inputStyle('stationName')}
            />

            <View style={{ height: 16 }} />
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
              <Text style={styles.saveText}>Save fuel log</Text>
            )}
          </TouchableOpacity>
        </View>

        {datePickerOpen && (
          <AppDatePicker
            value={form.date || new Date()}
            maximumDate={endOfToday()}
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
    paddingHorizontal: 14,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontFamily: 'RobotoCondensed500' },

  input: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: 'RobotoCondensed400',
  },
  dateInput: { justifyContent: 'center' },
  suffixWrapper: { position: 'relative', justifyContent: 'center' },
  suffix: {
    position: 'absolute',
    right: 14,
    fontSize: 13,
    fontFamily: 'RobotoCondensed400',
  },
  prefixWrapper: { position: 'relative', justifyContent: 'center' },
  prefix: {
    position: 'absolute',
    left: 14,
    fontSize: 13,
    fontFamily: 'RobotoCondensed400',
    zIndex: 1,
  },

  totalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  totalLabel: { fontSize: 13, fontFamily: 'RobotoCondensed500' },
  totalValue: { fontSize: 16, fontFamily: 'RobotoCondensed500', fontWeight: '700' },

  reminderRow: {
    marginTop: 20,
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
  saveText: { color: '#fff', fontFamily: 'RobotoCondensed500', fontSize: 14 },
});

export default AddFuelLog;
