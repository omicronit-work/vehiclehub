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
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import storage from '@react-native-firebase/storage';
// SVG icon components
import Car from '../assets/svg/Car';
import CloseIcon from '../assets/svg/CloseIcon.jsx';
import SearchIcon from '../assets/svg/SearchIcon.jsx';
import SelectIcon from '../assets/svg/SelectIcon.jsx';
import Upload from '../assets/svg/Upload.jsx';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDispatch, useSelector } from 'react-redux';
import { addVehicle } from '../store/vehicleSlice.js'
import {addUserVehicle} from '../store/userSlice.js'
import ToastManager, { Toast } from 'toastify-react-native'
import {setaddVehicalModalRd} from '../store/userSlice.js'
import  {setTrigger} from '../store/userSlice.js'
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

    // Clean up both listeners when the hook unmounts
    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, [defaultValue]);

  return behaviour;
};


const useTheme = () => {
  const { theme } = useSelector(store => store.theme);
  const [cachedTheme, setCachedTheme] = useState(null);

  useEffect(() => {
    // Hydrate from storage on mount and whenever the Redux theme changes
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
    const { userEmail,VehicalModal, Trigger } = useSelector((state) => state.user);
  const { isDark } = useTheme();
  const scrollViewRef = useRef(null);
  const behaviour = useBehavior();
  const dispatch = useDispatch()

 
  // ── Form State ────────────────────────────────

  
  const [form, setForm] = useState({ brand: '', model: '', year: '' });
  const [selectedImage, setSelectedImage] = useState(null);
  // ── Validation Error State ────────────────────
 
  const [errors, setErrors] = useState({ brand: '', model: '', year: '' });

  // ── UI State ──────────────────────────────────
 
  const [uiState, setUiState] = useState({
    yearDropdownVisible: false,
    brandFocused: false,
    modelFocused: false,
  });

 
  const [filteredData, setFilteredData] = useState([]);

  // ─────────────────────────────────────────────
  // Memoized Dynamic Styles
  // ─────────────────────────────────────────────

  const dynamicStyles = useMemo(
    () => ({
      /** Primary text color */
      textColor: { color: isDark ? '#fff' : '#041933' },

      /** Placeholder text color (lower opacity than normal text) */
      placeholderColor: isDark
        ? 'rgba(255, 255, 255, 0.16)'
        : 'rgba(4, 25, 51, 0.5)',

      /**
       * Icon color — brighter when the associated input is focused.
       * @param {boolean} isFocused
       */
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

      /** Background color for the modal sheet and non-transparent inputs */
      backgroundColor: isDark ? '#041933' : '#fff',

      /** Background color for floating dropdowns */
      dropdownBgColor: isDark ? 'rgba(9, 42, 87, 1)' : '#fff',
    }),
    [isDark],
  );

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

    // Form is valid only when every error message is empty
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
  
    // 👇 Log raw response before parsing
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
  
      // only local preview
      setSelectedImage(localUri);
    }
  };
  // ─────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────

  const toggleYearDropdown = useCallback(() => {
    setUiState(prev => ({
      ...prev,
      yearDropdownVisible: !prev.yearDropdownVisible,
    }));
  }, []);

  
  const selectYear = useCallback(year => {
    setForm(prev => ({ ...prev, year }));
    setErrors(prev => ({ ...prev, year: '' })); // Clear error on valid selection
    setUiState(prev => ({ ...prev, yearDropdownVisible: false }));
  }, []);

 
  const handleBrandSearch = useCallback(text => {
    setForm(prev => ({ ...prev, brand: text }));

    // Clear the brand error once the user starts correcting the field
    if (text.trim()) {
      setErrors(prev => ({ ...prev, brand: '' }));
    }

    // Only show suggestions when there is at least one character typed
    setFilteredData(
      text.length > 0
        ? VEHICLE_MODELS.filter(item =>
            item.toLowerCase().includes(text.toLowerCase()),
          )
        : [],
    );
  }, []);

  
  const handleSelectBrand = useCallback(item => {
    // Don't dismiss keyboard here - let the selection happen first
    setForm(prev => ({ ...prev, brand: item }));
    setErrors(prev => ({ ...prev, brand: '' })); // Clear error on valid selection
    setFilteredData([]);
  }, []);

 
  const handleModelChange = useCallback(text => {
    setForm(prev => ({ ...prev, model: text.trim() }));

    // Clear the model error once the user starts correcting the field
    if (text.trim()) {
      setErrors(prev => ({ ...prev, model: '' }));
    }
  }, []);

  
  const handleCloseModal = useCallback(() => {
    Keyboard.dismiss();
    setAddVehicleModal(false);
    setSelectedImage(null)
    dispatch(setaddVehicalModalRd(false))

    // Reset all form values
    setForm({ brand: '', model: '', year: '' });

    // Reset all validation errors so they don't persist on next open
    setErrors({ brand: '', model: '', year: '' });

    // Reset UI toggles and focus state
    setUiState({
      yearDropdownVisible: false,
      brandFocused: false,
      modelFocused: false,
    });

    // Clear autocomplete suggestions
    setFilteredData([]);
  }, [setAddVehicleModal]);

  const handleSaveVehicle = useCallback(async () => {
    if (!validate()) return;
  
    try {
      let uploadedImageUrl = null;
  
      // Upload image only when user presses Save Vehicle
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
  
      const result = await addUserVehicle(userEmail, vehicleData);
  
      console.log('Database Insert Result::', result.message);
  
      if (!result.success) {
        Toast.show({
          type: 'warn',
          text1: 'Vehicle Already Exists!!',
          position: 'top',
          visibilityTime: 4000,
          autoHide: true,
          icon: (
            <Image
              source={require('../assets/icons/crisis.png')}
              style={{ width: 24, height: 24, resizeMode: 'contain' }}
            />
          ),
        });
    
  
        return;
      }
  
      onVehicleAdded?.();
      handleCloseModal();
  
    } catch (error) {
      console.error('Save Error:', error);
  
      Toast.show({
        type: 'error',
        text1: 'Something went wrong',
        position: 'top',
      });
    }
  }, [
    form,
    selectedImage,
    userEmail,
    validate,
    handleCloseModal,
  ]);
  const updateFocusState = useCallback((field, value) => {
    setUiState(prev => ({ ...prev, [field]: value }));
  }, []);

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
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
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


  const renderBrandDropdown = useMemo(
    () =>
      filteredData.length > 0 && (
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
                // Highlight the first (top) suggestion
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
                    // First item uses medium weight; rest use light weight
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

  const isValid = form.year.trim() && form.brand.trim() &&  form.model.trim();

  

  return (
    <View style={styles.container}>
      <Modal
        isVisible={addVehicleModal || VehicalModal}
        onBackdropPress={handleCloseModal}   // Tap outside → close
        onBackButtonPress={handleCloseModal} // Android back button → close
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
       
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <KeyboardAvoidingView
            behavior={behaviour}
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

                {/* ── Header ─────────────────────────────────── */}
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

                {/* ── Form ───────────────────────────────────── */}
                <View style={styles.form}>

                  {/* ── Vehicle Brand ────────────────────────── */}
                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, dynamicStyles.textColor]}>
                      Vehicle Brand*
                    </Text>

                    {/* Container for input + overlapping dropdown */}
                  
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
                          onFocus={() => updateFocusState('brandFocused', true)}
                          onBlur={() => updateFocusState('brandFocused', false)}
                          onChangeText={handleBrandSearch}
                          placeholder="Search Brand"
                          placeholderTextColor={dynamicStyles.placeholderColor}
                          returnKeyType="done"
                          onSubmitEditing={Keyboard.dismiss}
                        />
                      </View>

                      {/* Autocomplete dropdown (absolutely positioned to overlap) */}
                      {renderBrandDropdown}
                  

                    {/* Inline validation error for brand field */}
                    {errors.brand ? (
                      <Text style={styles.errorText}>{errors.brand}</Text>
                    ) : null}
                  </View>

                  {/* ── Vehicle Model ────────────────────────── */}
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
                        style={[styles.inputWithIcon, dynamicStyles.textColor]}
                        value={form.model}
                        onFocus={() => updateFocusState('modelFocused', true)}
                        onBlur={() => updateFocusState('modelFocused', false)}
                        onChangeText={handleModelChange}
                        placeholder="Search model"
                        placeholderTextColor={dynamicStyles.placeholderColor}
                        returnKeyType="done"
                        onSubmitEditing={Keyboard.dismiss}
                      />
                    </View>

                    {/* Inline validation error for model field */}
                    {errors.model ? (
                      <Text style={styles.errorText}>{errors.model}</Text>
                    ) : null}
                  </View>

                  {/* ── Vehicle Year ─────────────────────────── */}
                  <View style={styles.inputGroup}>
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
                            : dynamicStyles.borderColor(false, form.year),
                        },
                      ]}
                      onPress={() => {
                        Keyboard.dismiss(); // Dismiss keyboard before opening year picker
                        toggleYearDropdown();
                      }}
                    >
                      <TextInput
                        style={[styles.yearInput, dynamicStyles.textColor]}
                        editable={false}   // Read-only; selection is via the dropdown
                        placeholder="Select year"
                        placeholderTextColor={dynamicStyles.placeholderColor}
                        value={form.year}
                      />
                      <SelectIcon color={dynamicStyles.iconColor()} />
                    </TouchableOpacity>

                    {/* Scrollable year picker dropdown */}
                    {renderYearDropdown}

                    {/* Inline validation error for year field */}
                    {errors.year ? (
                      <Text style={styles.errorText}>{errors.year}</Text>
                    ) : null}
                  </View>

                  {/* ── Upload Vehicle Picture ───────────────── */}
             
                  <TouchableOpacity onPress={()=>{
                    selectImage()
                  }} style={styles.uploadContainer}>
                    {selectedImage ? (
    <Image 
      source={{ uri: selectedImage }} 
      style={{
        width: '100%',
     height: '100%',
    
      }} 
      resizeMode="contain"
    />
    
  ) : (
    <>
      <Upload color={dynamicStyles.iconColor()} />
      <Text
        style={[
          styles.uploadText,
          { color: dynamicStyles.iconColor() },
        ]}
      >
        Upload Vehicle Picture
      </Text>
    </>
  )}
                  </TouchableOpacity>

                  {/* ── Save Button ──────────────────────────── */}
                   
                  <TouchableOpacity
  disabled={!isValid}
  onPress={async () => {
    await handleSaveVehicle();          // Wait for save to complete
    dispatch(setTrigger(true));          // Signal update needed
    setTimeout(() => {
      dispatch(setTrigger(false));       // Reset so next save works
    }, 300);
  }}
  style={[styles.saveButton, { opacity: !isValid ? 0.4 : null }]}
