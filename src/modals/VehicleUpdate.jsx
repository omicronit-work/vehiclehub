import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useUnsavedChanges, useDiscardConfirm } from '../util/methods/useUnsavedChanges';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import Modal from 'react-native-modal';
import { pickImage } from '../util/methods/useImagePicker';
import ToastManager, { Toast } from 'toastify-react-native';
import { useDispatch, useSelector } from 'react-redux';

import Car from '../assets/svg/Car.jsx';
import Upload from '../assets/svg/Upload.jsx';
import CloseX from '../assets/svg/CloseX.jsx';
import SelectIcon from '../assets/svg/SelectIcon.jsx';
import TrashIcon from '../assets/svg/TrashIcon.jsx';
import { updateUserVehicle, setTrigger } from '../store/userSlice.js';
import { uploadImage, deleteImage } from '../util/imageStorage';
import { accent } from '../theme/accent';
import { useHideAdsWhile } from '../util/ads';
import { useSheetFooterInset } from '../util/methods/useSheetFooterInset';
import { useBrands } from '../util/methods/useBrands';
import { useModels } from '../util/methods/useModels';
import SuggestionDropdown from '../components/ui/SuggestionDropdown';
import { filterOptions } from '../util/filterOptions';
import { DropdownHost, DropdownAnchor } from '../components/ui/DropdownHost';
import { FitImage } from '../components/PhotoPreview';
import { VEHICLE_YEARS } from '../util/constants';
import { kmToField, fieldToKm, formatKm } from '../util/distance';
import { recordsOdometer } from '../util/schedule/scheduleStore';
import { useDistanceUnit } from '../util/schedule/scheduleSettings';

const NAVY = 'rgba(4, 25, 51, 1)';
const ERROR_RED = 'rgba(211, 47, 47, 1)';
const DELETE_RED = '#DC3545';

const YEARS = VEHICLE_YEARS;

const INITIAL_FORM = { brand: '', model: '', year: '', odometer: '' };
const NO_ERRORS = { brand: '', model: '', year: '', odometer: '' };



