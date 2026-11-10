import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useTheme } from '../util/methods/useTheme';
import { useUnsavedChanges, useDiscardConfirm } from '../util/methods/useUnsavedChanges';
import Modal from 'react-native-modal';
import { pickImage } from '../util/methods/useImagePicker';
import { useDispatch, useSelector } from 'react-redux';

// SVG icon components
import Car from '../assets/svg/Car';
import CloseX from '../assets/svg/CloseX.jsx';
import SearchIcon from '../assets/svg/SearchIcon.jsx';
import Upload from '../assets/svg/Upload.jsx';

import { addUserVehicle } from '../store/userSlice.js';
import { Toast } from 'toastify-react-native';
import { setTrigger } from '../store/userSlice.js';
import { uploadImage } from '../util/imageStorage';
import { shadow } from '../theme/tokens';
import { accent } from '../theme/accent';
import { useHideAdsWhile } from '../util/ads';
import { useSheetFooterInset } from '../util/methods/useSheetFooterInset';
import { useBrands, addCustomBrand } from '../util/methods/useBrands';
import { useModels, addCustomModel } from '../util/methods/useModels';
import SuggestionDropdown from '../components/ui/SuggestionDropdown';
import { filterOptions } from '../util/filterOptions';
import { DropdownHost, DropdownAnchor } from '../components/ui/DropdownHost';
import { FitImage } from '../components/PhotoPreview';
import { VEHICLE_YEARS, VEHICLE_YEAR_ERROR } from '../util/constants';
import { kmToField, fieldToKm } from '../util/distance';
import { useDistanceUnit } from '../util/schedule/scheduleSettings';


const NAVY = 'rgba(4, 25, 51, 1)';
const ERROR_RED = 'rgba(211, 47, 47, 1)';

// Premium shadow profile — matches Vehicle.jsx / VehicleInformations.jsx

const YEARS = VEHICLE_YEARS;


