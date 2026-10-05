import React, { useEffect, useMemo, useState } from 'react';
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
} from 'react-native';
import Modal from 'react-native-modal';
import AppDatePicker from '../components/ui/AppDatePicker';
import { useSelector } from 'react-redux';

import CloseX from '../assets/svg/CloseX.jsx';
import FuelIcon from '../assets/svg/FuelIcon.jsx';

import { updateUserFuelLog, bumpVehicleOdometer } from '../store/userSlice.js';
import { useTheme } from '../util/methods/useTheme.js';
import { sanitizeDecimal } from '../util/numberInput';
import { useKeyboardBehavior } from '../util/methods/useKeyboardBehavior';
import { useCurrency, toDisplayAmount } from '../util/methods/useCurrency';
import { shadow } from '../theme/tokens';
import { accent } from '../theme/accent';

const NAVY = 'rgba(4, 25, 51, 1)';


const FUEL_TYPES = [
  { id: 1, name: 'Petrol', unit: 'L' },
  { id: 2, name: 'Diesel', unit: 'L' },
  { id: 3, name: 'CNG', unit: 'kg' },
  { id: 4, name: 'EV Charge', unit: 'kWh' },
];

const timestampToDate = timestamp => {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp === 'object' && timestamp._seconds !== undefined) {
    return new Date(timestamp._seconds * 1000);
  }
  return new Date(timestamp);
};

const endOfToday = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
};

const formatDate = d =>
  d ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : null;

const INITIAL_FORM = {
  fuelType: 'Petrol',
  date: null,
  odometer: '',
  liters: '',
  pricePerLiter: '',
  stationName: '',
  fullTank: true,
};

