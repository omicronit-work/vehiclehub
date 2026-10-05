import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  FlatList,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  PermissionsAndroid,
  Image,
  Dimensions,
  ActivityIndicator,
  Modal as RNModal,
} from 'react-native';
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useTheme } from '../util/methods/useTheme';
import { useUnsavedChanges, confirmDiscard } from '../util/methods/useUnsavedChanges';
import Modal from 'react-native-modal';
import { launchImageLibrary } from 'react-native-image-picker';
import { useDispatch, useSelector } from 'react-redux';

// SVG icon components
import Car from '../assets/svg/Car';
import CloseX from '../assets/svg/CloseX.jsx';
import SearchIcon from '../assets/svg/SearchIcon.jsx';
import SelectIcon from '../assets/svg/SelectIcon.jsx';
import Upload from '../assets/svg/Upload.jsx';

import { addUserVehicle } from '../store/userSlice.js';
import { Toast } from 'toastify-react-native';
import { setaddVehicalModalRd } from '../store/userSlice.js';
import { setTrigger } from '../store/userSlice.js';
import { uploadImage } from '../util/imageStorage';
import { shadow } from '../theme/tokens';
import { accent } from '../theme/accent';

const { height: SCREEN_H } = Dimensions.get('window');

const NAVY = 'rgba(4, 25, 51, 1)';
const ERROR_RED = 'rgba(211, 47, 47, 1)';

// Premium shadow profile — matches Vehicle.jsx / VehicleInformations.jsx

/* Newest-first: virtually everyone is adding a recent car, so 2026 sits
   at the top of the list instead of 1930. */
const YEARS = Array.from({ length: 2026 - 1930 + 1 }, (_, i) => (2026 - i).toString());

const VEHICLE_MODELS = [
  'BMW', 'Toyota', 'Mercedes', 'Honda', 'Nissan', 'Hyundai',
  'Ford', 'Chevrolet', 'Kia', 'Mazda', 'Mitsubishi', 'Volkswagen',
  'Audi', 'Lexus', 'Subaru', 'Tesla', 'Volvo', 'Suzuki', 'Peugeot',
];

