import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useUnsavedChanges, confirmDiscard } from '../util/methods/useUnsavedChanges';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  PermissionsAndroid,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import Modal from 'react-native-modal';
import { launchImageLibrary } from 'react-native-image-picker';
import ToastManager, { Toast } from 'toastify-react-native';
import { useDispatch, useSelector } from 'react-redux';

import Car from '../assets/svg/Car.jsx';
import Camera from '../assets/svg/Camera.jsx';
import CloseX from '../assets/svg/CloseX.jsx';
import SelectIcon from '../assets/svg/SelectIcon.jsx';
import { updateUserVehicle, setTrigger } from '../store/userSlice.js';
import { uploadImage, deleteImage } from '../util/imageStorage';
import { accent } from '../theme/accent';

const NAVY = 'rgba(4, 25, 51, 1)';
const ERROR_RED = 'rgba(211, 47, 47, 1)';

const YEARS = Array.from({ length: 2026 - 1930 + 1 }, (_, i) =>
  (2026 - i).toString(), // newest first — most edits pick a recent year
);

/** Predefined vehicle brand options shown in the autocomplete dropdown */
const VEHICLE_MODELS = [
  'BMW', 'Toyota', 'Mercedes', 'Honda', 'Nissan', 'Hyundai',
  'Ford', 'Chevrolet', 'Kia', 'Mazda', 'Mitsubishi', 'Volkswagen',
  'Audi', 'Lexus', 'Subaru', 'Tesla', 'Volvo', 'Suzuki', 'Peugeot',
];

const INITIAL_FORM = { brand: '', model: '', year: '' };
const NO_ERRORS = { brand: '', model: '', year: '' };



