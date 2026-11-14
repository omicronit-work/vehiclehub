import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useUnsavedChanges, useDiscardConfirm } from '../util/methods/useUnsavedChanges';
import {
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Text from '../components/ui/AppText';
import Modal from 'react-native-modal';
import AppDatePicker from '../components/ui/AppDatePicker';
import { useDispatch, useSelector } from 'react-redux';

import CloseX from '../assets/svg/CloseX.jsx';
import AddIcon from '../assets/svg/AddIcon.jsx';
import FuelIcon from '../assets/svg/FuelIcon.jsx';

import { addUserFuelLog, bumpVehicleOdometer, bumpRecordsVersion } from '../store/userSlice.js';

import { useTheme } from '../util/methods/useTheme.js';
import { sanitizeDecimal } from '../util/numberInput';
import { linkFuelAmounts, fuelUnit } from '../util/fuelEfficiency.js';
import { useFuelCountry, fuelTypesFor, fuelLabel } from '../util/fuelTypes';
import { useFuelHistory } from '../util/methods/useFuelHistory';
import { PreviousFillCard, OdometerWarning } from '../components/FuelFormParts';
import { kmToField, fieldToKm, formatKm } from '../util/distance';
import { useDistanceUnit } from '../util/schedule/scheduleSettings';
import { useKeyboardBehavior } from '../util/methods/useKeyboardBehavior';
import {
  useImagePicker,
} from '../util/methods/useImagePicker';
import { useCurrency } from '../util/methods/useCurrency';
import { uploadImage } from '../util/imageStorage';
import { shadow } from '../theme/tokens';
import { accent } from '../theme/accent';
import { useHideAdsWhile } from '../util/ads';
import { useSheetFooterInset } from '../util/methods/useSheetFooterInset';
import { FitImage } from '../components/PhotoPreview';
import MoreDetails from '../components/ui/MoreDetails.jsx';
import { t as tr } from '../i18n';
import { vehicleName } from '../i18n/brands';
import { localDate } from '../i18n';

const NAVY = 'rgba(4, 25, 51, 1)';


// Premium shadow profile — matches AddService.jsx / VehicleInformations.jsx

const EMPTY_FORM = {
  fuelType: 'Petrol',
  date: null,
  odometer: '',
  liters: '',
  pricePerLiter: '',
  stationName: '',
  totalCost: '',
};

const formatDate = d =>
  d
    ? localDate(d, { day: '2-digit', month: 'short', year: 'numeric' })
    : null;

const endOfToday = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
};

// Result of the two amount fields (litres bought, or total cost) shown as a
// small summary card under them.
const DerivedCard = ({ t, label, value, unit }) => (
  <View style={[styles.derivedCard, { backgroundColor: t.derivedBg, borderColor: t.derivedBorder }]}>
    <View style={[styles.derivedBadge, { backgroundColor: t.derivedBadge }]}>
      <FuelIcon color={t.accent} size={18} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={[styles.derivedLabel, { color: t.muted }]}>{label}</Text>
      <View style={styles.derivedValueRow}>
        <Text style={[styles.derivedValue, { color: t.accent }]}>{value}</Text>
        {!!unit && <Text style={[styles.derivedUnit, { color: t.text }]}>{unit}</Text>}
      </View>
    </View>
  </View>
);

