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
  Image,
  ActivityIndicator,
} from 'react-native';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useUnsavedChanges, useDiscardConfirm } from '../util/methods/useUnsavedChanges';
import Modal from 'react-native-modal';
import AppDatePicker from '../components/ui/AppDatePicker';
import CloseX from '../assets/svg/CloseX.jsx';
import SelectIcon from '../assets/svg/SelectIcon';
import Upload from '../assets/svg/Upload';
import { setVehiclesInformation } from '../store/vehicleSlice.js';
import { useSelector, useDispatch } from 'react-redux';
import { addUserDocument } from '../store/userSlice.js';
import { toPlain, fetchDocumentssByid } from '../store/fetchSlice.js';
import { toMillis } from '../util/dateStatus.js';
import DocumentTypeIcon from '../assets/svg/DocumentTypeIcon';
import AddIcon from '../assets/svg/AddIcon.jsx';
import ServiceDetailFields from '../components/ServiceDetailFields';
import { DropdownHost } from '../components/ui/DropdownHost';
import {
  DOCUMENT_TYPES,
  documentTypesFor,
  getDocumentFields,
  getDocumentCopy,
  resolveDocumentType,
  suggestExpiry,
} from '../util/documentFields';
import { useFuelCountry } from '../util/fuelTypes';
import { pickImage } from '../util/methods/useImagePicker';
import { reminderId, reminderSlot, DEFAULT_REMINDER_DAYS } from '../util/notifications.js';
import ReminderLeadPicker, { describeReminder } from '../components/ReminderLeadPicker';
import { scheduleReminderWithFeedback, ensureReminderPermission } from '../util/reminderFeedback.js';
import { uploadImage } from '../util/imageStorage';
import { shadow } from '../theme/tokens';
import { accent } from '../theme/accent';
import { useHideAdsWhile } from '../util/ads';
import { useSheetFooterInset } from '../util/methods/useSheetFooterInset';
import { FitImage } from '../components/PhotoPreview';

const { width } = Dimensions.get('window');

const NAVY = 'rgba(4, 25, 51, 1)';
const ERROR_RED = '#CC3333';

// Premium shadow profile — matches Vehicle.jsx / VehicleInformations.jsx