const VehicleUpdate = ({
  VehicleUpdateModal,
  setVehicalUpdate,
  EditValue,
  ImageUrl,
  setImageUrl,
  onVehicleUpdated,
}) => {
  const dispatch = useDispatch();
  const { userEmail } = useSelector(state => state.user);
  const { theme } = useSelector(store => store.theme);
  const isDark = theme === 'dark';

  const [form, setForm] = useState(INITIAL_FORM);
  // Bumped when the form is prefilled, so prefilled values count as clean.
  const [cleanKey, setCleanKey] = useState(0);
  const [errors, setErrors] = useState(NO_ERRORS);

  const [selectedImage, setSelectedImage] = useState(null);
  const [imageRemoved, setImageRemoved] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [keyboardBehavior, setKeyboardBehavior] = useState('padding');
  const [ui, setUi] = useState({
    focusedField: null,       // 'brand' | 'model' | 'year' | null
    yearDropdownOpen: false,
    brandSuggestions: [],
  });

  const displayImage = imageRemoved ? null : selectedImage || EditValue?.imageUrl || null;

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
      dropdownBg: isDark ? '#12294A' : '#fff',
      dropdownHighlight: isDark ? accent.lightAlpha(0.15) : accent.alpha(0.06),
      handle: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(4,25,51,0.15)',
      divider: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(4,25,51,0.06)',
      closeBg: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(4,25,51,0.05)',
      backdrop: 'rgba(4, 25, 51, 0.6)',
      iconWell: isDark ? accent.lightAlpha(0.14) : accent.alpha(0.08),
      accent: isDark ? accent.light : accent.primary,
    }),
    [isDark],
  );

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

  // Populate form when the sheet opens
  useEffect(() => {
    if (!VehicleUpdateModal || !EditValue) return;
    setForm({
      brand: EditValue.brand || '',
      model: EditValue.model || '',
      year: EditValue.year || '',
    });
    setSelectedImage(null);
    setImageRemoved(false);
    setErrors(NO_ERRORS);
    setCleanKey(k => k + 1);
    setUi({ focusedField: null, yearDropdownOpen: false, brandSuggestions: [] });
  }, [EditValue, VehicleUpdateModal]);

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const clearError = key => setErrors(prev => ({ ...prev, [key]: '' }));

  const handleClose = () => {
    if (isUploading) return; // don't dismiss mid-save
    Keyboard.dismiss();
    setVehicalUpdate(false);
  };

  // Backdrop, back button and the close icon ask before throwing away input.
  const isDirty = useUnsavedChanges({ form, selectedImage, imageRemoved }, cleanKey);
  const requestClose = () => confirmDiscard(isDirty, handleClose);

  // Cleanup after the exit animation, mirroring ServiceUpdate's flicker fix
  const handleModalHide = () => {
    setForm(INITIAL_FORM);
    setErrors(NO_ERRORS);
    setSelectedImage(null);
    setImageRemoved(false);
    setIsUploading(false);
    setUi({ focusedField: null, yearDropdownOpen: false, brandSuggestions: [] });
  };

  // ─── Brand autocomplete ──────────────────────────────────────────────────
  const handleBrandSearch = useCallback(text => {
    setForm(prev => ({ ...prev, brand: text }));
    if (text.trim()) setErrors(prev => ({ ...prev, brand: '' }));
    setUi(prev => ({
      ...prev,
      brandSuggestions:
        text.length > 0
          ? VEHICLE_MODELS.filter(item =>
              item.toLowerCase().includes(text.toLowerCase()),
            )
          : [],
    }));
  }, []);

  const handleSelectBrand = useCallback(item => {
    setForm(prev => ({ ...prev, brand: item }));
    setErrors(prev => ({ ...prev, brand: '' }));
    setUi(prev => ({ ...prev, brandSuggestions: [] }));
  }, []);

  // ─── Year picker ─────────────────────────────────────────────────────────
  const selectYear = useCallback(year => {
    setForm(prev => ({ ...prev, year }));
    setErrors(prev => ({ ...prev, year: '' }));
    setUi(prev => ({ ...prev, yearDropdownOpen: false, focusedField: null }));
  }, []);

  // ─── Photo ───────────────────────────────────────────────────────────────
  const requestPermission = async () => {
    if (Platform.OS !== 'android') return true;
    const permission =
      Platform.Version >= 33
        ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
        : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
    const result = await PermissionsAndroid.request(permission);
    return result === PermissionsAndroid.RESULTS.GRANTED;
  };

  const handleSelectImage = async () => {
    const hasPermission = await requestPermission();
    if (!hasPermission) {
      Toast.show({
        type: 'error',
        text1: 'Permission denied',
        text2: 'Please allow access to photos',
        position: 'top',
        visibilityTime: 3000,
      });
      return;
    }
    const response = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
      selectionLimit: 1,
    });
    if (response.assets?.[0]) {
      setSelectedImage(response.assets[0].uri);
      setImageRemoved(false);
      if (setImageUrl) setImageUrl(null);
    }
  };

  const handleRemoveImage = () => {
    deleteImage(EditValue?.imageUrl);
    setSelectedImage(null);
    setImageRemoved(true);
    if (setImageUrl) setImageUrl(null);
  };

  // ─── Save ────────────────────────────────────────────────────────────────
  const validate = useCallback(() => {
    const newErrors = {
      brand: form.brand.trim() ? '' : 'Vehicle brand is required.',
      model: form.model.trim() ? '' : 'Vehicle model is required.',
      year: form.year ? '' : 'Vehicle year is required.',
    };
    setErrors(newErrors);
    return Object.values(newErrors).every(e => e === '');
  }, [form]);

  const handleUpdateVehicle = useCallback(async () => {
    if (isUploading) return; // guard against double-tap
    if (!validate()) return;

    setIsUploading(true);
    try {
      let finalImageUrl = imageRemoved ? null : EditValue?.imageUrl || null;

      if (selectedImage) {
        const uploadResult = await uploadImage(selectedImage, 'vehicles');
        if (uploadResult?.success) {
          finalImageUrl = uploadResult.url;
        } else {
          Toast.show({
            type: 'error',
            text1: 'Image upload failed',
            text2: 'Please try again',
            position: 'top',
            visibilityTime: 3000,
          });
          setIsUploading(false);
          return;
        }
      }

      const updateData = {
        brand: form.brand.trim(),
        model: form.model.trim(),
        year: form.year,
        imageUrl: finalImageUrl,
      };

      const result = await updateUserVehicle(userEmail, EditValue?.id, updateData);
      if (!result?.success) {
        Toast.show({
          type: 'error',
          text1: 'Vehicle already exists',
          text2: `${updateData.brand} ${updateData.model} (${updateData.year}) is already in your garage.`,
          position: 'top',
          visibilityTime: 3000,
        });
        return;
      }

      // Close the sheet first, then alert the parent after the modal
      // animation/state transition has started (avoids render pipeline jank)
      setVehicalUpdate(false);
      dispatch(setTrigger(false));

      if (onVehicleUpdated) {
        setTimeout(async () => {
          await onVehicleUpdated();
        }, 100);
      }
    } catch (error) {
      console.error('Update error:', error);
      Toast.show({
        type: 'error',
        text1: 'Something went wrong',
        text2: 'Please try again later',
        position: 'top',
        visibilityTime: 3000,
      });
    } finally {
      setIsUploading(false);
    }
  }, [
    form, selectedImage, imageRemoved, EditValue, userEmail,
    validate, onVehicleUpdated, dispatch, isUploading, setVehicalUpdate,
  ]);

  // Border priority: error > focused > filled > default
  const borderFor = key =>
    errors[key]
      ? ERROR_RED
      : ui.focusedField === key
      ? t.inputBorderFocus
      : form[key] && form[key].toString().trim() !== ''
      ? t.inputBorderFilled
      : t.inputBorder;

  const FieldLabel = ({ children }) => (
    <Text style={[styles.label, { color: t.label }]}>{children}</Text>
  );

  const FieldError = ({ name }) =>
    errors[name] ? <Text style={styles.errorText}>{errors[name]}</Text> : null;

  return (
    <View style={styles.container}>
      <ToastManager />
      <Modal
        isVisible={VehicleUpdateModal}
        backdropOpacity={0.55}
        statusBarTranslucent
        coverScreen
        useNativeDriver={false}
        backdropTransitionOutTiming={1}
        hideModalContentWhileAnimating
        onBackdropPress={requestClose}
        onBackButtonPress={requestClose}
        onModalHide={handleModalHide}
        style={styles.modal}
        animationIn="slideInUp"
        animationOut="slideOutDown"
      >
        <KeyboardAvoidingView
          behavior={keyboardBehavior}
          style={[styles.sheet, { backgroundColor: t.sheetBg }]}
        >
          {/* Drag handle */}
          <View style={styles.handleWrapper}>
            <View style={[styles.handle, { backgroundColor: t.handle }]} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Car color={t.text} />
              <Text style={[styles.title, { color: t.text }]} numberOfLines={1}>
                Edit vehicle
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
            <View style={styles.form}>
              {/* Vehicle photo */}
              <View>
                <FieldLabel>Vehicle photo</FieldLabel>
                {displayImage ? (
                  <View style={styles.previewWrapper}>
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
                    <Camera />
                    <Text style={[styles.uploadText, { color: t.muted }]}>
                      Add a photo of your vehicle
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Brand — with autocomplete */}
              <View style={{ zIndex: 3, elevation: 3 }}>
                <FieldLabel>Brand</FieldLabel>
                <TextInput
                  value={form.brand}
                  onChangeText={handleBrandSearch}
                  onFocus={() => setUi(p => ({ ...p, focusedField: 'brand' }))}
                  onBlur={() => setUi(p => ({ ...p, focusedField: null }))}
                  placeholder="e.g. Toyota"
                  placeholderTextColor={t.placeholder}
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                  style={[
                    styles.input,
                    {
                      color: t.text,
                      backgroundColor: t.inputBg,
                      borderColor: borderFor('brand'),
                    },
                  ]}
                />
                <FieldError name="brand" />

                {ui.brandSuggestions.length > 0 && (
                  <View
                    style={[
                      styles.dropdown,
                      styles.brandDropdown,
                      { backgroundColor: t.dropdownBg, borderColor: t.inputBorder },
                    ]}
                  >
                    <ScrollView
                      nestedScrollEnabled
                      showsVerticalScrollIndicator
                      keyboardShouldPersistTaps="always"
                    >
                      {ui.brandSuggestions.map((item, index) => (
                        <TouchableOpacity
                          key={item}
                          onPress={() => handleSelectBrand(item)}
                          activeOpacity={0.7}
                          style={[
                            styles.dropdownItem,
                            index === 0 && { backgroundColor: t.dropdownHighlight },
                          ]}
                        >
                          <Text
                            style={[
                              styles.dropdownItemText,
                              {
                                color: t.text,
                                fontFamily:
                                  index === 0
                                    ? 'RobotoCondensed500'
                                    : 'RobotoCondensed400',
                              },
                            ]}
                          >
                            {item}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* Model + year side by side */}
              <View style={[styles.row, { zIndex: 2, elevation: 2 }]}>
                <View style={{ flex: 1 }}>
                  <FieldLabel>Model</FieldLabel>
                  <TextInput
                    value={form.model}
                    onChangeText={text => {
                      set('model', text);
                      clearError('model');
                    }}
                    onFocus={() => setUi(p => ({ ...p, focusedField: 'model' }))}
                    onBlur={() => setUi(p => ({ ...p, focusedField: null }))}
                    placeholder="e.g. Corolla"
                    placeholderTextColor={t.placeholder}
                    style={[
                      styles.input,
                      {
                        color: t.text,
                        backgroundColor: t.inputBg,
                        borderColor: borderFor('model'),
                      },
                    ]}
                  />
                  <FieldError name="model" />
                </View>

                <View style={{ flex: 1 }}>
                  <FieldLabel>Year</FieldLabel>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      Keyboard.dismiss();
                      setUi(p => ({
                        ...p,
                        yearDropdownOpen: !p.yearDropdownOpen,
                        focusedField: p.yearDropdownOpen ? null : 'year',
                      }));
                    }}
                    style={[
                      styles.input,
                      styles.dateInput,
                      { backgroundColor: t.inputBg, borderColor: borderFor('year') },
                    ]}
                  >
                    <Text style={{ color: form.year ? t.text : t.placeholder, fontSize: 14 }}>
                      {form.year || 'Select year'}
                    </Text>
                    <SelectIcon color={t.icon(!!form.year)} />
                  </TouchableOpacity>
                  <FieldError name="year" />

                  {ui.yearDropdownOpen && (
                    <View
                      style={[
                        styles.dropdown,
                        styles.yearDropdown,
                        { backgroundColor: t.dropdownBg, borderColor: t.inputBorder },
                      ]}
                    >
                      <ScrollView
                        nestedScrollEnabled
                        showsVerticalScrollIndicator
                        keyboardShouldPersistTaps="always"
                      >
                        {YEARS.map(year => {
                          const selected = form.year === year;
                          return (
                            <TouchableOpacity
                              key={year}
                              onPress={() => selectYear(year)}
                              style={[
                                styles.dropdownItem,
                                selected && { backgroundColor: t.dropdownHighlight },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.dropdownItemText,
                                  {
                                    color: t.text,
                                    fontFamily: selected
                                      ? 'RobotoCondensed500'
                                      : 'RobotoCondensed400',
                                  },
                                ]}
                              >
                                {year}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Sticky footer */}
          <View style={[styles.footer, { borderTopColor: t.divider, backgroundColor: t.sheetBg }]}>
            <TouchableOpacity
              style={[styles.primaryButton, isUploading && { opacity: 0.5 }]}
              onPress={() => {
                Keyboard.dismiss();
                handleUpdateVehicle();
              }}
              disabled={isUploading}
              activeOpacity={0.85}
            >
              {isUploading ? (
                <>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.primaryButtonText}>Saving…</Text>
                </>
              ) : (
                <Text style={styles.primaryButtonText}>Save changes</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

export default VehicleUpdate;

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

  form: { gap: 18 },
  label: { fontSize: 13, fontFamily: 'RobotoCondensed500', marginBottom: 8 },
  row: { flexDirection: 'row', gap: 12 },

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

  errorText: {
    fontSize: 12,
    fontFamily: 'RobotoCondensed400',
    color: ERROR_RED,
    marginTop: 6,
  },

  /* ── Dropdowns (brand autocomplete + year picker) ── */
  dropdown: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderRadius: 12,
    borderWidth: 1,
    padding: 6,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    zIndex: 100,
  },
  brandDropdown: { top: 74, maxHeight: 160 },
  yearDropdown: { top: 74, maxHeight: 190 },
  dropdownItem: {
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  dropdownItemText: { fontSize: 13 },

  /* ── Vehicle photo ── */
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

  /* ── Footer ── */
  footer: { padding: 16, paddingHorizontal: 20, borderTopWidth: 1 },
  primaryButton: {
    get backgroundColor() { return accent.primary; },
    height: 48,
    borderRadius: 24,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontFamily: 'RobotoCondensed500' },
});
