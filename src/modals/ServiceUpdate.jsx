import React, { useEffect, useState, useMemo } from 'react';
import { useUnsavedChanges, confirmDiscard } from '../util/methods/useUnsavedChanges';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  Image,
  ActivityIndicator,
} from 'react-native';

import Modal from 'react-native-modal';
import AppDatePicker from '../components/ui/AppDatePicker';
import { launchImageLibrary } from 'react-native-image-picker';
import { useSelector } from 'react-redux';

import CloseX from '../assets/svg/CloseX.jsx';
import SelectIcon from '../assets/svg/SelectIcon';
import Upload from '../assets/svg/Upload.jsx';
import AddIcon from '../assets/svg/AddIcon.jsx';
import { updateUserService, bumpVehicleOdometer } from '../store/userSlice.js';
import { cancelReminder, reminderId } from '../util/notifications.js';
import { scheduleReminderWithFeedback } from '../util/reminderFeedback.js';
import { uploadImage } from '../util/imageStorage';
import { sanitizeDecimal } from '../util/numberInput';
import { useCurrency, toBaseAmount, toDisplayAmount } from '../util/methods/useCurrency';
import { shadow } from '../theme/tokens';
import { accent } from '../theme/accent';

const NAVY = 'rgba(4, 25, 51, 1)';
const ERROR_RED = '#CC3333';

// Premium shadow profile — matches Vehicle.jsx / VehicleInformations.jsx

const SERVICE_NAME = [
  { id: 1, name: 'Engine Oil Refill', icon: require('../assets/icons/oil.png'), Wicon: require('../assets/icons/whiteOil.png'), extraFields: ['oilType', 'oilQuantity'] },
  { id: 2, name: 'Oil Filter', icon: require('../assets/icons/filter.png'), Wicon: require('../assets/icons/whiteFilter.png'), extraFields: ['filterBrand'] },
  { id: 3, name: 'Tires Change', icon: require('../assets/icons/tyre.png'), Wicon: require('../assets/icons/whiteTyre.png'), extraFields: ['tireBrand', 'tireSize', 'quantity'] },
  { id: 4, name: 'Gear Oil', icon: require('../assets/icons/oil.png'), Wicon: require('../assets/icons/whiteOil.png'), extraFields: ['oilType', 'oilQuantity'] },
  { id: 5, name: 'Brake Pads', icon: require('../assets/icons/break.png'), Wicon: require('../assets/icons/whiteBreak.png'), extraFields: ['padBrand', 'frontOrRear'] },
  { id: 6, name: 'Full Body Servicing', icon: require('../assets/icons/service.png'), Wicon: require('../assets/icons/whiteService.png'), extraFields: ['servicePackage'] },
];

const FIELD_CONFIG = {
  oilType: { label: 'Oil type', placeholder: 'e.g. Synthetic 5W-30', keyboard: 'default' },
  oilQuantity: { label: 'Oil quantity', placeholder: 'e.g. 4 Liters', keyboard: 'numeric' },
  filterBrand: { label: 'Filter brand', placeholder: 'e.g. Bosch, Mann', keyboard: 'default' },
  tireBrand: { label: 'Tire brand', placeholder: 'e.g. Michelin', keyboard: 'default' },
  tireSize: { label: 'Tire size', placeholder: 'e.g. 205/55 R16', keyboard: 'default' },
  quantity: { label: 'Quantity', placeholder: 'e.g. 4', keyboard: 'numeric' },
  padBrand: { label: 'Brake pad brand', placeholder: 'e.g. Brembo', keyboard: 'default' },
  frontOrRear: { label: 'Position', placeholder: 'Front / Rear / Both', keyboard: 'default' },
  servicePackage: { label: 'Service package', placeholder: 'Basic / Premium', keyboard: 'default' },
};

const EXTRA_KEYS = Object.keys(FIELD_CONFIG);

const timestampToDate = timestamp => {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp === 'object' && timestamp._seconds !== undefined) {
    return new Date(timestamp._seconds * 1000);
  }
  return new Date(timestamp);
};

