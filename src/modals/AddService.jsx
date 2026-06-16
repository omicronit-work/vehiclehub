import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
} from 'react';
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
  Image,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import Modal from 'react-native-modal';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDispatch, useSelector } from 'react-redux';
import { launchImageLibrary } from 'react-native-image-picker';
import CloseIcon from '../assets/svg/CloseIcon.jsx';
import Close from '../assets/svg/Close.jsx';
import SelectIcon from '../assets/svg/SelectIcon';
import SearchIcon from '../assets/svg/SearchIcon.jsx';
import Upload from '../assets/svg/Upload.jsx';

import { setVehiclesInformation } from '../store/vehicleSlice.js';
import { addUserService, saveServicesToFirestore } from '../store/userSlice.js';

const SERVICE_NAME = [
  {
    id: 1,
    name: 'Engine Oil Refill',
    icon: 'https://apidailysalah.zecodeek-it.com/media/icon/oil.png',
    extraFields: ['oilType', 'oilQuantity'],
  },
  {
    id: 2,
    name: 'Oil Filter',
    icon: 'https://apidailysalah.zecodeek-it.com/media/icon/filter.png',
    extraFields: ['filterBrand'],
  },
  {
    id: 3,
    name: 'Tires Change',
    icon: 'https://apidailysalah.zecodeek-it.com/media/icon/tyre.png',
    extraFields: ['tireBrand', 'tireSize', 'quantity'],
  },
  {
    id: 4,
    name: 'Gear Oil',
    icon: 'https://apidailysalah.zecodeek-it.com/media/icon/oil.png',
    extraFields: ['oilType', 'oilQuantity'],
  },
  {
    id: 5,
    name: 'Brake Pads',
    icon: 'https://apidailysalah.zecodeek-it.com/media/icon/break.png',
    extraFields: ['padBrand', 'frontOrRear'],
  },
  {
    id: 6,
    name: 'Full Body Servicing',
    icon: 'https://apidailysalah.zecodeek-it.com/media/icon/service.png',
    extraFields: ['servicePackage'],
  },
];



const FIELD_CONFIG = {
  oilType: { label: 'Oil Type', placeholder: 'e.g., Synthetic 5W-30', keyboard: 'default' },
  oilQuantity: { label: 'Oil Quantity', placeholder: 'e.g., 4 Liters', keyboard: 'numeric' },
  filterBrand: { label: 'Filter Brand', placeholder: 'e.g., Bosch, Mann', keyboard: 'default' },
  tireBrand: { label: 'Tire Brand', placeholder: 'e.g., Michelin', keyboard: 'default' },
  tireSize: { label: 'Tire Size', placeholder: 'e.g., 205/55 R16', keyboard: 'default' },
  quantity: { label: 'Quantity', placeholder: 'e.g., 4', keyboard: 'numeric' },
  padBrand: { label: 'Brake Pad Brand', placeholder: 'e.g., Brembo', keyboard: 'default' },
  frontOrRear: { label: 'Position', placeholder: 'Front / Rear / Both', keyboard: 'default' },
  servicePackage: { label: 'Service Package', placeholder: 'Basic / Premium', keyboard: 'default' },
};

