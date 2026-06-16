import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  PermissionsAndroid,
  Image,
} from 'react-native';
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import Modal from 'react-native-modal';
import { launchImageLibrary } from 'react-native-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDispatch, useSelector } from 'react-redux';

// SVG icon components
import Car from '../assets/svg/Car';
import CloseIcon from '../assets/svg/CloseIcon.jsx';
import Close from '../assets/svg/Close.jsx'
import SearchIcon from '../assets/svg/SearchIcon.jsx';
import SelectIcon from '../assets/svg/SelectIcon.jsx';
import Upload from '../assets/svg/Upload.jsx';

import { addUserVehicle } from '../store/userSlice.js';
import { Toast } from 'toastify-react-native';
import { setaddVehicalModalRd } from '../store/userSlice.js';
import { setTrigger } from '../store/userSlice.js';

/** Year list from 1930 up to 2026 (inclusive), used in the year picker dropdown */
const YEARS = Array.from({ length: 2026 - 1930 + 1 }, (_, i) => (1930 + i).toString());

/** Predefined vehicle brand options shown in the autocomplete dropdown */
const VEHICLE_MODELS = [
  'BMW', 'Toyota', 'Mercedes', 'Honda', 'Nissan', 'Hyundai',
  'Ford', 'Chevrolet', 'Kia', 'Mazda', 'Mitsubishi', 'Volkswagen',
  'Audi', 'Lexus', 'Subaru', 'Tesla', 'Volvo', 'Suzuki', 'Peugeot',
];

// ─────────────────────────────────────────────
// Custom Hook: useBehavior
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

const useTheme = () => {
  const { theme } = useSelector(store => store.theme);
  const [cachedTheme, setCachedTheme] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem('theme').then(setCachedTheme);
  }, [theme]);

  const isDark = useMemo(
    () => theme === 'dark' || cachedTheme === 'dark',
    [theme, cachedTheme],
  );

  return { isDark, theme: isDark ? 'dark' : 'light' };
};

