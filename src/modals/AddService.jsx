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
  Image,
} from 'react-native';
import Text from '../components/ui/AppText';
import Modal from 'react-native-modal';
import AppDatePicker from '../components/ui/AppDatePicker';
import { useDispatch, useSelector } from 'react-redux';

import CloseX from '../assets/svg/CloseX.jsx';
import ServiceTypeIcon from '../assets/svg/ServiceTypeIcon';
import AddIcon from '../assets/svg/AddIcon.jsx';

import { setVehiclesInformation } from '../store/vehicleSlice.js';
import { addUserService, bumpVehicleOdometer, bumpRecordsVersion } from '../store/userSlice.js';
import { kmToField, fieldToKm, formatKm, odometerLowMessage } from '../util/distance';
import { useDistanceUnit } from '../util/schedule/scheduleSettings';
import { fetchServicesByid, fetchFuelLogsById, toPlain } from '../store/fetchSlice.js';
import { toMillis } from '../util/dateStatus.js';
import { reminderId, reminderSlot } from '../util/notifications.js';
import { scheduleReminderWithFeedback, ensureReminderPermission } from '../util/reminderFeedback.js';

import { useTheme } from '../util/methods/useTheme.js';
import { sanitizeDecimal } from '../util/numberInput';
import { useKeyboardBehavior } from '../util/methods/useKeyboardBehavior';
import ServiceDetailFields from '../components/ServiceDetailFields';
import { DropdownHost } from '../components/ui/DropdownHost';
import {
  SERVICE_TYPES,
  getServiceFields,
  getServiceCopy,
  averageKmPerDay,
  suggestNextDue,
  serviceLabel,
} from '../util/serviceFields';
import {
  useImagePicker,
} from '../util/methods/useImagePicker';
import { uploadImage } from '../util/imageStorage';
import { useCurrency, parseAmount } from '../util/methods/useCurrency';
import { shadow } from '../theme/tokens';
import { accent } from '../theme/accent';
import { useHideAdsWhile } from '../util/ads';
import { useSheetFooterInset } from '../util/methods/useSheetFooterInset';
import { FitImage } from '../components/PhotoPreview';
import { offerScheduleUpdate } from '../util/schedule/offerScheduleUpdate';
import MoreDetails from '../components/ui/MoreDetails.jsx';
import { t as tr } from '../i18n';
import { vehicleName } from '../i18n/brands';
import { localDate } from '../i18n';

const NAVY = 'rgba(4, 25, 51, 1)';

