import {
  StyleSheet,
  Text,
  View,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  PermissionsAndroid,
  Image,
  ActivityIndicator,
} from 'react-native';
import React, { useState, useEffect, useMemo } from 'react';
import { useUnsavedChanges, confirmDiscard } from '../util/methods/useUnsavedChanges';
import Modal from 'react-native-modal';
import AppDatePicker from '../components/ui/AppDatePicker';
import CloseX from '../assets/svg/CloseX.jsx';
import SelectIcon from '../assets/svg/SelectIcon';
import Upload from '../assets/svg/Upload';
import { setVehiclesInformation } from '../store/vehicleSlice.js';
import { useSelector, useDispatch } from 'react-redux';
import { addUserDocument } from '../store/userSlice.js';
import { launchImageLibrary } from 'react-native-image-picker';
import { reminderId } from '../util/notifications.js';
import { scheduleReminderWithFeedback } from '../util/reminderFeedback.js';
import { uploadImage } from '../util/imageStorage';
import { shadow } from '../theme/tokens';
import { accent } from '../theme/accent';

const { width, height } = Dimensions.get('window');

const NAVY = 'rgba(4, 25, 51, 1)';
const ERROR_RED = '#CC3333';

// Premium shadow profile — matches Vehicle.jsx / VehicleInformations.jsx

// Standard validity periods for common vehicle documents, matched against
// the document name — used to suggest an expiry date the user can accept
// or ignore.
const DOCUMENT_VALIDITY = [
  { keywords: ['insurance'], months: 12 },
  { keywords: ['puc', 'pollution', 'emission'], months: 6 },
  { keywords: ['fitness'], months: 24 },
  { keywords: ['tax', 'token'], months: 12 },
  { keywords: ['permit'], months: 12 },
  { keywords: ['registration', 'rc book'], months: 12 },
  { keywords: ['license', 'licence', 'driving'], months: 120 },
];

const matchDocumentValidity = name => {
  const lower = name.trim().toLowerCase();
  if (!lower) return null;
  return (
    DOCUMENT_VALIDITY.find(entry => entry.keywords.some(k => lower.includes(k))) || null
  );
};

const addMonths = (date, months) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
};