const DROPDOWN_MAX_HEIGHT = 220;

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
  const { userEmail, VehicalModal } = useSelector(state => state.user);
  const isDark = useTheme();
  const scrollViewRef = useRef(null);
  const modelInputRef = useRef(null);
  const yearAnchorRef = useRef(null);
  const behavior = useBehavior();
  const dispatch = useDispatch();

  // ── Form State ────────────────────────────────
  const [form, setForm] = useState({ brand: '', model: '', year: '' });
  const [selectedImage, setSelectedImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const [yearAnchor, setYearAnchor] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [errors, setErrors] = useState({ brand: '', model: '', year: '' });

  const [uiState, setUiState] = useState({
    yearDropdownVisible: false,
    brandFocused: false,
    modelFocused: false,
    showDropdown: false,
  });

  const [filteredData, setFilteredData] = useState([]);

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
      dropdownBg: isDark ? '#0F2C52' : '#fff',
      dropdownBorder: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(4,25,51,0.08)',
      dropdownHighlight: isDark ? accent.lightAlpha(0.18) : accent.alpha(0.06),
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
    if (hasValue) return isDark ? accent.lightAlpha(0.5) : accent.alpha(0.4);
    return t.inputBorder;
  };

  // ─────────────────────────────────────────────
  // Validation
  // ─────────────────────────────────────────────
  const validate = useCallback(() => {
    const newErrors = {
      brand: form.brand.trim() ? '' : 'Enter or pick a brand.',
      model: form.model.trim() ? '' : 'Enter the model.',
      year: form.year ? '' : 'Select the year.',
    };
    setErrors(newErrors);
    return Object.values(newErrors).every(e => e === '');
  }, [form]);

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

  // ─────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────
  const handleYearInputPress = useCallback(() => {
    Keyboard.dismiss();
    if (uiState.yearDropdownVisible) {
      setUiState(prev => ({ ...prev, yearDropdownVisible: false }));
      return;
    }
    yearAnchorRef.current?.measureInWindow((x, y, width, height) => {
      setYearAnchor({ x, y, width, height });
      setUiState(prev => ({ ...prev, yearDropdownVisible: true }));
    });
  }, [uiState.yearDropdownVisible]);

  const closeYearDropdown = useCallback(() => {
    setUiState(prev => ({ ...prev, yearDropdownVisible: false }));
  }, []);

  const selectYear = useCallback(year => {
    setForm(prev => ({ ...prev, year }));
    setErrors(prev => ({ ...prev, year: '' }));
    setUiState(prev => ({ ...prev, yearDropdownVisible: false }));
  }, []);

  const handleBrandSearch = useCallback(text => {
    setForm(prev => ({ ...prev, brand: text }));

    if (text.trim()) {
      setErrors(prev => ({ ...prev, brand: '' }));
    }

    setFilteredData(
      text.length > 0
        ? VEHICLE_MODELS.filter(item =>
            item.toLowerCase().includes(text.toLowerCase()),
          )
        : VEHICLE_MODELS,
    );
    setUiState(prev => ({ ...prev, showDropdown: true }));
  }, []);

  const handleBrandFocus = useCallback(() => {
    updateFocusState('brandFocused', true);
    setUiState(prev => ({ ...prev, yearDropdownVisible: false, showDropdown: true }));

    setFilteredData(
      form.brand.length > 0
        ? VEHICLE_MODELS.filter(item =>
            item.toLowerCase().includes(form.brand.toLowerCase()),
          )
        : VEHICLE_MODELS,
    );
  }, [form.brand, updateFocusState]);

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
    setErrors(prev => ({ ...prev, brand: '' }));
    setFilteredData([]);
    setUiState(prev => ({ ...prev, showDropdown: false }));

    setTimeout(() => {
      modelInputRef.current?.focus();
    }, 100);
  }, []);

  const handleModelChange = useCallback(text => {
    setForm(prev => ({ ...prev, model: text }));

    if (text.trim()) {
      setErrors(prev => ({ ...prev, model: '' }));
    }
  }, []);

  const handleCloseModal = useCallback(() => {
    if (isLoading) return; // don't dismiss mid-save
    Keyboard.dismiss();
    setAddVehicleModal(false);
    setSelectedImage(null);
    dispatch(setaddVehicalModalRd(false));

    setForm({ brand: '', model: '', year: '' });
    setErrors({ brand: '', model: '', year: '' });
    setUiState({
      yearDropdownVisible: false,
      brandFocused: false,
      modelFocused: false,
      showDropdown: false,
    });
    setFilteredData([]);
  }, [setAddVehicleModal, dispatch, isLoading]);

  // Backdrop, back button and the close icon ask before throwing away input.
  const isDirty = useUnsavedChanges({ form, selectedImage });
  const requestClose = () => confirmDiscard(isDirty, handleCloseModal);

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
        const uploadResult = await uploadImage(selectedImage, 'vehicles');

        if (uploadResult?.success) {
          uploadedImageUrl = uploadResult.url;
        } else {
          Toast.show({
            type: 'error',
            text1: 'Image upload failed',
            text2: 'Check your connection and try again.',
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

      onVehicleAdded?.();
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
  // Brand dropdown
  // ─────────────────────────────────────────────
  const renderBrandDropdown = useMemo(() => {
    if (!uiState.showDropdown) return null;

    const inputClean = form.brand.trim();
    const exactMatch = VEHICLE_MODELS.some(
      item => item.toLowerCase() === inputClean.toLowerCase(),
    );

    if (inputClean.length > 0 && filteredData.length === 0 && !exactMatch) {
      return (
        <View
          style={[
            styles.brandDropdown,
            { backgroundColor: t.dropdownBg, borderColor: t.dropdownBorder },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleAddCustomBrand}
            style={styles.customAddWrapper}
          >
            <Text style={[styles.dropdownItemText, { color: t.text }]}>
              {form.brand}
            </Text>
            <Text style={[styles.addActionText, { color: t.accent }]}>
              Use this brand
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (filteredData.length === 0) return null;

    return (
      <View
        style={[
          styles.brandDropdown,
          { backgroundColor: t.dropdownBg, borderColor: t.dropdownBorder },
        ]}
      >
        <FlatList
          data={filteredData}
          keyExtractor={(item, index) => `${item}-${index}`}
          nestedScrollEnabled
          showsVerticalScrollIndicator
          keyboardShouldPersistTaps="always"
          style={styles.brandDropdownScroll}
          renderItem={({ item, index }) => {
            const highlighted = index === 0 && form.brand.trim();
            return (
              <TouchableOpacity
                style={[
                  styles.dropdownItem,
                  highlighted && { backgroundColor: t.dropdownHighlight },
                ]}
                onPress={() => handleSelectBrand(item)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.dropdownItemText,
                    {
                      color: t.text,
                      fontFamily: highlighted
                        ? 'RobotoCondensed500'
                        : 'RobotoCondensed400',
                    },
                  ]}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    );
  }, [uiState.showDropdown, filteredData, t, handleSelectBrand, handleAddCustomBrand, form.brand]);

  const dropdownTop = useMemo(
    () => yearAnchor.y + yearAnchor.height + 4,
    [yearAnchor],
  );

  const dropdownMaxHeight = useMemo(() => {
    const below = yearAnchor.y + yearAnchor.height + 4;
    const space = SCREEN_H - below - 8;
    return Math.min(DROPDOWN_MAX_HEIGHT, Math.max(120, space));
  }, [yearAnchor]);

  const isValid = form.year.trim() && form.brand.trim() && form.model.trim();

  return (
    <View style={styles.container}>
      <Modal
        isVisible={addVehicleModal || VehicalModal}
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
            setUiState(prev => ({ ...prev, showDropdown: false }));
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
              <View style={styles.form}>
                {/* Vehicle Brand */}
                <View style={[styles.inputGroup, { zIndex: 3000 }]}>
                  <Text style={[styles.inputLabel, { color: t.label }]}>
                    Brand<Text style={{ color: ERROR_RED }}> *</Text>
                  </Text>
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

                  {renderBrandDropdown}

                  {errors.brand ? (
                    <Text style={styles.errorText}>{errors.brand}</Text>
                  ) : null}
                </View>

                {/* Vehicle Model */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: t.label }]}>
                    Model<Text style={{ color: ERROR_RED }}> *</Text>
                  </Text>
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

                  {errors.model ? (
                    <Text style={styles.errorText}>{errors.model}</Text>
                  ) : null}
                </View>

                {/* Vehicle Year */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: t.label }]}>
                    Year<Text style={{ color: ERROR_RED }}> *</Text>
                  </Text>
                  <TouchableOpacity
                    ref={yearAnchorRef}
                    collapsable={false}
                    style={[
                      styles.searchInputContainer,
                      {
                        backgroundColor: t.inputBg,
                        borderColor: borderFor(
                          uiState.yearDropdownVisible,
                          !!form.year,
                          errors.year,
                        ),
                      },
                    ]}
                    onPress={handleYearInputPress}
                  >
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 14,
                        fontFamily: 'RobotoCondensed400',
                        color: form.year ? t.text : t.placeholder,
                      }}
                    >
                      {form.year || 'Select year'}
                    </Text>
                    <SelectIcon color={t.icon(uiState.yearDropdownVisible)} />
                  </TouchableOpacity>

                  {errors.year ? (
                    <Text style={styles.errorText}>{errors.year}</Text>
                  ) : null}
                </View>

                {/* Photo */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: t.label }]}>
                    Photo
                  </Text>

                  {selectedImage ? (
                    <View style={[styles.previewWrapper, shadow(2)]}>
                      <Image source={{ uri: selectedImage }} style={styles.preview} />
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
                
              </View>
            </ScrollView>

            {/* Sticky footer */}
            <View
              style={[
                styles.footer,
                { borderTopColor: t.divider, backgroundColor: t.sheetBg },
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
                  (!isValid || isLoading) && { opacity: 0.5 },
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
      </Modal>

      {/* ── Anchored, scrollable Year dropdown ── */}
      <RNModal
        visible={uiState.yearDropdownVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeYearDropdown}
      >
        <TouchableWithoutFeedback onPress={closeYearDropdown}>
          <View style={styles.overlayFill}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View
                style={[
                  styles.overlayDropdown,
                  {
                    top: dropdownTop,
                    left: yearAnchor.x,
                    width: yearAnchor.width,
                    maxHeight: dropdownMaxHeight,
                    backgroundColor: t.dropdownBg,
                    borderColor: t.dropdownBorder,
                  },
                ]}
              >
                <FlatList
                  data={YEARS}
                  keyExtractor={item => item}
                  showsVerticalScrollIndicator
                  initialScrollIndex={Math.max(0, YEARS.indexOf(form.year))}
                  getItemLayout={(_, index) => ({
                    length: 44,
                    offset: 44 * index,
                    index,
                  })}
                  renderItem={({ item: year }) => {
                    const selected = form.year === year;
                    return (
                      <TouchableOpacity
                        onPress={() => selectYear(year)}
                        style={[
                          styles.overlayItem,
                          selected && { backgroundColor: t.selectedYearBg },
                        ]}
                      >
                        <Text
                          style={[
                            styles.overlayItemText,
                            { color: t.text },
                            selected && { fontFamily: 'RobotoCondensed500' },
                          ]}
                        >
                          {year}
                        </Text>
                      </TouchableOpacity>
                    );
                  }}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </RNModal>
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
    borderWidth: 1,
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

  // ── Brand autocomplete dropdown ──
  brandDropdown: {
    position: 'absolute',
    top: 78,
    left: 0,
    right: 0,
    borderRadius: 12,
    borderWidth: 1,
    zIndex: 1000,
    elevation: 8,
    shadowColor: '#0A2A55',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    overflow: 'hidden',
  },
  brandDropdownScroll: { maxHeight: 176 },
  dropdownItem: {
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  dropdownItemText: { fontSize: 14 },
  customAddWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: 14,
  },
  addActionText: {
    fontFamily: 'RobotoCondensed500',
    fontSize: 13,
  },

  // ── Year overlay dropdown ──
  overlayFill: { flex: 1 },
  overlayDropdown: {
    position: 'absolute',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 4,
    elevation: 12,
    shadowColor: '#0A2A55',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    overflow: 'hidden',
  },
  overlayItem: {
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  overlayItemText: { fontFamily: 'RobotoCondensed400', fontSize: 14 },

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

  errorText: {
    fontSize: 12,
    fontFamily: 'RobotoCondensed400',
    color: ERROR_RED,
    marginTop: -2,
  },
});

export default AddVehicle;
