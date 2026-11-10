import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useUnsavedChanges, useDiscardConfirm } from '../util/methods/useUnsavedChanges';
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
import { useDispatch, useSelector } from 'react-redux';

import CloseX from '../assets/svg/CloseX.jsx';
import FuelIcon from '../assets/svg/FuelIcon.jsx';

import { updateUserFuelLog, bumpVehicleOdometer, bumpRecordsVersion } from '../store/userSlice.js';
import { kmToField, fieldToKm } from '../util/distance';
import { useDistanceUnit } from '../util/schedule/scheduleSettings';
import { useTheme } from '../util/methods/useTheme.js';
import { sanitizeDecimal } from '../util/numberInput';
import { linkFuelAmounts, fuelUnit } from '../util/fuelEfficiency.js';
import { useFuelCountry, fuelTypesFor, fuelLabel } from '../util/fuelTypes';
import FuelCountryBadge from '../components/FuelCountryBadge';
import { useFuelHistory } from '../util/methods/useFuelHistory';
import { PreviousFillCard, OdometerWarning } from '../components/FuelFormParts';
import { useKeyboardBehavior } from '../util/methods/useKeyboardBehavior';
import { amountText, parseAmount, recordCurrency, symbolFor } from '../util/methods/useCurrency';
import { shadow } from '../theme/tokens';
import { accent } from '../theme/accent';
import { useHideAdsWhile } from '../util/ads';
import { useSheetFooterInset } from '../util/methods/useSheetFooterInset';

const NAVY = 'rgba(4, 25, 51, 1)';



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
  totalCost: '',
};