const VehicleUpdate = ({
  VehicleUpdateModal,
  setVehicalUpdate,
  EditValue,
  ImageUrl,
  setImageUrl,
  onVehicleUpdated,
  onDelete,
}) => {
  useHideAdsWhile(VehicleUpdateModal);
  const footerInset = useSheetFooterInset();
  const dispatch = useDispatch();
  const distUnit = useDistanceUnit();
  const scrollRef = useRef(null);
  // Delete opens its confirm dialog only after this sheet has fully hidden —
  // presenting a second modal mid-dismiss is dropped on iOS.
  const pendingDeleteRef = useRef(null);
  const { userEmail } = useSelector(state => state.user);
  const { theme } = useSelector(store => store.theme);
  const brands = useBrands(VehicleUpdateModal);
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
    modelOpen: false,
  });

  // Models load only once the brand matches the list exactly.
  const modelBrand = useMemo(
    () => brands.find(b => b.toLowerCase() === form.brand.trim().toLowerCase()) || '',
    [brands, form.brand],
  );
  const models = useModels(modelBrand, VehicleUpdateModal);
  const modelSuggestions = useMemo(() => {
    const q = form.model.trim().toLowerCase();
    const list = filterOptions(models, q);
    // Nothing to suggest when the field already holds exactly the only match.
    return list.length === 1 && list[0].toLowerCase() === q ? [] : list;
  }, [models, form.model]);

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
      inputBorderFilled: isDark ? accent.light : accent.primary,
      placeholder: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(4,25,51,0.35)',
      icon: (active = false) =>
        active
          ? isDark ? '#fff' : NAVY
          : isDark ? 'rgba(255,255,255,0.45)' : 'rgba(4,25,51,0.45)',
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
      odometer:
        EditValue.currentOdometer != null && EditValue.currentOdometer !== ''
          ? String(EditValue.currentOdometer)
          : '',
    });
    setSelectedImage(null);
    setImageRemoved(false);
    setErrors(NO_ERRORS);
    setCleanKey(k => k + 1);
    setUi({ focusedField: null, yearDropdownOpen: false, brandSuggestions: [], modelOpen: false });
  }, [EditValue, VehicleUpdateModal]);

  // Highest reading in this vehicle's services / fuel logs: the odometer
  // can't be set below it (that would make the garage disagree with them).
  const [minOdometer, setMinOdometer] = useState(null);
  useEffect(() => {
    setMinOdometer(null);
    if (!VehicleUpdateModal || !EditValue?.id) return undefined;
    let cancelled = false;
    recordsOdometer(userEmail, EditValue.id)
      .then(km => { if (!cancelled) setMinOdometer(km); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [VehicleUpdateModal, EditValue, userEmail]);

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const clearError = key => setErrors(prev => ({ ...prev, [key]: '' }));

  const handleClose = () => {
    if (isUploading) return; // don't dismiss mid-save
    Keyboard.dismiss();
    setVehicalUpdate(false);
  };

  // Backdrop, back button and the close icon ask before throwing away input.
  const isDirty = useUnsavedChanges({ form, selectedImage, imageRemoved }, cleanKey);
  const [requestClose, discardDialog] = useDiscardConfirm(isDirty, handleClose);

  // Save stays disabled until something is changed (and required fields are filled).
  const requiredFilled =
    !!form.brand.trim() && !!form.model.trim() && !!String(form.year) && form.odometer !== '';
  // Dimmed (saveDisabled) while incomplete, but still pressable so a tap
  // reveals which fields are missing; only saving blocks the button.
  const saveDisabled = isUploading || !isDirty || !requiredFilled;

  // Cleanup after the exit animation, mirroring ServiceUpdate's flicker fix
  const handleModalHide = () => {
    setForm(INITIAL_FORM);
    setErrors(NO_ERRORS);
    setSelectedImage(null);
    setImageRemoved(false);
    setIsUploading(false);
    setUi({ focusedField: null, yearDropdownOpen: false, brandSuggestions: [], modelOpen: false });
    if (pendingDeleteRef.current) {
      const target = pendingDeleteRef.current;
      pendingDeleteRef.current = null;
      onDelete?.(target);
    }
  };

  // ─── Brand autocomplete ──────────────────────────────────────────────────
  const handleBrandSearch = useCallback(text => {
    setForm(prev => ({ ...prev, brand: text }));
    if (text.trim()) setErrors(prev => ({ ...prev, brand: '' }));
    setUi(prev => ({
      ...prev,
      brandSuggestions:
        text.length > 0 ? filterOptions(brands, text) : [],
    }));
  }, [brands]);

  const handleSelectBrand = useCallback(item => {
    setForm(prev => ({ ...prev, brand: item }));
    setErrors(prev => ({ ...prev, brand: '' }));
    setUi(prev => ({ ...prev, brandSuggestions: [] }));
  }, []);

  const handleSelectModel = useCallback(item => {
    setForm(prev => ({ ...prev, model: item }));
    setErrors(prev => ({ ...prev, model: '' }));
    setUi(prev => ({ ...prev, modelOpen: false }));
    Keyboard.dismiss();
  }, []);

  // ─── Year picker ─────────────────────────────────────────────────────────
  const selectYear = useCallback(year => {
    setForm(prev => ({ ...prev, year }));
    setErrors(prev => ({ ...prev, year: '' }));
    setUi(prev => ({ ...prev, yearDropdownOpen: false, focusedField: null }));
  }, []);

  // ─── Photo ───────────────────────────────────────────────────────────────
  const handleSelectImage = async () => {
    const response = await pickImage();
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
      odometer:
        form.odometer === ''
          ? 'Enter the current odometer reading.'
          : minOdometer != null && Number(form.odometer) < minOdometer
            ? `Your service and fuel records go up to ${formatKm(minOdometer, distUnit)}. Enter that or higher.`
            : '',
    };
    setErrors(newErrors);
    return Object.values(newErrors).every(e => e === '');
  }, [form, minOdometer, distUnit]);

  const handleUpdateVehicle = useCallback(async () => {
    if (isUploading) return; // guard against double-tap
    if (!validate()) return;

    setIsUploading(true);
    try {
      let finalImageUrl = imageRemoved ? null : EditValue?.imageUrl || null;

      if (selectedImage) {
        const uploadResult = await uploadImage(selectedImage);
        if (uploadResult?.success) {
          finalImageUrl = uploadResult.url;
        } else {
          Toast.show({
            type: 'error',
            text1: 'Image upload failed',
            text2: uploadResult?.message || 'Please try again',
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
        currentOdometer: Number(form.odometer) || 0,
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

  const FieldLabel = ({ children, required }) => (
    <Text style={[styles.label, { color: t.label }]}>
      {children}
      {required && <Text style={{ color: ERROR_RED }}> *</Text>}
    </Text>
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
              <View style={[styles.iconWell, { backgroundColor: t.iconWell }]}>
                <Car color={t.accent} />
              </View>
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
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            <DropdownHost scrollRef={scrollRef}>
              <View style={styles.form}>
                {/* Brand — with autocomplete */}
                <View style={{ zIndex: 3 }}>
                  <FieldLabel required>Brand</FieldLabel>
                  <DropdownAnchor
                    open={ui.brandSuggestions.length > 0}
                    dropdown={
                      <SuggestionDropdown
                        items={ui.brandSuggestions}
                        query={form.brand}
                        onSelect={handleSelectBrand}
                      />
                    }
                  >
                    <TextInput
                      value={form.brand}
                      onChangeText={handleBrandSearch}
                      onFocus={() => setUi(p => ({ ...p, focusedField: 'brand', modelOpen: false }))}
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
                  </DropdownAnchor>
                  <FieldError name="brand" />

                </View>

                {/* Model + year side by side */}
                <View style={[styles.row, { zIndex: 2 }]}>
                  <View style={{ flex: 1 }}>
                    <FieldLabel required>Model</FieldLabel>
                    <DropdownAnchor
                      open={ui.modelOpen && !!modelBrand && modelSuggestions.length > 0}
                      dropdown={
                        <SuggestionDropdown
                          items={modelSuggestions}
                          query={form.model}
                          onSelect={handleSelectModel}
                        />
                      }
                    >
                      <TextInput
                        value={form.model}
                        onChangeText={text => {
                          set('model', text);
                          clearError('model');
                          setUi(p => ({ ...p, modelOpen: true }));
                        }}
                        onFocus={() => setUi(p => ({ ...p, focusedField: 'model', modelOpen: true, brandSuggestions: [] }))}
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
                    </DropdownAnchor>
                    <FieldError name="model" />

                  </View>

                  <View style={{ flex: 1 }}>
                    <FieldLabel required>Year</FieldLabel>
                    <DropdownAnchor
                      open={ui.yearDropdownOpen}
                      dropdown={
                        <SuggestionDropdown items={YEARS} selected={form.year} onSelect={selectYear} />
                      }
                    >
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => {
                          Keyboard.dismiss();
                          setUi(p => ({
                            ...p,
                            yearDropdownOpen: !p.yearDropdownOpen,
                            focusedField: p.yearDropdownOpen ? null : 'year',
                            modelOpen: false,
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
                    </DropdownAnchor>
                    <FieldError name="year" />

                  </View>
                </View>

                {/* Current odometer — seeds the "due in X km" checks */}
                <View>
                  <FieldLabel required>Current odometer</FieldLabel>
                  <View>
                    <TextInput
                      value={kmToField(form.odometer, distUnit)}
                      onChangeText={v => {
                        // Stored in km; typed in the user's unit.
                        const odometer = fieldToKm(v, distUnit);
                        set('odometer', odometer);
                        if (odometer !== '') clearError('odometer');
                      }}
                      onFocus={() => setUi(p => ({ ...p, focusedField: 'odometer', yearDropdownOpen: false, modelOpen: false, brandSuggestions: [] }))}
                      onBlur={() => setUi(p => ({ ...p, focusedField: null }))}
                      keyboardType="number-pad"
                      placeholder="e.g. 45000"
                      placeholderTextColor={t.placeholder}
                      returnKeyType="done"
                      onSubmitEditing={Keyboard.dismiss}
                      style={[
                        styles.input,
                        styles.odometerInput,
                        {
                          color: t.text,
                          backgroundColor: t.inputBg,
                          borderColor: borderFor('odometer'),
                        },
                      ]}
                    />
                    <Text style={[styles.odometerSuffix, { color: t.placeholder }]}>{distUnit}</Text>
                  </View>
                  <FieldError name="odometer" />
                </View>

                {/* Vehicle photo */}
                <View>
                  <FieldLabel>Photo</FieldLabel>
                  {displayImage ? (
                    <View style={styles.previewWrapper}>
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
                        Add a photo of your vehicle
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </DropdownHost>
          </ScrollView>

          {/* Sticky footer */}
          <View style={[styles.footer, { borderTopColor: t.divider, backgroundColor: t.sheetBg, paddingBottom: 16 + footerInset }]}>
            <TouchableOpacity
              style={[styles.primaryButton, saveDisabled && { opacity: 0.5 }]}
              onPress={() => {
                Keyboard.dismiss();
                handleUpdateVehicle();
              }}
              disabled={isUploading || !isDirty}
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
            {onDelete && (
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => {
                  Keyboard.dismiss();
                  pendingDeleteRef.current = EditValue;
                  setVehicalUpdate(false);
                }}
                disabled={isUploading}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Delete vehicle"
              >
                <TrashIcon width={16} height={16} color={DELETE_RED} />
                <Text style={styles.deleteButtonText}>Delete vehicle</Text>
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
        {discardDialog}
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
    gap: 12,
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

  form: { gap: 18 },
  label: { fontSize: 13, fontFamily: 'RobotoCondensed500', marginBottom: 8 },
  row: { flexDirection: 'row', gap: 12 },

  input: {
    height: 46,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: 'RobotoCondensed400',
  },
  odometerInput: { paddingRight: 42 },
  odometerSuffix: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    textAlignVertical: 'center',
    lineHeight: 46,
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
  deleteButton: {
    height: 44,
    marginTop: 8,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: { color: DELETE_RED, fontSize: 15, fontFamily: 'RobotoCondensed500' },
});
