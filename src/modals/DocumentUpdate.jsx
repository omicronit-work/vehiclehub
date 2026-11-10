import {
  StyleSheet,
  Text,
  View,
  Keyboard,
  KeyboardAvoidingView,
  TextInput,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useUnsavedChanges, useDiscardConfirm } from '../util/methods/useUnsavedChanges';
import Modal from 'react-native-modal';
import AppDatePicker from '../components/ui/AppDatePicker';
import { pickImage } from '../util/methods/useImagePicker';
import CloseX from '../assets/svg/CloseX.jsx';
import SelectIcon from '../assets/svg/SelectIcon.jsx';
import Upload from '../assets/svg/Upload.jsx';
import { useSelector } from 'react-redux';
import { updateUserDocument } from '../store/userSlice.js';
import { cancelReminder, reminderId, reminderSlot, DEFAULT_REMINDER_DAYS } from '../util/notifications.js';
import ReminderLeadPicker, { describeReminder } from '../components/ReminderLeadPicker';
import { scheduleReminderWithFeedback, ensureReminderPermission } from '../util/reminderFeedback.js';
import PhotoPreview, { FitImage } from '../components/PhotoPreview';
import { uploadImage } from '../util/imageStorage';
import { shadow } from '../theme/tokens';
import { accent } from '../theme/accent';
import { useHideAdsWhile } from '../util/ads';
import { useSheetFooterInset } from '../util/methods/useSheetFooterInset';
import DocumentTypeIcon from '../assets/svg/DocumentTypeIcon';
import AddIcon from '../assets/svg/AddIcon.jsx';
import ServiceDetailFields from '../components/ServiceDetailFields';
import { DropdownHost } from '../components/ui/DropdownHost';
import {
  documentTypesFor,
  DOCUMENT_DETAIL_KEYS,
  DOCUMENT_DETAIL_LABELS,
  getDocumentType,
  getDocumentFields,
  getDocumentCopy,
  formatDocumentDetail,
  suggestExpiry,
} from '../util/documentFields';
import { useFuelCountry } from '../util/fuelTypes';

const { width, height } = Dimensions.get('window');

const NAVY = 'rgba(4, 25, 51, 1)';
const ERROR_RED = '#CC3333';

// Premium shadow profile — matches Vehicle.jsx / VehicleInformations.jsx


const INITIAL_FORM = {
  documentName: '',
  remindMe: false,
  reminderDays: DEFAULT_REMINDER_DAYS,
  issueDate: null,
  expiryDate: null,
  description: '',
  file: null,
  ...Object.fromEntries(DOCUMENT_DETAIL_KEYS.map(k => [k, ''])),
};

