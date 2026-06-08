import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
} from 'react-native';
import Modal from 'react-native-modal';
import { launchImageLibrary } from 'react-native-image-picker';
import ToastManager, { Toast } from 'toastify-react-native';
import Car from '../assets/svg/Car.jsx';
import Camera from '../assets/svg/Camera.jsx';
import CloseIcon from '../assets/svg/CloseIcon.jsx';
import Close from '../assets/svg/Close.jsx';
import VehicleColored from '../assets/svg/VehicleColored.jsx';
import SelectIcon from '../assets/svg/SelectIcon.jsx';
import SearchIcon from '../assets/svg/SearchIcon.jsx'; // ← ADDED
import { updateUserVehicle, setTrigger } from '../store/userSlice.js';
import { useDispatch, useSelector } from 'react-redux';

const YEARS = Array.from({ length: 2026 - 1930 + 1 }, (_, i) =>
  (1930 + i).toString(),
);

/** Predefined vehicle brand options shown in the autocomplete dropdown */
const VEHICLE_MODELS = [
  'BMW', 'Toyota', 'Mercedes', 'Honda', 'Nissan', 'Hyundai',
  'Ford', 'Chevrolet', 'Kia', 'Mazda', 'Mitsubishi', 'Volkswagen',
  'Audi', 'Lexus', 'Subaru', 'Tesla', 'Volvo', 'Suzuki', 'Peugeot',
];