const AddVehicle = ({
  addVehicleModal,
  setAddVehicleModal,
  onVehicleAdded
}) => {
  const { userEmail, VehicalModal } = useSelector((state) => state.user);
  const { isDark } = useTheme();
  const scrollViewRef = useRef(null);
  const modelInputRef = useRef(null);
  const behavior = useBehavior();
  const dispatch = useDispatch();

  // ── Form State ────────────────────────────────
  const [form, setForm] = useState({ brand: '', model: '', year: '' });
  const [selectedImage, setSelectedImage] = useState(null);
  const [isLoading, setisLoading] =useState(false)
  
  // ── Validation Error State ────────────────────
  const [errors, setErrors] = useState({ brand: '', model: '', year: '' });

  // ── UI State ──────────────────────────────────
  const [uiState, setUiState] = useState({
    yearDropdownVisible: false,
    brandFocused: false,
    modelFocused: false,
    showDropdown: false, // Added to tightly control dropdown visibility
  });

  const [filteredData, setFilteredData] = useState([]);

  // ─────────────────────────────────────────────
  // Memoized Dynamic Styles
  // ─────────────────────────────────────────────
  const dynamicStyles = useMemo(
    () => ({
      textColor: { color: isDark ? '#fff' : '#041933' },
      placeholderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(4, 25, 51, 0.5)',
      iconColor: (isFocused = false) =>
        isDark
          ? isFocused ? '#FFFFFF' : 'rgba(255, 255, 255, 0.5)'
          : 'rgba(4, 25, 51, 0.5)',
      borderColor: (isFocused = false, hasValue = false, defaultColor = '#EEF1F5') =>
        isFocused || hasValue
          ? 'rgba(0, 78, 171, 1)'
          : isDark ? 'rgba(255, 255, 255, 0.16)' : defaultColor,
      backgroundColor: isDark ? '#041933' : '#fff',
      dropdownBgColor: isDark ? 'rgba(9, 42, 87, 1)' : '#fff',
    }),
    [isDark],
  );

  const updateFocusState = useCallback((field, value) => {
    setUiState(prev => ({ ...prev, [field]: value }));
  }, []);

  // ─────────────────────────────────────────────
  // Validation
  // ─────────────────────────────────────────────
  const validate = useCallback(() => {
    const newErrors = {
      brand: form.brand.trim() ? '' : 'Vehicle brand is required.',
      model: form.model.trim() ? '' : 'Vehicle model is required.',
      year: form.year ? '' : 'Vehicle year is required.',
    };
    setErrors(newErrors);
    return Object.values(newErrors).every(e => e === '');
  }, [form]);

  const requestPermission = async () => {
    if (Platform.OS !== 'android') return true;
  
    if (Platform.Version >= 33) {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
      );
      return result === PermissionsAndroid.RESULTS.GRANTED;
    } else {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
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
  
    const response = await fetch('https://apidailysalah.zecodeek-it.com/media/upload.php', {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  
    const rawText = await response.text();
    console.log('Server raw response:', rawText);
    console.log('Status code:', response.status);
  
    try {
      return JSON.parse(rawText);
    } catch (e) {
      console.error('Not JSON. Server said:', rawText);
      return null;
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
      const localUri = response.assets[0].uri;
      setSelectedImage(localUri);
    }
  };

  // ─────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────
  
  const handleYearInputPress = useCallback(() => {
    Keyboard.dismiss();
    setUiState(prev => ({
      ...prev,
      yearDropdownVisible: !prev.yearDropdownVisible, 
    }));
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
    // Removed the fast setTimeout that was breaking your custom clicks
  }, [updateFocusState]);
  
  const handleSelectBrand = useCallback(item => {
    setForm(prev => ({ ...prev, brand: item }));
    setErrors(prev => ({ ...prev, brand: '' }));
    setFilteredData([]);
    setUiState(prev => ({ ...prev, showDropdown: false }));
    
    // Smoothly focus next field now that choice is settled
    setTimeout(() => {
      modelInputRef.current?.focus();
    }, 100);
  }, []);

  const handleAddCustomBrand = useCallback(() => {
    setErrors(prev => ({ ...prev, brand: '' }));
    setFilteredData([]);
    setUiState(prev => ({ ...prev, showDropdown: false }));
    
    // Locks custom string and moves field focus cleanly
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
  }, [setAddVehicleModal, dispatch]);

  const handleSaveVehicle = useCallback(async () => {
    if (!validate()) return;
  
    try {
      let uploadedImageUrl = null;
  
      if (selectedImage) {
        const uploadResult = await uploadImageToServer(selectedImage);
  
        if (uploadResult?.success) {
          uploadedImageUrl = uploadResult.url;
          console.log('Uploaded URL:', uploadedImageUrl);
        } else {
          console.warn('Upload failed:', uploadResult);
          Toast.show({
            type: 'error',
            text1: 'Image upload failed',
            position: 'top',
            visibilityTime: 3000,
            autoHide: true,
          });
          return;
        }
      }
  
      const vehicleData = {
        brand: form.brand,
        model: form.model,
        year: form.year,
        imageUrl: uploadedImageUrl,
      };
       setisLoading(true)
      const result = await addUserVehicle(userEmail, vehicleData);
      console.log('Database Insert Result::', result.message);
      setisLoading(false)
      
       
  
      onVehicleAdded?.();
      handleCloseModal();
  
    } catch (error) {
      console.error('Save Error:', error);
      
    }
  }, [form, selectedImage, userEmail, validate, handleCloseModal, onVehicleAdded]);

  // ─────────────────────────────────────────────
  // Memoized Sub-renders
  // ─────────────────────────────────────────────
  const renderYearDropdown = useMemo(
    () =>
      uiState.yearDropdownVisible && (
        <View
          style={[
            styles.yearDropdown,
            {
              borderColor: dynamicStyles.borderColor(),
              backgroundColor: dynamicStyles.dropdownBgColor,
            },
          ]}
        >
          <ScrollView 
            nestedScrollEnabled 
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="always"
          >
            {YEARS.map(year => (
              <TouchableOpacity
                key={year}
                onPress={() => selectYear(year)}
                style={styles.yearDropdownItem}
              >
                <Text style={[styles.yearDropdownText, dynamicStyles.textColor]}>
                  {year}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ),
    [uiState.yearDropdownVisible, dynamicStyles, selectYear],
  );

  const renderBrandDropdown = useMemo(() => {
    if (!uiState.showDropdown) return null;

    const inputClean = form.brand.trim();
    const exactMatch = VEHICLE_MODELS.some(
      item => item.toLowerCase() === inputClean.toLowerCase()
    );

    // Show "Add" layout option when there is custom text and no matches are left
    if (inputClean.length > 0 && filteredData.length === 0 && !exactMatch) {
      return (
        <View style={[styles.yearDropdown, { backgroundColor: dynamicStyles.dropdownBgColor }]}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleAddCustomBrand}
            style={styles.dropdownItemWrapper}
          >
            <View style={styles.customAddWrapper}>
              <Text style={[styles.dropdownItem, dynamicStyles.textColor, { fontFamily: 'RobotoCondensed400' }]}>
                {form.brand}
              </Text>
              <Text style={styles.addActionText}>
                Add
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      );
    }

    if (filteredData.length === 0) return null;

    return (
      <View
        style={[
          styles.yearDropdown,
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
                index === 0 && form.brand.trim() && styles.firstDropdownItem,
                index === 0 && form.brand.trim() && {
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
                      index === 0 && form.brand.trim()
                        ? 'RobotoCondensed500'
                        : 'RobotoCondensed300',
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
    );
  }, [uiState.showDropdown, filteredData, dynamicStyles, handleSelectBrand, handleAddCustomBrand, isDark, form.brand]);

  const isValid = form.year.trim() && form.brand.trim() && form.model.trim();

  return (
    <View style={styles.container}>
      <Modal
        isVisible={addVehicleModal || VehicalModal}
        onBackdropPress={handleCloseModal}
        onBackButtonPress={handleCloseModal}
        coverScreen={true}
        useNativeDriver={false}
        backdropTransitionOutTiming={1}
        hideModalContentWhileAnimating={true}
        backdropOpacity={0.6}
        style={styles.modal}
        statusBarTranslucent={true}
        animationIn="slideInUp"
        animationOut="slideOutDown"
        avoidKeyboard={true}
      >
        <TouchableWithoutFeedback onPress={() => {
          Keyboard.dismiss();
          setUiState(prev => ({ ...prev, yearDropdownVisible: false, showDropdown: false }));
        }}>
          <KeyboardAvoidingView
            behavior={behavior}
            style={[
              styles.modalView,
              { backgroundColor: dynamicStyles.backgroundColor },
            ]}
          >
            <ScrollView
              ref={scrollViewRef}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              <View style={styles.modalInner}>

                {/* Header */}
                <View style={styles.header}>
                  <View style={styles.headerLeft}>
                    <Car color={dynamicStyles.textColor.color} />
                    <Text style={[styles.headerTitle, dynamicStyles.textColor]}>
                      Add Vehicle
                    </Text>
                  </View>
                  <TouchableOpacity onPress={handleCloseModal}>
                    <CloseIcon />
                  </TouchableOpacity>
                </View>

                {/* Form */}
                <View style={styles.form}>

                  {/* Vehicle Brand */}
                  <View style={[styles.inputGroup, { zIndex: 3000 }]}>
                    <Text style={[styles.inputLabel, dynamicStyles.textColor]}>
                      Vehicle Brand*
                    </Text>
                    <View
                      style={[
                        styles.searchInputContainer,
                        {
                          borderColor: errors.brand
                            ? 'rgba(211, 47, 47, 1)'
                            : dynamicStyles.borderColor(uiState.brandFocused, form.brand.trim()),
                        },
                      ]}
                    >
                      <SearchIcon
                        color={
                          uiState.brandFocused || form.brand.trim()
                            ? 'rgba(4, 25, 51, 1)'
                            : 'rgba(4, 25, 51, 0.5)'
                        }
                        style={styles.iconMargin}
                      />
                      <TextInput
                        style={[styles.inputWithIcon, dynamicStyles.textColor]}
                        value={form.brand}
                        onFocus={handleBrandFocus}
                        onBlur={handleBrandBlur}
                        onChangeText={handleBrandSearch}
                        placeholder="Search Brand"
                        placeholderTextColor={dynamicStyles.placeholderColor}
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
                    <Text style={[styles.inputLabel, dynamicStyles.textColor]}>
                      Vehicle Model*
                    </Text>
                    <View
                      style={[
                        styles.searchInputContainer,
                        {
                          backgroundColor: dynamicStyles.backgroundColor,
                          borderColor: errors.model
                            ? 'rgba(211, 47, 47, 1)'
                            : dynamicStyles.borderColor(uiState.modelFocused, form.model.trim()),
                        },
                      ]}
                    >
                      <SearchIcon
                        color={
                          uiState.modelFocused || form.model.trim()
                            ? 'rgba(4, 25, 51, 1)'
                            : 'rgba(4, 25, 51, 0.5)'
                        }
                        style={styles.iconMargin}
                      />
                      <TextInput
                        ref={modelInputRef}
                        style={[styles.inputWithIcon, dynamicStyles.textColor]}
                        value={form.model}
                        onFocus={() => {
                          updateFocusState('modelFocused', true);
                          setUiState(prev => ({ ...prev, yearDropdownVisible: false, showDropdown: false }));
                        }}
                        onBlur={() => updateFocusState('modelFocused', false)}
                        onChangeText={handleModelChange}
                        placeholder="Search model"
                        placeholderTextColor={dynamicStyles.placeholderColor}
                        returnKeyType="done"
                        onSubmitEditing={Keyboard.dismiss}
                      />
                    </View>

                    {errors.model ? (
                      <Text style={styles.errorText}>{errors.model}</Text>
                    ) : null}
                  </View>

                  {/* Vehicle Year */}
                  <View style={[styles.inputGroup, { zIndex: uiState.yearDropdownVisible ? 2000 : 1 }]}>
                    <Text style={[styles.inputLabel, dynamicStyles.textColor]}>
                      Vehicle Year*
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.yearInputContainer,
                        {
                          backgroundColor: dynamicStyles.backgroundColor,
                          borderColor: errors.year
                            ? 'rgba(211, 47, 47, 1)'
                            : dynamicStyles.borderColor(uiState.yearDropdownVisible, form.year),
                        },
                      ]}
                      onPress={handleYearInputPress}
                    >
                      <TextInput
                        style={[styles.yearInput, dynamicStyles.textColor]}
                        editable={false}
                        placeholder="Select year"
                        placeholderTextColor={dynamicStyles.placeholderColor}
                        value={form.year}
                      />
                      <SelectIcon color={dynamicStyles.iconColor(uiState.yearDropdownVisible)} />
                    </TouchableOpacity>

                    {renderYearDropdown}

                    {errors.year ? (
                      <Text style={styles.errorText}>{errors.year}</Text>
                    ) : null}
                  </View>

                  {/* Upload Picture */}
                  <TouchableOpacity onPress={selectImage} style={styles.uploadContainer}>
                    {selectedImage ? (
                      <View>
                        <Image 
                          source={{ uri: selectedImage }} 
                          style={{ width: 90, height: 100, resizeMode: 'cover' }} 
                        />
                        <TouchableOpacity onPress={() => setSelectedImage(null)} style={{
                          height: 16,
                          width: 16,
                          borderRadius: 10,
                          backgroundColor: '#004EAB',
                          justifyContent: 'center',
                          alignItems: "center",
                          borderWidth: 1,
                          borderColor: '#fff',
                          position: 'absolute',
                          right: -7,
                          top: -5,
                        }}>
                          <Close/>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <>
                        <Upload color={dynamicStyles.iconColor()} />
                        <Text style={[styles.uploadText, { color: dynamicStyles.iconColor() }]}>
                          Upload Vehicle Picture
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>

                  {/* Save Button */}
                  <TouchableOpacity
                    disabled={!isValid}
                    onPress={async () => {
                      await handleSaveVehicle();
                      dispatch(setTrigger(true));
                      setTimeout(() => {
                        dispatch(setTrigger(false));
                      }, 300);
                    }}
                    style={[styles.saveButton, { opacity: !isValid ? 0.4 : null }]}
                  >
                    <Text style={styles.saveButtonText}>  {isLoading ? 'Saving..' : 'Save Vehicle' }  </Text>
                  </TouchableOpacity>

                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  modal: { margin: 0, justifyContent: 'flex-end' },
  modalView: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    minHeight: '50%',
    maxHeight: '90%',
  },
  scrollContent: { flexGrow: 1 },
  modalInner: { marginHorizontal: 24, marginTop: 24, marginBottom: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  headerTitle: { fontFamily: 'RobotoCondensed400', fontSize: 18 },
  form: { marginTop: 16, gap: 16 },
  inputGroup: { gap: 8, position: 'relative' },
  inputLabel: { fontSize: 14, fontFamily: 'RobotoCondensed400' },
  yearInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  yearInput: { flex: 1, paddingVertical: 0 },
  yearDropdown: {
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
    zIndex: 5000, 
  },
  yearDropdownItem: { paddingVertical: 10, paddingHorizontal: 12 },
  yearDropdownText: { fontFamily: 'RobotoCondensed300', fontSize: 12 },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
  },
  inputWithIcon: { flex: 1, height: '100%', paddingVertical: 0 },
  dropdownItemWrapper: { borderRadius: 5 },
  firstDropdownItem: { borderRadius: 5 },
  dropdownItem: { paddingVertical: 8, paddingHorizontal: 6, fontSize: 12 },
  customAddWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 8,
  },
  addActionText: {
    fontFamily: 'RobotoCondensed500',
    color: '#004EAB',
    fontSize: 13,
  },
  uploadContainer: {
    minHeight: 90,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2B6BB9',
    paddingVertical: 13,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  uploadText: { fontFamily: 'RobotoCondensed300', fontSize: 14 },
  saveButton: {
    backgroundColor: '#004EAB',
    height: 38,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    fontFamily: 'RobotoCondensed400',
    color: '#fff',
    textAlign: 'center',
    fontSize: 14,
  },
  iconMargin: { marginRight: 4 },
  errorText: {
    fontSize: 12,
    fontFamily: 'RobotoCondensed300',
    color: 'rgba(211, 47, 47, 1)',
    marginTop: 2,
  },
});

export default AddVehicle;