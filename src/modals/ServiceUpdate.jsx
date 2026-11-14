import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useUnsavedChanges, useDiscardConfirm } from '../util/methods/useUnsavedChanges';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import Text from '../components/ui/AppText';

import Modal from 'react-native-modal';
import AppDatePicker from '../components/ui/AppDatePicker';
import { pickImage } from '../util/methods/useImagePicker';
import { useDispatch, useSelector } from 'react-redux';

import CloseX from '../assets/svg/CloseX.jsx';
import ServiceTypeIcon from '../assets/svg/ServiceTypeIcon';
import SelectIcon from '../assets/svg/SelectIcon';
import Upload from '../assets/svg/Upload.jsx';
import AddIcon from '../assets/svg/AddIcon.jsx';
import { updateUserService, bumpVehicleOdometer, bumpRecordsVersion } from '../store/userSlice.js';
import { kmToField, fieldToKm, formatKm } from '../util/distance';
import { useDistanceUnit } from '../util/schedule/scheduleSettings';
import { cancelReminder, reminderId, reminderSlot } from '../util/notifications.js';
import { scheduleReminderWithFeedback, ensureReminderPermission } from '../util/reminderFeedback.js';
import PhotoPreview, { FitImage } from '../components/PhotoPreview';
import { uploadImage } from '../util/imageStorage';
import { sanitizeDecimal } from '../util/numberInput';
import { amountText, parseAmount, recordCurrency, symbolFor, formatMoney } from '../util/methods/useCurrency';
import { shadow } from '../theme/tokens';
import { accent } from '../theme/accent';
import ServiceDetailFields from '../components/ServiceDetailFields';
import { DropdownHost } from '../components/ui/DropdownHost';
import {
  SERVICE_TYPES as SERVICE_NAME,
  SERVICE_DETAIL_KEYS,
  getServiceFields,
  getServiceCopy,
  formatServiceDetail,
  serviceLabel,
} from '../util/serviceFields';
import { useHideAdsWhile } from '../util/ads';
import { useSheetFooterInset } from '../util/methods/useSheetFooterInset';
import { t as tr } from '../i18n';
import { localDate } from '../i18n';

const NAVY = 'rgba(4, 25, 51, 1)';

// Premium shadow profile — matches Vehicle.jsx / VehicleInformations.jsx