/* End of today / start of today — used to clamp picker results so
   serviceDate can never be in the future and nextServiceDate never in the past. */
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


const getExtraFieldsForService = serviceName => {
  if (!serviceName) return [];
  const found = SERVICE_NAME.find(
    item => item.name.toLowerCase().trim() === serviceName.toLowerCase().trim(),
  );
  return found?.extraFields || [];
};

const EMPTY_EXTRAS = EXTRA_KEYS.reduce((acc, k) => ({ ...acc, [k]: '' }), {});

const INITIAL_FORM = {
  name: '',
  description: '',
  currentMileage: '',
  totalCost: '',
  workshopName: '',
  serviceDate: null,
  nextServiceDate: null,
  nextServiceMileage: '',
  remindMe: false,
  imageUrl: '',
  ...EMPTY_EXTRAS,
};

// Defined outside the component so they aren't remounted on every render.
const FieldLabel = ({ t, children }) => (
  <Text style={[styles.label, { color: t.label }]}>{children}</Text>
);

const InfoRow = ({ t, label, value }) => (
  <View style={[styles.infoRow, { backgroundColor: t.infoRowBg }]}>
    <Text style={[styles.infoLabel, { color: t.muted }]}>{label}</Text>
    <Text style={[styles.infoValue, { color: t.text }]}>{value}</Text>
  </View>
);