const AddFuelLog = ({ AddFuelLogModal, setAddFuelLogModal, onFuelLogAdded }) => {
  useHideAdsWhile(AddFuelLogModal);
  const footerInset = useSheetFooterInset();
  const isDark = useTheme();
  const behaviour = useKeyboardBehavior();
  const scrollViewRef = useRef(null);

  const vehicles = useSelector(state => state.vehicle.vehiclesInformation);
  const { userEmail, selectedCar: storedCarId } = useSelector(state => state.user);
  const dispatch = useDispatch();
  const activeVehicle = useMemo(
    () => vehicles?.find(v => v.id === storedCarId) || vehicles?.[0],
    [vehicles, storedCarId],
  );
  // Save to the vehicle this form shows. A stale stored id (e.g. a vehicle
  // deleted on another screen) used to send the record somewhere invisible.
  const selectedCar = activeVehicle?.id ?? storedCarId;

  const [form, setForm] = useState(EMPTY_FORM);
  // Fuel names follow the phone's country (time zone), e.g. Gasohol 95 in Thailand.
  const fuelCountry = useFuelCountry(AddFuelLogModal);
  const fuelTypes = useMemo(() => fuelTypesFor(fuelCountry), [fuelCountry]);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [triedSave, setTriedSave] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const { code: currencyCode, symbol: currencySymbol, ready: currencyReady } = useCurrency(AddFuelLogModal, { lock: !!AddFuelLogModal });

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
      derivedBg: isDark ? accent.lightAlpha(0.1) : accent.alpha(0.06),
      derivedBorder: isDark ? accent.lightAlpha(0.22) : accent.alpha(0.16),
      derivedBadge: isDark ? accent.lightAlpha(0.16) : '#fff',
    }),
    [isDark],
  );

  const activeUnit = fuelUnit(form.fuelType);
  const isElectric = form.fuelType === 'EV Charge';

  const vehicleOdometer = Number(activeVehicle?.currentOdometer) || 0;
  const distUnit = useDistanceUnit();
  const history = useFuelHistory({
    open: AddFuelLogModal,
    userEmail,
    carId: selectedCar,
    date: form.date,
    odometer: form.odometer,
    excludeId: undefined,
    vehicleOdometer,
    fuelType: form.fuelType,
  });
  // Suggest the last price only when it was paid in today's currency; a
  // price saved in another currency is never converted.
  const lastPrice =
    history.lastPrice && history.lastPriceCurrency === currencyCode ? history.lastPrice : null;

  // Amount paid and price are typed; the quantity is worked out from them
  // (it drives fuel economy and cost per km).
  const editedAmounts = useRef([]);
  const setAmount = (key, value) => {
    editedAmounts.current = [...editedAmounts.current.filter(k => k !== key), key];
    setForm(f => {
      const next = { ...f, [key]: value };
      // Buying by amount: borrow the last price paid so the quantity fills in.
      if (key !== 'pricePerLiter' && !next.pricePerLiter && lastPrice) {
        next.pricePerLiter = String(lastPrice);
      }
      return { ...next, ...linkFuelAmounts(next, editedAmounts.current) };
    });
  };

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


  const isValid =
    !!form.date &&
    parseFloat(form.odometer) >= 0 &&
    parseFloat(form.liters) > 0 &&
    parseFloat(form.pricePerLiter) > 0;

  // Start the odometer at the vehicle's current reading (the lowest a new
  // fill-up can be), so it only needs adjusting. The prefill counts as clean.
  // Today's date too, and — once this vehicle's history loads — the fuel type
  // used last time, so a routine fill-up is mostly quantity and price.
  const [cleanKey, setCleanKey] = useState(0);
  useEffect(() => {
    if (!AddFuelLogModal) return;
    setForm(f => ({
      ...f,
      date: f.date || new Date(),
      odometer: f.odometer === '' && vehicleOdometer ? String(vehicleOdometer) : f.odometer,
    }));
    setCleanKey(k => k + 1);
  }, [AddFuelLogModal, vehicleOdometer]);

  const prefilledType = useRef(false);
  useEffect(() => {
    if (!AddFuelLogModal) {
      prefilledType.current = false;
      return;
    }
    if (prefilledType.current || history.loading || !history.lastFuelType) return;
    prefilledType.current = true;
    if (fuelTypes.some(ft => ft.key === history.lastFuelType)) {
      setForm(f => ({ ...f, fuelType: history.lastFuelType }));
      setCleanKey(k => k + 1);
    }
  }, [AddFuelLogModal, history.loading, history.lastFuelType, fuelTypes]);

  const resetAll = () => {
    setForm(EMPTY_FORM);
    editedAmounts.current = [];
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
  const isDirty = useUnsavedChanges({ form, selectedImage }, cleanKey);
  const [requestClose, discardDialog] = useDiscardConfirm(isDirty, handleClose);

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

  // Save stays disabled until all required fields are filled and valid.
  // Dimmed (saveDisabled) while incomplete, but still pressable so a tap
  // reveals which fields are missing; only saving blocks the button.
  const saveDisabled = isLoading || !currencyReady || !isValid;

  const handleSave = async () => {
    // Wait until the app currency is known: it is saved with the amounts.
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
        const uploadResult = await uploadImage(selectedImage);
        if (uploadResult?.success) {
          uploadedImageUrl = uploadResult.url;
        } else {
          setSaveError(uploadResult?.message || tr('The receipt photo couldn\'t be uploaded. Check your connection and try again.'));
          setIsLoading(false);
          return;
        }
      }

      // Saved exactly as typed, together with the currency they were typed in.
      const price = parseFloat(form.pricePerLiter);
      const fuelData = {
        ...form,
        fuelName: fuelLabel(form.fuelType, fuelCountry),
        pricePerLiter: Number.isFinite(price) ? price : 0,
        totalCost: parseFloat(form.totalCost) > 0 ? parseFloat(form.totalCost) : 0,
        currency: currencyCode,
        imageUrl: uploadedImageUrl,
      };

      await addUserFuelLog(userEmail, fuelData, selectedCar);
      bumpVehicleOdometer(userEmail, selectedCar, form.odometer).catch(() => {});
      dispatch(bumpRecordsVersion());

      onFuelLogAdded?.();
      setAddFuelLogModal(false);
      resetAll();
    } catch (error) {
      console.warn('Save fuel log failed:', error);
      setSaveError(tr('The record couldn\'t be saved. Try again.'));
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
      borderColor:
        focusedField === key
          ? t.inputBorderFocus
          : form[key] && form[key].toString().trim() !== ''
          ? t.inputBorderFilled
          : t.inputBorder,
      color: t.inputText,
    },
  ];

  const missingDate = triedSave && !form.date;
  const missingOdometer = triedSave && !(parseFloat(form.odometer) >= 0);
  const missingAmount =
    triedSave && !(parseFloat(form.totalCost) > 0);
  const missingPrice = triedSave && !(parseFloat(form.pricePerLiter) > 0);

  const FieldError = ({ show, children }) =>
    show ? <Text style={[styles.fieldError, { color: t.fieldError }]}>{children}</Text> : null;

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
            <Text style={[styles.title, { color: t.text }]}>{tr('Log fuel')}</Text>
            {!!activeVehicle && (
              <Text style={[styles.subtitle, { color: t.muted }]} numberOfLines={1}>
                {vehicleName(activeVehicle)}
                {vehicleOdometer ? ` · ${formatKm(vehicleOdometer, distUnit)}` : ''}
              </Text>
            )}
          </View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={tr('Close')}
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
          <View style={styles.fuelLabelRow}>
            <FieldLabel required>{tr('fuel.label')}</FieldLabel>
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
                    {
                      backgroundColor: selected ? accent.primary : t.chipBg,
                      borderColor: selected ? accent.primary : t.chipBorder,
                    },
                  ]}
                >
                  <Text
                    style={[styles.chipText, { color: selected ? '#fff' : t.chipText }]}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.fieldGroup}>
            <PreviousFillCard history={history} colors={partColors} />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <FieldLabel required>{tr('Date')}</FieldLabel>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setDatePickerOpen(true)}
                  style={[
                    styles.input,
                    styles.dateInput,
                    {
                      backgroundColor: t.inputBg,
                      borderColor: missingDate ? t.required : form.date ? t.inputBorderFilled : t.inputBorder,
                    },
                  ]}
                >
                  <Text style={{ color: form.date ? t.inputText : t.placeholder, fontSize: 14 }}>
                    {formatDate(form.date) || tr('Select date')}
                  </Text>
                </TouchableOpacity>
                <FieldError show={missingDate}>{tr('Pick the fill-up date.')}</FieldError>
              </View>

              <View style={{ flex: 1 }}>
                <FieldLabel required>{tr('Odometer')}</FieldLabel>
                <View style={styles.suffixWrapper}>
                  <TextInput
                    // Stored in km; typed and shown in the user's unit.
                    value={kmToField(form.odometer, distUnit)}
                    onChangeText={v => set('odometer', fieldToKm(v, distUnit))}
                    onFocus={() => setFocusedField('odometer')}
                    onBlur={() => setFocusedField(null)}
                    keyboardType="number-pad"
                    placeholder={tr('Current reading')}
                    placeholderTextColor={t.placeholder}
                    style={[...inputStyle('odometer'), { paddingRight: 42 }, missingOdometer && { borderColor: t.required }]}
                  />
                  <Text style={[styles.suffix, { color: t.muted }]}>{distUnit}</Text>
                </View>
                <FieldError show={missingOdometer}>{tr('Enter the odometer reading.')}</FieldError>
                {/* Same rule on every form: warn, don't block (util/distance.js). */}
                {focusedField !== 'odometer' && <OdometerWarning history={history} colors={partColors} />}
              </View>
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <FieldLabel required>{tr('Amount paid')}</FieldLabel>
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
                    style={[...inputStyle('totalCost'), { paddingLeft: 30 }, missingAmount && { borderColor: t.required }]}
                  />
                </View>
                <FieldError show={missingAmount}>{tr('Enter the amount you paid.')}</FieldError>
              </View>

              <View style={{ flex: 1 }}>
                <FieldLabel required>{tr('Price / {0}', { 0: activeUnit })}</FieldLabel>
                <View style={styles.prefixWrapper}>
                  <Text style={[styles.prefix, { color: t.muted }]}>{currencySymbol}</Text>
                  <TextInput
                    value={form.pricePerLiter}
                    onChangeText={v => setAmount('pricePerLiter', sanitizeDecimal(v))}
                    onFocus={() => setFocusedField('pricePerLiter')}
                    onBlur={() => setFocusedField(null)}
                    keyboardType="decimal-pad"
                    placeholder={lastPrice ? String(lastPrice) : '0.00'}
                    placeholderTextColor={t.placeholder}
                    style={[...inputStyle('pricePerLiter'), { paddingLeft: 30 }, missingPrice && { borderColor: t.required }]}
                  />
                </View>
                <FieldError show={missingPrice}>{tr('Enter the price per {0}.', { 0: activeUnit })}</FieldError>
              </View>
            </View>

            {/* The other half of the purchase, worked out from the two fields above */}
            {parseFloat(form.liters) > 0 && (
              <DerivedCard
                t={t}
                label={tr('You got')}
                value={form.liters}
                unit={activeUnit}
              />
            )}
          </View>

          {/* Optional: folded away so a routine fill-up is just the fields above. */}
          <View style={styles.fieldGroup}>
          <MoreDetails
            summary={isElectric ? tr('Charging station, receipt photo') : tr('Station, receipt photo')}
            hasValue={!!form.stationName || !!selectedImage}
            resetKey={AddFuelLogModal}
            onOpen={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
            color={t.inputText}
            mutedColor={t.muted}
          >
            <FieldLabel>{isElectric ? tr('Charging station') : tr('Station name')}</FieldLabel>
            <TextInput
              value={form.stationName}
              onChangeText={v => set('stationName', v)}
              onFocus={() => setFocusedField('stationName')}
              onBlur={() => setFocusedField(null)}
              placeholder={isElectric ? tr('e.g. Mall fast charger') : tr('e.g. Shell, Main Road')}
              placeholderTextColor={t.placeholder}
              style={inputStyle('stationName')}
            />

            <View style={{ height: 16 }} />
            <FieldLabel>{tr('Receipt photo')}</FieldLabel>
            {selectedImage ? (
              <View style={[styles.previewWrapper, shadow(2)]}>
                <FitImage uri={selectedImage} style={styles.preview} />
                <TouchableOpacity
                  onPress={clearImage}
                  style={styles.removePhoto}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.removePhotoText}>{tr('Remove')}</Text>
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
                  {tr('Add a photo of the receipt')}
                </Text>
              </TouchableOpacity>
            )}
          </MoreDetails>
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
            disabled={isLoading || !currencyReady}
            style={[styles.saveButton, shadow(3), saveDisabled && { opacity: 0.5 }]}
            onPress={() => {
              Keyboard.dismiss();
              handleSave();
            }}
          >
            {isLoading ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.saveText}>{tr('Saving…')}</Text>
              </>
            ) : (
              <Text style={styles.saveText}>{tr('Save fuel log')}</Text>
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

  fuelLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  chipScroll: { marginHorizontal: -20, marginVertical: -4 },
  chipGrid: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingVertical: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontFamily: 'RobotoCondensed500' },
  derivedCard: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  derivedBadge: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  derivedLabel: { fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', fontFamily: 'RobotoCondensed500' },
  derivedValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 1 },
  derivedValue: { fontSize: 22, fontFamily: 'RobotoCondensed500' },
  derivedUnit: { fontSize: 14, fontFamily: 'RobotoCondensed500' },

  input: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1.5,
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
  fieldError: {
    marginTop: 6,
    fontSize: 12,
    fontFamily: 'RobotoCondensed400',
    lineHeight: 16,
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