>
                    <Text style={styles.saveButtonText}>Save Vehicle</Text>
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
  /** Root container — flex: 1 so the modal covers full height */
  container: { flex: 1 },

  /** Modal anchored to the bottom of the screen, no side margins */
  modal: { margin: 0, justifyContent: 'flex-end' },

 
  modalView: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    minHeight: '50%',
    maxHeight: '90%',
  },

  /** Allows the inner content to grow and fill the modal sheet */
  scrollContent: { flexGrow: 1 },

  /** Padding wrapper for all content inside the modal */
  modalInner: { marginHorizontal: 24, marginTop: 24, marginBottom: 24 },

  /** Row: title on the left, close button on the right */
  header: { flexDirection: 'row', justifyContent: 'space-between' },

  /** Car icon + "Add Vehicle" text side by side */
  headerLeft: { flexDirection: 'row', gap: 8, alignItems: 'center' },

  /** Modal title text style */
  headerTitle: { fontFamily: 'RobotoCondensed400', fontSize: 18 },

  /** Vertical stack of all input groups with consistent spacing */
  form: { marginTop: 16, gap: 16 },

  /** Wraps a label + input (+ optional dropdown/error) as a unit */
  inputGroup: { gap: 8 },

  /** Field label above each input */
  inputLabel: { fontSize: 14, fontFamily: 'RobotoCondensed400' },

  /** Year field row: TextInput (read-only) + chevron icon */
  yearInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
  },

  /** Year text inside the year picker button */
  yearInput: { flex: 1, paddingVertical: 0 },

 
 
  yearDropdown: {
    maxHeight:120,
   position: 'absolute',
    top: 70, // Just below the 40px input + 4px gap
    left: 0,
    right: 0,
    borderRadius: 12,
    padding: 8,
    elevation: 10, // Higher elevation for Android shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    zIndex: 1,
  },

  /** Individual row inside the year picker */
  yearDropdownItem: { paddingVertical: 10, paddingHorizontal: 12 },

  /** Year text inside the picker rows */
  yearDropdownText: { fontFamily: 'RobotoCondensed300', fontSize: 12 },

  /** Row: search icon + TextInput side by side */
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
  },


  inputWithIcon: { flex: 1, height: '100%', paddingVertical: 0 },

 
  brandInputWrapper: {
    position: 'relative',
    zIndex: 100, // Ensure dropdown appears above other elements
  },


  dropdown: {
    position: 'absolute',
    top: 44, // Just below the 40px input + 4px gap
    left: 0,
    right: 0,
    borderRadius: 12,
    padding: 8,
    elevation: 10, // Higher elevation for Android shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    zIndex: 101,
  },

  /** Wrapper for each brand suggestion row */
  dropdownItemWrapper: { borderRadius: 5 },

  /** Extra style for the first suggestion (highlighted background) */
  firstDropdownItem: { borderRadius: 5 },

  /** Text style for each brand suggestion */
  dropdownItem: { paddingVertical: 8, paddingHorizontal: 6, fontSize: 12 },

  
  uploadContainer: {
    height: 90,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(43, 107, 185, 1)',
    paddingVertical: 13,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },

  /** "Upload Vehicle Picture" label inside the upload area */
  uploadText: { fontFamily: 'RobotoCondensed300', fontSize: 14 },

  /** Primary action button — blue background, full-width */
  saveButton: {
      
    backgroundColor: '#004EAB',
    height:38,
     justifyContent:'center',
    paddingHorizontal:16,
    borderRadius: 12,
    alignItems: 'center',
    

  },

  /** "Save Vehicle" button label */
  saveButtonText: {
    fontFamily: 'RobotoCondensed400',
    color: '#fff',
    textAlign: 'center',
    fontSize: 14,
  },

  // Right margin between the search icon and the TextInput 
  iconMargin: { marginRight: 4 },

  errorText: {
    fontSize: 12,
    fontFamily: 'RobotoCondensed300',
    color: 'rgba(211, 47, 47, 1)',
    marginTop: 2,
  },
});

export default AddVehicle;