// ─────────────────────────────────────────────
// Custom Hooks
// ─────────────────────────────────────────────
const useBehavior = () => {
  const defaultValue = 'padding';
  const [behaviour, setBehaviour] = useState(defaultValue);

  useEffect(() => {
    const showListener = Keyboard.addListener('keyboardDidShow', () =>
      setBehaviour(defaultValue),
    );
    const hideListener = Keyboard.addListener('keyboardDidHide', () =>
      setBehaviour(undefined),
    );

    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []);

  return behaviour;
};

const AddVehicle = ({ addVehicleModal, setAddVehicleModal, onVehicleAdded }) => {
  const { userEmail } = useSelector(state => state.user);
  useHideAdsWhile(addVehicleModal);
  const footerInset = useSheetFooterInset();
  const brands = useBrands(addVehicleModal);
  const isDark = useTheme();
  const scrollViewRef = useRef(null);
  const modelInputRef = useRef(null);
  const behavior = useBehavior();
  const dispatch = useDispatch();
  const distUnit = useDistanceUnit();

  // ── Form State ────────────────────────────────
  const [form, setForm] = useState({ brand: '', model: '', year: '', odometer: '' });
  const [selectedImage, setSelectedImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const [errors, setErrors] = useState({ brand: '', model: '', year: '', odometer: '' });

  const [uiState, setUiState] = useState({
    yearDropdownVisible: false,
    brandFocused: false,
    modelFocused: false,
    yearFocused: false,
    odometerFocused: false,
    showDropdown: false,
    modelDropdown: false,
  });

  const [filteredData, setFilteredData] = useState([]);

  // Models load only once the brand matches the list exactly (custom brands
  // included) — not on every keystroke of a half-typed brand.
  const modelBrand = useMemo(
    () => brands.find(b => b.toLowerCase() === form.brand.trim().toLowerCase()) || '',
    [brands, form.brand],
  );
  const models = useModels(modelBrand, addVehicleModal);
  const filteredModels = useMemo(() => filterOptions(models, form.model), [models, form.model]);

  // ─────────────────────────────────────────────
  // Theme tokens — matches the AddService redesign
  // ─────────────────────────────────────────────
  const t = useMemo(
    () => ({
      sheetBg: isDark ? '#0A1E38' : '#fff',
      text: isDark ? '#fff' : NAVY,
      muted: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(4,25,51,0.55)',
      label: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(4,25,51,0.7)',
      inputBg: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(4,25,51,0.03)',
      inputBorder: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(4,25,51,0.10)',
      inputBorderFocus: isDark ? accent.light : accent.primary,
      placeholder: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(4,25,51,0.35)',
      icon: (active = false) =>
        active
          ? isDark ? '#fff' : NAVY
          : isDark ? 'rgba(255,255,255,0.45)' : 'rgba(4,25,51,0.45)',
      selectedYearBg: isDark ? accent.alpha(0.35) : accent.alpha(0.08),
      handle: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(4,25,51,0.15)',
      divider: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(4,25,51,0.06)',
      closeBg: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(4,25,51,0.05)',
      accent: isDark ? accent.light : accent.primary,
      iconWell: isDark ? accent.lightAlpha(0.14) : accent.alpha(0.08),
    }),
    [isDark],
  );

  const updateFocusState = useCallback((field, value) => {
    setUiState(prev => ({ ...prev, [field]: value }));
  }, []);

  const borderFor = (focused, hasValue, error) => {
    if (error) return ERROR_RED;
    if (focused) return t.inputBorderFocus;
    if (hasValue) return isDark ? accent.light : accent.primary;
    return t.inputBorder;
  };

  // ─────────────────────────────────────────────
  // Validation
  // ─────────────────────────────────────────────
  const validate = useCallback(() => {
    const newErrors = {
      brand: form.brand.trim() ? '' : 'Enter or pick a brand.',
      model: form.model.trim() ? '' : 'Enter the model.',
      year: YEARS.includes(form.year) ? '' : VEHICLE_YEAR_ERROR,
      odometer: form.odometer !== '' ? '' : 'Enter the current odometer reading.',
    };
    setErrors(newErrors);
    return Object.values(newErrors).every(e => e === '');
  }, [form]);

  const selectImage = async () => {
    const response = await pickImage();

    if (response.assets?.[0]) {
      setSelectedImage(response.assets[0].uri);
    }
  };

  // ─────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────
  const selectYear = useCallback(year => {
    setForm(prev => ({ ...prev, year }));
    setErrors(prev => ({ ...prev, year: '' }));
    setUiState(prev => ({ ...prev, yearDropdownVisible: false }));
    Keyboard.dismiss();
  }, []);

  // Digits only; suggestions narrow as the year is typed ("20" → 2026…2000).
  // The range error shows as soon as no valid year can start with the digits
  // typed so far ("3" for 3000), not only when Save is tapped.
  const handleYearChange = useCallback(text => {
    const year = text.replace(/[^0-9]/g, '').slice(0, 4);
    setForm(prev => ({ ...prev, year }));
    const stillPossible = year.length < 4 && YEARS.some(y => y.startsWith(year));
    setErrors(prev => ({
      ...prev,
      year: !year || YEARS.includes(year) || stillPossible ? '' : VEHICLE_YEAR_ERROR,
    }));
    setUiState(prev => ({ ...prev, yearDropdownVisible: true }));
  }, []);

  const filteredYears = useMemo(
    () => (form.year ? YEARS.filter(y => y.startsWith(form.year)) : YEARS),
    [form.year],
  );

  const handleBrandSearch = useCallback(text => {
    setForm(prev => ({ ...prev, brand: text }));

    if (text.trim()) {
      setErrors(prev => ({ ...prev, brand: '' }));
    }

    setFilteredData(filterOptions(brands, text));
    setUiState(prev => ({ ...prev, showDropdown: true }));
  }, [brands]);

  const handleBrandFocus = useCallback(() => {
    updateFocusState('brandFocused', true);
    setUiState(prev => ({ ...prev, yearDropdownVisible: false, showDropdown: true, modelDropdown: false }));

    setFilteredData(filterOptions(brands, form.brand));
  }, [brands, form.brand, updateFocusState]);

  // Brands arrive from Firestore after the modal opens — refresh an already
  // open dropdown instead of waiting for the next keystroke.
  useEffect(() => {
    if (!uiState.showDropdown) return;
    setFilteredData(filterOptions(brands, form.brand));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brands]);

  const handleBrandBlur = useCallback(() => {
    updateFocusState('brandFocused', false);
  }, [updateFocusState]);

  const handleSelectBrand = useCallback(item => {
    setForm(prev => ({ ...prev, brand: item }));
    setErrors(prev => ({ ...prev, brand: '' }));
    setFilteredData([]);
    setUiState(prev => ({ ...prev, showDropdown: false }));

    setTimeout(() => {
      modelInputRef.current?.focus();
    }, 100);
  }, []);

  const handleAddCustomBrand = useCallback(() => {
    addCustomBrand(form.brand, userEmail);
    setErrors(prev => ({ ...prev, brand: '' }));
    setFilteredData([]);
    setUiState(prev => ({ ...prev, showDropdown: false }));

    setTimeout(() => {
      modelInputRef.current?.focus();
    }, 100);
  }, [form.brand, userEmail]);

  const handleModelChange = useCallback(text => {
    setForm(prev => ({ ...prev, model: text }));

    if (text.trim()) {
      setErrors(prev => ({ ...prev, model: '' }));
    }
    setUiState(prev => ({ ...prev, modelDropdown: true }));
  }, []);

  const handleSelectModel = useCallback(item => {
    setForm(prev => ({ ...prev, model: item }));
    setErrors(prev => ({ ...prev, model: '' }));
    setUiState(prev => ({ ...prev, modelDropdown: false }));
    Keyboard.dismiss();
  }, []);

  const handleAddCustomModel = useCallback(() => {
    addCustomModel(modelBrand, form.model, userEmail);
    setErrors(prev => ({ ...prev, model: '' }));
    setUiState(prev => ({ ...prev, modelDropdown: false }));
    Keyboard.dismiss();
  }, [modelBrand, form.model, userEmail]);

  const handleCloseModal = useCallback(() => {
    if (isLoading) return; // don't dismiss mid-save
    Keyboard.dismiss();
    setAddVehicleModal(false);
    setSelectedImage(null);

    setForm({ brand: '', model: '', year: '', odometer: '' });
    setErrors({ brand: '', model: '', year: '', odometer: '' });
    setUiState({
      yearDropdownVisible: false,
      brandFocused: false,
      modelFocused: false,
      yearFocused: false,
      odometerFocused: false,
      showDropdown: false,
      modelDropdown: false,
    });
    setFilteredData([]);
  }, [setAddVehicleModal, isLoading]);

  // Backdrop, back button and the close icon ask before throwing away input.
  const isDirty = useUnsavedChanges({ form, selectedImage });
  const [requestClose, discardDialog] = useDiscardConfirm(isDirty, handleCloseModal);

  // Save stays disabled until every required field has something in it.
  const requiredFilled =
    !!form.brand.trim() && !!form.model.trim() && !!form.year && form.odometer !== '';
  // Dimmed (saveDisabled) while incomplete, but still pressable so a tap
  // reveals which fields are missing; only saving blocks the button.
  const saveDisabled = isLoading || !requiredFilled;

  const handleSaveVehicle = useCallback(async () => {
    if (isLoading) return; // guard against double-tap

    if (!validate()) {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    setIsLoading(true);

    try {
      let uploadedImageUrl = null;

      if (selectedImage) {
        const uploadResult = await uploadImage(selectedImage);

        if (uploadResult?.success) {
          uploadedImageUrl = uploadResult.url;
        } else {
          Toast.show({
            type: 'error',
            text1: 'Image upload failed',
            text2: uploadResult?.message || 'Check your connection and try again.',
            position: 'top',
            visibilityTime: 3000,
            autoHide: true,
          });
          return;
        }
      }

      const vehicleData = {
        brand: form.brand.trim(),
        model: form.model.trim(),
        year: form.year,
        currentOdometer: Number(form.odometer) || 0,
        imageUrl: uploadedImageUrl,
      };

      const result = await addUserVehicle(userEmail, vehicleData);
      if (!result?.success) {
        Toast.show({
          type: 'error',
          text1: 'Vehicle already exists',
          text2: `${form.brand.trim()} ${form.model.trim()} (${form.year}) is already in your garage.`,
          position: 'top',
          visibilityTime: 3000,
          autoHide: true,
        });
        return;
      }

      // Refresh trigger fires only after a confirmed save
      dispatch(setTrigger(true));
      setTimeout(() => dispatch(setTrigger(false)), 300);

      onVehicleAdded?.(result.id);
      handleCloseModal();
    } catch (error) {
      console.error('Save Error:', error);
      Toast.show({
        type: 'error',
        text1: "Vehicle couldn't be saved",
        text2: 'Try again.',
        position: 'top',
        visibilityTime: 3000,
        autoHide: true,
      });
    } finally {
      setIsLoading(false);
    }
  }, [
    form,
    selectedImage,
    userEmail,
    validate,
    handleCloseModal,
    onVehicleAdded,
    dispatch,
    isLoading,
  ]);

  // ─────────────────────────────────────────────
  // Brand / model / year suggestion dropdowns
  // ─────────────────────────────────────────────
  const renderBrandDropdown = uiState.showDropdown ? (
    <SuggestionDropdown
      items={filteredData}
      query={form.brand}
      known={brands}
      onSelect={handleSelectBrand}
      onAdd={handleAddCustomBrand}
      addLabel="Brand"
    />
  ) : null;

  // Models are listed per brand, so they need a recognised brand first.
  const modelHint = !modelBrand
    ? form.brand.trim()
      ? 'Pick a brand from the list to see its models, or type the model.'
      : 'Choose a brand first to see its models.'
    : !form.model.trim() && models.length === 0
      ? `No ${modelBrand} models listed yet — type one to add it.`
      : null;

  const renderModelDropdown = uiState.modelDropdown ? (
    <SuggestionDropdown
      hint={modelHint}
      items={filteredModels}
      query={form.model}
      known={models}
      onSelect={handleSelectModel}
      onAdd={handleAddCustomModel}
      addLabel="Model"
    />
  ) : null;

  // Suggestions only — a year can't be added to the list.
  const renderYearDropdown = uiState.yearDropdownVisible ? (
    <SuggestionDropdown
      items={filteredYears}
      query={form.year}
      known={YEARS}
      onSelect={selectYear}
    />
  ) : null;


  return (
    <View style={styles.container}>
      <Modal
        isVisible={addVehicleModal}
        onBackdropPress={requestClose}
        onBackButtonPress={requestClose}
        coverScreen
        useNativeDriver={false}
        backdropTransitionOutTiming={1}
        hideModalContentWhileAnimating
        backdropOpacity={0.55}
        style={styles.modal}
        statusBarTranslucent
        animationIn="slideInUp"
        animationOut="slideOutDown"
      >
        <TouchableWithoutFeedback
          onPress={() => {
            Keyboard.dismiss();
            setUiState(prev => ({ ...prev, showDropdown: false, modelDropdown: false }));
          }}
        >
          <KeyboardAvoidingView
            behavior={behavior}
            style={[styles.sheet, shadow(4), { backgroundColor: t.sheetBg }]}
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
                <Text style={[styles.headerTitle, { color: t.text }]}>
                  Add vehicle
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
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
              nestedScrollEnabled
            >
              <DropdownHost style={styles.form} scrollRef={scrollViewRef}>
                {/* Vehicle Brand */}
                <View style={[styles.inputGroup, { zIndex: 3000 }]}>
                  <Text style={[styles.inputLabel, { color: t.label }]}>
                    Brand<Text style={{ color: ERROR_RED }}> *</Text>
                  </Text>
                  <DropdownAnchor open={!!renderBrandDropdown} dropdown={renderBrandDropdown}>
                    <View
                      style={[
                        styles.searchInputContainer,
                        {
                          backgroundColor: t.inputBg,
                          borderColor: borderFor(
                            uiState.brandFocused,
                            !!form.brand.trim(),
                            errors.brand,
                          ),
                        },
                      ]}
                    >
                      <SearchIcon
                        color={t.icon(uiState.brandFocused || !!form.brand.trim())}
                        style={styles.iconMargin}
                      />
                      <TextInput
                        style={[styles.inputWithIcon, { color: t.text }]}
                        value={form.brand}
                        onFocus={handleBrandFocus}
                        onBlur={handleBrandBlur}
                        onChangeText={handleBrandSearch}
                        placeholder="Search or type a brand"
                        placeholderTextColor={t.placeholder}
                        returnKeyType="done"
                        onSubmitEditing={Keyboard.dismiss}
                      />
                    </View>
                  </DropdownAnchor>

                  {errors.brand ? (
                    <Text style={styles.errorText}>{errors.brand}</Text>
                  ) : null}
                </View>

                {/* Vehicle Model */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: t.label }]}>
                    Model<Text style={{ color: ERROR_RED }}> *</Text>
                  </Text>
                  <DropdownAnchor open={!!renderModelDropdown} dropdown={renderModelDropdown}>
                    <View
                      style={[
                        styles.searchInputContainer,
                        {
                          backgroundColor: t.inputBg,
                          borderColor: borderFor(
                            uiState.modelFocused,
                            !!form.model.trim(),
                            errors.model,
                          ),
                        },
                      ]}
                    >
                      <TextInput
                        ref={modelInputRef}
                        style={[styles.inputWithIcon, { color: t.text }]}
                        value={form.model}
                        onFocus={() => {
                          updateFocusState('modelFocused', true);
                          setUiState(prev => ({
                            ...prev,
                            yearDropdownVisible: false,
                            showDropdown: false,
                            modelDropdown: true,
                          }));
                        }}
                        onBlur={() => updateFocusState('modelFocused', false)}
                        onChangeText={handleModelChange}
                        placeholder="e.g. Corolla, X5, Civic"
                        placeholderTextColor={t.placeholder}
                        returnKeyType="done"
                        onSubmitEditing={Keyboard.dismiss}
                      />
                    </View>
                  </DropdownAnchor>

                  {errors.model ? (
                    <Text style={styles.errorText}>{errors.model}</Text>
                  ) : null}
                </View>

                {/* Vehicle Year */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: t.label }]}>
                    Year<Text style={{ color: ERROR_RED }}> *</Text>
                  </Text>
                  <DropdownAnchor open={!!renderYearDropdown} dropdown={renderYearDropdown}>
                    <View
                      style={[
                        styles.searchInputContainer,
                        {
                          backgroundColor: t.inputBg,
                          borderColor: borderFor(
                            uiState.yearFocused,
                            !!form.year,
                            errors.year,
                          ),
                        },
                      ]}
                    >
                      <TextInput
                        style={[styles.inputWithIcon, { color: t.text }]}
                        value={form.year}
                        onFocus={() => {
                          updateFocusState('yearFocused', true);
                          setUiState(prev => ({
                            ...prev,
                            yearDropdownVisible: true,
                            showDropdown: false,
                            modelDropdown: false,
                          }));
                        }}
                        onBlur={() => updateFocusState('yearFocused', false)}
                        onChangeText={handleYearChange}
                        placeholder={`e.g. ${new Date().getFullYear()}`}
                        placeholderTextColor={t.placeholder}
                        keyboardType="number-pad"
                        maxLength={4}
                        returnKeyType="done"
                        onSubmitEditing={Keyboard.dismiss}
                      />
                    </View>
                  </DropdownAnchor>

                  {errors.year ? (
                    <Text style={styles.errorText}>{errors.year}</Text>
                  ) : null}
                </View>

                {/* Current odometer — seeds the "due in X km" checks */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: t.label }]}>
                    Current Odometer<Text style={{ color: ERROR_RED }}> *</Text>
                  </Text>
                  <View
                    style={[
                      styles.searchInputContainer,
                      {
                        backgroundColor: t.inputBg,
                        borderColor: borderFor(
                          uiState.odometerFocused,
                          !!form.odometer,
                          errors.odometer,
                        ),
                      },
                    ]}
                  >
                    <TextInput
                      style={[styles.inputWithIcon, { color: t.text }]}
                      value={kmToField(form.odometer, distUnit)}
                      onFocus={() => {
                        updateFocusState('odometerFocused', true);
                        setUiState(prev => ({
                          ...prev,
                          yearDropdownVisible: false,
                          showDropdown: false,
                          modelDropdown: false,
                        }));
                      }}
                      onBlur={() => updateFocusState('odometerFocused', false)}
                      onChangeText={v => {
                        // Stored in km; typed in the user's unit.
                        const odometer = fieldToKm(v, distUnit);
                        setForm(prev => ({ ...prev, odometer }));
                        if (odometer !== '') {
                          setErrors(prev => ({ ...prev, odometer: '' }));
                        }
                      }}
                      keyboardType="number-pad"
                      placeholder="e.g. 45000"
                      placeholderTextColor={t.placeholder}
                      returnKeyType="done"
                      onSubmitEditing={Keyboard.dismiss}
                    />
                    <Text style={[styles.odometerSuffix, { color: t.placeholder }]}>{distUnit}</Text>
                  </View>

                  {errors.odometer ? (
                    <Text style={styles.errorText}>{errors.odometer}</Text>
                  ) : null}
                </View>

                {/* Photo */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: t.label }]}>
                    Photo
                  </Text>

                  {selectedImage ? (
                    <View style={[styles.previewWrapper, shadow(2)]}>
                      <FitImage uri={selectedImage} style={styles.preview} />
                      <TouchableOpacity
                        onPress={() => setSelectedImage(null)}
                        style={styles.removePhoto}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.removePhotoText}>Remove</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={selectImage}
                        style={styles.changePhoto}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.removePhotoText}>Change</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={selectImage}
                      activeOpacity={0.8}
                      style={[styles.uploadZone, { borderColor: t.inputBorder }]}
                    >
                      <Upload color={t.icon()} />
                      <Text style={[styles.uploadText, { color: t.muted }]}>
                        Add a photo of your vehicle
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </DropdownHost>
            </ScrollView>

            {/* Sticky footer */}
            <View
              style={[
                styles.footer,
                { borderTopColor: t.divider, backgroundColor: t.sheetBg, paddingBottom: 16 + footerInset },
              ]}
            >
              <TouchableOpacity
                disabled={isLoading}
                onPress={() => {
                  Keyboard.dismiss();
                  handleSaveVehicle();
                }}
                activeOpacity={0.85}
                style={[
                  styles.saveButton,
                  shadow(3),
                  saveDisabled && { opacity: 0.5 },
                ]}
              >
                {isLoading ? (
                  <>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.saveButtonText}>Saving…</Text>
                  </>
                ) : (
                  <Text style={styles.saveButtonText}>Save Vehicle</Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
        {discardDialog}
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  // Wrapper only hosts an out-of-flow Modal; flex: 1 here would steal layout space from the parent.
  container: { position: 'absolute' },
  modal: { margin: 0, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  handleWrapper: { alignItems: 'center', paddingTop: 10 },
  handle: { width: 40, height: 4, borderRadius: 2 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
  },
  headerLeft: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  iconWell: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontFamily: 'RobotoCondensed500', fontSize: 18 },
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
  inputGroup: { gap: 8, position: 'relative' },
  inputLabel: { fontSize: 13, fontFamily: 'RobotoCondensed500' },

  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
  },
  inputWithIcon: {
    flex: 1,
    height: '100%',
    paddingVertical: 0,
    fontSize: 14,
    fontFamily: 'RobotoCondensed400',
  },
  iconMargin: { marginRight: 8 },

  // ── Photo ──
  uploadZone: {
    height: 96,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  uploadText: { fontFamily: 'RobotoCondensed400', fontSize: 13 },
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
  removePhotoText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'RobotoCondensed500',
  },

  // ── Footer ──
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
    fontFamily: 'RobotoCondensed500',
    color: '#fff',
    fontSize: 14,
  },

  odometerSuffix: { fontSize: 14, fontFamily: 'RobotoCondensed400', marginLeft: 8 },
  errorText: {
    fontSize: 12,
    fontFamily: 'RobotoCondensed400',
    color: ERROR_RED,
    marginTop: -2,
  },
});

export default AddVehicle;