const AddDocument = ({ AddDocumentModal, setAddDocumentModal, onDocumentAdded }) => {
  const { userEmail, selectedCar } = useSelector(state => state.user);
  const { theme } = useSelector(state => state.theme);
  const isDark = theme === 'dark';

  const [documentName, setDocumentName] = useState('');
  const [remindMe, setRemindMe] = useState(false);
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
      inputBorderFilled: isDark ? accent.lightAlpha(0.5) : accent.alpha(0.4),
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
    () => vehicles?.find(v => v.id === selectedCar) || vehicles?.[0],
    [vehicles, selectedCar],
  );
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
    setErrors({});
    setSaveError(null);
    setFocusedField(null);
    setShowDatePicker(false);
    setActiveDateField(null);
  };

  // Backdrop, back button and the close icon ask before throwing away input.
  const isDirty = useUnsavedChanges({ documentName, remindMe, issueDate, expiryDate, description, selectedImage });
  const requestClose = () => confirmDiscard(isDirty, handleClose);

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

  const requestPermission = async () => {
    if (Platform.OS !== 'android') return true;

    if (Platform.Version >= 33) {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
      );
      return result === PermissionsAndroid.RESULTS.GRANTED;
    } else {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      );
      return result === PermissionsAndroid.RESULTS.GRANTED;
    }
  };


  const selectImage = async () => {
    const hasPermission = await requestPermission();
    if (!hasPermission) return;

    const response = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
      selectionLimit: 1,
    });

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
        const uploadResult = await uploadImage(selectedImage, 'documents');

        if (uploadResult?.success) {
          uploadedFileUrl = uploadResult.url;
        } else {
          setSaveError("The file couldn't be uploaded. Check your connection and try again.");
          setLoading(false);
          return;
        }
      }

      const newDocument = {
        documentName,
        issueDate,
        expiryDate,
        description,
        remindMe, // Directly respects user choice, no automatic overwriting
        imageUrl: uploadedFileUrl,
      };

      const newDocumentId = await addUserDocument(userEmail, newDocument, selectedCar);

      if (remindMe && expiryDate) {
        scheduleReminderWithFeedback({
          id: reminderId('document', newDocumentId),
          kind: 'document',
          subject: documentName,
          body: 'Renew it before it expires.',
          dueDate: expiryDate,
        });
      }

      onDocumentAdded?.();

      const updatedVehicles = (vehicles || []).map((vehicle) => {
        if (vehicle.id === selectedCar) {
          return {
            ...vehicle,
            documents: vehicle.documents
              ? [...vehicle.documents, newDocument]
              : [newDocument],
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

  // Suggest an expiry date once the document name matches a known type.
  const validityMatch = useMemo(() => matchDocumentValidity(documentName), [documentName]);

  const suggestedExpiry = useMemo(() => {
    if (!validityMatch) return null;
    const baseDate = issueDate || new Date();
    return addMonths(baseDate, validityMatch.months);
  }, [validityMatch, issueDate]);

  const applySuggestedExpiry = () => {
    if (!suggestedExpiry) return;
    setExpiryDate(suggestedExpiry);
    setRemindMe(true);
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
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.form}>
              {/* Document Name */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: t.label }]}>
                  Document name<Text style={{ color: ERROR_RED }}> *</Text>
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: t.text,
                      backgroundColor: t.inputBg,
                      borderColor: borderFor('documentName', documentName),
                    },
                  ]}
                  placeholder="e.g. Insurance, Registration, Tax token"
                  placeholderTextColor={t.placeholder}
                  value={documentName}
                  onFocus={() => setFocusedField('documentName')}
                  onBlur={() => setFocusedField(null)}
                  onChangeText={val => {
                    setDocumentName(val);
                    if (errors.documentName) setErrors(e => ({ ...e, documentName: '' }));
                  }}
                />
                {errors.documentName ? (
                  <Text style={styles.errorText}>{errors.documentName}</Text>
                ) : null}
              </View>

              {/* Issue & Expiry dates */}
              <View style={styles.dateRow}>
                <View style={styles.dateColumn}>
                  <Text style={[styles.label, { color: t.label }]}>Issue date</Text>
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
                  <Text style={[styles.label, { color: t.label }]}>Expiry date</Text>
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

              {suggestedExpiry && !expiryDate && (
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
                      Suggested: expires {formatDate(suggestedExpiry)}
                    </Text>
                    <Text style={[styles.suggestionHint, { color: t.muted }]}>
                      Typical validity for this document type
                    </Text>
                  </View>
                  <Text style={[styles.suggestionAction, { color: t.accent }]}>Use</Text>
                </TouchableOpacity>
              )}

              {/* Remind me */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setRemindMe(prev => !prev)}
                style={[
                  styles.reminderRow,
                  {
                    backgroundColor: t.inputBg,
                    borderColor: remindMe ? t.inputBorderFilled : t.inputBorder,
                  },
                ]}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.reminderTitle, { color: t.text }]}>
                    Remind me before it expires
                  </Text>
                  <Text style={[styles.reminderHint, { color: t.muted }]}>
                    {expiryDate
                      ? `Expires ${formatDate(expiryDate)}`
                      : 'Set an expiry date to use reminders'}
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
                  placeholder="Policy number, provider, anything worth remembering…"
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
                    <Image source={{ uri: selectedImage }} style={styles.preview} />
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

              {saveError && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorBoxText}>{saveError}</Text>
                </View>
              )}
            </View>
          </ScrollView>

          <View
            style={[
              styles.footer,
              { borderTopColor: t.divider, backgroundColor: t.sheetBg },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.saveButton,
                shadow(3),
                (!documentName.trim() || loading) && { opacity: 0.5 },
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
    borderWidth: 1,
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