const VehicleUpdate = ({
  VehicleUpdateModal,
  setVehicalUpdate,
  EditValue,
  ImageUrl,
  setImageUrl,
  onVehicleUpdated,
}) => {
  const [form, setForm] = useState({ brand: '', model: '', year: '' });
  const [yearDropdownVisible, setYearDropdownVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageRemoved, setImageRemoved] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [keyboardBehavior, setKeyboardBehavior] = useState('padding');
  
  const [errors, setErrors] = useState({ brand: '', model: '', year: '' });
  const [focusedField, setFocusedField] = useState(null); // 'brand' | 'model' | 'year' | null

  // ── NEW: Brand dropdown state ─────────────────
  const [filteredData, setFilteredData] = useState([]);
  const [brandFocused, setBrandFocused] = useState(false);

  const { userEmail } = useSelector(state => state.user);

  // ── NEW: Theme support (same as AddVehicle) ───
  const { theme } = useSelector(store => store.theme);
  const isDark = theme === 'dark';

  const dispatch = useDispatch()

  // ── NEW: Dynamic styles (same as AddVehicle) ──
  const dynamicStyles = useMemo(
    () => ({
      textColor: { color: isDark ? '#fff' : '#041933' },
      placeholderColor: isDark
        ? 'rgba(255, 255, 255, 0.16)'
        : 'rgba(4, 25, 51, 0.5)',
      iconColor: (isFocused = false) =>
        isDark
          ? isFocused
            ? '#FFFFFF'
            : 'rgba(255, 255, 255, 0.5)'
          : 'rgba(4, 25, 51, 0.5)',
      borderColor: (isFocused = false, hasValue = false, defaultColor = '#EEF1F5') =>
        isFocused || hasValue
          ? 'rgba(0, 78, 171, 1)'
          : isDark
          ? 'rgba(255, 255, 255, 0.16)'
          : defaultColor,
      backgroundColor: isDark ? '#041933' : '#fff',
      dropdownBgColor: isDark ? 'rgba(9, 42, 87, 1)' : '#fff',
    }),
    [isDark],
  );

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

  // Sync form with EditValue when modal opens
  useEffect(() => {
    if (EditValue) {
      setForm({
        brand: EditValue.brand || '',
        model: EditValue.model || '',
        year: EditValue.year || '',
      });
      setSelectedImage(null);
      setImageRemoved(false);
      setErrors({ brand: '', model: '', year: '' });
      setFocusedField(null);
      setFilteredData([]); // ← Clear dropdown on open
    }
  }, [EditValue, VehicleUpdateModal]);

  // Determine which image to show: newly selected > existing > placeholder
  const displayImage = imageRemoved ? null : (selectedImage || EditValue?.imageUrl);

  const closeModal = () => {
    setVehicalUpdate(false);
    setYearDropdownVisible(false);
    setSelectedImage(null);
    setImageRemoved(false);
    setErrors({ brand: '', model: '', year: '' });
    setFocusedField(null);
    setFilteredData([]); // ← Clear dropdown on close
  };

  // ── NEW: Brand search handler (same as AddVehicle) ──
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
        : [],
    );
  }, []);

  // ── NEW: Brand selection handler (same as AddVehicle) ──
  const handleSelectBrand = useCallback(item => {
    setForm(prev => ({ ...prev, brand: item }));
    setErrors(prev => ({ ...prev, brand: '' }));
    setFilteredData([]);
  }, []);

  const selectYear = useCallback((year) => {
    setForm(prev => ({ ...prev, year }));
    setYearDropdownVisible(false);
    setErrors(prev => ({ ...prev, year: '' }));
    setFocusedField(null);
  }, []);

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

  const uploadImageToServer = async (localUri) => {
    const filename = localUri.split('/').pop();
    const formData = new FormData();

    formData.append('photo', {
      uri: localUri,
      type: 'image/jpeg',
      name: filename,
    });

    const response = await fetch(
      'https://apidailysalah.zecodeek-it.com/media/upload.php',
      {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      },
    );

    const rawText = await response.text();

    try {
      return JSON.parse(rawText);
    } catch (e) {
      console.error('Upload parse error:', rawText);
      return null;
    }
  };

  const deleteImageFromServer = async (imageUrl) => {
    if (!imageUrl) return;
    try {
      await fetch('https://apidailysalah.zecodeek-it.com/media/delete.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: imageUrl }),
      });
    } catch (e) {
      console.error('Delete image error:', e);
    }
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
      const localUri = response.assets[0].uri;
      setSelectedImage(localUri);
      setImageRemoved(false);
      if (setImageUrl) setImageUrl(null);
    }
  };

  const handleRemoveImage = () => {
    deleteImageFromServer(EditValue?.imageUrl);
    setSelectedImage(null);
    setImageRemoved(true);
    if (setImageUrl) setImageUrl(null);
  };

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
    if (!validate()) return;
  
    setIsUploading(true);
  
    try {
      let finalImageUrl = imageRemoved ? null : (EditValue?.imageUrl || null);
  
      // If user selected a new image, upload it
      if (selectedImage) {
        const uploadResult = await uploadImageToServer(selectedImage);
  
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
  
      const res = await updateUserVehicle(userEmail, EditValue?.id, updateData);
  
      if (res) {
        console.log('Data Updated Successfully!!!');
      }
  
      // ── FIXED ORDER ───────────────────────────────────────────
      // 1. Close local fields and modal UI cleanly first
      closeModal();
      dispatch(setTrigger(false));
  
      // 2. Alert parent components to update state AFTER modal closure begins
      if (onVehicleUpdated) {
        // Use setTimeout to ensure the React Native modal animation/state transition 
        // processes without blocking parent rendering pipeline updates
        setTimeout(async () => {
          await onVehicleUpdated();
        }, 100);
      }
      // ──────────────────────────────────────────────────────────
      
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
  }, [form, selectedImage, imageRemoved, EditValue, userEmail, validate, onVehicleUpdated, dispatch]);
  // Helper to determine border color for inputs
  // Priority: Error > Focused or Has Value > Default
  const getInputBorderColor = (fieldName) => {
    if (errors[fieldName]) return 'rgba(211, 47, 47, 1)';
    if (focusedField === fieldName || form[fieldName]) return '#004EAB';
    return '#ccc';
  };

  // ── NEW: Memoized brand dropdown (same as AddVehicle) ──
  const renderBrandDropdown = useMemo(
    () =>
      filteredData.length > 0 && (
        <View
          style={[
            styles.brandDropdown,
            { backgroundColor: dynamicStyles.dropdownBgColor },
          ]}
        >
          <ScrollView
            nestedScrollEnabled
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="always"
          >
            {filteredData.map((item, index) => (
              <TouchableOpacity
                style={[
                  styles.dropdownItemWrapper,
                  index === 0 && styles.firstDropdownItem,
                  index === 0 && {
                    backgroundColor: isDark
                      ? 'rgba(4, 25, 51, 0.5)'
                      : 'rgba(0, 78, 171, 0.06)',
                  },
                ]}
                key={index}
                onPress={() => handleSelectBrand(item)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.dropdownItem,
                    {
                      fontFamily:
                        index === 0 ? 'RobotoCondensed500' : 'RobotoCondensed300',
                    },
                    dynamicStyles.textColor,
                  ]}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ),
    [filteredData, dynamicStyles, handleSelectBrand, isDark],
  );

  return (
    <View style={styles.container}>
      <ToastManager />
      <Modal
        coverScreen={true}
        useNativeDriver={false}
        backdropTransitionOutTiming={1}
        hideModalContentWhileAnimating={true}
        backdropOpacity={0.6}
        statusBarTranslucent={true}
        avoidKeyboard={true}
        isVisible={VehicleUpdateModal}
        onBackdropPress={closeModal}
        onBackButtonPress={closeModal}
        style={styles.modal}
        animationIn="slideInUp"
        animationOut="slideOutDown"
      >
        <KeyboardAvoidingView
          behavior={keyboardBehavior}
          style={[styles.modalView, { backgroundColor: dynamicStyles.backgroundColor }]}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalInner}>

              {/* ── Header ─────────────────────────────────── */}
              <View style={styles.header}>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <Car color={dynamicStyles.textColor.color} />
                  <Text style={[styles.headerTitle, dynamicStyles.textColor]}>Edit Vehicle</Text>
                </View>
                <TouchableOpacity onPress={closeModal}>
                  <CloseIcon />
                </TouchableOpacity>
              </View>

              {/* ── Vehicle Image ───────────────────────────── */}
              <View style={{ justifyContent: 'center', alignItems: 'center' }}>
                {!displayImage ? (
                  <TouchableOpacity
                    style={styles.imagePlaceholder}
                    onPress={handleSelectImage}
                    activeOpacity={0.7}
                  >
                    <View style={styles.cameraBadge}>
                      <Camera />
                    </View>
                    <VehicleColored />
                  </TouchableOpacity>
                ) : (
                  <View>
                    <Image
                      style={styles.vehicleImage}
                      source={{ uri: displayImage }}
                    />
                    <TouchableOpacity
                      onPress={handleRemoveImage}
                      style={styles.removeImageBadge}
                    >
                      <Close />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* ── Vehicle Brand ────────────────────────────── */}
              {/* UPDATED: Now with search icon + autocomplete dropdown */}
              <View style={[styles.inputGroup, { zIndex: 2, elevation: 2 }]}>
                <Text style={[styles.label, dynamicStyles.textColor]}>Vehicle Brand*</Text>

                <View
                  style={[
                    styles.searchInputContainer,
                    {
                      borderColor: errors.brand
                        ? 'rgba(211, 47, 47, 1)'
                        : dynamicStyles.borderColor(brandFocused, form.brand.trim()),
                    },
                  ]}
                >
                  {/* <SearchIcon
                    color={
                      brandFocused || form.brand.trim()
                        ? 'rgba(4, 25, 51, 1)'
                        : 'rgba(4, 25, 51, 0.5)'
                    }
                    style={styles.iconMargin}
                  /> */}
                  <TextInput
                    style={[styles.inputWithIcon, dynamicStyles.textColor]}
                    value={form.brand}
                    onFocus={() => {
                      setBrandFocused(true);
                      setFocusedField('brand');
                    }}
                    onBlur={() => {
                      setBrandFocused(false);
                      setFocusedField(null);
                    }}
                    onChangeText={handleBrandSearch}
                    placeholder="Search Brand"
                    placeholderTextColor={dynamicStyles.placeholderColor}
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                  />
                </View>

                {/* Autocomplete dropdown */}
                {renderBrandDropdown}

                {errors.brand ? <Text style={styles.errorText}>{errors.brand}</Text> : null}
              </View>

              {/* ── Vehicle Model ────────────────────────────── */}
              <View style={[styles.inputGroup, { zIndex: 1, elevation: 1 }]}>
                <Text style={[styles.label, dynamicStyles.textColor]}>Vehicle Model*</Text>
                
                <TextInput
                  value={form.model}
                  onChangeText={text => {
                    setForm(prev => ({ ...prev, model: text }));
                    setErrors(prev => ({ ...prev, model: '' }));
                  }}
                  onFocus={() => setFocusedField('model')}
                  onBlur={() => setFocusedField(null)}
                  style={[
                    styles.input,
                    { borderColor: getInputBorderColor('model') },
                  ]}
                  placeholder="Enter model"
                  placeholderTextColor={dynamicStyles.placeholderColor}
                />
                {errors.model ? <Text style={styles.errorText}>{errors.model}</Text> : null}
              </View>

              {/* ── Vehicle Year ─────────────────────────────── */}
              <View style={[styles.inputGroup]}>
                <Text style={[styles.label, dynamicStyles.textColor]}>Vehicle Year*</Text>

                <TouchableOpacity
                  style={[
                    styles.yearInputContainer,
                    { borderColor: getInputBorderColor('year') },
                  ]}
                  onPress={() => {
                    setYearDropdownVisible(prev => !prev);
                    setFocusedField('year');
                  }}
                  activeOpacity={1}
                >
                  <Text style={{
                    flex: 1,
                    color: form.year ? dynamicStyles.textColor.color : dynamicStyles.placeholderColor,
                    fontFamily: 'RobotoCondensed400',
                    fontSize: 14,
                  }}>
                    {form.year || 'Select year'}
                  </Text>
                  <SelectIcon color={dynamicStyles.iconColor()} />
                </TouchableOpacity>

                {errors.year ? <Text style={styles.errorText}>{errors.year}</Text> : null}

                {yearDropdownVisible && (
                  <View style={[
                    styles.yearDropdown,
                    {
                      backgroundColor: dynamicStyles.dropdownBgColor,
                      borderColor: dynamicStyles.borderColor(),
                    },
                  ]}>
                    <ScrollView
                      nestedScrollEnabled
                      showsVerticalScrollIndicator
                      keyboardShouldPersistTaps="always"
                      style={{ height: 110 }}
                    >
                      {YEARS.map(year => (
                        <TouchableOpacity
                          key={year}
                          onPress={() => selectYear(year)}
                          style={styles.yearDropdownItem}
                        >
                          <Text style={[styles.yearDropdownText, dynamicStyles.textColor]}>{year}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* ── Update Button ────────────────────────────── */}
              
              <TouchableOpacity
                style={[styles.button, isUploading ? styles.buttonDisabled : null]}
                onPress={handleUpdateVehicle}
                disabled={isUploading}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>
                  {isUploading ? 'Updating...' : 'Update Vehicle'}
                </Text>
              </TouchableOpacity>

            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

export default VehicleUpdate;

const styles = StyleSheet.create({
  container: { flex: 1 },

  modal: {
    margin: 0,
    justifyContent: 'flex-end',
  },

  modalView: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '90%',
  },

  scrollContent: {
    flexGrow: 1,
    overflow: 'visible',
  },

  modalInner: {
    padding: 20,
    gap: 16,
    overflow: 'visible',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  headerTitle: {
    fontFamily: 'RobotoCondensed400',
    fontSize: 18,
  },

  imagePlaceholder: {
    height: 60,
    width: 70,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 12,
    position: 'relative',
    borderColor: '#EEF1F5',
  },

  cameraBadge: {
    height: 16,
    width: 16,
    borderRadius: 8,
    backgroundColor: '#004EAB',
    position: 'absolute',
    top: -4,
    right: -4,
    justifyContent: 'center',
    alignItems: 'center',
  },

  vehicleImage: {
    height: 60,
    width: 70,
    borderRadius: 12,
  },

  removeImageBadge: {
    height: 16,
    width: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fff',
    backgroundColor: '#004EAB',
    position: 'absolute',
    top: -4,
    right: -4,
    justifyContent: 'center',
    alignItems: 'center',
  },

  inputGroup: {
    gap: 6,
    overflow: 'visible',
  },

  label: {
    fontFamily: 'RobotoCondensed400',
    fontSize: 14,
  },

  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 10,
    fontFamily: 'RobotoCondensed400',
  },

  inputError: {
    borderColor: 'rgba(211, 47, 47, 1)',
  },

  errorText: {
    fontSize: 12,
    fontFamily: 'RobotoCondensed300',
    color: 'rgba(211, 47, 47, 1)',
    marginTop: 2,
  },

  // ── NEW: Brand search input (same as AddVehicle) ──
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
  },

  inputWithIcon: {
    flex: 1,
    height: '100%',
    paddingVertical: 0,
    fontFamily: 'RobotoCondensed400',
    fontSize: 14,
  },

  iconMargin: {
    marginRight: 4,
  },

  // ── NEW: Brand dropdown (same as AddVehicle) ──
  brandDropdown: {
    maxHeight: 120,
    position: 'absolute',
    top: 70,
    left: 0,
    right: 0,
    borderRadius: 12,
    padding: 8,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    zIndex: 101,
  },

  dropdownItemWrapper: {
    borderRadius: 5,
  },

  firstDropdownItem: {
    borderRadius: 5,
  },

  dropdownItem: {
    paddingVertical: 8,
    paddingHorizontal: 6,
    fontSize: 12,
  },

  yearInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 44,
  },

  yearDropdown: {
    top: 0,
    left: 0,
    right: 0,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEF1F5',
    padding: 8,
    elevation: 100,
    zIndex: 100,
  },

  yearDropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },

  yearDropdownText: {
    fontFamily: 'RobotoCondensed300',
    fontSize: 12,
  },

  button: {
    backgroundColor: '#004EAB',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  buttonText: {
    color: '#FFFFFF',
    fontFamily: 'RobotoCondensed400',
  },
});