const ServiceUpdate = ({
  updateData,
  ServiceUpdateModal,
  setServiceUpdateModal,
  onServiceUpdated,
  setSelectedCard,
  forView,
  setForView,
}) => {
  const { theme } = useSelector(store => store.theme);
  const { userEmail, selectedCar } = useSelector(state => state.user);
  const { symbol: currencySymbol, fxRate, ready: currencyReady } = useCurrency(ServiceUpdateModal);

  const [loading, setLoading] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [keyboardBehavior, setKeyboardBehavior] = useState('padding');

  const [selectedImage, setSelectedImage] = useState(null);
  const [imageRemoved, setImageRemoved] = useState(false);

  const [form, setForm] = useState(INITIAL_FORM);
  // Bumped when the form is prefilled, so prefilled values count as clean.
  const [cleanKey, setCleanKey] = useState(0);
  const [isCustomType, setIsCustomType] = useState(false);
  const [ui, setUi] = useState({
    focusedField: null,
    showDatePicker: false,
    datePickerMode: 'service',
  });

  const displayImage = imageRemoved ? null : selectedImage || form.imageUrl || null;

  useEffect(() => {
    const showListener = Keyboard.addListener('keyboardDidShow', () =>
      setKeyboardBehavior('padding'),
    );
    const hideListener = Keyboard.addListener('keyboardDidHide', () =>
      setKeyboardBehavior(undefined),
    );
    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []);

  // Redux is the only theme source (see util/methods/useTheme).
  const isDark = theme === 'dark';

  // ─── Theme tokens — matches the other redesigned sheets ─────────────────
  const t = useMemo(
    () => ({
      sheetBg: isDark ? '#0A1E38' : '#fff',
      text: isDark ? '#fff' : NAVY,
      muted: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(4,25,51,0.55)',
      label: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(4,25,51,0.7)',
      inputBg: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(4,25,51,0.03)',
      inputBorder: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(4,25,51,0.10)',
      inputBorderFocus: isDark ? accent.light : accent.primary,
      inputBorderFilled: isDark ? accent.lightAlpha(0.5) : accent.alpha(0.4),
      placeholder: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(4,25,51,0.35)',
      icon: (active = false) =>
        active
          ? isDark ? '#fff' : NAVY
          : isDark ? 'rgba(255,255,255,0.45)' : 'rgba(4,25,51,0.45)',
      chipBg: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
      chipBorder: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(4,25,51,0.12)',
      chipText: isDark ? 'rgba(255,255,255,0.8)' : NAVY,
      handle: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(4,25,51,0.15)',
      divider: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(4,25,51,0.06)',
      closeBg: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(4,25,51,0.05)',
      accent: isDark ? accent.light : accent.primary,
      toggleOff: isDark ? 'rgba(255,255,255,0.18)' : accent.alpha(0.18),
      infoRowBg: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(4,25,51,0.025)',
      extrasBg: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(4,25,51,0.02)',
      backdrop: 'rgba(4, 25, 51, 0.6)',
      iconWell: isDark ? accent.lightAlpha(0.14) : accent.alpha(0.08),
    }),
    [isDark],
  );

  // Populate form from updateData
  useEffect(() => {
    // Wait for the exchange rate so the cost isn't prefilled at the wrong
    // rate and then reset under the user's edits when the rate arrives.
    if (!ServiceUpdateModal || !updateData || !currencyReady) return;

    setSelectedImage(null);
    setImageRemoved(false);
    setSaveError(null);

    const serviceName = updateData?.name || '';
    const knownFields = getExtraFieldsForService(serviceName);

    const extras = {};
    EXTRA_KEYS.forEach(k => {
      extras[k] = knownFields.includes(k) ? updateData?.[k] || '' : '';
    });

    setForm({
      name: serviceName,
      imageUrl: updateData?.imageUrl || '',
      description: updateData?.description || '',
      currentMileage: updateData?.currentMileage?.toString() || '',
      // Stored in BASE_CURRENCY; edited in the display currency.
      totalCost: toDisplayAmount(updateData?.totalCost, fxRate),
      workshopName: updateData?.workshopName || '',
      serviceDate: timestampToDate(updateData?.serviceDate),
      nextServiceDate: timestampToDate(updateData?.nextServiceDate),
      nextServiceMileage: updateData?.nextServiceMileage?.toString() || '',
      remindMe: updateData?.remindMe || false,
      ...extras,
    });

    setIsCustomType(serviceName !== '' && knownFields.length === 0 &&
      !SERVICE_NAME.some(s => s.name === serviceName));
    setUi({ focusedField: null, showDatePicker: false, datePickerMode: 'service' });
    setCleanKey(k => k + 1);
  }, [ServiceUpdateModal, updateData, fxRate, currencyReady]);

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const extraFields = useMemo(
    () => (isCustomType ? [] : getExtraFieldsForService(form.name)),
    [form.name, isCustomType],
  );

  const handlePickType = type => {
    setIsCustomType(false);
    setForm(prev => ({ ...prev, name: type.name, ...EMPTY_EXTRAS }));
  };

  const handlePickCustom = () => {
    setIsCustomType(true);
    setForm(prev => ({ ...prev, name: '', ...EMPTY_EXTRAS }));
  };

  const onDateChange = (event, date) => {
    const mode = ui.datePickerMode;
    setUi(prev => ({ ...prev, showDatePicker: false }));
    // Android: closing the native date dialog can leave the soft keyboard
    // unable to attach to the next TextInput that's tapped — this call is a
    // no-op if nothing's showing, but it resets the stuck IME state so the
    // next natural focus works.
    Keyboard.dismiss();
    if (event.type !== 'set' || !date) return;

    /* Safety clamp — the picker's min/max props already prevent this on
       both platforms, but this guarantees the stored value is in range
       even if the picker's `value` started out-of-range. */
    if (mode === 'service' && date > endOfToday()) {
      date = new Date(); // service date can't be in the future
    }
    if (mode === 'next' && date < startOfToday()) {
      date = new Date(); // next service date can't be in the past
    }

    set(mode === 'service' ? 'serviceDate' : 'nextServiceDate', date);
  };

  const handleSelectImage = async () => {
    const response = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
      selectionLimit: 1,
    });
    if (response.assets?.[0]) {
      setSelectedImage(response.assets[0].uri);
      setImageRemoved(false);
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImageRemoved(true);
    set('imageUrl', '');
  };

  const handleClose = () => {
    if (loading) return; // don't dismiss mid-save
    Keyboard.dismiss();
    setServiceUpdateModal(false);
  };

  // Backdrop, back button and the close icon ask before throwing away input.
  const isDirty = useUnsavedChanges({ form, isCustomType, selectedImage, imageRemoved }, cleanKey);
  const requestClose = () => confirmDiscard(isDirty, handleClose);

  // Cleanup after the exit animation, mirroring the original's flicker fix
  const handleModalHide = () => {
    setForView(false);
    setSelectedCard(false);
    setForm(INITIAL_FORM);
    setIsCustomType(false);
    setSelectedImage(null);
    setImageRemoved(false);
    setSaveError(null);
    setLoading(false);
  };

  const isValid = form.name.trim().length > 0;

  const handleUpdate = async () => {
    if (loading || !currencyReady) return; // guard against double-tap / unconverted amounts
    if (!isValid) {
      setSaveError('Choose or name the service before saving.');
      return;
    }

    try {
      setLoading(true);
      setSaveError(null);

      let finalImageUrl = imageRemoved ? '' : form.imageUrl || '';

      if (selectedImage) {
        const uploadResult = await uploadImage(selectedImage, 'services');
        if (uploadResult?.success) {
          finalImageUrl = uploadResult.url;
        } else {
          setSaveError("The receipt photo couldn't be uploaded. Check your connection and try again.");
          return;
        }
      }

      const currentExtraFields = getExtraFieldsForService(form.name);
      const updatedForm = {
        ...form,
        imageUrl: finalImageUrl,
        totalCost: toBaseAmount(form.totalCost, fxRate),
      };
      // Blank out extras that don't belong to the (possibly new) type
      EXTRA_KEYS.forEach(k => {
        if (!currentExtraFields.includes(k)) updatedForm[k] = '';
      });

      await updateUserService(userEmail, updatedForm, selectedCar, updateData.id);
      bumpVehicleOdometer(userEmail, selectedCar, updatedForm.currentMileage).catch(() => {});

      const id = reminderId('service', updateData.id);
      await cancelReminder(id);
      if (updatedForm.remindMe && updatedForm.nextServiceDate) {
        scheduleReminderWithFeedback({
          id,
          kind: 'service',
          subject: updatedForm.name,
          body: updatedForm.workshopName ? `At ${updatedForm.workshopName}` : 'Next service reminder.',
          dueDate: updatedForm.nextServiceDate,
        });
      }

      onServiceUpdated?.();
      setServiceUpdateModal(false); // cleanup happens in onModalHide
    } catch (error) {
      console.error('Failed to update service:', error);
      setSaveError("The changes couldn't be saved. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = date =>
    date
      ? date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : '';

  const borderFor = key =>
    ui.focusedField === key
      ? t.inputBorderFocus
      : form[key] && form[key].toString().trim() !== ''
      ? t.inputBorderFilled
      : t.inputBorder;

  const serviceIcon = useMemo(() => {
    const match = SERVICE_NAME.find(s => s.name === form.name);
    if (!match) return null;
    return isDark ? match.Wicon : match.icon;
  }, [form.name, isDark]);

  const sheetInner = (
    <>
      {/* Drag handle */}
      <View style={styles.handleWrapper}>
        <View style={[styles.handle, { backgroundColor: t.handle }]} />
      </View>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconWell, { backgroundColor: t.iconWell }]}>
            <Image
              source={
                serviceIcon ||
                (isDark ? require('../assets/icons/whiteService.png') : require('../assets/icons/service.png'))
              }
              style={styles.headerIcon}
            />
          </View>
          <Text style={[styles.title, { color: t.text }]} numberOfLines={1}>
            {forView ? form.name || 'Service record' : 'Edit service'}
          </Text>
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
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        {forView ? (
          /* ════════ VIEW MODE — service record detail ════════ */
          <View style={styles.viewBody}>
            {displayImage ? (
              <Image source={{ uri: displayImage }} style={[styles.viewPhoto, shadow(2)]} />
            ) : null}

            {form.serviceDate && (
              <InfoRow t={t} label="Service date" value={formatDate(form.serviceDate)} />
            )}
            {!!form.currentMileage && (
              <InfoRow t={t} label="Mileage" value={`${form.currentMileage} km`} />
            )}
            {!!form.totalCost && (
              <InfoRow t={t} label="Total cost" value={`${currencySymbol} ${form.totalCost}`} />
            )}
            {!!form.workshopName && (
              <InfoRow t={t} label="Workshop" value={form.workshopName} />
            )}

            {extraFields.map(fieldKey =>
              form[fieldKey] ? (
                <InfoRow t={t}
                  key={fieldKey}
                  label={FIELD_CONFIG[fieldKey].label}
                  value={form[fieldKey]}
                />
              ) : null,
            )}

            {form.nextServiceDate && (
              <InfoRow t={t}
                label="Next service"
                value={`${formatDate(form.nextServiceDate)}${form.remindMe ? '  ·  Reminder on' : ''}`}
              />
            )}

            {!!form.nextServiceMileage && (
              <InfoRow t={t} label="Due mileage" value={`${form.nextServiceMileage} km`} />
            )}

            {!!form.description && (
              <View style={[styles.infoRow, { backgroundColor: t.infoRowBg }]}>
                <Text style={[styles.infoLabel, { color: t.muted }]}>Notes</Text>
                <Text style={[styles.infoNotes, { color: t.text }]}>
                  {form.description}
                </Text>
              </View>
            )}
          </View>
        ) : (
          /* ════════ EDIT MODE — same language as AddService ════════ */
          <View style={styles.form}>
            {/* Service type chips */}
            <View>
              <FieldLabel t={t}>Service type</FieldLabel>
              <View style={styles.chipGrid}>
                {SERVICE_NAME.map(type => {
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
                        style={[styles.chipText, { color: selected ? '#fff' : t.chipText }]}
                      >
                        {type.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handlePickCustom}
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
                  <Text style={[styles.chipText, { color: isCustomType ? '#fff' : t.chipText }]}>
                    Other
                  </Text>
                </TouchableOpacity>
              </View>

              {isCustomType && (
                <TextInput
                  value={form.name}
                  onChangeText={v => set('name', v)}
                  onFocus={() => setUi(p => ({ ...p, focusedField: 'name' }))}
                  onBlur={() => setUi(p => ({ ...p, focusedField: null }))}
                  placeholder="Name the service"
                  placeholderTextColor={t.placeholder}
                  style={[
                    styles.input,
                    {
                      marginTop: 10,
                      color: t.text,
                      backgroundColor: t.inputBg,
                      borderColor: borderFor('name'),
                    },
                  ]}
                />
              )}
            </View>

            {/* Extra fields for the chosen type */}
            {extraFields.length > 0 && (
              <View
                style={[
                  styles.extrasBox,
                  { backgroundColor: t.extrasBg, borderColor: t.inputBorder },
                ]}
              >
                <Text style={[styles.groupTitle, { color: t.muted }]}>
                  {form.name.toUpperCase()} DETAILS
                </Text>
                <View style={styles.extrasWrap}>
                  {extraFields.map(fieldKey => {
                    const config = FIELD_CONFIG[fieldKey];
                    if (!config) return null;
                    return (
                      <View key={fieldKey} style={styles.extraField}>
                        <FieldLabel t={t}>{config.label}</FieldLabel>
                        <TextInput
                          value={form[fieldKey] || ''}
                          onChangeText={v => set(fieldKey, v)}
                          onFocus={() => setUi(p => ({ ...p, focusedField: fieldKey }))}
                          onBlur={() => setUi(p => ({ ...p, focusedField: null }))}
                          keyboardType={config.keyboard}
                          placeholder={config.placeholder}
                          placeholderTextColor={t.placeholder}
                          style={[
                            styles.input,
                            {
                              color: t.text,
                              backgroundColor: t.sheetBg,
                              borderColor: borderFor(fieldKey),
                            },
                          ]}
                        />
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Date + mileage */}
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <FieldLabel t={t}>Service date</FieldLabel>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() =>
                    setUi(p => ({ ...p, showDatePicker: true, datePickerMode: 'service' }))
                  }
                  style={[
                    styles.input,
                    styles.dateInput,
                    { backgroundColor: t.inputBg, borderColor: borderFor('serviceDate') },
                  ]}
                >
                  <Text style={{ color: form.serviceDate ? t.text : t.placeholder, fontSize: 14 }}>
                    {form.serviceDate ? formatDate(form.serviceDate) : 'Select date'}
                  </Text>
                  <SelectIcon color={t.icon(!!form.serviceDate)} />
                </TouchableOpacity>
              </View>

              <View style={{ flex: 1 }}>
                <FieldLabel t={t}>Mileage</FieldLabel>
                <View style={styles.suffixWrapper}>
                  <TextInput
                    value={form.currentMileage}
                    onChangeText={v => set('currentMileage', v.replace(/[^0-9]/g, ''))}
                    onFocus={() => setUi(p => ({ ...p, focusedField: 'currentMileage' }))}
                    onBlur={() => setUi(p => ({ ...p, focusedField: null }))}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={t.placeholder}
                    style={[
                      styles.input,
                      {
                        paddingRight: 42,
                        color: t.text,
                        backgroundColor: t.inputBg,
                        borderColor: borderFor('currentMileage'),
                      },
                    ]}
                  />
                  <Text style={[styles.suffix, { color: t.muted }]}>km</Text>
                </View>
              </View>
            </View>

            {/* Cost + workshop */}
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <FieldLabel t={t}>Total cost ({currencySymbol})</FieldLabel>
                <TextInput
                  value={form.totalCost}
                  onChangeText={v => set('totalCost', sanitizeDecimal(v))}
                  onFocus={() => setUi(p => ({ ...p, focusedField: 'totalCost' }))}
                  onBlur={() => setUi(p => ({ ...p, focusedField: null }))}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={t.placeholder}
                  style={[
                    styles.input,
                    {
                      color: t.text,
                      backgroundColor: t.inputBg,
                      borderColor: borderFor('totalCost'),
                    },
                  ]}
                />
              </View>

              <View style={{ flex: 1 }}>
                <FieldLabel t={t}>Workshop</FieldLabel>
                <TextInput
                  value={form.workshopName}
                  onChangeText={v => set('workshopName', v)}
                  onFocus={() => setUi(p => ({ ...p, focusedField: 'workshopName' }))}
                  onBlur={() => setUi(p => ({ ...p, focusedField: null }))}
                  placeholder="Workshop name"
                  placeholderTextColor={t.placeholder}
                  style={[
                    styles.input,
                    {
                      color: t.text,
                      backgroundColor: t.inputBg,
                      borderColor: borderFor('workshopName'),
                    },
                  ]}
                />
              </View>
            </View>

            {/* Next service + reminder */}
            <View>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <FieldLabel t={t}>Next service date</FieldLabel>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() =>
                      setUi(p => ({ ...p, showDatePicker: true, datePickerMode: 'next' }))
                    }
                    style={[
                      styles.input,
                      styles.dateInput,
                      { backgroundColor: t.inputBg, borderColor: borderFor('nextServiceDate') },
                    ]}
                  >
                    <Text style={{ color: form.nextServiceDate ? t.text : t.placeholder, fontSize: 14 }}>
                      {form.nextServiceDate ? formatDate(form.nextServiceDate) : 'Select date'}
                    </Text>
                    <SelectIcon color={t.icon(!!form.nextServiceDate)} />
                  </TouchableOpacity>
                </View>

                <View style={{ flex: 1 }}>
                  <FieldLabel t={t}>Due mileage</FieldLabel>
                  <View style={styles.suffixWrapper}>
                    <TextInput
                      value={form.nextServiceMileage}
                      onChangeText={v => set('nextServiceMileage', v.replace(/[^0-9]/g, ''))}
                      onFocus={() => setUi(p => ({ ...p, focusedField: 'nextServiceMileage' }))}
                      onBlur={() => setUi(p => ({ ...p, focusedField: null }))}
                      keyboardType="number-pad"
                      placeholder="Optional"
                      placeholderTextColor={t.placeholder}
                      style={[
                        styles.input,
                        { paddingRight: 42, color: t.text, backgroundColor: t.inputBg, borderColor: borderFor('nextServiceMileage') },
                      ]}
                    />
                    <Text style={[styles.suffix, { color: t.muted }]}>km</Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => set('remindMe', !form.remindMe)}
                style={[
                  styles.reminderRow,
                  {
                    backgroundColor: t.inputBg,
                    borderColor: form.remindMe ? t.inputBorderFilled : t.inputBorder,
                  },
                ]}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.reminderTitle, { color: t.text }]}>
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
                    { backgroundColor: form.remindMe ? accent.primary : t.toggleOff },
                  ]}
                >
                  <View
                    style={[
                      styles.thumb,
                      { transform: [{ translateX: form.remindMe ? 14 : 0 }] },
                    ]}
                  />
                </View>
              </TouchableOpacity>
            </View>

            {/* Notes */}
            <View>
              <FieldLabel t={t}>Notes</FieldLabel>
              <TextInput
                value={form.description}
                onChangeText={v => set('description', v)}
                onFocus={() => setUi(p => ({ ...p, focusedField: 'description' }))}
                onBlur={() => setUi(p => ({ ...p, focusedField: null }))}
                placeholder="Parts replaced, warranty, anything worth remembering…"
                placeholderTextColor={t.placeholder}
                multiline
                textAlignVertical="top"
                style={[
                  styles.input,
                  styles.multiline,
                  {
                    color: t.text,
                    backgroundColor: t.inputBg,
                    borderColor: borderFor('description'),
                  },
                ]}
              />
            </View>

            {/* Receipt photo */}
            <View>
              <FieldLabel t={t}>Receipt photo</FieldLabel>
              {displayImage ? (
                <View style={[styles.previewWrapper, shadow(2)]}>
                  <Image source={{ uri: displayImage }} style={styles.preview} />
                  <TouchableOpacity
                    onPress={handleRemoveImage}
                    style={styles.removePhoto}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.photoActionText}>Remove</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleSelectImage}
                    style={styles.changePhoto}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.photoActionText}>Change</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleSelectImage}
                  style={[styles.uploadZone, { borderColor: t.inputBorder }]}
                >
                  <Upload color={t.icon()} />
                  <Text style={[styles.uploadText, { color: t.muted }]}>
                    Add a photo of the receipt
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {saveError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorBoxText}>{saveError}</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Sticky footer */}
      <View style={[styles.footer, { borderTopColor: t.divider, backgroundColor: t.sheetBg }]}>
        {forView ? (
          <TouchableOpacity
            style={[styles.primaryButton, shadow(3)]}
            onPress={() => setForView(false)}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>Edit service</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.primaryButton, shadow(3), (!isValid || loading || !currencyReady) && { opacity: 0.5 }]}
            onPress={() => {
              Keyboard.dismiss();
              handleUpdate();
            }}
            disabled={loading || !currencyReady}
            activeOpacity={0.85}
          >
            {loading ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.primaryButtonText}>Saving…</Text>
              </>
            ) : (
              <Text style={styles.primaryButtonText}>Save changes</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Date picker */}
      {ui.showDatePicker && !forView && (
        <AppDatePicker
          value={
            (ui.datePickerMode === 'service' ? form.serviceDate : form.nextServiceDate) ||
            new Date()
          }
          /* Service date → today or earlier. Next service date → today or later. */
          maximumDate={ui.datePickerMode === 'service' ? endOfToday() : undefined}
          minimumDate={ui.datePickerMode === 'next' ? startOfToday() : undefined}
          onChange={onDateChange}
        />
      )}
    </>
  );

  return (
    <View style={styles.container}>
      <Modal
        isVisible={ServiceUpdateModal}
        backdropOpacity={0.55}
        statusBarTranslucent
        onBackdropPress={requestClose}
        onBackButtonPress={requestClose}
        onModalHide={handleModalHide}
        style={styles.modal}
        coverScreen
      >
        {forView ? (
          // View mode: plain View — KeyboardAvoidingView steals the touch
          // events the ScrollView needs for momentum scrolling (original fix)
          <View style={[styles.sheet, shadow(4), { backgroundColor: t.sheetBg }]}>
            {sheetInner}
          </View>
        ) : (
          <KeyboardAvoidingView
            behavior={keyboardBehavior}
            style={[styles.sheet, shadow(4), { backgroundColor: t.sheetBg }]}
          >
            {sheetInner}
          </KeyboardAvoidingView>
        )}
      </Modal>
    </View>
  );
};

