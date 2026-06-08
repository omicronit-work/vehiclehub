import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
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
} from 'react-native';

import Modal from 'react-native-modal';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchImageLibrary } from 'react-native-image-picker';
import { useDispatch, useSelector } from 'react-redux';

import CloseIcon from '../assets/svg/CloseIcon.jsx';
import SelectIcon from '../assets/svg/SelectIcon';
import Upload from '../assets/svg/Upload.jsx';
import Close from '../assets/svg/Close.jsx';
import Camera from '../assets/svg/Camera.jsx';
import { updateUserService } from '../store/userSlice.js';
import { setVehiclesInformation } from '../store/vehicleSlice.js';

const SERVICE_NAME = [
  {
    id: 1,
    name: 'Engine Oil Refill',
    icon: require('../assets/icons/oil.png'),
  },
  { id: 2, name: 'Oil Filter', icon: require('../assets/icons/filter.png') },
  { id: 3, name: 'Tires Change', icon: require('../assets/icons/tyre.png') },
  { id: 4, name: 'Gear Oil', icon: require('../assets/icons/oil.png') },
  { id: 5, name: 'Brake Pads', icon: require('../assets/icons/break.png') },
  {
    id: 6,
    name: 'Full Body Servicing',
    icon: require('../assets/icons/service.png'),
  },
];

// Helper to convert Firestore Timestamp to JS Date
const timestampToDate = (timestamp) => {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp === 'object' && timestamp._seconds !== undefined) {
    return new Date(timestamp._seconds * 1000);
  }
  return new Date(timestamp);
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