// Premium shadow profile — matches Vehicle.jsx / VehicleInformations.jsx

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
    ? localDate(d, { day: '2-digit', month: 'short', year: 'numeric' })
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
  useHideAdsWhile(AddServiceModal);
  const footerInset = useSheetFooterInset();
  const dispatch = useDispatch();
  const isDark = useTheme();
  const behaviour = useKeyboardBehavior();
  const scrollViewRef = useRef(null);
  const { code: currencyCode, symbol: currencySymbol, ready: currencyReady } = useCurrency(AddServiceModal, { lock: !!AddServiceModal });

  const vehicles = useSelector(state => state.vehicle.vehiclesInformation);
  const { userEmail, selectedCar: storedCarId } = useSelector(state => state.user);
  const activeVehicle = useMemo(
    () => vehicles?.find(v => v.id === storedCarId) || vehicles?.[0],
    [vehicles, storedCarId],
  );
  // Save to the vehicle this form shows. A stale stored id (e.g. a vehicle
  // deleted on another screen) used to send the record somewhere invisible.
  const selectedCar = activeVehicle?.id ?? storedCarId;

  const [form, setForm] = useState(EMPTY_FORM);
  const [extras, setExtras] = useState({});
  const [isCustomType, setIsCustomType] = useState(false);
  const [showAllTypes, setShowAllTypes] = useState(false);
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
      inputBorderFilled: isDark ? accent.light : accent.primary,
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
      emptyIconWell: isDark ? accent.lightAlpha(0.10) : accent.alpha(0.06),
      emptyText: isDark ? accent.softAlpha(0.6) : accent.alpha(0.55),
    }),
    [isDark],
  );

  const isValid = form.name.trim().length > 0 && !!form.serviceDate;
  const copy = useMemo(() => getServiceCopy(form.name), [form.name]);

  // Common types first; the rest behind "More". A selected uncommon type
  // stays visible even when the list is collapsed.
  const visibleTypes = useMemo(
    () => (showAllTypes ? SERVICE_TYPES : SERVICE_TYPES.filter(type => type.popular || type.name === form.name)),
    [showAllTypes, form.name],
  );
  const hiddenCount = SERVICE_TYPES.length - SERVICE_TYPES.filter(type => type.popular).length;
  const hasType = form.name.trim().length > 0;

  // With the keyboard up only a few rows of the sheet are visible, so when a
  // typed custom name first produces detail fields they'd sit hidden under
  // the keyboard. Scroll the name box to the top to reveal them.
  const customNameY = useRef(0);
  useEffect(() => {
    if (!isCustomType || !hasType) return;
    const id = setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: Math.max(customNameY.current - 10, 0), animated: true });
    }, 50);
    return () => clearTimeout(id);
  }, [isCustomType, hasType]);

  // Dated odometer readings for this vehicle (fuel logs + past services),
  // used to estimate how fast the user actually drives.
  const [readings, setReadings] = useState([]);
  const [pastServices, setPastServices] = useState([]);
  useEffect(() => {
    if (!AddServiceModal || !userEmail || !selectedCar) return;
    let cancelled = false;
    Promise.all([
      fetchServicesByid(userEmail, selectedCar).catch(() => []),
      fetchFuelLogsById(userEmail, selectedCar).catch(() => []),
    ]).then(([services, fuelLogs]) => {
      if (cancelled) return;
      setPastServices(services || []);
      setReadings([
        ...(services || []).map(s => ({ ms: toMillis(s.serviceDate), km: Number(s.currentMileage) })),
        ...(fuelLogs || []).map(f => ({ ms: toMillis(f.date), km: Number(f.odometer) })),
      ]);
    });
    return () => {
      cancelled = true;
    };
  }, [AddServiceModal, userEmail, selectedCar]);

  // Latest earlier service of the same type, so the user sees when and at
  // what reading it was last done.
  const previousService = useMemo(() => {
    const key = form.name.trim().toLowerCase();
    if (!key) return null;
    const before = form.serviceDate?.getTime() ?? Infinity;
    return pastServices
      .map(s => ({ ...s, ms: toMillis(s.serviceDate) }))
      .filter(s => (s.name || '').trim().toLowerCase() === key && s.ms && s.ms <= before)
      .sort((a, b) => b.ms - a.ms)[0] || null;
  }, [pastServices, form.name, form.serviceDate]);

  const vehicleOdometer = Number(activeVehicle?.currentOdometer) || 0;
  const distUnit = useDistanceUnit();
  const enteredKm = copy.showOdometer ? Number(form.currentMileage) || 0 : 0;
  const previousKm = Number(previousService?.currentMileage) || 0;

  // Highest reading logged on or before the service date. A lower entry is
  // most likely a typo — flagged, not blocked, since backdated entries are valid.
  const floorReading = useMemo(() => {
    const at = form.serviceDate?.getTime();
    if (!at) return null;
    const dated = readings.filter(r => r.ms && r.ms <= at && r.km > 0);
    const best = dated.reduce((top, r) => (!top || r.km > top.km ? r : top), null);
    // The car's own odometer has no date; it only applies to today's entries.
    if (at >= startOfToday().getTime() && vehicleOdometer > (best?.km || 0)) {
      return { km: vehicleOdometer, ms: null };
    }
    return best;
  }, [readings, form.serviceDate, vehicleOdometer]);
  const odometerTooLow = enteredKm > 0 && !!floorReading && enteredKm < floorReading.km;

  // Pre-fill today's date and the vehicle's current reading, so a routine
  // service only needs the type and cost. Prefilled values count as clean.
  const [cleanKey, setCleanKey] = useState(0);
  useEffect(() => {
    if (!AddServiceModal) return;
    setForm(f => ({
      ...f,
      serviceDate: f.serviceDate || new Date(),
      currentMileage: f.currentMileage === '' && vehicleOdometer ? String(vehicleOdometer) : f.currentMileage,
    }));
    setCleanKey(k => k + 1);
  }, [AddServiceModal, vehicleOdometer]);

  // Only suggested once the user has entered the date, odometer and the
  // details the interval depends on — computed from those, not a default.
  const suggestion = useMemo(() => {
    const kmPerDay = averageKmPerDay([
      ...readings,
      { ms: form.serviceDate?.getTime(), km: Number(form.currentMileage) },
    ]);
    const s = suggestNextDue({
      name: form.name,
      serviceDate: form.serviceDate,
      odometer: form.currentMileage,
      details: extras,
      kmPerDay,
      unit: distUnit,
    });
    if (!s) return null;
    // Km-only types (no due date) need a km figure; dated ones a future date.
    if (!copy.showDueDate) return s.dueMileage ? s : null;
    return s.dueDate >= startOfToday() ? s : null;
  }, [readings, form.name, form.serviceDate, form.currentMileage, extras, copy.showDueDate, distUnit]);

  const applySuggestion = () => {
    if (!suggestion) return;
    setForm(f => ({
      ...f,
      nextServiceDate: copy.showDueDate ? suggestion.dueDate : null,
      nextServiceMileage: suggestion.dueMileage ? String(suggestion.dueMileage) : f.nextServiceMileage,
      remindMe: copy.showDueDate,
    }));
  };

  const setExtra = (key, value) => setExtras(e => ({ ...e, [key]: value }));

  const resetAll = () => {
    setForm(EMPTY_FORM);
    setExtras({});
    setIsCustomType(false);
    setShowAllTypes(false);
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
  const reminderAt = useMemo(() => reminderSlot(form.nextServiceDate)?.fireAt ?? null, [form.nextServiceDate]);

  const isDirty = useUnsavedChanges({ form, extras, isCustomType, selectedImage }, cleanKey);
  const [requestClose, discardDialog] = useDiscardConfirm(isDirty, handleClose);

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
        const uploadResult = await uploadImage(selectedImage);
        if (uploadResult?.success) {
          uploadedImageUrl = uploadResult.url;
        } else {
          setSaveError(uploadResult?.message || tr('The receipt photo couldn\'t be uploaded. Check your connection and try again.'));
          setIsLoading(false);
          return;
        }
      }

      // STRICT USER AUTHORITY CHECK: Force remindMe to false if no due date is picked
      const nextServiceDate = copy.showNext && copy.showDueDate ? form.nextServiceDate : null;
      const cleanRemindMe = nextServiceDate ? form.remindMe : false;

      const typeExtras = Object.fromEntries(
        getServiceFields(form.name)
          .filter(f => extras[f.key])
          .map(f => [f.key, extras[f.key]]),
      );
      const currentMileage = copy.showOdometer ? form.currentMileage : '';
      const serviceData = {
        ...form,
        ...typeExtras,
        currentMileage,
        nextServiceDate,
        nextServiceMileage: copy.showNext ? form.nextServiceMileage : '',
        remindMe: cleanRemindMe,
        imageUrl: uploadedImageUrl,
        // Saved exactly as typed, with the currency it was typed in.
        totalCost: parseAmount(form.totalCost),
        currency: currencyCode,
      };

      const newServiceId = await addUserService(userEmail, serviceData, selectedCar);
      bumpVehicleOdometer(userEmail, selectedCar, currentMileage).catch(() => {});
      dispatch(bumpRecordsVersion());

      if (cleanRemindMe) {
        scheduleReminderWithFeedback({
          id: reminderId('service', newServiceId),
          kind: 'service',
          subject: form.name,
          body: form.workshopName ? tr('At {0}', { 0: form.workshopName }) : tr('Next service reminder.'),
          dueDate: form.nextServiceDate,
        });
      }

      onServiceAdded?.();

      // R12: a service matching a schedule can restart it.
      offerScheduleUpdate({
        email: userEmail,
        vehicleId: selectedCar,
        serviceName: form.name,
        serviceDate: form.serviceDate,
        mileage: currentMileage,
      }).then(updated => updated && onServiceAdded?.());

      const updatedVehicles = [...(vehicles || [])];
      const targetIndex = updatedVehicles.findIndex(v => v.id === selectedCar);
      if (targetIndex !== -1) {
        updatedVehicles[targetIndex] = {
          ...updatedVehicles[targetIndex],
          services: [...(updatedVehicles[targetIndex].services || []), toPlain(serviceData)],
        };
        dispatch(setVehiclesInformation(updatedVehicles));
      }

      setAddServiceModal(false);
      resetAll();
    } catch (error) {
      console.warn('Save service failed:', error);
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
            <Text style={[styles.title, { color: t.text }]}>{tr('Add service')}</Text>
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
          <DropdownHost scrollRef={scrollViewRef}>
            {missingType && (
              <Text style={[styles.inlineError, { color: t.required }]}>
                {tr('Choose a service type to continue.')}
              </Text>
            )}
            <FieldLabel required>{tr('Service type')}</FieldLabel>
            <View style={styles.chipGrid}>
              {visibleTypes.map(type => {
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
                    <ServiceTypeIcon
                      icon={type.icon}
                      size={15}
                      color={selected ? '#fff' : t.chipText}
                    />
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.chipText,
                        { color: selected ? '#fff' : t.chipText },
                      ]}
                    >
                      {serviceLabel(type.name)}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              {/* Other comes last — only once the full list is open (or it's selected). */}
              {(showAllTypes || hiddenCount === 0 || isCustomType) && (
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
                    {tr('Other')}
                  </Text>
                </TouchableOpacity>
              )}

              {hiddenCount > 0 && (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setShowAllTypes(v => !v)}
                  style={[styles.chip, { backgroundColor: 'transparent', borderColor: t.inputBorderFocus, borderStyle: 'dashed' }]}
                >
                  <Text style={[styles.chipText, { color: t.accent }]}>
                    {showAllTypes ? tr('Show less') : tr('More ({0})', { 0: hiddenCount })}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {isCustomType && (
              <TextInput
                value={form.name}
                onChangeText={v => set('name', v)}
                onLayout={e => { customNameY.current = e.nativeEvent.layout.y; }}
                onFocus={() => setFocusedField('name')}
                onBlur={() => setFocusedField(null)}
                placeholder={tr('Name the service')}
                placeholderTextColor={t.placeholder}
                style={[...inputStyle('name'), { marginTop: 10 }]}
              />
            )}

            {!hasType && (
              <View style={styles.pickTypeHint}>
                <View style={[styles.pickTypeWell, { backgroundColor: t.emptyIconWell }]}>
                  <ServiceTypeIcon icon="service" size={42} strokeWidth={1.6} color={t.accent} />
                </View>
                <View style={styles.pickTypeText}>
                  <Text style={[styles.pickTypeTitle, { color: t.text }]}>
                    {isCustomType ? tr('Name Your Service') : tr('Pick Your Service')}
                  </Text>
                  <Text style={[styles.pickTypeHintText, { color: t.emptyText }]}>
                    {isCustomType
                      ? tr('Type a name above to fill in its details.')
                      : tr('Choose a service type above to fill in its details.')}
                  </Text>
                </View>
              </View>
            )}

            {hasType && (
            <>
            {previousService && (
              <View style={[styles.previousBox, { backgroundColor: t.inputBg }]}>
                <Text style={[styles.previousTitle, { color: t.muted }]}>{tr('PREVIOUS SERVICE')}</Text>
                <Text style={[styles.previousText, { color: t.text }]}>
                  {formatDate(new Date(previousService.ms))}
                  {previousKm ? ` · ${formatKm(previousKm, distUnit)}` : ''}
                </Text>
                {previousKm > 0 && enteredKm > previousKm && (
                  <Text style={[styles.previousSince, { color: t.accent }]}>
                    {tr('{0} since then', { 0: formatKm(enteredKm - previousKm, distUnit) })}
                  </Text>
                )}
              </View>
            )}

            <ServiceDetailFields
              serviceName={form.name}
              values={extras}
              onChange={setExtra}
              colors={{
                text: t.inputText,
                label: t.label,
                muted: t.muted,
                placeholder: t.placeholder,
                inputBg: t.inputBg,
                border: t.inputBorder,
                borderFocus: t.inputBorderFocus,
                borderFilled: t.inputBorderFilled,
                chipBg: t.chipBg,
                chipBorder: t.chipBorder,
                chipText: t.chipText,
              }}
            />

            {/* Same 14px step as between the detail rows above. */}
            <View style={styles.afterDetails}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <FieldLabel required>{copy.dateLabel}</FieldLabel>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setDatePicker('service')}
                    style={[
                      styles.input,
                      styles.dateInput,
                      {
                        backgroundColor: t.inputBg,
                        borderColor: missingDate ? t.required : form.serviceDate ? t.inputBorderFilled : t.inputBorder,
                      },
                    ]}
                  >
                    <Text style={{ color: form.serviceDate ? t.inputText : t.placeholder, fontSize: 14 }}>
                      {formatDate(form.serviceDate) || tr('Select date')}
                    </Text>
                  </TouchableOpacity>
                  {missingDate && (
                    <Text style={[styles.fieldError, { color: t.required }]}>
                      {tr('Pick a date.')}
                    </Text>
                  )}
                </View>

                {copy.showOdometer && (
                  <View style={{ flex: 1 }}>
                    <FieldLabel>{copy.mileageLabel}</FieldLabel>
                    <View style={styles.suffixWrapper}>
                      <TextInput
                        value={kmToField(form.currentMileage, distUnit)}
                        onChangeText={v => set('currentMileage', fieldToKm(v, distUnit))}
                        onFocus={() => setFocusedField('currentMileage')}
                        onBlur={() => setFocusedField(null)}
                        keyboardType="number-pad"
                        placeholder={vehicleOdometer ? String(vehicleOdometer) : '0'}
                        placeholderTextColor={t.placeholder}
                        style={[...inputStyle('currentMileage'), { paddingRight: 42 }]}
                      />
                      <Text style={[styles.suffix, { color: t.muted }]}>{distUnit}</Text>
                    </View>
                    {odometerTooLow && (
                      <Text style={[styles.fieldError, { color: '#B45309' }]}>
                        {odometerLowMessage(floorReading, distUnit)}
                      </Text>
                    )}
                  </View>
                )}
              </View>

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <FieldLabel>{copy.costLabel}{currencySymbol ? ` (${currencySymbol})` : ''}</FieldLabel>
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

              </View>
            </View>

            {copy.showNext && (
              <View style={styles.fieldGroup}>
                <Text style={[styles.groupTitle, { color: t.muted }]}>{copy.nextTitle}</Text>

                {suggestion && !(copy.showDueDate ? form.nextServiceDate : form.nextServiceMileage) && (
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
                        {copy.showDueDate
                          ? `${tr('Suggested: due {0}', { 0: formatDate(suggestion.dueDate) })}${
                              suggestion.dueMileage ? ` · ~${formatKm(suggestion.dueMileage, distUnit)}` : ''
                            }`
                          : tr('Suggested: due at ~{0}', { 0: formatKm(suggestion.dueMileage, distUnit) })}
                      </Text>
                      <Text style={[styles.suggestionHint, { color: t.muted }]}>
                        {suggestion.hint}
                      </Text>
                    </View>
                    <Text style={[styles.suggestionAction, { color: t.accent }]}>{tr('Use')}</Text>
                  </TouchableOpacity>
                )}

                <View style={styles.row}>
                  {copy.showDueDate && (
                  <View style={{ flex: 1 }}>
                    <FieldLabel>{copy.nextDateLabel}</FieldLabel>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => setDatePicker('next')}
                      style={[
                        styles.input,
                        styles.dateInput,
                        { backgroundColor: t.inputBg, borderColor: form.nextServiceDate ? t.inputBorderFilled : t.inputBorder },
                      ]}
                    >
                      <Text style={{ color: form.nextServiceDate ? t.inputText : t.placeholder, fontSize: 14 }}>
                        {formatDate(form.nextServiceDate) || tr('Select date')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  )}

                  {copy.showDueKm && (
                    <View style={{ flex: 1 }}>
                      <FieldLabel>{copy.nextMileageLabel}</FieldLabel>
                      <View style={styles.suffixWrapper}>
                        <TextInput
                          value={kmToField(form.nextServiceMileage, distUnit)}
                          onChangeText={v => set('nextServiceMileage', fieldToKm(v, distUnit))}
                          onFocus={() => setFocusedField('nextServiceMileage')}
                          onBlur={() => setFocusedField(null)}
                          keyboardType="number-pad"
                          placeholder={tr('Optional')}
                          placeholderTextColor={t.placeholder}
                          style={[...inputStyle('nextServiceMileage'), { paddingRight: 42 }]}
                        />
                        <Text style={[styles.suffix, { color: t.muted }]}>{distUnit}</Text>
                      </View>
                    </View>
                  )}
                </View>

                {copy.showDueDate && (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={async () => {
                    if (!form.nextServiceDate) {
                      setSaveError(tr('Please select a due date before enabling the reminder.'));
                      return;
                    }
                    if (form.remindMe) return set('remindMe', false);
                    if (await ensureReminderPermission()) set('remindMe', true);
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
                      {copy.remindLabel}
                    </Text>
                    <Text style={[styles.reminderHint, { color: t.muted }]}>
                      {!form.nextServiceDate
                        ? tr('Set a next service date to use reminders')
                        : reminderAt
                        ? tr('Due {0} · Notification date {1}', { 0: formatDate(form.nextServiceDate), 1: formatDate(new Date(reminderAt)) })
                        : tr('Due {0}', { 0: formatDate(form.nextServiceDate) })}
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
                )}
              </View>
            )}

            {/* Optional: shop, notes and photo stay folded until wanted. */}
            <View style={styles.fieldGroup}>
            <MoreDetails
              summary={tr('Shop, notes, receipt photo')}
              hasValue={!!form.workshopName || !!form.description || !!selectedImage}
              resetKey={AddServiceModal}
              onOpen={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
              color={t.inputText}
              mutedColor={t.muted}
            >
              <FieldLabel>{copy.shopLabel}</FieldLabel>
              <TextInput
                value={form.workshopName}
                onChangeText={v => set('workshopName', v)}
                onFocus={() => setFocusedField('workshopName')}
                onBlur={() => setFocusedField(null)}
                placeholder={copy.shopPlaceholder}
                placeholderTextColor={t.placeholder}
                style={inputStyle('workshopName')}
              />
              <View style={{ height: 14 }} />

              <FieldLabel>{tr('Notes')}</FieldLabel>
              <TextInput
                value={form.description}
                onChangeText={v => set('description', v)}
                onFocus={() => setFocusedField('description')}
                onBlur={() => setFocusedField(null)}
                placeholder={copy.notesPlaceholder}
                placeholderTextColor={t.placeholder}
                multiline
                textAlignVertical="top"
                style={[...inputStyle('description'), styles.multiline]}
              />

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

            </>
            )}

            {saveError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{saveError}</Text>
              </View>
            )}
          </DropdownHost>
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: t.divider, backgroundColor: t.sheetBg, paddingBottom: 16 + footerInset }]}>
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={isLoading || !currencyReady}
            // Dimmed while incomplete, but still pressable so a tap shows what's missing.
            style={[styles.saveButton, shadow(3), (isLoading || !currencyReady || !isValid) && { opacity: 0.5 }]}
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
              <Text style={styles.saveText}>{tr('Save service')}</Text>
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
  afterDetails: { marginTop: 14 },
  pickTypeHint: {
    alignItems: 'center',
    gap: 20,
    paddingTop: 32,
    paddingBottom: 12,
  },
  pickTypeWell: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickTypeText: { gap: 6 },
  pickTypeTitle: {
    fontSize: 16,
    textAlign: 'center',
    fontFamily: 'RobotoCondensed500',
  },
  pickTypeHintText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 12,
    fontFamily: 'RobotoCondensed400',
  },
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
  chipText: { fontSize: 13, fontFamily: 'RobotoCondensed500' },


  input: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1.5,
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
  previousBox: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, gap: 4, marginTop: 20 },
  previousTitle: { fontSize: 11, fontFamily: 'RobotoCondensed500', letterSpacing: 1.2 },
  previousText: { fontSize: 14, fontFamily: 'RobotoCondensed500' },
  previousSince: { fontSize: 12, fontFamily: 'RobotoCondensed400' },
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
  saveText: { color: '#fff', fontFamily: 'RobotoCondensed500',  fontSize: 14, },
});

export default AddService;