export default ServiceUpdate;

const styles = StyleSheet.create({
  // Wrapper only hosts an out-of-flow Modal; flex: 1 here would steal layout space from the parent.
  container: { position: 'absolute' },
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconWell: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: { width: 20, height: 20, resizeMode: 'contain' },
  title: { fontSize: 18, fontFamily: 'RobotoCondensed500', flexShrink: 1 },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: { height: 1, width: '100%' },
  scrollContent: { flexGrow: 1, padding: 20 },

  /* ── View mode ── */
  viewBody: { gap: 12 },
  viewPhoto: {
    width: '100%',
    height: 180,
    borderRadius: 14,
    resizeMode: 'cover',
    marginBottom: 4,
  },
  infoRow: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  infoLabel: { fontSize: 12, fontFamily: 'RobotoCondensed500', letterSpacing: 0.4 },
  infoValue: { fontSize: 15, fontFamily: 'RobotoCondensed500' },
  infoNotes: { fontSize: 14, fontFamily: 'RobotoCondensed400', lineHeight: 20 },

  /* ── Edit mode ── */
  form: { gap: 18 },
  label: { fontSize: 13, fontFamily: 'RobotoCondensed500', marginBottom: 8 },
  groupTitle: {
    fontSize: 12,
    fontFamily: 'RobotoCondensed500',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  row: { flexDirection: 'row', gap: 12 },

  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
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
    padding: 14,
    paddingBottom: 2,
    borderRadius: 14,
    borderWidth: 1,
  },
  extrasWrap: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12 },
  extraField: { flexBasis: '46%', flexGrow: 1, marginBottom: 12 },

  input: {
    height: 46,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: 'RobotoCondensed400',
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  multiline: { height: 92, paddingTop: 12 },
  suffixWrapper: { position: 'relative', justifyContent: 'center' },
  suffix: {
    position: 'absolute',
    right: 14,
    fontSize: 13,
    fontFamily: 'RobotoCondensed400',
  },

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
  thumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff' },

  uploadZone: {
    height: 96,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  uploadText: { fontSize: 13, fontFamily: 'RobotoCondensed400' },
  previewWrapper: { position: 'relative' },
  preview: { width: '100%', height: 150, borderRadius: 12, resizeMode: 'cover' },
  removePhoto: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(4,25,51,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  changePhoto: {
    position: 'absolute',
    top: 8,
    right: 76,
    backgroundColor: 'rgba(4,25,51,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  photoActionText: { color: '#fff', fontSize: 12, fontFamily: 'RobotoCondensed500' },

  errorBox: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(214, 60, 60, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(214, 60, 60, 0.25)',
  },
  errorBoxText: {
    color: '#C24242',
    fontSize: 13,
    fontFamily: 'RobotoCondensed400',
    lineHeight: 18,
  },

  footer: { padding: 16, paddingHorizontal: 20, borderTopWidth: 1 },
  primaryButton: {
    get backgroundColor() { return accent.primary; },
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontFamily: 'RobotoCondensed500' },
});