const FuelUpdate = ({ FuelUpdateModal, setFuelUpdateModal, updateData, onFuelLogUpdated, setSelectedCard }) => {
  const isDark = useTheme();
  const behaviour = useKeyboardBehavior();
  const { userEmail, selectedCar } = useSelector(state => state.user);

  const [form, setForm] = useState(INITIAL_FORM);
  // Bumped when the form is prefilled, so prefilled values count as clean.
  const [cleanKey, setCleanKey] = useState(0);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [focusedField, setFocusedField] = useState(null);
  const { symbol: currencySymbol, fxRate, ready: currencyReady } = useCurrency(FuelUpdateModal);

  // Prefill once the currency lookup has settled, so the stored base amount is
  // shown (and later saved back) with the same rate.
  useEffect(() => {
    if (!FuelUpdateModal || !updateData || !currencyReady) return;
    setForm({
      fuelType: updateData.fuelType || 'Petrol',
      date: timestampToDate(updateData.date),
      odometer: updateData.odometer?.toString() || '',
      liters: updateData.liters?.toString() || '',
      pricePerLiter: toDisplayAmount(updateData.pricePerLiter, fxRate),
      stationName: updateData.stationName || '',
      fullTank: updateData.fullTank ?? true,
    });
    setSaveError(null);
    setCleanKey(k => k + 1);
  }, [FuelUpdateModal, updateData, fxRate, currencyReady]);

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));

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

  const handleClose = () => {
    if (loading) return;
    setFuelUpdateModal(false);
    setSelectedCard?.(false);
  };

  // Backdrop, back button and the close icon ask before throwing away input.
  const isDirty = useUnsavedChanges({ form }, cleanKey);
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

  const handleUpdate = async () => {
    if (loading || !currencyReady) return;
    if (!isValid) {
      setSaveError('Fill in the date, odometer and quantity before saving.');
      return;
    }

    try {
      setLoading(true);
      setSaveError(null);

      const priceInBaseCurrency = parseFloat(form.pricePerLiter) / fxRate;
      const fuelData = {
        ...form,
        pricePerLiter: Number.isFinite(priceInBaseCurrency) ? priceInBaseCurrency : 0,
        totalCost: totalCost != null ? totalCost / fxRate : 0,
      };
      await updateUserFuelLog(userEmail, fuelData, selectedCar, updateData.id);
      bumpVehicleOdometer(userEmail, selectedCar, form.odometer).catch(() => {});

      onFuelLogUpdated?.();
      setFuelUpdateModal(false);
      setSelectedCard?.(false);
    } catch (error) {
      console.warn('Update fuel log failed:', error);
      setSaveError("The record couldn't be updated. Try again.");
    } finally {
      setLoading(false);
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

  if (!updateData) return null;

  return (
    <Modal
      isVisible={FuelUpdateModal}
      statusBarTranslucent
      onBackdropPress={requestClose}
      onBackButtonPress={requestClose}
      style={styles.modal}
      coverScreen
      useNativeDriver={false}
   
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
          <Text style={[styles.title, { color: t.text, flex: 1 }]}>Edit fuel log</Text>
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
                    { backgroundColor: selected ? accent.primary : t.chipBg, borderColor: selected ? accent.primary : t.chipBorder },
                  ]}
                >
                  <Text style={[styles.chipText, { color: selected ? '#fff' : t.chipText }]}>{type.name}</Text>
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
                  style={[styles.input, styles.dateInput, { backgroundColor: t.inputBg, borderColor: t.inputBorder }]}
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
                    style={[...inputStyle('odometer'), { paddingRight: 42 }]}
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
                    style={[...inputStyle('liters'), { paddingRight: 42 }]}
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
              style={[styles.reminderRow, { backgroundColor: t.inputBg, borderColor: form.fullTank ? t.inputBorderFocus : t.inputBorder }]}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.reminderTitle, { color: t.inputText }]}>Filled to full</Text>
                <Text style={[styles.reminderHint, { color: t.muted }]}>
                  Marks this fill-up as a full tank rather than a top-up
                </Text>
              </View>
              <View style={[styles.track, { backgroundColor: form.fullTank ? accent.primary : isDark ? 'rgba(255,255,255,0.18)' : accent.alpha(0.18) }]}>
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
            disabled={loading || !currencyReady}
            style={[styles.saveButton, shadow(3), (!isValid || loading || !currencyReady) && { opacity: 0.5 }]}
            onPress={() => {
              Keyboard.dismiss();
              handleUpdate();
            }}
          >
            {loading ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.saveText}>Saving…</Text>
              </>
            ) : (
              <Text style={styles.saveText}>Save changes</Text>
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
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%' },
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
  iconWell: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontFamily: 'RobotoCondensed500' },
  closeButton: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  divider: { height: 1, width: '100%' },
  scrollContent: { padding: 20, paddingBottom: 12 },
  fieldLabel: { fontSize: 13, fontFamily: 'RobotoCondensed500', marginBottom: 8 },
  fieldGroup: { marginTop: 24 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 38, borderRadius: 19, borderWidth: 1 },
  chipText: { fontSize: 13, fontFamily: 'RobotoCondensed500' },
  input: { height: 46, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontSize: 14, fontFamily: 'RobotoCondensed400' },
  dateInput: { justifyContent: 'center' },
  suffixWrapper: { position: 'relative', justifyContent: 'center' },
  suffix: { position: 'absolute', right: 14, fontSize: 13, fontFamily: 'RobotoCondensed400' },
  prefixWrapper: { position: 'relative', justifyContent: 'center' },
  prefix: { position: 'absolute', left: 14, fontSize: 13, fontFamily: 'RobotoCondensed400', zIndex: 1 },
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
  track: { width: 36, height: 22, borderRadius: 11, padding: 2, justifyContent: 'center' },
  thumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff' },
  errorBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(214, 60, 60, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(214, 60, 60, 0.25)',
  },
  errorText: { color: '#C24242', fontSize: 13, fontFamily: 'RobotoCondensed400', lineHeight: 18 },
  footer: { padding: 16, paddingHorizontal: 20, borderTopWidth: 1 },
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

export default FuelUpdate;