const EXTRA_KEYS = SERVICE_DETAIL_KEYS;

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
  onDelete, // optional: shows a Delete button beside Edit in view mode
}) => {
  useHideAdsWhile(ServiceUpdateModal);
  const footerInset = useSheetFooterInset();
  const { theme } = useSelector(store => store.theme);
  const { userEmail, selectedCar } = useSelector(state => state.user);
  const dispatch = useDispatch();
  const scrollRef = useRef(null);
  // A saved record keeps the currency it was entered in: its cost is edited
  // and saved back in that currency, whatever the app currency is now.
  const recordCode = recordCurrency(updateData);
  const currencySymbol = symbolFor(recordCode);
  const currencyReady = true;
  const distUnit = useDistanceUnit();

  const [loading, setLoading] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [keyboardBehavior, setKeyboardBehavior] = useState('padding');

  const [selectedImage, setSelectedImage] = useState(null);
  const [imageRemoved, setImageRemoved] = useState(false);

  const [form, setForm] = useState(INITIAL_FORM);
  // Bumped when the form is prefilled, so prefilled values count as clean.
  const [cleanKey, setCleanKey] = useState(0);
  const [isCustomType, setIsCustomType] = useState(false);
  const [showAllTypes, setShowAllTypes] = useState(false);
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
      inputBorderFilled: isDark ? accent.light : accent.primary,
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
      backdrop: 'rgba(4, 25, 51, 0.6)',
      iconWell: isDark ? accent.lightAlpha(0.14) : accent.alpha(0.08),
    }),
    [isDark],
  );

  // Populate form from updateData
  useEffect(() => {
    if (!ServiceUpdateModal || !updateData) return;

    setSelectedImage(null);
    setImageRemoved(false);
    setSaveError(null);

    const serviceName = updateData?.name || '';

    const extras = {};
    EXTRA_KEYS.forEach(k => {
      extras[k] = updateData?.[k] || '';
    });

    setForm({
      name: serviceName,
      imageUrl: updateData?.imageUrl || '',
      description: updateData?.description || '',
      currentMileage: updateData?.currentMileage?.toString() || '',
      // Exactly as saved, in the record's own currency.
      totalCost: amountText(updateData?.totalCost),
      workshopName: updateData?.workshopName || '',
      serviceDate: timestampToDate(updateData?.serviceDate),
      nextServiceDate: timestampToDate(updateData?.nextServiceDate),
      nextServiceMileage: updateData?.nextServiceMileage?.toString() || '',
      remindMe: updateData?.remindMe || false,
      ...extras,
    });

    setIsCustomType(serviceName !== '' && !SERVICE_NAME.some(s => s.name === serviceName));
    setUi({ focusedField: null, showDatePicker: false, datePickerMode: 'service' });
    setCleanKey(k => k + 1);
  }, [ServiceUpdateModal, updateData]);

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const extraFields = useMemo(() => getServiceFields(form.name), [form.name]);
  const copy = useMemo(() => getServiceCopy(form.name), [form.name]);
  // Km-only types hide the due date; an older record that already has one keeps it visible.
  const showDueDate = copy.showDueDate || !!form.nextServiceDate;

  // Common types first; the rest behind "More". The record's own type
  // stays visible even when the list is collapsed.
  const visibleTypes = useMemo(
    () => (showAllTypes ? SERVICE_NAME : SERVICE_NAME.filter(type => type.popular || type.name === form.name)),
    [showAllTypes, form.name],
  );
  const hiddenCount = SERVICE_NAME.length - SERVICE_NAME.filter(type => type.popular).length;

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
    const response = await pickImage();
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
  // A reminder needs a next service date that hasn't passed yet.
  const reminderAt = useMemo(() => reminderSlot(form.nextServiceDate)?.fireAt ?? null, [form.nextServiceDate]);
  const remindOn = form.remindMe && !!reminderAt;

  const isDirty = useUnsavedChanges({ form, isCustomType, selectedImage, imageRemoved }, cleanKey);
  const [requestClose, discardDialog] = useDiscardConfirm(isDirty, handleClose);

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

  // Save stays disabled until something is changed (and required fields are filled).
  // Dimmed (saveDisabled) while incomplete, but still pressable so a tap
  // reveals which fields are missing; only saving blocks the button.
  const saveDisabled = loading || !currencyReady || !isDirty || !isValid;

  const handleUpdate = async () => {
    if (loading) return; // guard against double-tap
    if (!isValid) {
      setSaveError(tr('Choose or name the service before saving.'));
      return;
    }

    try {
      setLoading(true);
      setSaveError(null);

      let finalImageUrl = imageRemoved ? '' : form.imageUrl || '';

      if (selectedImage) {
        const uploadResult = await uploadImage(selectedImage);
        if (uploadResult?.success) {
          finalImageUrl = uploadResult.url;
        } else {
          setSaveError(uploadResult?.message || tr('The receipt photo couldn\'t be uploaded. Check your connection and try again.'));
          return;
        }
      }

      const typeKeys = getServiceFields(form.name).map(f => f.key);
      const updatedForm = {
        ...form,
        remindMe: remindOn,
        imageUrl: finalImageUrl,
        totalCost: parseAmount(form.totalCost),
        currency: recordCode,
      };

      // Blank out details that don't belong to the (possibly new) type
      EXTRA_KEYS.forEach(k => {
        if (!typeKeys.includes(k)) updatedForm[k] = '';
      });

      await updateUserService(userEmail, updatedForm, selectedCar, updateData.id);
      bumpVehicleOdometer(userEmail, selectedCar, updatedForm.currentMileage).catch(() => {});
      dispatch(bumpRecordsVersion());

      const id = reminderId('service', updateData.id);
      await cancelReminder(id);
      if (remindOn) {
        scheduleReminderWithFeedback({
          id,
          kind: 'service',
          subject: updatedForm.name,
          body: updatedForm.workshopName ? tr('At {0}', { 0: updatedForm.workshopName }) : tr('Next service reminder.'),
          dueDate: updatedForm.nextServiceDate,
        });
      }

      onServiceUpdated?.();
      setServiceUpdateModal(false); // cleanup happens in onModalHide
    } catch (error) {
      console.error('Failed to update service:', error);
      setSaveError(tr('The changes couldn\'t be saved. Try again.'));
    } finally {
      setLoading(false);
    }
  };

  const formatDate = date =>
    date
      ? localDate(date, { day: '2-digit', month: 'short', year: 'numeric' })
      : '';

  const borderFor = key =>
    ui.focusedField === key
      ? t.inputBorderFocus
      : form[key] && form[key].toString().trim() !== ''
      ? t.inputBorderFilled
      : t.inputBorder;

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
            <ServiceTypeIcon name={form.name} size={20} color={t.accent} />
          </View>
          <Text style={[styles.title, { color: t.text }]} numberOfLines={1}>
            {forView ? serviceLabel(form.name) || tr('Service record') : tr('Edit service')}
          </Text>
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
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        <DropdownHost scrollRef={scrollRef}>
          {forView ? (
            /* ════════ VIEW MODE — service record detail ════════ */
            <View style={styles.viewBody}>
              <PhotoPreview
                uri={displayImage}
                borderColor={t.divider}
                fileName="VehicleHub_Service"
                style={styles.viewPhoto}
              />

              {!!form.serviceDate && (
                <InfoRow t={t} label={copy.dateLabel} value={formatDate(form.serviceDate)} />
              )}
              {!!form.currentMileage && (
                <InfoRow t={t} label={copy.mileageLabel} value={formatKm(form.currentMileage, distUnit)} />
              )}
              {!!form.totalCost && (
                <InfoRow t={t} label={copy.costLabel} value={formatMoney(form.totalCost, currencySymbol)} />
              )}
              {!!form.workshopName && (
                <InfoRow t={t} label={copy.shopLabel} value={form.workshopName} />
              )}

              {extraFields.map(field =>
                form[field.key] ? (
                  <InfoRow t={t}
                    key={field.key}
                    label={field.label}
                    value={formatServiceDetail(field.key, form[field.key])}
                  />
                ) : null,
              )}

              {!!form.nextServiceDate && (
                <InfoRow t={t}
                  label={tr('Next service')}
                  value={`${formatDate(form.nextServiceDate)}${remindOn ? `  ·  Reminder ${formatDate(new Date(reminderAt))}` : ''}`}
                />
              )}

              {!!form.nextServiceMileage && (
                <InfoRow t={t} label={tr('Due mileage')} value={formatKm(form.nextServiceMileage, distUnit)} />
              )}

              {!!form.description && (
                <View style={[styles.infoRow, { backgroundColor: t.infoRowBg }]}>
                  <Text style={[styles.infoLabel, { color: t.muted }]}>{tr('Notes')}</Text>
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
                <FieldLabel t={t}>{tr('Service type')}</FieldLabel>
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
                          style={[styles.chipText, { color: selected ? '#fff' : t.chipText }]}
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
                    onFocus={() => setUi(p => ({ ...p, focusedField: 'name' }))}
                    onBlur={() => setUi(p => ({ ...p, focusedField: null }))}
                    placeholder={tr('Name the service')}
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
              <ServiceDetailFields
                serviceName={form.name}
                values={form}
                onChange={set}
                colors={{
                  text: t.text,
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
                style={styles.detailsSection}
              />

              {/* Date + mileage */}
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <FieldLabel t={t}>{copy.dateLabel}</FieldLabel>
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
                      {form.serviceDate ? formatDate(form.serviceDate) : tr('Select date')}
                    </Text>
                    <SelectIcon color={t.icon(!!form.serviceDate)} />
                  </TouchableOpacity>
                </View>

                {copy.showOdometer && (
                  <View style={{ flex: 1 }}>
                    <FieldLabel t={t}>{copy.mileageLabel}</FieldLabel>
                    <View style={styles.suffixWrapper}>
                      <TextInput
                        value={kmToField(form.currentMileage, distUnit)}
                        onChangeText={v => set('currentMileage', fieldToKm(v, distUnit))}
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
                      <Text style={[styles.suffix, { color: t.muted }]}>{distUnit}</Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Cost + workshop */}
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <FieldLabel t={t}>{copy.costLabel} ({currencySymbol})</FieldLabel>
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
                  <FieldLabel t={t}>{copy.shopLabel}</FieldLabel>
                  <TextInput
                    value={form.workshopName}
                    onChangeText={v => set('workshopName', v)}
                    onFocus={() => setUi(p => ({ ...p, focusedField: 'workshopName' }))}
                    onBlur={() => setUi(p => ({ ...p, focusedField: null }))}
                    placeholder={copy.shopPlaceholder}
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
              {/* Kept for older records that already carry a due date. */}
              {(copy.showNext || !!form.nextServiceDate) && (
                <View>
                  <Text style={[styles.groupTitle, { color: t.muted }]}>{copy.nextTitle}</Text>
                  <View style={styles.row}>
                    {showDueDate && (
                    <View style={{ flex: 1 }}>
                      <FieldLabel t={t}>{copy.nextDateLabel}</FieldLabel>
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
                          {form.nextServiceDate ? formatDate(form.nextServiceDate) : tr('Select date')}
                        </Text>
                        <SelectIcon color={t.icon(!!form.nextServiceDate)} />
                      </TouchableOpacity>
                    </View>
                    )}

                    {copy.showDueKm && (
                      <View style={{ flex: 1 }}>
                        <FieldLabel t={t}>{copy.nextMileageLabel}</FieldLabel>
                        <View style={styles.suffixWrapper}>
                          <TextInput
                            value={kmToField(form.nextServiceMileage, distUnit)}
                            onChangeText={v => set('nextServiceMileage', fieldToKm(v, distUnit))}
                            onFocus={() => setUi(p => ({ ...p, focusedField: 'nextServiceMileage' }))}
                            onBlur={() => setUi(p => ({ ...p, focusedField: null }))}
                            keyboardType="number-pad"
                            placeholder={tr('Optional')}
                            placeholderTextColor={t.placeholder}
                            style={[
                              styles.input,
                              { paddingRight: 42, color: t.text, backgroundColor: t.inputBg, borderColor: borderFor('nextServiceMileage') },
                            ]}
                          />
                          <Text style={[styles.suffix, { color: t.muted }]}>{distUnit}</Text>
                        </View>
                      </View>
                    )}
                  </View>

                  {showDueDate && (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    disabled={!reminderAt}
                    onPress={async () => {
                      if (remindOn) return set('remindMe', false);
                      if (await ensureReminderPermission()) set('remindMe', true);
                    }}
                    style={[
                      styles.reminderRow,
                      {
                        backgroundColor: t.inputBg,
                        borderColor: remindOn ? t.inputBorderFilled : t.inputBorder,
                        opacity: reminderAt ? 1 : 0.5,
                      },
                    ]}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[styles.reminderTitle, { color: t.text }]}>
                        {copy.remindLabel}
                      </Text>
                      <Text style={[styles.reminderHint, { color: t.muted }]}>
                        {!form.nextServiceDate
                          ? tr('Set a next service date to use reminders')
                          : reminderAt
                          ? tr('Due {0} · Notification date {1}', { 0: formatDate(form.nextServiceDate), 1: formatDate(new Date(reminderAt)) })
                          : tr('Was due {0}', { 0: formatDate(form.nextServiceDate) })}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.track,
                        { backgroundColor: remindOn ? accent.primary : t.toggleOff },
                      ]}
                    >
                      <View
                        style={[
                          styles.thumb,
                          { transform: [{ translateX: remindOn ? 14 : 0 }] },
                        ]}
                      />
                    </View>
                  </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Notes */}
              <View>
                <FieldLabel t={t}>{tr('Notes')}</FieldLabel>
                <TextInput
                  value={form.description}
                  onChangeText={v => set('description', v)}
                  onFocus={() => setUi(p => ({ ...p, focusedField: 'description' }))}
                  onBlur={() => setUi(p => ({ ...p, focusedField: null }))}
                  placeholder={copy.notesPlaceholder}
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
                <FieldLabel t={t}>{tr('Receipt photo')}</FieldLabel>
                {displayImage ? (
                  <View style={[styles.previewWrapper, shadow(2)]}>
                    <FitImage uri={displayImage} style={styles.preview} />
                    <TouchableOpacity
                      onPress={handleRemoveImage}
                      style={styles.removePhoto}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.photoActionText}>{tr('Remove')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleSelectImage}
                      style={styles.changePhoto}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.photoActionText}>{tr('Change')}</Text>
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
                      {tr('Add a photo of the receipt')}
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
        </DropdownHost>
      </ScrollView>

      {/* Sticky footer */}
      <View style={[styles.footer, { borderTopColor: t.divider, backgroundColor: t.sheetBg, paddingBottom: 16 + footerInset }]}>
        {forView ? (
          <View style={styles.viewFooterRow}>
            {!!onDelete && (
              <TouchableOpacity
                style={[styles.deleteButton, { backgroundColor: isDark ? 'rgba(255,156,144,0.16)' : '#FDECEA' }]}
                onPress={() => onDelete(updateData)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={tr('Delete service record')}
              >
                <Text style={[styles.primaryButtonText, { color: isDark ? '#FF9C90' : '#C62828' }]}>{tr('Delete')}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.primaryButton, shadow(3), styles.flex1]}
              onPress={() => setForView(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>{tr('Edit service')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.primaryButton, shadow(3), saveDisabled && { opacity: 0.5 }]}
            onPress={() => {
              Keyboard.dismiss();
              handleUpdate();
            }}
            disabled={loading || !currencyReady || !isDirty}
            activeOpacity={0.85}
          >
            {loading ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.primaryButtonText}>{tr('Saving…')}</Text>
              </>
            ) : (
              <Text style={styles.primaryButtonText}>{tr('Save changes')}</Text>
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
        {discardDialog}
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
  viewPhoto: { marginBottom: 4 },
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
  // The form's gap already spaces the details; drop their own top margin.
  detailsSection: { marginTop: 0 },
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
  chipText: { fontSize: 13, fontFamily: 'RobotoCondensed500' },


  input: {
    height: 46,
    borderWidth: 1.5,
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
  viewFooterRow: { flexDirection: 'row', gap: 12 },
  flex1: { flex: 1 },
  deleteButton: {
    height: 48,
    paddingHorizontal: 22,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