const ServiceUpdate = ({
  updateData,
  ServiceUpdateModal,
  setServiceUpdateModal,
  onServiceUpdated,
  forView, setForView,

}) => {
  const dispatch = useDispatch();

  const { theme } = useSelector(store => store.theme);

  const vehicles = useSelector(
    state => state.vehicle.vehiclesInformation ?? [],
  );

 

  const { userEmail, selectedCar } = useSelector(state => state.user);

  const [cachedTheme, setCachedTheme] = useState(null);
  const [loadng, setLoading] = useState(false);
  const [keyboardBehavior, setKeyboardBehavior] = useState('padding');

  const [selectedImage, setSelectedImage] = useState(null);
  const [imageRemoved, setImageRemoved] = useState(false);

  const [form, setForm] = useState({
    name: '',
    description: '',
    currentMileage: '',
    totalCost: '',
    workshopName: '',
    serviceDate: null,
    nextServiceDate: null,
    remindMe: false,
    imageUrl: '',
  });

  const [ui, setUi] = useState({
    focusedField: null,
    showDatePicker: false,
    datePickerMode: 'service',
  });

  const [filteredData, setFilteredData] = useState([]);

  const selectingRef = useRef(false);
  const scrollViewRef = useRef(null);

  // Computed display image: newly selected > existing url > null
  const displayImage = imageRemoved
    ? null
    : selectedImage || form.imageUrl || null;


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
    

  useEffect(() => {
    const loadTheme = async () => {
      const savedTheme = await AsyncStorage.getItem('theme');
      setCachedTheme(savedTheme);
    };
    loadTheme();

    console.log('info from pokpok::', vehicles)
  }, []);

  useEffect(() => {
    if (ServiceUpdateModal && updateData) {
      setSelectedImage(null);
      setImageRemoved(false);
      setForm({
        name: updateData?.name || '',
        imageUrl: updateData?.imageUrl || '',
        description: updateData?.description || '',
        currentMileage: updateData?.currentMileage?.toString() || '',
        totalCost: updateData?.totalCost?.toString() || '',
        workshopName: updateData?.workshopName || '',
        serviceDate: timestampToDate(updateData?.serviceDate),
        nextServiceDate: timestampToDate(updateData?.nextServiceDate),
        remindMe: updateData?.remindMe || false,
      });

      setUi({
        focusedField: null,
        showDatePicker: false,
        datePickerMode: 'service',
      });
    }
  }, [ServiceUpdateModal, updateData]);

  useEffect(() => {
    if (updateData) {
      setForm({
        name: updateData?.name || '',
        description: updateData?.description || '',
        currentMileage: updateData?.currentMileage?.toString() || '',
        totalCost: updateData?.totalCost?.toString() || '',
        workshopName: updateData?.workshopName || '',
        imageUrl: updateData?.imageUrl || '',
        serviceDate: timestampToDate(updateData?.serviceDate),
        nextServiceDate: timestampToDate(updateData?.nextServiceDate),
        remindMe: updateData?.remindMe || false,
      });
    }
  }, [updateData]);

  const isDark = useMemo(
    () => theme === 'dark' || cachedTheme === 'dark',
    [theme, cachedTheme],
  );

  const handleInputChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleNameSearch = text => {
    handleInputChange('name', text);

    if (text.trim().length > 0) {
      setFilteredData(
        SERVICE_NAME.filter(item =>
          item.name.toLowerCase().includes(text.toLowerCase()),
        ),
      );
    } else {
      setFilteredData([]);
    }
  };

  const handleSelectPressIn = () => {
    selectingRef.current = true;
  };

  const handleSelectService = item => {
    selectingRef.current = false;
    Keyboard.dismiss();
    setForm(prev => ({ ...prev, name: item.name }));
    setFilteredData([]);
    setUi(prev => ({ ...prev, focusedField: null }));
  };

  const onDateChange = (event, date) => {
    setUi(prev => ({ ...prev, showDatePicker: false }));

    if (event.type === 'set' && date) {
      const field =
        ui.datePickerMode === 'service' ? 'serviceDate' : 'nextServiceDate';
      handleInputChange(field, date);
    }
  };

  const handleSelectImage = async () => {
    const response = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
      selectionLimit: 1,
    });

    if (response.assets?.[0]) {
      setSelectedImage(response.assets[0].uri);
      setImageRemoved(false);
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImageRemoved(true);
    handleInputChange('imageUrl', '');
  };

  const handleUpdate = async () => {
    try {
      setLoading(true);

      let finalImageUrl = imageRemoved ? '' : (form.imageUrl || '');

      // Upload new image if selected
      if (selectedImage) {
        const uploadResult = await uploadImageToServer(selectedImage);
        if (uploadResult?.success) {
          finalImageUrl = uploadResult.url;
        } else {
          console.error('Image upload failed');
          setLoading(false);
          return;
        }
      }

      const updatedForm = { ...form, imageUrl: finalImageUrl };

      await updateUserService(userEmail, updatedForm, selectedCar, updateData.id);
      setLoading(false);

      const updatedVehicles = (vehicles ?? []).map(vehicle => {
        if (vehicle.id === selectedCar) {
          return {
            ...vehicle,
            services: (vehicle.services ?? []).map(service =>
              service.id === updateData.id
                ? { ...service, ...updatedForm }
                : service,
            ),
          };
        }
        return vehicle;
      });

      // dispatch(setVehiclesInformation(updatedVehicles));
      onServiceUpdated?.();
      setServiceUpdateModal(false);
    } catch (error) {
      console.error('Failed to update service:', error);
      setLoading(false);
    }
  };

  const ds = useMemo(
    () => ({
      textColor: {
        color: isDark ? '#fff' : '#041933',
      },

      placeholderColor: isDark
        ? 'rgba(255,255,255,0.38)'
        : 'rgba(4,25,51,0.38)',

      backgroundColor: isDark ? '#041933' : '#fff',

      dropdownBg: isDark ? '#0d2240' : '#fff',

      dropdownBorder: isDark ? '#1e3d60' : '#E2E6EC',

      dropdownDivider: isDark ? '#1e3d60' : '#F0F2F5',

      firstItemBg: isDark ? 'rgba(0,78,171,0.22)' : '#F0F4FB',

      getBorder: field => {
        if (ui.focusedField === field) {
          return styles.inputFocused;
        }
        if (form[field]) {
          return styles.inputFilled;
        }
        return {
          borderColor: isDark ? 'rgba(255,255,255,0.16)' : '#EEF1F5',
        };
      },
    }),
    [isDark, ui, form],
  );

  const renderDropdown = () => {
    if (filteredData.length === 0) return null;

    return (
      <View
        style={[
          styles.dropdown,
          {
            backgroundColor: ds.dropdownBg,
            borderColor: ds.dropdownBorder,
          },
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
              index === 0 && { backgroundColor: ds.firstItemBg },
              index < filteredData.length - 1 && {
                borderBottomColor: ds.dropdownDivider,
              },
            ]}
          >
            <Image source={item.icon} style={styles.dropdownIcon} />
            <Text
              style={[
                styles.dropdownText,
                ds.textColor,
                index === 0 && styles.dropdownTextBold,
              ]}
            >
              {item.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Modal
        isVisible={ServiceUpdateModal}
        statusBarTranslucent
        onBackdropPress={() => {
          Keyboard.dismiss();
          setForView(false)
          setServiceUpdateModal(false);
        }}
        style={styles.modal}
        avoidKeyboard
        coverScreen
      >
        <TouchableWithoutFeedback
          onPress={() => {
            Keyboard.dismiss();
            
            setFilteredData([]);
          }}
        >
          <KeyboardAvoidingView
            behavior={keyboardBehavior}
            style={[styles.modalView, { backgroundColor: ds.backgroundColor }]}
          >
            {/* HEADER */}
            <View style={styles.header}>
            <Text style={[styles.title, ds.textColor]}>
  {forView
    ? `${vehicles?.[0]?.brand ?? ''} ${vehicles?.[0]?.model ?? ''}'s Service`
    : 'Update Service'}
</Text>

              <TouchableOpacity
                onPress={() => {
                  Keyboard.dismiss();
                  setServiceUpdateModal(false);
                  setFilteredData([]);
                  setForView(false)
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
                  {/* SERVICE NAME */}
                  <View>
                    <Text style={[styles.labelText, ds.textColor]}>
                      Service Name
                    </Text>

                    <View style={styles.dropdownAnchor}>
                      <View
                        style={[
                          styles.searchInputContainer,
                          ds.getBorder('name'),
                        ]}
                      >
                        <TextInput
                          style={[styles.inputWithIcon, ds.textColor]}
                          placeholder="Search name"
                          placeholderTextColor={ds.placeholderColor}
                          value={form.name}
                          onFocus={() =>
                            setUi(prev => ({ ...prev, focusedField: 'name' }))
                          }
                          onBlur={() =>
                            setUi(prev => ({ ...prev, focusedField: null }))
                          }
                          onChangeText={handleNameSearch}
                          editable={!forView}
                        />
                      </View>

                      {renderDropdown()}
                    </View>
                  </View>

                  {/* SERVICE DATE */}
                  <View>
                    <Text style={[styles.labelText, ds.textColor]}>
                      Service Date
                    </Text>

                    <TouchableOpacity
                      onPress={() =>
                        setUi(prev => ({
                          ...prev,
                          showDatePicker: true,
                          datePickerMode: 'service',
                        }))
                      }
                      style={[
                        styles.searchInputContainer,
                        ds.getBorder('serviceDate'),
                      ]}
                      disabled={forView}
                    >
                      <TextInput
                        editable={false}
                        pointerEvents="none"
                        style={[styles.inputText, ds.textColor]}
                        placeholder="Select date"
                        placeholderTextColor={ds.placeholderColor}
                        value={
                          form.serviceDate
                            ? form.serviceDate.toDateString()
                            : ''
                        }
                      />
                      <SelectIcon />
                    </TouchableOpacity>
                  </View>

                  {/* MILEAGE & COST */}
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
                        placeholder="Enter km"
                        placeholderTextColor={ds.placeholderColor}
                        keyboardType="numeric"
                        value={form.currentMileage}
                        onChangeText={text =>
                          handleInputChange('currentMileage', text)
                        }
                        onFocus={() =>
                          setUi(prev => ({
                            ...prev,
                            focusedField: 'currentMileage',
                          }))
                        }
                        onBlur={() =>
                          setUi(prev => ({ ...prev, focusedField: null }))
                        }

                        editable={!forView}
                      />
                    </View>

                    <View style={styles.halfWidthContainer}>
                      <Text style={[styles.labelText, ds.textColor]}>
                        Total Cost
                      </Text>

                      <TextInput
                      editable={!forView}
                        style={[
                          styles.inputField,
                          ds.getBorder('totalCost'),
                          ds.textColor,
                        ]}
                        placeholder="Enter amount"
                        placeholderTextColor={ds.placeholderColor}
                        keyboardType="numeric"
                        value={form.totalCost}
                        onChangeText={text =>
                          handleInputChange('totalCost', text)
                        }
                        onFocus={() =>
                          setUi(prev => ({
                            ...prev,
                            focusedField: 'totalCost',
                          }))
                        }
                        onBlur={() =>
                          setUi(prev => ({ ...prev, focusedField: null }))
                        }
                      />
                    </View>
                  </View>

                  {/* WORKSHOP */}
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
                        editable={!forView}
                        style={[styles.inputWithIcon, ds.textColor]}
                        placeholder="Enter name"
                        placeholderTextColor={ds.placeholderColor}
                        value={form.workshopName}
                        onChangeText={text =>
                          handleInputChange('workshopName', text)
                        }
                        onFocus={() =>
                          setUi(prev => ({
                            ...prev,
                            focusedField: 'workshopName',
                          }))
                        }
                        onBlur={() =>
                          setUi(prev => ({ ...prev, focusedField: null }))
                        }
                      />
                    </View>
                  </View>

                  {/* NEXT DATE */}
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
                              disabled={forView}
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
                        disabled={forView}
                      onPress={() =>
                        setUi(prev => ({
                          ...prev,
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
                        editable={false}
                        pointerEvents="none"
                        style={[styles.inputText, ds.textColor]}
                        placeholder="Select date"
                        placeholderTextColor={ds.placeholderColor}
                        value={
                          form.nextServiceDate
                            ? form.nextServiceDate.toDateString()
                            : ''
                        }
                      />
                      <SelectIcon />
                    </TouchableOpacity>
                  </View>

                  {/* DESCRIPTION */}
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
                         editable={!forView}
                        multiline
                        textAlignVertical="top"
                        style={[styles.inputWithIcon, ds.textColor]}
                        placeholder="Enter description"
                        placeholderTextColor={ds.placeholderColor}
                        value={form.description}
                        onChangeText={text =>
                          handleInputChange('description', text)
                        }
                        onFocus={() =>
                          setUi(prev => ({
                            ...prev,
                            focusedField: 'description',
                          }))
                        }
                        onBlur={() =>
                          setUi(prev => ({ ...prev, focusedField: null }))
                        }
                      />
                    </View>
                  </View>

                  {/* UPLOAD */}
                  <View style={{ justifyContent: 'center', alignItems: 'center' }}>
                    {!displayImage ? (
                      <TouchableOpacity
                        style={styles.uploadContainer}
                        onPress={handleSelectImage}
                        activeOpacity={0.7}
                      >
                        <Upload color={isDark ? '#fff' : 'rgba(4,25,51,0.5)'} />
                        <Text
                          style={[
                            styles.uploadText,
                            { color: isDark ? '#fff' : 'rgba(4,25,51,0.5)' },
                          ]}
                        >
                          Receipt / Invoice Upload
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={[styles.uploadContainer,  ]}>
                        <Image
                          style={styles.receiptImage}
                          source={{ uri: displayImage }}
                        />
                        {forView ? null :  <TouchableOpacity
                          onPress={handleRemoveImage}
                          style={styles.removeImageBadge}
                        >
                          <Close />
                        </TouchableOpacity> }
                       
                      </View>
                    )}
                  </View>
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

                {/* BUTTON */}
                {forView ?  null :    <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.button}
                  onPress={handleUpdate}
                >
                  <Text style={styles.buttonText}>
                    {loadng ? 'Updating...' : 'Update Service'}
                  </Text>
                </TouchableOpacity> }
             
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

export default ServiceUpdate;

const styles = StyleSheet.create({
  container: { flex: 1 },

  modal: {
    margin: 0,
    justifyContent: 'flex-end',
  },

  modalView: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    minHeight: '50%',
    maxHeight: '90%',
    overflow: 'visible',
  },

  inner: { padding: 20 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 0,
  },

  title: {
    fontSize: 18,
    fontFamily: 'RobotoCondensed400',
  },

  formContainer: {
    gap: 16,
  },

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

  inputWithIcon: {
    flex: 1,
    height: '100%',
  },

  inputText: {
    flex: 1,
    fontSize: 14,
  },

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

  inputFocused: {
    borderColor: '#004EAB',
    borderWidth: 1.5,
  },

  inputFilled: {
    borderColor: '#004EAB',
    borderWidth: 1,
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

  halfWidthContainer: {
    flex: 1,
  },

  customTrack: {
    width: 18,
    height: 12,
    borderRadius: 11,
    padding: 1,
  },

  customThumb: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#fff',
  },

  uploadContainer: {
    width: '100%',
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

  uploadText: {
    textAlign: 'center',
    fontSize: 12,
  },

  receiptImage: {
    width: 163,
    height: 100,
    borderRadius:12,
    resizeMode:'cover'
  },

  removeImageBadge: {
    height: 20,
    width: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fff',
    backgroundColor: '#004EAB',
    position: 'absolute',
    top:5,
    right:105,
    justifyContent: 'center',
    alignItems: 'center',
  },

  button: {
    backgroundColor: '#004EAB',
    height: 38,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },

  buttonText: {
    color: '#fff',
    fontFamily: 'RobotoCondensed400',
    fontSize: 14,
  },

  iconMargin: {
    marginRight: 4,
  },

  remindText: {
    fontFamily: 'RobotoCondensed300',
    fontSize: 14,
  },

  dropdownAnchor: {
    position: 'relative',
    zIndex: 999,
  },

  dropdown: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    borderRadius: 12,
    zIndex: 1000,
    elevation: 6,
  },

  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 5,
  },

  dropdownIcon: {
    width: 12,
    height: 12,
    resizeMode: 'contain',
  },

  dropdownText: {
    fontSize: 14,
    fontFamily: 'RobotoCondensed300',
  },

  dropdownTextBold: {
    fontFamily: 'RobotoCondensed500',
  },
});