const FuelUpdate = ({ FuelUpdateModal, setFuelUpdateModal, updateData, onFuelLogUpdated, setSelectedCard }) => {
  useHideAdsWhile(FuelUpdateModal);
  const footerInset = useSheetFooterInset();
  const isDark = useTheme();
  const behaviour = useKeyboardBehavior();
  const vehicles = useSelector(state => state.vehicle.vehiclesInformation);
  const { userEmail, selectedCar } = useSelector(state => state.user);
  const dispatch = useDispatch();
  const activeVehicle = useMemo(
    () => vehicles?.find(v => v.id === selectedCar) || vehicles?.[0],
    [vehicles, selectedCar],
  );

  const [form, setForm] = useState(INITIAL_FORM);
  // Chips follow the user's current country; the record's own fuel stays
  // selectable even if it was bought somewhere else.
  const fuelCountry = useFuelCountry(FuelUpdateModal);
  const fuelTypes = useMemo(
    () => fuelTypesFor(fuelCountry, updateData?.fuelType),
    [fuelCountry, updateData?.fuelType],
  );
  // Bumped when the form is prefilled, so prefilled values count as clean.
  const [cleanKey, setCleanKey] = useState(0);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [triedSave, setTriedSave] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  // A saved record keeps the currency it was entered in: its amounts are
  // edited and saved back in that currency, whatever the app currency is now.
  const recordCode = recordCurrency(updateData);
  const currencySymbol = symbolFor(recordCode);
  const currencyReady = true;

  useEffect(() => {
    if (!FuelUpdateModal || !updateData) return;
    setForm({
      fuelType: updateData.fuelType || 'Petrol',
      date: timestampToDate(updateData.date),
      odometer: updateData.odometer?.toString() || '',
      liters: updateData.liters?.toString() || '',
      pricePerLiter: amountText(updateData.pricePerLiter),
      totalCost: amountText(updateData.totalCost),
      stationName: updateData.stationName || '',
    });
    setSaveError(null);
    setTriedSave(false);
    editedAmounts.current = [];
    setCleanKey(k => k + 1);
  }, [FuelUpdateModal, updateData]);

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
      inputBorderFilled: isDark ? accent.light : accent.primary,
      inputText: isDark ? '#fff' : NAVY,
      placeholder: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(4,25,51,0.35)',
      chipBg: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
      chipBorder: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(4,25,51,0.12)',
      chipText: isDark ? 'rgba(255,255,255,0.8)' : NAVY,
      handle: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(4,25,51,0.15)',
      divider: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(4,25,51,0.06)',
      accent: isDark ? accent.light : accent.primary,
      required: '#C24242',
      fieldError: isDark ? '#FF9C90' : '#C24242',
      iconWell: isDark ? accent.lightAlpha(0.14) : accent.alpha(0.08),
    }),
    [isDark],
  );

  const activeUnit = fuelUnit(form.fuelType);
  const isElectric = form.fuelType === 'EV Charge';

  // Quantity, price and total: type any two and the third is filled in.
  const editedAmounts = useRef([]);
  const setAmount = (key, value) => {
    editedAmounts.current = [...editedAmounts.current.filter(k => k !== key), key];
    setForm(f => {
      const next = { ...f, [key]: value };
      return { ...next, ...linkFuelAmounts(next, editedAmounts.current) };
    });
  };

  const vehicleOdometer = Number(activeVehicle?.currentOdometer) || 0;
  const distUnit = useDistanceUnit();
  const history = useFuelHistory({
    open: FuelUpdateModal,
    userEmail,
    carId: selectedCar,
    date: form.date,
    odometer: form.odometer,
    excludeId: updateData?.id,
    vehicleOdometer,
  });
  const partColors = {
    text: t.inputText,
    muted: t.muted,
    inputBg: t.inputBg,
    inputBorder: t.inputBorder,
    inputBorderFocus: t.inputBorderFocus,
    accent: t.accent,
    required: t.fieldError,
    isDark,
  };

  const isValid = !!form.date && parseFloat(form.odometer) >= 0 && parseFloat(form.liters) > 0;

  const handleClose = () => {
    if (loading) return;
    setFuelUpdateModal(false);
    setSelectedCard?.(false);
  };

  // Backdrop, back button and the close icon ask before throwing away input.
  const isDirty = useUnsavedChanges({ form }, cleanKey);
  const [requestClose, discardDialog] = useDiscardConfirm(isDirty, handleClose);

  // Save stays disabled until something is changed (and required fields are filled).
  // Dimmed (saveDisabled) while incomplete, but still pressable so a tap
  // reveals which fields are missing; only saving blocks the button.
  const saveDisabled = loading || !currencyReady || !isDirty || !isValid;

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
      setTriedSave(true);
      return;
    }

    try {
      setLoading(true);
      setSaveError(null);

      const price = parseAmount(form.pricePerLiter);
      const cost = parseAmount(form.totalCost);
      const fuelData = {
        ...form,
        // Keep the name it was bought under unless the fuel itself changed.
        // Old records have no fuelName and keep showing their fuelType.
        fuelName: form.fuelType === updateData.fuelType
          ? updateData.fuelName || ''
          : fuelLabel(form.fuelType, fuelCountry),
        pricePerLiter: price ?? 0,
        totalCost: cost > 0 ? cost : 0,
        currency: recordCode,
      };
      await updateUserFuelLog(userEmail, fuelData, selectedCar, updateData.id);
      bumpVehicleOdometer(userEmail, selectedCar, form.odometer).catch(() => {});
      dispatch(bumpRecordsVersion());

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

  const missingDate = triedSave && !form.date;
  const missingOdometer = triedSave && !(parseFloat(form.odometer) >= 0);
  const missingAmount = triedSave && !(parseFloat(form.liters) > 0);

  const FieldError = ({ show, children }) =>
    show ? <Text style={[styles.fieldError, { color: t.fieldError }]}>{children}</Text> : null;

  const inputStyle = key => [
    styles.input,
    {
      backgroundColor: t.inputBg,
      borderColor:
        focusedField === key
          ? t.inputBorderFocus
          : form[key] && form[key].toString().trim() !== ''
          ? t.inputBorderFilled
          : t.inputBorder,
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
          <View style={styles.fuelLabelRow}>
            <FieldLabel required>Fuel type</FieldLabel>
            <FuelCountryBadge country={fuelCountry} isDark={isDark} />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={styles.chipScroll}
            contentContainerStyle={styles.chipGrid}
          >
            {fuelTypes.map(type => {
              const selected = form.fuelType === type.key;
              return (
                <TouchableOpacity
                  key={type.key}
                  activeOpacity={0.8}
                  onPress={() => set('fuelType', type.key)}
                  style={[
                    styles.chip,
                    selected && shadow(1),
                    { backgroundColor: selected ? accent.primary : t.chipBg, borderColor: selected ? accent.primary : t.chipBorder },
                  ]}
                >
                  <Text style={[styles.chipText, { color: selected ? '#fff' : t.chipText }]}>{type.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.fieldGroup}>
            <PreviousFillCard history={history} colors={partColors} />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <FieldLabel required>Date</FieldLabel>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setDatePickerOpen(true)}
                  style={[styles.input, styles.dateInput, { backgroundColor: t.inputBg, borderColor: missingDate ? t.required : form.date ? t.inputBorderFilled : t.inputBorder }]}
                >
                  <Text style={{ color: form.date ? t.inputText : t.placeholder, fontSize: 14 }}>
                    {formatDate(form.date) || 'Select date'}
                  </Text>
                </TouchableOpacity>
                <FieldError show={missingDate}>Pick the fill-up date.</FieldError>
              </View>

              <View style={{ flex: 1 }}>
                <FieldLabel required>Odometer</FieldLabel>
                <View style={styles.suffixWrapper}>
                  <TextInput
                    // Stored in km; typed and shown in the user's unit.
                    value={kmToField(form.odometer, distUnit)}
                    onChangeText={v => set('odometer', fieldToKm(v, distUnit))}
                    onFocus={() => setFocusedField('odometer')}
                    onBlur={() => setFocusedField(null)}
                    keyboardType="number-pad"
                    placeholder={vehicleOdometer ? String(vehicleOdometer) : '0'}
                    placeholderTextColor={t.placeholder}
                    style={[...inputStyle('odometer'), { paddingRight: 42 }, missingOdometer && { borderColor: t.required }]}
                  />
                  <Text style={[styles.suffix, { color: t.muted }]}>{distUnit}</Text>
                </View>
                <FieldError show={missingOdometer}>Enter the odometer reading.</FieldError>
                <OdometerWarning history={history} colors={partColors} />
              </View>
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <FieldLabel required>{isElectric ? 'Energy added' : 'Quantity'}</FieldLabel>
                <View style={styles.suffixWrapper}>
                  <TextInput
                    value={form.liters}
                    onChangeText={v => setAmount('liters', sanitizeDecimal(v))}
                    onFocus={() => setFocusedField('liters')}
                    onBlur={() => setFocusedField(null)}
                    keyboardType="decimal-pad"
                    placeholder="0.0"
                    placeholderTextColor={t.placeholder}
                    style={[...inputStyle('liters'), { paddingRight: 42 }, missingAmount && { borderColor: t.required }]}
                  />
                  <Text style={[styles.suffix, { color: t.muted }]}>{activeUnit}</Text>
                </View>
                <FieldError show={missingAmount}>
                  {`Enter the amount in ${activeUnit} (more than 0).`}
                </FieldError>
              </View>

              <View style={{ flex: 1 }}>
                <FieldLabel>{`Price / ${activeUnit}`}</FieldLabel>
                <View style={styles.prefixWrapper}>
                  <Text style={[styles.prefix, { color: t.muted }]}>{currencySymbol}</Text>
                  <TextInput
                    value={form.pricePerLiter}
                    onChangeText={v => setAmount('pricePerLiter', sanitizeDecimal(v))}
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

            <FieldLabel>Total cost</FieldLabel>
            <View style={styles.prefixWrapper}>
              <Text style={[styles.prefix, { color: t.muted }]}>{currencySymbol}</Text>
              <TextInput
                value={form.totalCost}
                onChangeText={v => setAmount('totalCost', sanitizeDecimal(v))}
                onFocus={() => setFocusedField('totalCost')}
                onBlur={() => setFocusedField(null)}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={t.placeholder}
                style={[...inputStyle('totalCost'), { paddingLeft: 30 }]}
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <FieldLabel>{isElectric ? 'Charging station' : 'Station name'}</FieldLabel>
            <TextInput
              value={form.stationName}
              onChangeText={v => set('stationName', v)}
              onFocus={() => setFocusedField('stationName')}
              onBlur={() => setFocusedField(null)}
              placeholder={isElectric ? 'e.g. Mall fast charger' : 'e.g. Shell, Main Road'}
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

        <View style={[styles.footer, { borderTopColor: t.divider, backgroundColor: t.sheetBg, paddingBottom: 16 + footerInset }]}>
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={loading || !currencyReady || !isDirty}
            style={[styles.saveButton, shadow(3), saveDisabled && { opacity: 0.5 }]}
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
      {discardDialog}
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
  fuelLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  chipScroll: { marginHorizontal: -20, marginVertical: -4 },
  chipGrid: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingVertical: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, height: 32, borderRadius: 16, borderWidth: 1 },
  chipText: { fontSize: 12, fontFamily: 'RobotoCondensed500' },
  input: { height: 46, borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 14, fontSize: 14, fontFamily: 'RobotoCondensed400' },
  dateInput: { justifyContent: 'center' },
  suffixWrapper: { position: 'relative', justifyContent: 'center' },
  suffix: { position: 'absolute', right: 14, fontSize: 13, fontFamily: 'RobotoCondensed400' },
  prefixWrapper: { position: 'relative', justifyContent: 'center' },
  prefix: { position: 'absolute', left: 14, fontSize: 13, fontFamily: 'RobotoCondensed400', zIndex: 1 },
  errorBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(214, 60, 60, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(214, 60, 60, 0.25)',
  },
  fieldError: { marginTop: 6, fontSize: 12, fontFamily: 'RobotoCondensed400', lineHeight: 16 },
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