// `initial` (optional) prefills the form when it opens — the document page's
// "Renew" passes the old document's type and details, starting the new one
// where the old one ran out: { documentName, issueDate, details }.
const AddDocument = ({ AddDocumentModal, setAddDocumentModal, onDocumentAdded, initial }) => {
  useHideAdsWhile(AddDocumentModal);
  const footerInset = useSheetFooterInset();
  const { userEmail, selectedCar: storedCarId } = useSelector(state => state.user);
  const { theme } = useSelector(state => state.theme);
  const isDark = theme === 'dark';

  const [documentName, setDocumentName] = useState('');
  const [remindMe, setRemindMe] = useState(false);
  const [reminderDays, setReminderDays] = useState(DEFAULT_REMINDER_DAYS);
  const [issueDate, setIssueDate] = useState(null);
  const [expiryDate, setExpiryDate] = useState(null);
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState(null);
  const [focusedField, setFocusedField] = useState(null);
  const [screenWidth, setScreenWidth] = useState(width);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [activeDateField, setActiveDateField] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [extras, setExtras] = useState({});
  const [isCustomType, setIsCustomType] = useState(false);
  const [showAllTypes, setShowAllTypes] = useState(false);
  const scrollViewRef = useRef(null);
  // Document types and examples for where the owner is (Thai Por Ror Bor and
  // road tax, Bangladeshi tax token and fitness, …).
  const docCountry = useFuelCountry(AddDocumentModal);
  const countryTypes = useMemo(() => documentTypesFor(docCountry, documentName), [docCountry, documentName]);

  useEffect(() => {
    if (!AddDocumentModal || !initial) return;
    const name = initial.documentName || '';
    setDocumentName(name);
    setIsCustomType(!!name && !DOCUMENT_TYPES.some(type => type.name === name));
    setExtras(initial.details || {});
    setIssueDate(initial.issueDate || null);
    setExpiryDate(null);
  }, [AddDocumentModal, initial]);

  // ─── Theme tokens ───────────
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
      backdrop: 'rgba(4, 25, 51, 0.6)',
      iconWell: isDark ? accent.lightAlpha(0.14) : accent.alpha(0.08),
      chipBg: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
      chipBorder: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(4,25,51,0.12)',
      chipText: isDark ? 'rgba(255,255,255,0.8)' : NAVY,
      emptyIconWell: isDark ? accent.lightAlpha(0.10) : accent.alpha(0.06),
      emptyText: isDark ? accent.softAlpha(0.6) : accent.alpha(0.55),
    }),
    [isDark],
  );

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenWidth(window.width);
    });
    return () => subscription?.remove();
  }, []);

  const vehicles = useSelector(state => state.vehicle.vehiclesInformation);
  const activeVehicle = useMemo(
    () => vehicles?.find(v => v.id === storedCarId) || vehicles?.[0],
    [vehicles, storedCarId],
  );
  // Save to the vehicle this form shows. A stale stored id (e.g. a vehicle
  // deleted on another screen) used to send the record somewhere invisible.
  const selectedCar = activeVehicle?.id ?? storedCarId;
  const dispatch = useDispatch();

  const [keyboardBehavior, setKeyboardBehavior] = useState('padding');

  useEffect(() => {
    const showListener = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardBehavior('padding');
    });
    const hideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardBehavior(undefined);
    });
    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []);

  const handleClose = () => {
    if (loading) return;
    setAddDocumentModal(false);
    setDocumentName('');
    setIssueDate(null);
    setExpiryDate(null);
    setDescription('');
    setSelectedImage(null);
    setRemindMe(false);
    setReminderDays(DEFAULT_REMINDER_DAYS);
    setExtras({});
    setIsCustomType(false);
    setShowAllTypes(false);
    setErrors({});
    setSaveError(null);
    setFocusedField(null);
    setShowDatePicker(false);
    setActiveDateField(null);
  };

  // Backdrop, back button and the close icon ask before throwing away input.
  // A reminder needs both dates, and an expiry that hasn't passed yet.
  const slot = useMemo(() => reminderSlot(expiryDate, Date.now(), reminderDays), [expiryDate, reminderDays]);
  const reminderAt = slot?.fireAt ?? null;
  const canRemind = !!issueDate && !!reminderAt;

  useEffect(() => {
    if (!canRemind) setRemindMe(false);
  }, [canRemind]);

  const isDirty = useUnsavedChanges({ documentName, remindMe, reminderDays, issueDate, expiryDate, description, selectedImage, extras, isCustomType });
  const [requestClose, discardDialog] = useDiscardConfirm(isDirty, handleClose);

  // Save stays disabled until the required document name is filled in.
  // Dimmed (saveDisabled) while incomplete, but still pressable so a tap
  // reveals which fields are missing; only saving blocks the button.
  const saveDisabled = loading || !documentName.trim();

  const formatDate = date => {
    if (!date) return '';
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const openDatePicker = field => {
    Keyboard.dismiss();
    setActiveDateField(field);
    setFocusedField(field);
    setShowDatePicker(true);
  };

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    setFocusedField(null);
    // Android: closing the native date dialog can leave the soft keyboard
    // unable to attach to the next TextInput that's tapped — this call is a
    // no-op if nothing's showing, but it resets the stuck IME state so the
    // next natural focus works.
    Keyboard.dismiss();

    if (event.type === 'dismissed' || !selectedDate) return;

    if (activeDateField === 'issueDate') {
      const today = new Date();
      // Reset hours to allow matching dates accurately
      today.setHours(23, 59, 59, 999); 
      if (selectedDate > today) {
        setErrors(e => ({ ...e, issueDate: 'Issue date cannot be in the future.' }));
      } else {
        setIssueDate(selectedDate);
        setErrors(e => ({ ...e, issueDate: '', expiryDate: '' }));
      }
    } else if (activeDateField === 'expiryDate') {
      setExpiryDate(selectedDate);
      setErrors(e => ({ ...e, expiryDate: '' }));
    }
  };

  const validate = () => {
    const newErrors = {};
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (!documentName.trim()) {
      newErrors.documentName = 'Enter a name for this document.';
    }
    if (issueDate && issueDate > today) {
      newErrors.issueDate = 'Issue date cannot be in the future.';
    }
    if (issueDate && expiryDate && expiryDate < issueDate) {
      newErrors.expiryDate = 'Expiry date is before the issue date.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const selectImage = async () => {
    const response = await pickImage();

    if (response.assets?.[0]) {
      setSelectedImage(response.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (loading) return; 
    if (!validate()) return;

    setSaveError(null);
    setLoading(true);

    try {
      let uploadedFileUrl = null;

      if (selectedImage) {
        const uploadResult = await uploadImage(selectedImage);

        if (uploadResult?.success) {
          uploadedFileUrl = uploadResult.url;
        } else {
          setSaveError(uploadResult?.message || "The file couldn't be uploaded. Check your connection and try again.");
          setLoading(false);
          return;
        }
      }

      const typeExtras = Object.fromEntries(
        getDocumentFields(documentName, docCountry)
          .filter(f => extras[f.key])
          .map(f => [f.key, extras[f.key]]),
      );
      const newDocument = {
        ...typeExtras,
        documentName,
        issueDate,
        expiryDate,
        description,
        remindMe: remindMe && canRemind,
        reminderDays,
        imageUrl: uploadedFileUrl,
      };

      const newDocumentId = await addUserDocument(userEmail, newDocument, selectedCar);

      if (remindMe && canRemind) {
        scheduleReminderWithFeedback({
          id: reminderId('document', newDocumentId),
          kind: 'document',
          subject: documentName,
          body: 'Renew it before it expires.',
          dueDate: expiryDate,
          daysBefore: reminderDays,
        });
      }

      onDocumentAdded?.();

      const updatedVehicles = (vehicles || []).map((vehicle) => {
        if (vehicle.id === selectedCar) {
          return {
            ...vehicle,
            documents: [...(vehicle.documents || []), toPlain(newDocument)],
          };
        }
        return vehicle;
      });
      dispatch(setVehiclesInformation(updatedVehicles));

      handleClose();
    } catch (error) {
      console.error('Save document error:', error);
      setSaveError("The document couldn't be saved. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const borderFor = (key, value) =>
    errors[key]
      ? ERROR_RED
      : focusedField === key
      ? t.inputBorderFocus
      : value && value.toString().trim() !== ''
      ? t.inputBorderFilled
      : t.inputBorder;

  const copy = useMemo(() => getDocumentCopy(documentName, docCountry), [documentName, docCountry]);
  const hasType = documentName.trim().length > 0;
  const setExtra = (key, value) => setExtras(e => ({ ...e, [key]: value }));

  // Common types first; the rest behind "More". A selected uncommon type
  // stays visible even when the list is collapsed.
  const visibleTypes = useMemo(
    () => (showAllTypes ? countryTypes : countryTypes.filter(type => type.popular || type.name === documentName)),
    [showAllTypes, countryTypes, documentName],
  );
  const hiddenCount = countryTypes.filter(type => !type.popular && type.name !== documentName).length;

  const handlePickType = type => {
    setIsCustomType(false);
    setExtras({});
    setDocumentName(type.name);
    setErrors(e => ({ ...e, documentName: '' }));
  };

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

  // Earlier documents of this vehicle, so the user sees when the last one of
  // the same type was issued and when it ran out.
  const [pastDocuments, setPastDocuments] = useState([]);
  useEffect(() => {
    if (!AddDocumentModal || !userEmail || !selectedCar) return;
    let cancelled = false;
    fetchDocumentssByid(userEmail, selectedCar)
      .catch(() => [])
      .then(docs => !cancelled && setPastDocuments(docs || []));
    return () => {
      cancelled = true;
    };
  }, [AddDocumentModal, userEmail, selectedCar]);

  const previousDocument = useMemo(() => {
    const key = documentName.trim().toLowerCase();
    if (!key) return null;
    const type = resolveDocumentType(documentName);
    const sameKind = d =>
      type
        ? resolveDocumentType(d.documentName) === type
        : (d.documentName || '').trim().toLowerCase() === key;
    return pastDocuments
      .filter(sameKind)
      .map(d => ({ ...d, issueMs: toMillis(d.issueDate), expiryMs: toMillis(d.expiryDate) }))
      .sort((a, b) => (b.expiryMs ?? b.issueMs ?? 0) - (a.expiryMs ?? a.issueMs ?? 0))[0] || null;
  }, [pastDocuments, documentName]);

  // Suggested expiry from the type's validity and the details it depends on.
  const suggestion = useMemo(
    () => suggestExpiry({ name: documentName, issueDate, details: extras }),
    [documentName, issueDate, extras],
  );

  const applySuggestedExpiry = () => {
    if (!suggestion) return;
    setExpiryDate(suggestion.expiryDate);
    if (issueDate) setRemindMe(true);
    setErrors(e => ({ ...e, expiryDate: '' }));
  };

  const isTablet = screenWidth >= 768;

  const datePickerValue =
    activeDateField === 'issueDate'
      ? issueDate || new Date()
      : expiryDate || new Date();

  return (
    <View style={styles.container}>
      <Modal
        isVisible={AddDocumentModal}
        style={styles.modal}
        backdropOpacity={0.55}
        statusBarTranslucent
        animationIn="slideInUp"
        animationOut="slideOutDown"
        backdropColor={t.backdrop}
        onBackdropPress={requestClose}
        onBackButtonPress={requestClose}
      >
        <KeyboardAvoidingView
          behavior={keyboardBehavior}
          style={[
            styles.sheet,
            shadow(4),
            { backgroundColor: t.sheetBg },
            isTablet && styles.sheetTablet,
          ]}
        >
          <View style={styles.handleWrapper}>
            <View style={[styles.handle, { backgroundColor: t.handle }]} />
          </View>

          <View style={styles.header}>
            <View style={[styles.iconWell, { backgroundColor: t.iconWell }]}>
              <Image
                source={isDark ? require('../assets/icons/documentWhite.png') : require('../assets/icons/document.png')}
                style={styles.headerIcon}
              />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.title, { color: t.text }]}>Add document</Text>
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
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <DropdownHost scrollRef={scrollViewRef}>
            <View style={styles.form}>
              {/* Document type */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: t.label }]}>
                  Document type<Text style={{ color: ERROR_RED }}> *</Text>
                </Text>
                {errors.documentName ? (
                  <Text style={styles.errorText}>Choose a document type to continue.</Text>
                ) : null}
                <View style={styles.chipGrid}>
                  {visibleTypes.map(type => {
                    const selected = !isCustomType && documentName === type.name;
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

                  {/* Other comes last — only once the full list is open (or it's selected). */}
                  {(showAllTypes || hiddenCount === 0 || isCustomType) && (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => {
                        setIsCustomType(true);
                        setExtras({});
                        setDocumentName('');
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
                        borderColor: borderFor('documentName', documentName),
                      },
                    ]}
                    placeholder="Name the document"
                    placeholderTextColor={t.placeholder}
                    value={documentName}
                    onLayout={e => { customNameY.current = e.nativeEvent.layout.y; }}
                    onFocus={() => setFocusedField('documentName')}
                    onBlur={() => setFocusedField(null)}
                    onChangeText={val => {
                      setDocumentName(val);
                      if (errors.documentName) setErrors(e => ({ ...e, documentName: '' }));
                    }}
                  />
                )}
              </View>

              {!hasType && (
                <View style={styles.pickTypeHint}>
                  <View style={[styles.pickTypeWell, { backgroundColor: t.emptyIconWell }]}>
                    <DocumentTypeIcon icon="document" size={42} strokeWidth={1.6} color={t.accent} />
                  </View>
                  <View style={styles.pickTypeText}>
                    <Text style={[styles.pickTypeTitle, { color: t.text }]}>
                      {isCustomType ? 'Name Your Document' : 'Pick Your Document'}
                    </Text>
                    <Text style={[styles.pickTypeHintText, { color: t.emptyText }]}>
                      {isCustomType
                        ? 'Type a name above to fill in its details.'
                        : 'Choose a document type above to fill in its details.'}
                    </Text>
                  </View>
                </View>
              )}

              {hasType && (
              <>
              {previousDocument && (
                <View style={[styles.previousBox, { backgroundColor: t.inputBg }]}>
                  <Text style={[styles.previousTitle, { color: t.muted }]}>PREVIOUS DOCUMENT</Text>
                  <Text style={[styles.previousText, { color: t.text }]}>
                    {previousDocument.issueMs ? `Issued ${formatDate(new Date(previousDocument.issueMs))}` : previousDocument.documentName}
                  </Text>
                  {!!previousDocument.expiryMs && (
                    <Text style={[styles.previousSince, { color: previousDocument.expiryMs < Date.now() ? ERROR_RED : t.accent }]}>
                      {previousDocument.expiryMs < Date.now() ? 'Expired' : 'Valid until'}{' '}
                      {formatDate(new Date(previousDocument.expiryMs))}
                    </Text>
                  )}
                </View>
              )}

              <ServiceDetailFields
                serviceName={documentName}
                fields={getDocumentFields(documentName, docCountry)}
                values={extras}
                onChange={setExtra}
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
                        borderColor: borderFor('issueDate', issueDate),
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dateText,
                        { color: issueDate ? t.text : t.placeholder },
                      ]}
                    >
                      {issueDate ? formatDate(issueDate) : 'Select date'}
                    </Text>
                    <SelectIcon color={t.icon(!!issueDate)} />
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
                        borderColor: borderFor('expiryDate', expiryDate),
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dateText,
                        { color: expiryDate ? t.text : t.placeholder },
                      ]}
                    >
                      {expiryDate ? formatDate(expiryDate) : 'Select date'}
                    </Text>
                    <SelectIcon color={t.icon(!!expiryDate)} />
                  </TouchableOpacity>
                </View>
              </View>
              
              {errors.issueDate ? (
                <Text style={[styles.errorText, { marginTop: -10 }]}>
                  {errors.issueDate}
                </Text>
              ) : null}
              {errors.expiryDate ? (
                <Text style={[styles.errorText, { marginTop: -10 }]}>
                  {errors.expiryDate}
                </Text>
              ) : null}

              {suggestion && !expiryDate && (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={applySuggestedExpiry}
                  style={[
                    styles.suggestionBanner,
                    { backgroundColor: t.inputBg, borderColor: t.inputBorderFocus },
                  ]}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[styles.suggestionTitle, { color: t.accent }]}>
                      Suggested: expires {formatDate(suggestion.expiryDate)}
                    </Text>
                    <Text style={[styles.suggestionHint, { color: t.muted }]}>
                      {suggestion.hint}
                    </Text>
                  </View>
                  <Text style={[styles.suggestionAction, { color: t.accent }]}>Use</Text>
                </TouchableOpacity>
              )}

              {/* Remind me */}
              <TouchableOpacity
                activeOpacity={0.8}
                disabled={!canRemind}
                onPress={async () => {
                  if (remindMe) return setRemindMe(false);
                  if (await ensureReminderPermission()) setRemindMe(true);
                }}
                style={[
                  styles.reminderRow,
                  {
                    backgroundColor: t.inputBg,
                    borderColor: remindMe ? t.inputBorderFilled : t.inputBorder,
                    opacity: canRemind ? 1 : 0.5,
                  },
                ]}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.reminderTitle, { color: t.text }]}>
                    {copy.remindLabel}
                  </Text>
                  <Text style={[styles.reminderHint, { color: t.muted }]}>
                    {!issueDate || !expiryDate
                      ? 'Set issue and expiry dates to use reminders'
                      : !reminderAt
                      ? `Expired ${formatDate(expiryDate)}`
                      : `Expires ${formatDate(expiryDate)} · ${describeReminder(slot, reminderDays)}`}
                  </Text>
                </View>
                <View
                  style={[
                    styles.track,
                    { backgroundColor: remindMe ? accent.primary : t.toggleOff },
                  ]}
                >
                  <View
                    style={[
                      styles.thumb,
                      { transform: [{ translateX: remindMe ? 14 : 0 }] },
                    ]}
                  />
                </View>
              </TouchableOpacity>
              {remindMe && canRemind && (
                <ReminderLeadPicker t={t} value={reminderDays} onChange={setReminderDays} disabled={loading} />
              )}

              {/* Description */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: t.label }]}>Notes</Text>
                <TextInput
                  style={[
                    styles.input,
                    styles.multiline,
                    {
                      color: t.text,
                      backgroundColor: t.inputBg,
                      borderColor: borderFor('description', description),
                    },
                  ]}
                  placeholder={copy.notesPlaceholder}
                  placeholderTextColor={t.placeholder}
                  multiline
                  textAlignVertical="top"
                  value={description}
                  onFocus={() => setFocusedField('description')}
                  onBlur={() => setFocusedField(null)}
                  onChangeText={setDescription}
                />
              </View>

              {/* File Upload */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: t.label }]}>Document photo</Text>

                {selectedImage ? (
                  <View style={[styles.previewWrapper, shadow(2)]}>
                    <FitImage uri={selectedImage} style={styles.preview} />
                    <TouchableOpacity
                      onPress={() => setSelectedImage(null)}
                      style={styles.removePhoto}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.photoActionText}>Remove</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={selectImage}
                      style={styles.changePhoto}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.photoActionText}>Change</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={selectImage}
                    style={[styles.uploadZone, { borderColor: t.inputBorder }]}
                  >
                    <Upload color={t.icon()} />
                    <Text style={[styles.uploadText, { color: t.muted }]}>
                      Add a photo of the document
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              </>
              )}

              {saveError && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorBoxText}>{saveError}</Text>
                </View>
              )}
            </View>
            </DropdownHost>
          </ScrollView>

          <View
            style={[
              styles.footer,
              { borderTopColor: t.divider, backgroundColor: t.sheetBg, paddingBottom: 16 + footerInset },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.saveButton,
                shadow(3),
                saveDisabled && { opacity: 0.5 },
              ]}
              onPress={() => {
                Keyboard.dismiss();
                handleSave();
              }}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.saveButtonText}>Saving…</Text>
                </>
              ) : (
                <Text style={styles.saveButtonText}>Save document</Text>
              )}
            </TouchableOpacity>
          </View>

          {showDatePicker && (
            <AppDatePicker
              value={datePickerValue}
              maximumDate={activeDateField === 'issueDate' ? new Date() : undefined}
              onChange={handleDateChange}
            />
          )}
        </KeyboardAvoidingView>
        {discardDialog}
      </Modal>
    </View>
  );
};

export default AddDocument;

const styles = StyleSheet.create({
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
  scrollContent: { flexGrow: 1, padding: 20 },
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
  // The form's 18px gap already spaces the section.
  detailsSection: { marginTop: 0 },
  pickTypeHint: { alignItems: 'center', gap: 20, paddingTop: 14, paddingBottom: 12 },
  pickTypeWell: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  pickTypeText: { gap: 6 },
  pickTypeTitle: { fontSize: 16, textAlign: 'center', fontFamily: 'RobotoCondensed500' },
  pickTypeHintText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 12,
    fontFamily: 'RobotoCondensed400',
  },
  previousBox: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, gap: 4 },
  previousTitle: { fontSize: 11, fontFamily: 'RobotoCondensed500', letterSpacing: 1.2 },
  previousText: { fontSize: 14, fontFamily: 'RobotoCondensed500' },
  previousSince: { fontSize: 12, fontFamily: 'RobotoCondensed400' },
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
  saveButton: {
    get backgroundColor() { return accent.primary; },
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'RobotoCondensed500',
  },
});