const DocumentUpdate = ({
  updateData,
  DocumentUpdateModal,
  setDocumentUpdateModal,
  onDocumentUpdated,
  forView,
  setForView,
  setSelectedCard,
  onDelete, // optional: shows a Delete button beside Edit in view mode
}) => {
  useHideAdsWhile(DocumentUpdateModal);
  const footerInset = useSheetFooterInset();
  const docCountry = useFuelCountry(DocumentUpdateModal);
  const [form, setForm] = useState(INITIAL_FORM);
  // Bumped when the form is prefilled, so prefilled values count as clean.
  const [cleanKey, setCleanKey] = useState(0);
  const [image, setImage] = useState({ url: null, selected: null, removed: false });
  const [ui, setUi] = useState({
    errors: {},
    focusedField: null,
    showDatePicker: false,
    activeDateField: null,
    loading: false,
  });
  const [dims, setDims] = useState({ width, height });
  const [isCustomType, setIsCustomType] = useState(false);
  const [showAllTypes, setShowAllTypes] = useState(false);
  const scrollViewRef = useRef(null);

  const { userEmail, selectedCar } = useSelector(state => state.user);
  const { theme } = useSelector(state => state.theme);
  const isDark = theme === 'dark';

  // ─── Theme tokens — matches the Add* redesigns ───────────────────────────
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
      handle: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(4,25,51,0.15)',
      divider: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(4,25,51,0.06)',
      closeBg: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(4,25,51,0.05)',
      accent: isDark ? accent.light : accent.primary,
      toggleOff: isDark ? 'rgba(255,255,255,0.18)' : accent.alpha(0.18),
      infoRowBg: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(4,25,51,0.025)',
      backdrop: 'rgba(4, 25, 51, 0.6)',
      iconWell: isDark ? accent.lightAlpha(0.14) : accent.alpha(0.08),
      chipBg: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
      chipBorder: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(4,25,51,0.12)',
      chipText: isDark ? 'rgba(255,255,255,0.8)' : NAVY,
    }),
    [isDark],
  );

  const displayImage = image.removed ? null : image.selected || image.url || null;

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDims({ width: window.width, height: window.height });
    });
    return () => subscription?.remove();
  }, []);

  // Populate form when updateData changes
  useEffect(() => {
    if (!updateData) return;
    setForm({
      documentName: updateData.documentName || '',
      remindMe: updateData.remindMe || false,
      reminderDays: Number(updateData.reminderDays) || DEFAULT_REMINDER_DAYS,
      issueDate: updateData.issueDate?._seconds
        ? new Date(updateData.issueDate._seconds * 1000)
        : null,
      expiryDate: updateData.expiryDate?._seconds
        ? new Date(updateData.expiryDate._seconds * 1000)
        : null,
      description: updateData.description || '',
      file: updateData.file || null,
      ...Object.fromEntries(DOCUMENT_DETAIL_KEYS.map(k => [k, updateData[k] || ''])),
    });
    const name = updateData.documentName || '';
    setIsCustomType(name.trim() !== '' && !getDocumentType(name));
    setShowAllTypes(false);
    setImage({ url: updateData.imageUrl || '', selected: null, removed: false });
    setCleanKey(k => k + 1);
  }, [updateData, DocumentUpdateModal]);

  const setField = (key, val) => setForm(prev => ({ ...prev, [key]: val }));
  const clearError = key =>
    setUi(prev => ({ ...prev, errors: { ...prev.errors, [key]: '' } }));

  // Only start the modal's exit animation here. Cleanup happens in
  // onModalHide (after the animation) to avoid the mid-animation flicker.
  const handleClose = () => {
    if (ui.loading) return; // don't dismiss mid-save
    setDocumentUpdateModal(false);
  };

  // Backdrop, back button and the close icon ask before throwing away input.
  // A reminder needs both dates, and an expiry that hasn't passed yet.
  const slot = useMemo(
    () => reminderSlot(form.expiryDate, Date.now(), form.reminderDays),
    [form.expiryDate, form.reminderDays],
  );
  const reminderAt = slot?.fireAt ?? null;
  const canRemind = !!form.issueDate && !!reminderAt;
  const remindOn = form.remindMe && canRemind;

  const isDirty = useUnsavedChanges({ form, image, isCustomType }, cleanKey);
  const [requestClose, discardDialog] = useDiscardConfirm(isDirty, handleClose);

  // Save stays disabled until something is changed (and required fields are filled).
  // Dimmed (saveDisabled) while incomplete, but still pressable so a tap
  // reveals which fields are missing; only saving blocks the button.
  const saveDisabled = ui.loading || !isDirty || !form.documentName.trim();

  // Runs AFTER the modal has fully animated out — safe to reset everything.
  const handleModalHide = () => {
    setForView(false);
    setSelectedCard(false);
    setForm(INITIAL_FORM);
    setImage({ url: null, selected: null, removed: false });
    setUi({
      errors: {},
      focusedField: null,
      showDatePicker: false,
      activeDateField: null,
      loading: false,
    });
  };

  const formatDate = date => {
    if (!date) return '';
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  /* View-mode expiry status pill: expired / expiring soon / valid */
  const expiryStatus = useMemo(() => {
    if (!form.expiryDate) return null;
    const days = Math.ceil((form.expiryDate - new Date()) / 86400000);
    if (days < 0) {
      return { label: 'Expired', bg: 'rgba(204,51,51,0.12)', color: '#C24242' };
    }
    if (days <= 30) {
      return {
        label: days === 0 ? 'Expires today' : `Expires in ${days} day${days === 1 ? '' : 's'}`,
        bg: 'rgba(224,144,0,0.12)',
        color: '#C07A00',
      };
    }
    return { label: 'Valid', bg: 'rgba(30,150,80,0.12)', color: '#1E9650' };
  }, [form.expiryDate]);

  const openDatePicker = field => {
    Keyboard.dismiss();
    setUi(prev => ({
      ...prev,
      activeDateField: field,
      focusedField: field,
      showDatePicker: true,
    }));
  };

  const handleDateChange = (event, selectedDate) => {
    const field = ui.activeDateField;
    setUi(prev => ({ ...prev, showDatePicker: false, focusedField: null }));
    // Android: closing the native date dialog can leave the soft keyboard
    // unable to attach to the next TextInput that's tapped — this call is a
    // no-op if nothing's showing, but it resets the stuck IME state so the
    // next natural focus works.
    Keyboard.dismiss();

    if (event.type === 'dismissed' || !selectedDate) return;

    const key = field === 'issueDate' ? 'issueDate' : 'expiryDate';
    setField(key, selectedDate);
    setUi(prev => ({
      ...prev,
      errors: { ...prev.errors, issueDate: '', expiryDate: '' },
    }));
  };

  const handleSelectImage = async () => {
    const response = await pickImage();
    if (response.assets?.[0]) {
      setImage(prev => ({ ...prev, selected: response.assets[0].uri, removed: false }));
    }
  };

  const handleRemoveImage = () => {
    setImage({ url: '', selected: null, removed: true });
  };

  const validate = () => {
    const newErrors = {};
    if (!form.documentName.trim()) {
      newErrors.documentName = 'Enter a name for this document.';
    }
    if (form.issueDate && form.expiryDate && form.expiryDate < form.issueDate) {
      newErrors.expiryDate = 'Expiry date is before the issue date.';
    }
    setUi(prev => ({ ...prev, errors: newErrors }));
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (ui.loading) return; // guard against double-tap
    if (!validate()) return;

    try {
      setUi(prev => ({ ...prev, loading: true, errors: {} }));
      let finalImageUrl = image.removed ? '' : image.url || '';

      if (image.selected) {
        const uploadResult = await uploadImage(image.selected);
        if (uploadResult?.success) {
          finalImageUrl = uploadResult.url;
          setImage(prev => ({ ...prev, url: finalImageUrl, selected: null }));
        } else {
          setUi(prev => ({
            ...prev,
            loading: false,
            errors: { api: uploadResult?.message || "The photo couldn't be uploaded. Check your connection and try again." },
          }));
          return;
        }
      }

      await updateUserDocument(
        userEmail,
        {
          // Only the chosen type's details; the rest are cleared.
          ...Object.fromEntries(getDocumentFields(form.documentName).map(f => [f.key, form[f.key]])),
          documentName: form.documentName,
          issueDate: form.issueDate,
          expiryDate: form.expiryDate,
          description: form.description,
          file: form.file,
          remindMe: remindOn,
          reminderDays: form.reminderDays,
          imageUrl: finalImageUrl,
        },
        selectedCar,
        updateData.id,
      );

      const id = reminderId('document', updateData.id);
      await cancelReminder(id);
      if (remindOn) {
        scheduleReminderWithFeedback({
          id,
          kind: 'document',
          subject: form.documentName,
          body: 'Renew it before it expires.',
          dueDate: form.expiryDate,
          daysBefore: form.reminderDays,
        });
      }

      onDocumentUpdated?.();
      setUi(prev => ({ ...prev, loading: false }));
      handleClose(); // slide-out; cleanup in onModalHide
    } catch (error) {
      console.log('Update failed:', error);
      setUi(prev => ({
        ...prev,
        loading: false,
        errors: { api: "The changes couldn't be saved. Try again." },
      }));
    }
  };

  const borderFor = (key, value) =>
    ui.errors[key]
      ? ERROR_RED
      : ui.focusedField === key
      ? t.inputBorderFocus
      : value && value.toString().trim() !== ''
      ? t.inputBorderFilled
      : t.inputBorder;

  const isTablet = dims.width >= 768;

  const copy = useMemo(() => getDocumentCopy(form.documentName, docCountry), [form.documentName, docCountry]);
  const detailFields = useMemo(() => getDocumentFields(form.documentName, docCountry), [form.documentName, docCountry]);
  // The owner's country's types; the record's own type stays even if it
  // belongs to another country.
  const countryTypes = useMemo(() => documentTypesFor(docCountry, form.documentName), [docCountry, form.documentName]);

  // Common types first; the rest behind "More". The record's own type stays
  // visible even when the list is collapsed.
  const visibleTypes = useMemo(
    () => (showAllTypes ? countryTypes : countryTypes.filter(type => type.popular || type.name === form.documentName)),
    [showAllTypes, countryTypes, form.documentName],
  );
  const hiddenCount = countryTypes.filter(type => !type.popular && type.name !== form.documentName).length;

  const handlePickType = type => {
    setIsCustomType(false);
    setForm(prev => ({
      ...prev,
      ...Object.fromEntries(DOCUMENT_DETAIL_KEYS.map(k => [k, ''])),
      documentName: type.name,
    }));
    clearError('documentName');
  };

  const suggestion = useMemo(
    () => suggestExpiry({ name: form.documentName, issueDate: form.issueDate, details: form }),
    [form],
  );

  const datePickerValue =
    ui.activeDateField === 'issueDate'
      ? form.issueDate || new Date()
      : form.expiryDate || new Date();

  /* ─── View-mode building block: label + value row ─── */
  const InfoRow = ({ label, value, pill }) => (
    <View style={[styles.infoRow, { backgroundColor: t.infoRowBg }]}>
      <Text style={[styles.infoLabel, { color: t.muted }]}>{label}</Text>
      <View style={styles.infoValueRow}>
        <Text style={[styles.infoValue, { color: t.text }]}>{value}</Text>
        {pill && (
          <View style={[styles.statusPill, { backgroundColor: pill.bg }]}>
            <Text style={[styles.statusPillText, { color: pill.color }]}>
              {pill.label}
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Modal
        isVisible={DocumentUpdateModal}
        backdropColor={t.backdrop}
        style={styles.modal}
        statusBarTranslucent
        backdropOpacity={0.55}
        animationIn="slideInUp"
        animationOut="slideOutDown"
        onBackdropPress={requestClose}
        onBackButtonPress={requestClose}
        onModalHide={handleModalHide}
      >
        <KeyboardAvoidingView
          behavior="padding"
          style={[
            styles.sheet,
            shadow(4),
            { backgroundColor: t.sheetBg },
            isTablet && styles.sheetTablet,
          ]}
        >
          {/* Drag handle */}
          <View style={styles.handleWrapper}>
            <View style={[styles.handle, { backgroundColor: t.handle }]} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.iconWell, { backgroundColor: t.iconWell }]}>
                <DocumentTypeIcon name={form.documentName} size={20} color={t.accent} />
              </View>
              <Text style={[styles.title, { color: t.text }]} numberOfLines={1}>
                {forView ? form.documentName || 'Document' : 'Edit document'}
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
            ref={scrollViewRef}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <DropdownHost scrollRef={scrollViewRef}>
            {forView ? (
              /* ════════ VIEW MODE — a document detail sheet, not a dead form ════════ */
              <View style={styles.viewBody}>
                <PhotoPreview
                  uri={displayImage}
                  borderColor={t.divider}
                  fileName="VehicleHub_Document"
                  style={styles.viewPhoto}
                />

                {!!form.issueDate && (
                  <InfoRow label={copy.issueLabel} value={formatDate(form.issueDate)} />
                )}

                {!!form.expiryDate && (
                  <InfoRow
                    label={copy.expiryLabel}
                    value={formatDate(form.expiryDate)}
                    pill={expiryStatus}
                  />
                )}

                {DOCUMENT_DETAIL_KEYS.filter(k => String(form[k] || '').trim()).map(k => (
                  <InfoRow
                    key={k}
                    label={detailFields.find(f => f.key === k)?.label || DOCUMENT_DETAIL_LABELS[k]}
                    value={formatDocumentDetail(k, form[k])}
                  />
                ))}

                <InfoRow
                  label="Reminder"
                  value={remindOn ? `On — ${formatDate(new Date(reminderAt))}` : 'Off'}
                />

                {form.description.trim() !== '' && (
                  <View style={[styles.infoRow, { backgroundColor: t.infoRowBg }]}>
                    <Text style={[styles.infoLabel, { color: t.muted }]}>Notes</Text>
                    <Text style={[styles.infoNotes, { color: t.text }]}>
                      {form.description}
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              /* ════════ EDIT MODE — same form language as AddDocument ════════ */
              <View style={styles.form}>
                {/* Document type */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: t.label }]}>
                    Document type<Text style={{ color: ERROR_RED }}> *</Text>
                  </Text>
                  {ui.errors.documentName ? (
                    <Text style={styles.errorText}>{ui.errors.documentName}</Text>
                  ) : null}
                  <View style={styles.chipGrid}>
                    {visibleTypes.map(type => {
                      const selected = !isCustomType && form.documentName === type.name;
                      return (
                        <TouchableOpacity
                          key={type.id}
                          activeOpacity={0.8}
                          onPress={() => handlePickType(type)}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          style={[
                            styles.chip,
                            selected && shadow(1),
                            {
                              backgroundColor: selected ? accent.primary : t.chipBg,
                              borderColor: selected ? accent.primary : t.chipBorder,
                            },
                          ]}
                        >
                          <DocumentTypeIcon icon={type.icon} size={15} color={selected ? '#fff' : t.chipText} />
                          <Text numberOfLines={1} style={[styles.chipText, { color: selected ? '#fff' : t.chipText }]}>
                            {type.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}

                    {(showAllTypes || hiddenCount === 0 || isCustomType) && (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => {
                          if (isCustomType) return;
                          setIsCustomType(true);
                          setForm(prev => ({
                            ...prev,
                            ...Object.fromEntries(DOCUMENT_DETAIL_KEYS.map(k => [k, ''])),
                            documentName: '',
                          }));
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
                        <Text style={[styles.chipText, { color: isCustomType ? '#fff' : t.chipText }]}>Other</Text>
                      </TouchableOpacity>
                    )}

                    {hiddenCount > 0 && (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => setShowAllTypes(v => !v)}
                        style={[styles.chip, { backgroundColor: 'transparent', borderColor: t.inputBorderFocus, borderStyle: 'dashed' }]}
                      >
                        <Text style={[styles.chipText, { color: t.accent }]}>
                          {showAllTypes ? 'Show less' : `More (${hiddenCount})`}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {isCustomType && (
                    <TextInput
                      style={[
                        styles.input,
                        {
                          marginTop: 2,
                          color: t.text,
                          backgroundColor: t.inputBg,
                          borderColor: borderFor('documentName', form.documentName),
                        },
                      ]}
                      placeholder="Name the document"
                      placeholderTextColor={t.placeholder}
                      value={form.documentName}
                      onFocus={() => setUi(prev => ({ ...prev, focusedField: 'documentName' }))}
                      onBlur={() => setUi(prev => ({ ...prev, focusedField: null }))}
                      onChangeText={val => {
                        setField('documentName', val);
                        if (ui.errors.documentName) clearError('documentName');
                      }}
                    />
                  )}
                </View>

                {detailFields.length > 0 && (
                  <ServiceDetailFields
                    serviceName={form.documentName}
                    fields={detailFields}
                    values={form}
                    onChange={setField}
                    style={styles.detailsSection}
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
                  />
                )}

                {/* Issue & Expiry dates */}
                <View style={styles.dateRow}>
                  <View style={styles.dateColumn}>
                    <Text style={[styles.label, { color: t.label }]}>{copy.issueLabel}</Text>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => openDatePicker('issueDate')}
                      style={[
                        styles.dateButton,
                        {
                          backgroundColor: t.inputBg,
                          borderColor: borderFor('issueDate', form.issueDate),
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dateText,
                          { color: form.issueDate ? t.text : t.placeholder },
                        ]}
                      >
                        {form.issueDate ? formatDate(form.issueDate) : 'Select date'}
                      </Text>
                      <SelectIcon color={t.icon(!!form.issueDate)} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.dateColumn}>
                    <Text style={[styles.label, { color: t.label }]}>{copy.expiryLabel}</Text>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => openDatePicker('expiryDate')}
                      style={[
                        styles.dateButton,
                        {
                          backgroundColor: t.inputBg,
                          borderColor: borderFor('expiryDate', form.expiryDate),
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dateText,
                          { color: form.expiryDate ? t.text : t.placeholder },
                        ]}
                      >
                        {form.expiryDate ? formatDate(form.expiryDate) : 'Select date'}
                      </Text>
                      <SelectIcon color={t.icon(!!form.expiryDate)} />
                    </TouchableOpacity>
                  </View>
                </View>
                {ui.errors.expiryDate ? (
                  <Text style={[styles.errorText, { marginTop: -10 }]}>
                    {ui.errors.expiryDate}
                  </Text>
                ) : null}

                {suggestion && !form.expiryDate && (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => {
                      setField('expiryDate', suggestion.expiryDate);
                      clearError('expiryDate');
                    }}
                    style={[styles.suggestionBanner, { backgroundColor: t.inputBg, borderColor: t.inputBorderFocus }]}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[styles.suggestionTitle, { color: t.accent }]}>
                        Suggested: expires {formatDate(suggestion.expiryDate)}
                      </Text>
                      <Text style={[styles.suggestionHint, { color: t.muted }]}>{suggestion.hint}</Text>
                    </View>
                    <Text style={[styles.suggestionAction, { color: t.accent }]}>Use</Text>
                  </TouchableOpacity>
                )}

                {/* Remind me row */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  disabled={!canRemind}
                  onPress={async () => {
                    if (remindOn) return setField('remindMe', false);
                    if (await ensureReminderPermission()) setField('remindMe', true);
                  }}
                  style={[
                    styles.reminderRow,
                    {
                      backgroundColor: t.inputBg,
                      borderColor: remindOn ? t.inputBorderFilled : t.inputBorder,
                      opacity: canRemind ? 1 : 0.5,
                    },
                  ]}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[styles.reminderTitle, { color: t.text }]}>
                      {copy.remindLabel}
                    </Text>
                    <Text style={[styles.reminderHint, { color: t.muted }]}>
                      {!form.issueDate || !form.expiryDate
                        ? 'Set issue and expiry dates to use reminders'
                        : !reminderAt
                        ? `Expired ${formatDate(form.expiryDate)}`
                        : `Expires ${formatDate(form.expiryDate)} · ${describeReminder(slot, form.reminderDays)}`}
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
                {remindOn && (
                  <ReminderLeadPicker
                    t={t}
                    value={form.reminderDays}
                    onChange={days => setField('reminderDays', days)}
                    disabled={ui.loading}
                  />
                )}

                {/* Notes */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: t.label }]}>Notes</Text>
                  <TextInput
                    style={[
                      styles.input,
                      styles.multiline,
                      {
                        color: t.text,
                        backgroundColor: t.inputBg,
                        borderColor: borderFor('description', form.description),
                      },
                    ]}
                    placeholder={copy.notesPlaceholder}
                    placeholderTextColor={t.placeholder}
                    multiline
                    textAlignVertical="top"
                    value={form.description}
                    onFocus={() => setUi(prev => ({ ...prev, focusedField: 'description' }))}
                    onBlur={() => setUi(prev => ({ ...prev, focusedField: null }))}
                    onChangeText={val => setField('description', val)}
                  />
                </View>

                {/* Photo */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: t.label }]}>Document photo</Text>

                  {displayImage ? (
                    <View style={[styles.previewWrapper, shadow(2)]}>
                      <FitImage uri={displayImage} style={styles.preview} />
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
                        Add a photo of the document
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {ui.errors.api ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorBoxText}>{ui.errors.api}</Text>
                  </View>
                ) : null}
              </View>
            )}
            </DropdownHost>
          </ScrollView>

          {/* Sticky footer — Edit in view mode, Save in edit mode */}
          <View
            style={[
              styles.footer,
              { borderTopColor: t.divider, backgroundColor: t.sheetBg, paddingBottom: 16 + footerInset },
            ]}
          >
            {forView ? (
              <View style={styles.viewFooterRow}>
                {!!onDelete && (
                  <TouchableOpacity
                    style={[styles.deleteButton, { backgroundColor: isDark ? 'rgba(255,156,144,0.16)' : '#FDECEA' }]}
                    onPress={() => onDelete(updateData)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Delete document"
                  >
                    <Text style={[styles.primaryButtonText, { color: isDark ? '#FF9C90' : '#C62828' }]}>Delete</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.primaryButton, shadow(3), styles.flex1]}
                  onPress={() => setForView(false)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryButtonText}>Edit document</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  shadow(3),
                  saveDisabled && { opacity: 0.5 },
                ]}
                onPress={() => {
                  Keyboard.dismiss();
                  handleSave();
                }}
                disabled={ui.loading || !isDirty}
                activeOpacity={0.85}
              >
                {ui.loading ? (
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

          {/* Date Picker */}
          {ui.showDatePicker && !forView && (
            <AppDatePicker
              value={datePickerValue}
              onChange={handleDateChange}
            />
          )}
        </KeyboardAvoidingView>
        {discardDialog}
      </Modal>
    </View>
  );
};

export default DocumentUpdate;

const styles = StyleSheet.create({
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
  // The form's gap already spaces the section.
  detailsSection: { marginTop: 0 },
  suggestionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  suggestionTitle: { fontSize: 13, fontFamily: 'RobotoCondensed500' },
  suggestionHint: { fontSize: 12, fontFamily: 'RobotoCondensed400', marginTop: 1 },
  suggestionAction: { fontSize: 13, fontFamily: 'RobotoCondensed500' },
  // Wrapper only hosts an out-of-flow Modal; flex: 1 here would steal layout space from the parent.
  container: { position: 'absolute' },
  modal: { margin: 0, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  sheetTablet: {
    marginHorizontal: '10%',
    maxHeight: '85%',
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
  title: { fontSize: 18, fontFamily: 'RobotoCondensed500', flex: 1, flexShrink: 1 },
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
  infoLabel: {
    fontSize: 12,
    fontFamily: 'RobotoCondensed500',
    letterSpacing: 0.4,
  },
  infoValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  infoValue: { fontSize: 15, fontFamily: 'RobotoCondensed500' },
  infoNotes: { fontSize: 14, fontFamily: 'RobotoCondensed400', lineHeight: 20 },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusPillText: { fontSize: 12, fontFamily: 'RobotoCondensed500' },

  /* ── Edit mode ── */
  form: { gap: 18 },
  inputGroup: { gap: 8 },
  label: { fontSize: 13, fontFamily: 'RobotoCondensed500' },
  input: {
    height: 46,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: 'RobotoCondensed400',
  },
  multiline: {
    height: 92,
    paddingTop: 12,
  },
  dateRow: { flexDirection: 'row', gap: 12 },
  dateColumn: { flex: 1, gap: 8 },
  dateButton: {
    height: 46,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateText: { fontSize: 14, fontFamily: 'RobotoCondensed400' },

  reminderRow: {
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
  preview: {
    width: '100%',
    height: 150,
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
  changePhoto: {
    position: 'absolute',
    top: 8,
    right: 76,
    backgroundColor: 'rgba(4,25,51,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  photoActionText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'RobotoCondensed500',
  },

  errorText: {
    fontSize: 12,
    color: ERROR_RED,
    fontFamily: 'RobotoCondensed400',
  },
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

  footer: {
    padding: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
  },
  viewFooterRow: { flexDirection: 'row', gap: 12 },
  flex1: { flex: 1 },
  deleteButton: {
    height: 48,
    paddingHorizontal: 22,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButton: {
    get backgroundColor() { return accent.primary; },
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'RobotoCondensed500',
  },
});