const AddService = ({ AddServiceModal, setAddServiceModal, onServiceAdded }) => {

  const { theme } = useSelector(store => store.theme);
  const dispatch = useDispatch();
  const [cachedTheme, setCachedTheme] = useState(null);
  

  const vehicles = useSelector(state => state.vehicle.vehiclesInformation);
  const { userEmail, selectedCar } = useSelector((state) => state.user);

  const [selectedImage, setSelectedImage] = useState(null);

 

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
    }, [defaultValue]);

    return behaviour;
  };

  const behaviour = useBehavior();

  useEffect(() => {
    AsyncStorage.getItem('theme').then(setCachedTheme);
  }, [theme]);

  const isDark = useMemo(
    () => theme === 'dark' || cachedTheme === 'dark',
    [theme, cachedTheme],
  );

  // ---------------------------------------------------------
  // 2. STATE
  // ---------------------------------------------------------
  const [form, setForm] = useState({
    name: '',
    description: '',
    currentMileage: '',
    totalCost: '',
    img: '',
    workshopName: '',
    serviceDate: null,
    nextServiceDate: null,
    remindMe: false,
    oilType: '',
    oilQuantity: '',
    filterBrand: '',
    tireBrand: '',
    tireSize: '',
    quantity: '',
    padBrand: '',
    frontOrRear: '',
    servicePackage: '',
  });

  const [ui, setUi] = useState({
    errors: {},
    touched: {},
    focusedField: null,
    showDatePicker: false,
    datePickerMode: 'service',
    keyboardPadding: 'padding',
  });

  const [filteredData, setFilteredData] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoading,setisLading] = useState(false) 

  const selectingRef = useRef(false);

  // ---------------------------------------------------------
  // 3. REFS & KEYBOARD LISTENERS
  // ---------------------------------------------------------
  const scrollViewRef = useRef(null);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () =>
      setUi(p => ({ ...p, keyboardPadding: 'padding' })),
    );
    const hide = Keyboard.addListener('keyboardDidHide', () =>
      setUi(p => ({ ...p, keyboardPadding: undefined })),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // ---------------------------------------------------------
  // 4. VALIDATION
  // ---------------------------------------------------------
  const validate = useCallback((field, value) => {
    switch (field) {
      case 'name':
        if (!value?.trim()) return 'Service name is required';
        return value.length < 2 ? 'Too short' : '';
      case 'serviceDate':
        if (!value) return 'Required';
        return value > new Date() ? 'Cannot be in future' : '';
      case 'nextServiceDate':
        return value && value < new Date() ? 'Cannot be in past' : '';
      default:
        return '';
    }
  }, []);

  // ---------------------------------------------------------
  // 5. HANDLERS
  // ---------------------------------------------------------
  const handleInputChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (ui.errors[field]) {
      setUi(prev => ({ ...prev, errors: { ...prev.errors, [field]: '' } }));
    }
  };

  // ← UPDATED: Fixed trimming and auto-select exact match
  const handleNameSearch = text => {
    const trimmedText = text.trim();
    handleInputChange('name', text);
    setShowDropdown(true)
    setForm(prev => ({
      ...prev,
      name: text,
      oilType: '',
      oilQuantity: '',
      filterBrand: '',
      tireBrand: '',
      tireSize: '',
      quantity: '',
      padBrand: '',
      frontOrRear: '',
      servicePackage: '',
    }));

    if (trimmedText.length > 0) {
      const filtered = SERVICE_NAME.filter(item =>
        item.name.toLowerCase().includes(trimmedText.toLowerCase()),
      );
      setFilteredData(filtered);

      // Auto-select if exact match
      const exactMatch = SERVICE_NAME.find(
        item => item.name.toLowerCase() === trimmedText.toLowerCase()
      );
      if (exactMatch) {
        selectingRef.current = false;
        setForm(prev => ({
          ...prev,
          name: exactMatch.name,
        }));
        setFilteredData([]);
        setUi(p => ({
          ...p,
          focusedField: null,
          touched: { ...p.touched, name: true },
          errors: { ...p.errors, name: validate('name', exactMatch.name) },
        }));
      }
    } else {
      setFilteredData(SERVICE_NAME);
    }
  };

  const handleNameFocus = () => {
    setShowDropdown(true);
    setUi(p => ({ ...p, focusedField: 'name' }));
    if (!form.name.trim()) {
      setFilteredData(SERVICE_NAME);
    }
  };

  const handleSelectPressIn = () => {
    selectingRef.current = true;
  };

  const handleSelectService = item => {
    selectingRef.current = false;
    Keyboard.dismiss();
    setForm(prev => ({
      ...prev,
      name: item.name,
      oilType: '',
      oilQuantity: '',
      filterBrand: '',
      tireBrand: '',
      tireSize: '',
      quantity: '',
      padBrand: '',
      frontOrRear: '',
      servicePackage: '',
    }));
    setFilteredData([]);
    setUi(p => ({
      ...p,
      focusedField: null,
      touched: { ...p.touched, name: true },
      errors: { ...p.errors, name: validate('name', item.name) },
    }));
  };

  const handleBlur = field => {
    if (field === 'name' && !selectingRef.current) {
      setFilteredData([]);
    }
    setUi(prev => ({
      ...prev,
      focusedField: null,
      touched: { ...prev.touched, [field]: true },
      errors: { ...prev.errors, [field]: validate(field, form[field]) },
    }));
  };

  const onDateChange = (event, date) => {
    setUi(prev => ({ ...prev, showDatePicker: false }));
    if (event.type === 'set' && date) {
      const field =
        ui.datePickerMode === 'service' ? 'serviceDate' : 'nextServiceDate';
      handleInputChange(field, date);
      setUi(prev => ({
        ...prev,
        touched: { ...prev.touched, [field]: true },
        errors: { ...prev.errors, [field]: validate(field, date) },
      }));
    }
  };

  const resetForm = () => {
    setForm({
      name: '',
      description: '',
      currentMileage: '',
      totalCost: '',
      img: '',
      workshopName: '',
      serviceDate: null,
      nextServiceDate: null,
      remindMe: false,
      oilType: '',
      oilQuantity: '',
      filterBrand: '',
      tireBrand: '',
      tireSize: '',
      quantity: '',
      padBrand: '',
      frontOrRear: '',
      servicePackage: '',
    });
    setFilteredData([]);
    setSelectedImage(null);
    setUi(prev => ({ ...prev, errors: {}, touched: {}, focusedField: null }));
  };

  const handleSave = async () => {
    const nameErr = validate('name', form.name);
    const dateErr = validate('serviceDate', form.serviceDate);

    if (!nameErr && !dateErr) {
      const serviceData = { ...form };

      let uploadedImageUrl = null;

      if (selectedImage) {
        const uploadResult = await uploadImageToServer(selectedImage);
        if (uploadResult?.success) {
          uploadedImageUrl = uploadResult.url;
        } else {
          console.warn('Upload failed:', uploadResult);
          return;
        }
      }

      const vehicleData = {
        name: form.name,
        description: form.description,
        currentMileage: form.currentMileage,
        totalCost: form.totalCost,
        workshopName: form.workshopName,
        serviceDate: form.serviceDate,
        nextServiceDate: form.nextServiceDate,
        remindMe: form.remindMe,
        imageUrl: uploadedImageUrl,
        oilType: form.oilType,
        oilQuantity: form.oilQuantity,
        filterBrand: form.filterBrand,
        tireBrand: form.tireBrand,
        tireSize: form.tireSize,
        quantity: form.quantity,
        padBrand: form.padBrand,
        frontOrRear: form.frontOrRear,
        servicePackage: form.servicePackage,
      };
      setisLading(true)
      await addUserService(userEmail, vehicleData, selectedCar);
      onServiceAdded?.();
      setisLading(false)

      const updatedVehicles = [...vehicles];

      if (updatedVehicles.length > 0) {
        const vehicle = updatedVehicles[0];
        updatedVehicles[0] = {
          ...vehicle,
          services: [...(vehicle.services || []), serviceData],
        };
        dispatch(setVehiclesInformation(updatedVehicles));
      }

      setAddServiceModal(false);
      resetForm();
    } else {
      setUi(prev => ({
        ...prev,
        errors: { name: nameErr, serviceDate: dateErr },
        touched: { name: true, serviceDate: true },
      }));
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }
  };

  const selectedService = SERVICE_NAME.find(s => s.name === form.name);
  const extraFields = selectedService?.extraFields || [];

  const ds = useMemo(
    () => ({
      textColor: { color: isDark ? '#fff' : '#041933' },
      placeholderColor: isDark
        ? 'rgba(255,255,255,0.38)'
        : 'rgba(4,25,51,0.38)',
      backgroundColor: isDark ? '#041933' : '#fff',
      dropdownBg: isDark ? '#0d2240' : '#fff',
      dropdownBorder: isDark ? '#1e3d60' : '#E2E6EC',
      dropdownDivider: isDark ? '#1e3d60' : '#F0F2F5',
      firstItemBg: isDark ? 'rgba(0,78,171,0.22)' : '#F0F4FB',
      getBorder: field => {
        if (ui.touched[field] && ui.errors[field]) return styles.inputError;
        if (ui.focusedField === field) return styles.inputFocused;
        if (form[field]) return styles.inputFilled;
        return { borderColor: isDark ? 'rgba(255,255,255,0.16)' : '#EEF1F5' };
      },
    }),
    [isDark, ui, form],
  );

  const isValid = form.name.trim() && form.serviceDate;

  // ---------------------------------------------------------
  // 7. DROPDOWN RENDERER
  // ---------------------------------------------------------
  const renderDropdown = () => {
    // Check if typed text exactly matches any existing service
    const exactMatch = SERVICE_NAME.some(
      item => item.name.toLowerCase() === form.name.trim().toLowerCase()
    );

    // Show "Add" option only when no matches AND no exact match
    if (form.name.trim().length > 0 && filteredData.length === 0 && !exactMatch) {
      return (
        <View
          style={[
            styles.dropdown,
            { backgroundColor: ds.dropdownBg, borderColor: ds.dropdownBorder },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.7}
            onPressIn={()=>{
              handleSelectPressIn()
               
              setShowDropdown(false);
            }}
            onPress={() => {
              selectingRef.current = false;
              setShowDropdown(false);
              setFilteredData([]);
              Keyboard.dismiss();
            
              // IMPORTANT: keep input value but re-enable dropdown next time
              setTimeout(() => {
                setShowDropdown(true);
              }, 0);
            }}
            style={styles.dropdownItem}
          >
            <View style={{
              flex:1,
              paddingHorizontal:3,
              flexDirection:'row',
              justifyContent:'space-between'
            }}>
            <Text style={[styles.dropdownText, ds.textColor]}>
              {form.name.trim()}
            </Text>
            <Text style={[styles.dropdownAddText, { color: '#004EAB', }]}>
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
          styles.dropdown,
          { backgroundColor: ds.dropdownBg, borderColor: ds.dropdownBorder },
        ]}
      >
        {filteredData.map((item, index) => (
          <TouchableOpacity
            key={item.id}
            activeOpacity={0.7}
            onPressIn={handleSelectPressIn}
            onPress={() => handleSelectService(item)}
            style={[
              styles.dropdownItem,
              index === 0 && form.name.trim() && { backgroundColor: ds.firstItemBg },
              index < filteredData.length - 1 && {
               
              },
            ]}
          >
            <Image source={{ uri: item?.icon }} style={styles.dropdownIcon} />
            <Text
              style={[
                styles.dropdownText,
                ds.textColor,
                index === 0 && form.name.trim() && styles.dropdownTextBold,
              ]}
            >
              {item.name} 
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // Render dynamic extra fields
  const renderExtraFields = () => {
    if (extraFields.length === 0) return null;

    return extraFields.map(fieldKey => {
      const config = FIELD_CONFIG[fieldKey];
      if (!config) return null;

      return (
        <View key={fieldKey}>
          <Text style={[styles.labelText, ds.textColor]}>{config.label}</Text>
          <TextInput
            style={[
              styles.inputField,
              ds.getBorder(fieldKey),
              ds.textColor,
            ]}
            placeholder={config.placeholder}
            placeholderTextColor={ds.placeholderColor}
            keyboardType={config.keyboard}
            value={form[fieldKey]}
            onChangeText={t => handleInputChange(fieldKey, t)}
            onFocus={() => setUi(p => ({ ...p, focusedField: fieldKey }))}
            onBlur={() => handleBlur(fieldKey)}
          />
        </View>
      );
    });
  };

  // ---------------------------------------------------------
  // 8. IMAGE HANDLERS
  // ---------------------------------------------------------
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

  const uploadImageToServer = async localUri => {
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
      handleInputChange('img', localUri);
    }
  };

  // ---------------------------------------------------------
  // 9. RENDER
  // ---------------------------------------------------------
  return (
    <View style={styles.container}>
      <Modal
        isVisible={AddServiceModal}
        statusBarTranslucent
        onBackdropPress={() => {
          setAddServiceModal(false);
          resetForm();
        }}
        style={styles.modal}
        avoidKeyboard={true}
        coverScreen={true}
        useNativeDriver={false}
        backdropTransitionOutTiming={1}
        hideModalContentWhileAnimating={true}
        backdropOpacity={0.6}
        animationIn="slideInUp"
        animationOut="slideOutDown"
      >
        <TouchableWithoutFeedback
          onPress={() => {
            Keyboard.dismiss();
            setFilteredData([]);
          }}
        >
          <KeyboardAvoidingView
            behavior={behaviour}
            style={[styles.modalView, { backgroundColor: ds.backgroundColor }]}
          >
            {/* HEADER */}
            <View style={styles.header}>
              <Text style={[styles.title, ds.textColor]}>Add Service</Text>
              <TouchableOpacity
                onPress={() => {
                  setAddServiceModal(false);
                  resetForm();
                }}
              >
                <CloseIcon />
              </TouchableOpacity>
            </View>

            <ScrollView
              ref={scrollViewRef}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ flexGrow: 1 }}
            >
              <View style={styles.inner}>
                <View style={styles.formContainer}>

                  {/* ── SERVICE NAME ── */}
                  <View>
                    <Text style={[styles.labelText, ds.textColor]}>
                      Service Name*
                    </Text>

                    <View style={styles.dropdownAnchor}>
                      <View
                        style={[
                          styles.searchInputContainer,
                          ds.getBorder('name'),
                        ]}
                      >
                        <SearchIcon
                          color={
                            ui.focusedField === 'name' || form.name
                              ? '#041933'
                              : isDark
                              ? 'rgba(255,255,255,0.38)'
                              : 'rgba(4,25,51,0.38)'
                          }
                          style={styles.iconMargin}
                        />
                        <TextInput
                          style={[styles.inputWithIcon, ds.textColor]}
                          placeholder="Search name"
                          placeholderTextColor={ds.placeholderColor}
                          value={form.name}
                          onFocus={handleNameFocus}
                          onChangeText={handleNameSearch}
                          onBlur={() => handleBlur('name')}
                          onSubmitEditing={Keyboard.dismiss}
                        />
                      </View>

                      {!showDropdown ? null : renderDropdown()}
                    </View>

                    {ui.touched.name && ui.errors.name ? (
                      <Text style={styles.errorText}>{ui.errors.name}</Text>
                    ) : null}
                  </View>

                  {/* ── DYNAMIC EXTRA FIELDS ── */}
                  {renderExtraFields()}

                  {/* ── SERVICE DATE ── */}
                  <View>
                    <Text style={[styles.labelText, ds.textColor]}>
                      Service Date*
                    </Text>
                    <TouchableOpacity
                      onPress={() =>
                        setUi(p => ({
                          ...p,
                          showDatePicker: true,
                          datePickerMode: 'service',
                        }))
                      }
                      style={[
                        styles.searchInputContainer,
                        ds.getBorder('serviceDate'),
                      ]}
                    >
                      <TextInput
                        style={[styles.inputText, ds.textColor]}
                        placeholder="Select date"
                        placeholderTextColor={ds.placeholderColor}
                        value={
                          form.serviceDate
                            ? form.serviceDate.toDateString()
                            : ''
                        }
                        editable={false}
                        pointerEvents="none"
                      />
                      <SelectIcon
                        color={
                          form.serviceDate ? '#041933' : 'rgba(4,25,51,0.38)'
                        }
                      />
                    </TouchableOpacity>
                    {ui.touched.serviceDate && ui.errors.serviceDate ? (
                      <Text style={styles.errorText}>
                        {ui.errors.serviceDate}
                      </Text>
                    ) : null}
                  </View>

                  {/* ── MILEAGE & COST ── */}
                  <View style={styles.rowContainer}>
                    <View style={styles.halfWidthContainer}>
                      <Text style={[styles.labelText, ds.textColor]}>
                        Current Mileage
                      </Text>
                      <TextInput
                        style={[
                          styles.inputField,
                          ds.getBorder('currentMileage'),
                          ds.textColor,
                        ]}
                        placeholder="Enter current km"
                        placeholderTextColor={ds.placeholderColor}
                        keyboardType="numeric"
                        value={form.currentMileage}
                        onChangeText={t =>
                          handleInputChange('currentMileage', t)
                        }
                        onFocus={() =>
                          setUi(p => ({ ...p, focusedField: 'currentMileage' }))
                        }
                        onBlur={() => handleBlur('currentMileage')}
                      />
                    </View>
                    <View style={styles.halfWidthContainer}>
                      <Text style={[styles.labelText, ds.textColor]}>
                        Total Cost
                      </Text>
                      <TextInput
                        style={[
                          styles.inputField,
                          ds.getBorder('totalCost'),
                          ds.textColor,
                        ]}
                        placeholder="Enter amount"
                        placeholderTextColor={ds.placeholderColor}
                        keyboardType="numeric"
                        value={form.totalCost}
                        onChangeText={t => handleInputChange('totalCost', t)}
                        onFocus={() =>
                          setUi(p => ({ ...p, focusedField: 'totalCost' }))
                        }
                        onBlur={() => handleBlur('totalCost')}
                      />
                    </View>
                  </View>

                  {/* ── WORKSHOP NAME ── */}
                  <View>
                    <Text style={[styles.labelText, ds.textColor]}>
                      Workshop Name
                    </Text>
                    <View
                      style={[
                        styles.searchInputContainer,
                        ds.getBorder('workshopName'),
                      ]}
                    >
                      <TextInput
                        style={[styles.inputWithIcon, ds.textColor]}
                        placeholder="Enter Name"
                        placeholderTextColor={ds.placeholderColor}
                        value={form.workshopName}
                        onChangeText={t => handleInputChange('workshopName', t)}
                        onFocus={() =>
                          setUi(p => ({ ...p, focusedField: 'workshopName' }))
                        }
                        onBlur={() => handleBlur('workshopName')}
                      />
                    </View>
                  </View>

                  {/* ── NEXT SERVICE + REMIND ME ── */}
                  <View>
                    <View style={styles.rowSpacedContainer}>
                      <Text style={[styles.labelText, ds.textColor]}>
                        Next Service Date
                      </Text>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() =>
                            handleInputChange('remindMe', !form.remindMe)
                          }
                          style={[
                            styles.customTrack,
                            {
                              backgroundColor: form.remindMe
                                ? '#004EAB'
                                : 'rgba(0,78,171,0.2)',
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.customThumb,
                              {
                                transform: [
                                  { translateX: form.remindMe ? 6 : 0 },
                                ],
                              },
                            ]}
                          />
                        </TouchableOpacity>
                        <Text style={[styles.remindText, ds.textColor]}>
                          Remind Me
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() =>
                        setUi(p => ({
                          ...p,
                          showDatePicker: true,
                          datePickerMode: 'next',
                        }))
                      }
                      style={[
                        styles.searchInputContainer,
                        ds.getBorder('nextServiceDate'),
                      ]}
                    >
                      <TextInput
                        style={[styles.inputText, ds.textColor]}
                        placeholder="Select date"
                        placeholderTextColor={ds.placeholderColor}
                        value={
                          form.nextServiceDate
                            ? form.nextServiceDate.toDateString()
                            : ''
                        }
                        editable={false}
                        pointerEvents="none"
                      />
                      <SelectIcon
                        color={
                          form.nextServiceDate
                            ? '#041933'
                            : 'rgba(4,25,51,0.38)'
                        }
                      />
                    </TouchableOpacity>
                    {ui.touched.nextServiceDate && ui.errors.nextServiceDate ? (
                      <Text style={styles.errorText}>
                        {ui.errors.nextServiceDate}
                      </Text>
                    ) : null}
                  </View>

                  {/* ── DESCRIPTION ── */}
                  <View>
                    <Text style={[styles.labelText, ds.textColor]}>
                      Description
                    </Text>
                    <View
                      style={[
                        styles.descriptionContainer,
                        ds.getBorder('description'),
                      ]}
                    >
                      <TextInput
                        style={[styles.inputWithIcon, ds.textColor]}
                        placeholder="Enter description"
                        textAlignVertical="top"
                        placeholderTextColor={ds.placeholderColor}
                        multiline
                        value={form.description}
                        onChangeText={t => handleInputChange('description', t)}
                        onFocus={() =>
                          setUi(p => ({ ...p, focusedField: 'description' }))
                        }
                        onBlur={() => handleBlur('description')}
                      />
                    </View>
                  </View>

                  {/* ── UPLOAD ── */}
                  <TouchableOpacity
                    onPress={selectImage}
                    style={styles.uploadContainer}
                  >
                    {selectedImage ? (
                      <View>
                        <Image
                          source={{ uri: selectedImage }}
                          style={{ width: 100, height: 100, resizeMode: 'cover' }}
                        />
                        <TouchableOpacity
                          onPress={() => setSelectedImage(null)}
                          style={{
                            height: 16,
                            width: 16,
                            borderRadius: 10,
                            backgroundColor: '#004EAB',
                            justifyContent: 'center',
                            alignItems: 'center',
                            borderWidth: 1,
                            borderColor: '#fff',
                            position: 'absolute',
                            right: -7,
                            top: -5,
                          }}
                        >
                          <Close />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <>
                        <Upload color={isDark ? '#fff' : 'rgba(4,25,51,0.5)'} />
                        <Text
                          style={[
                            styles.uploadText,
                            { color: isDark ? '#fff' : 'rgba(4,25,51,0.5)' },
                          ]}
                        >
                          Receipt / Invoice Upload (Photo/PDF)
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {/* DATE PICKER */}
                {ui.showDatePicker && (
                  <DateTimePicker
                    value={
                      (ui.datePickerMode === 'service'
                        ? form.serviceDate
                        : form.nextServiceDate) || new Date()
                    }
                    mode="date"
                    onChange={onDateChange}
                  />
                )}

                {/* SAVE BUTTON */}
                <TouchableOpacity
                  activeOpacity={isValid ? 0.7 : 1}
                  disabled={!isValid}
                  style={[styles.button, !isValid && { opacity: 0.5 }]}
                  onPress={handleSave}
                >
                  <Text style={styles.buttonText}> {isLoading ? 'Saving...' : 'Save service'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

// ---------------------------------------------------------
// STYLES
// ---------------------------------------------------------
const styles = StyleSheet.create({
  dropdownAddText: {
    fontSize: 14,
    fontFamily: 'RobotoCondensed500',
  },
  container: { flex: 1 },
  modal: { margin: 0, justifyContent: 'flex-end' },
  modalView: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    minHeight: '50%',
    maxHeight: '90%',
  },
  inner: { padding: 20 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 0,
  },
  title: { fontSize: 18, fontFamily: 'RobotoCondensed400' },
  formContainer: { gap: 16 },

  labelText: {
    fontFamily: 'RobotoCondensed400',
    fontSize: 14,
    marginBottom: 8,
  },

  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  inputWithIcon: { flex: 1, height: '100%' },
  inputText: { flex: 1, fontSize: 14 },
  inputField: {
    width: '100%',
    height: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 13,
    fontSize: 14,
  },
  descriptionContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 68,
  },

  inputFocused: { borderColor: '#004EAB', borderWidth: 1.5 },
  inputFilled: { borderColor: '#004EAB', borderWidth: 1 },
  inputError: { borderColor: '#FF3B30', borderWidth: 1 },
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
    fontFamily: 'RobotoCondensed400',
    marginTop: 4,
    marginLeft: 4,
  },

  rowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowSpacedContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  halfWidthContainer: { flex: 1 },

  customTrack: { width: 18, height: 12, borderRadius: 11, padding: 1 },
  customThumb: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#fff',
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
  uploadText: { textAlign: 'center', fontSize: 12 },

  button: {
    backgroundColor: '#004EAB',
    height: 38,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: { color: '#fff', fontFamily: 'RobotoCondensed400', fontSize: 16 },
  iconMargin: { marginRight: 4 },
  remindText: { fontFamily: 'RobotoCondensed300', fontSize: 14 },

  // ── DROPDOWN ──
  dropdownAnchor: {
    position: 'relative',
    zIndex: 999,
  },
  dropdown: {
    position: 'absolute',
    top: 45,
    left: 0,
    right: 0,
    borderRadius:12,
 
    zIndex: 1000,
    elevation: 6,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 5,
  },
  dropdownIcon: { width: 12, height: 12, resizeMode: 'contain' },
  dropdownText: { fontSize: 14, fontFamily: 'RobotoCondensed300' },
  dropdownTextBold: { fontFamily: 'RobotoCondensed500' },
});

export default AddService;