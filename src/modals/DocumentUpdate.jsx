import {
  StyleSheet,
  Text,
  View,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  Image,
} from 'react-native';
import React, { useState, useEffect, useMemo } from 'react';
import Modal from 'react-native-modal';
import DateTimePicker from '@react-native-community/datetimepicker';
import { launchImageLibrary } from 'react-native-image-picker';
import CloseIcon from '../assets/svg/CloseIcon.jsx';
import SelectIcon from '../assets/svg/SelectIcon.jsx';
import Upload from '../assets/svg/Upload.jsx';
import Close from '../assets/svg/Close.jsx';
import { useSelector } from 'react-redux';
import { updateUserDocument } from '../store/userSlice.js';

const { width, height } = Dimensions.get('window');

// ─── Upload helper (same pattern as ServiceUpdate) ───────────────────────────
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
// ─────────────────────────────────────────────────────────────────────────────

const DocumentUpdate = ({
  updateData,
  DocumentUpdateModal,
  setDocumentUpdateModal,
  onDocumentUpdated,
  forView, setForView
}) => {
  const [documentName, setDocumentName] = useState('');
  const [remindMe, setRemindMe] = useState(false);
  const [issueDate, setIssueDate] = useState(null);
  const [expiryDate, setExpiryDate] = useState(null);
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [focusedField, setFocusedField] = useState(null);
  const [screenWidth, setScreenWidth] = useState(width);
  const [screenHeight, setScreenHeight] = useState(height);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [activeDateField, setActiveDateField] = useState(null);
  const [loading, setLoading] = useState(false);

  // ── Image state (mirrors ServiceUpdate pattern) ──
  const [imageUrl, setImgurl] = useState(null);       // existing url from server
  const [selectedImage, setSelectedImage] = useState(null); // newly picked local uri
  const [imageRemoved, setImageRemoved] = useState(false);  // user explicitly removed

  const { userEmail, selectedCar } = useSelector((state) => state.user);

  // Computed display: newly selected > existing url > null
  const displayImage = imageRemoved
    ? null
    : selectedImage || imageUrl || null;

  useEffect(() => {
    console.log({
      imageUrl,
      selectedImage,
      imageRemoved,
      displayImage,
    });
  }, [imageUrl, selectedImage, imageRemoved]);

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenWidth(window.width);
      setScreenHeight(window.height);
    });
    return () => subscription?.remove();
  }, []);

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

  // Populate form when updateData changes
  useEffect(() => {
    if (!updateData) return;

    setDocumentName(updateData.documentName || '');
    setImgurl(updateData.imageUrl || '');
    setSelectedImage(null);
    setImageRemoved(false);
    setRemindMe(updateData.remindMe || false);

    setIssueDate(
      updateData.issueDate?._seconds
        ? new Date(updateData.issueDate._seconds * 1000)
        : null,
    );

    setExpiryDate(
      updateData.expiryDate?._seconds
        ? new Date(updateData.expiryDate._seconds * 1000)
        : null,
    );

    setDescription(updateData.description || '');
    setFile(updateData.file || null);
  }, [updateData, DocumentUpdateModal]);

  const handleClose = () => {
    setForView(false);
    setDocumentUpdateModal(false);
    setDocumentName('');
    setIssueDate(null);
    setExpiryDate(null);
    setDescription('');
    setFile(null);
    setRemindMe(false);
    setErrors({});
    setFocusedField(null);
    setShowDatePicker(false);
    setActiveDateField(null);
    setSelectedImage(null);
    setImageRemoved(false);
    setImgurl(null);
  };

  const formatDate = (date) => {
    if (!date) return '';
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const openDatePicker = (field) => {
    Keyboard.dismiss();
    setActiveDateField(field);
    setFocusedField(field);
    setShowDatePicker(true);
  };

  const handleDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      setFocusedField(null);
    }

    if (event.type === 'dismissed') {
      setShowDatePicker(false);
      setFocusedField(null);
      return;
    }

    if (selectedDate) {
      if (activeDateField === 'issueDate') {
        setIssueDate(selectedDate);
        if (errors.issueDate) setErrors((e) => ({ ...e, issueDate: '' }));
      } else if (activeDateField === 'expiryDate') {
        setExpiryDate(selectedDate);
        if (errors.expiryDate) setErrors((e) => ({ ...e, expiryDate: '' }));
      }
    }

    if (Platform.OS === 'ios') {
      setShowDatePicker(false);
      setFocusedField(null);
    }
  };

  // ── Pick image from gallery ──────────────────────────────────────────────
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

  // ── Remove image ─────────────────────────────────────────────────────────
  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImageRemoved(true);
    setImgurl('');
  };

  const validate = () => {
    const newErrors = {};
    if (!documentName.trim()) newErrors.documentName = 'Document name is required.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    try {
      setLoading(true);

      let finalImageUrl = imageRemoved ? '' : (imageUrl || '');

      if (selectedImage) {
        const uploadResult = await uploadImageToServer(selectedImage);
        if (uploadResult?.success) {
          finalImageUrl = uploadResult.url;
          setImgurl(finalImageUrl);        
          setSelectedImage(null);          
        } else {
          console.error('Image upload failed');
          setLoading(false);
          return;
        }
      }

      console.log('Finale Url::', finalImageUrl);

      const updatedDocument = {
        documentName,
        issueDate,
        expiryDate,
        description,
        file,
        remindMe,
        imageUrl: finalImageUrl,
      };

      await updateUserDocument(
        userEmail,
        updatedDocument,
        selectedCar,
        updateData.id,
      );

      onDocumentUpdated?.();
      handleClose();
    } catch (error) {
      console.log('Update failed:', error);
      setErrors({ api: 'Failed to update document. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const fieldStyle = (key, value) => {
    if (forView) {
      return { borderColor: 'rgba(238, 241, 245, 1)' };
    }
    return {
      borderColor: errors[key]
        ? '#CC3333'
        : value && value.toString().trim() !== ''
        ? 'rgba(0, 78, 171, 1)'
        : focusedField === key
        ? 'rgba(0, 78, 171, 1)'
        : 'rgba(238, 241, 245, 1)',
    };
  };

  const isFormValid = useMemo(() => {
    return documentName.trim().length > 0;
  }, [documentName]);

  const isTablet = screenWidth >= 768;
  const isLandscape = screenWidth > screenHeight;

  const datePickerValue =
    activeDateField === 'issueDate'
      ? issueDate || new Date()
      : expiryDate || new Date();

  const shouldShowDatesSection = useMemo(() => {
    if (!forView) return true;
    return issueDate !== null || expiryDate !== null;
  }, [forView, issueDate, expiryDate]);

  return (
    <View style={styles.container}>
      <Modal
        isVisible={DocumentUpdateModal}
        style={styles.modal}
        statusBarTranslucent
        animationIn="slideInUp"
        animationOut="slideOutDown"
        avoidKeyboard
        onBackdropPress={handleClose}
        onBackButtonPress={handleClose}
      >
        <KeyboardAvoidingView
          behavior={keyboardBehavior}
          style={[
            styles.modalView,
            isTablet && styles.modalViewTablet,
            isLandscape && styles.modalViewLandscape,
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, isTablet && styles.titleTablet]}>
              {forView ? 'View Document' : 'Update Document'}
            </Text>
            <TouchableOpacity
              onPress={handleClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <CloseIcon />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={styles.inner}>
              <View style={styles.formContainer}>

                {/* Document Name */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.labelText, isTablet && styles.labelTextTablet]}>
                    Document Name
                  </Text>
                  <TextInput
                    editable={!forView}
                    style={[
                      styles.inputField,
                      { color: '#041933' },    
                      fieldStyle('documentName', documentName),
                      isTablet && styles.inputFieldTablet,
                    ]}
                    placeholder="Enter name"
                    placeholderTextColor="rgba(4, 25, 51, 0.5)"
                    value={documentName}
                    onFocus={() => setFocusedField('documentName')}
                    onBlur={() => setFocusedField(null)}
                    onChangeText={(val) => {
                      setDocumentName(val);
                      if (errors.documentName)
                        setErrors((e) => ({ ...e, documentName: '' }));
                    }}
                  />
                  {errors.documentName ? (
                    <Text style={styles.errorText}>{errors.documentName}</Text>
                  ) : null}
                </View>

                {/* Issue Date & Expiry Date Row */}
                {shouldShowDatesSection && (
                  <View style={[styles.dateRow, isLandscape && styles.dateRowLandscape]}>

                    {/* Issue Date */}
                    {(!forView || issueDate !== null) && (
                      <View style={styles.dateColumn}>
                        <Text style={[styles.labelText, isTablet && styles.labelTextTablet]}>
                          Issue Date
                        </Text>
                        <TouchableOpacity
                          disabled={forView}
                          onPress={() => openDatePicker('issueDate')}
                          style={[
                            styles.datePickerButton,
                            fieldStyle('issueDate', issueDate),
                            isTablet && styles.datePickerButtonTablet,
                          ]}
                        >
                          <Text
                            style={[
                              styles.datePickerPlaceholder,
                              isTablet && styles.datePickerPlaceholderTablet,
                              issueDate && { color: '#041933' },
                            ]}
                          >
                            {issueDate ? formatDate(issueDate) : 'Select date'}
                          </Text>
                          {!forView && (
                            <SelectIcon
                              color={
                                issueDate
                                  ? 'rgba(4, 25, 51, 1)'
                                  : 'rgba(4, 25, 51, 0.5)'
                              }
                            />
                          )}
                        </TouchableOpacity>
                        {errors.issueDate ? (
                          <Text style={styles.errorText}>{errors.issueDate}</Text>
                        ) : null}
                      </View>
                    )}

                    {/* Expiry Date */}
                    {(!forView || expiryDate !== null) && (
                      <View style={styles.dateColumn}>
                        <View style={styles.expiryLabelRow}>
                          <Text style={[styles.labelText, isTablet && styles.labelTextTablet]}>
                            Expiry Date
                          </Text>
                          {/* ONLY RENDER THE REMINDER TOGGLE IF NOT IN VIEW MODE */}
                          {!forView && (
                            <View style={styles.reminderContainer}>
                              <TouchableOpacity
                                disabled={forView}
                                activeOpacity={0.8}
                                onPress={() => setRemindMe((prev) => !prev)}
                                style={[
                                  styles.customTrack,
                                  isTablet && styles.customTrackTablet,
                                  {
                                    backgroundColor: remindMe
                                      ? '#004EAB'
                                      : 'rgba(0, 78, 171, 0.2)',
                                  },
                                ]}
                              >
                                <View
                                  style={[
                                    styles.customThumb,
                                    isTablet && styles.customThumbTablet,
                                    {
                                      transform: [
                                        { translateX: remindMe ? (isTablet ? 8 : 6) : 0 },
                                      ],
                                    },
                                  ]}
                                />
                              </TouchableOpacity>
                              <Text
                                style={[
                                  styles.remindMeText,
                                  isTablet && styles.remindMeTextTablet,
                                ]}
                              >
                                Remind Me
                              </Text>
                            </View>
                          )}
                        </View>

                        <TouchableOpacity
                          disabled={forView}
                          onPress={() => openDatePicker('expiryDate')}
                          style={[
                            styles.datePickerButton,
                            fieldStyle('expiryDate', expiryDate),
                            isTablet && styles.datePickerButtonTablet,
                          ]}
                        >
                          <Text
                            style={[
                              styles.datePickerPlaceholder,
                              isTablet && styles.datePickerPlaceholderTablet,
                              expiryDate && { color: '#041933' },
                            ]}
                          >
                            {expiryDate ? formatDate(expiryDate) : 'Select date'}
                          </Text>
                          {!forView && (
                            <SelectIcon
                              color={
                                expiryDate
                                  ? 'rgba(4, 25, 51, 1)'
                                  : 'rgba(4, 25, 51, 0.5)'
                              }
                            />
                          )}
                        </TouchableOpacity>
                        {errors.expiryDate ? (
                          <Text style={styles.errorText}>{errors.expiryDate}</Text>
                        ) : null}
                      </View>
                    )}
                  </View>
                )}

                {/* Description */}
                {(!forView || description.trim() !== '') && (
                  <View style={styles.inputGroup}>
                    <Text style={[styles.labelText, isTablet && styles.labelTextTablet]}>
                      Description
                    </Text>
                    <View
                      style={[
                        styles.descriptionContainer,
                        fieldStyle('description', description),
                      ]}
                    >
                      <TextInput
                        editable={!forView}
                        style={[
                          styles.inputWithIcon,
                          isTablet && styles.inputWithIconTablet,
                          { color: '#041933' },   
                        ]}
                        placeholder="Enter description"
                        placeholderTextColor={'rgba(4, 25, 51, 0.5)'}
                        multiline
                        numberOfLines={screenWidth < 400 ? 3 : 4}
                        textAlignVertical="top"
                        value={description}
                        onFocus={() => setFocusedField('description')}
                        onBlur={() => setFocusedField(null)}
                        onChangeText={(val) => {
                          setDescription(val);
                          if (errors.description)
                            setErrors((e) => ({ ...e, description: '' }));
                        }}
                        onSubmitEditing={Keyboard.dismiss}
                      />
                    </View>
                    {errors.description ? (
                      <Text style={styles.errorText}>{errors.description}</Text>
                    ) : null}
                  </View>
                )}

                {/* Upload / Image Preview */}
                {(!forView || displayImage) && (
                  <View style={styles.inputGroup}>
                    {!displayImage ? (
                      <TouchableOpacity
                        style={[
                          styles.uploadContainer,
                          isTablet && styles.uploadContainerTablet,
                          errors.file && { borderColor: '#CC3333' },
                        ]}
                        onPress={handleSelectImage}
                        disabled={forView}
                        activeOpacity={0.7}
                      >
                        <Upload
                          color={'black'}
                          width={isTablet ? 28 : 24}
                          height={isTablet ? 28 : 24}
                        />
                        <Text
                          style={[
                            styles.uploadText,
                            isTablet && styles.uploadTextTablet,
                          ]}
                        >
                          {file ? file.name : 'Upload Document (Photo/PDF)'}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <View
                        style={[
                          styles.uploadContainer, { borderWidth: forView ? 0 : 1 },
                          isTablet && styles.uploadContainerTablet,
                        ]}
                      >
                        <Image
                          style={styles.receiptImage}
                          source={{ uri: displayImage }}
                        />
                        {forView ? null : (
                          <TouchableOpacity
                            onPress={handleRemoveImage}
                            style={styles.removeImageBadge}
                          >
                            <Close />
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                    {errors.file ? (
                      <Text style={styles.errorText}>{errors.file}</Text>
                    ) : null}
                  </View>
                )}

              </View>

              {/* Save Button */}
              {forView ? null : (
                <TouchableOpacity
                  style={[
                    styles.button,
                    isTablet && styles.buttonTablet,
                    !isFormValid && { opacity: 0.5 },
                  ]}
                  onPress={handleSave}
                  disabled={!isFormValid || loading}
                >
                  <Text style={[styles.buttonText, isTablet && styles.buttonTextTablet]}>
                    {loading ? 'Updating...' : 'Update Document'}
                  </Text>
                </TouchableOpacity>
              )}

            </View>
          </ScrollView>

          {/* Date Picker */}
          {showDatePicker && !forView && (
            <DateTimePicker
              value={datePickerValue}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
            />
          )}

        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

export default DocumentUpdate;

const styles = StyleSheet.create({
  container: { flex: 1 },
  modal: { margin: 0, justifyContent: 'flex-end' },
  modalView: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '90%',
  },
  modalViewTablet: {
    marginHorizontal: '10%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  modalViewLandscape: {
    marginHorizontal: '15%',
    maxHeight: '90%',
  },
  scrollContent: {
    flexGrow: 1,
  },
  inner: {
    padding: 16,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingHorizontal: 20,
    paddingBottom: 0,
  },
  title: {
    fontSize: 18,
    color: '#041933',
    fontFamily: 'RobotoCondensed400',
  },
  titleTablet: {
    fontSize: 22,
  },
  formContainer: {
    gap: 12,
  },
  inputGroup: {
    gap: 8,
  },
  labelText: {
    fontSize: 14,
    color: '#041933',
    fontFamily: 'RobotoCondensed400',
  },
  labelTextTablet: {
    fontSize: 16,
  },
  inputField: {
    height: 40,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderColor: 'rgba(238, 241, 245, 1)',
    fontSize: 14,
  },
  inputFieldTablet: {
    height: 44,
    fontSize: 16,
    paddingVertical: 14,
    paddingHorizontal: 15,
  },
  errorText: {
    fontSize: 12,
    color: '#CC3333',
    marginTop: 2,
    fontFamily: 'RobotoCondensed400',
  },
  dateRow: {
    flexDirection: 'row',
    gap: 15,
  },
  dateRowLandscape: {
    gap: 16,
  },
  dateColumn: {
    flex: 1,
    gap: 8,
  },
  expiryLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reminderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  datePickerButton: {
    height: 40,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 0,
    paddingHorizontal: 13,
    borderColor: 'rgba(238, 241, 245, 1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  datePickerButtonTablet: {
    height: 44,
    paddingVertical: 13,
    paddingHorizontal: 15,
  },
  datePickerPlaceholder: {
    fontSize: 14,
    color: 'rgba(4, 25, 51, 0.5)',
    fontFamily: 'RobotoCondensed400',
  },
  datePickerPlaceholderTablet: {
    fontSize: 16,
  },
  remindMeText: {
    fontSize: 14,
    fontFamily: 'RobotoCondensed300',
    color: '#041933',
  },
  remindMeTextTablet: {
    fontSize: 16,
  },
  customTrack: {
    width: 18,
    height: 12,
    borderRadius: 11,
    padding: 1,
    justifyContent: 'center',
  },
  customTrackTablet: {
    width: 22,
    height: 14,
  },
  customThumb: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#fff',
  },
  customThumbTablet: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  descriptionContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(238, 241, 245, 1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 78,
  },
  inputWithIcon: {
    flex: 1,
    height: '100%',
    paddingVertical: 13,
    fontSize: 14,
  },
  inputWithIconTablet: {
    fontSize: 16,
    paddingVertical: 14,
  },
  uploadContainer: {
    height: 100,
    borderRadius: 12,
    borderColor: 'rgba(43, 107, 185, 1)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    overflow: 'hidden',
    position: 'relative', // Ensures absolute badge aligns perfectly to this container
  },
  uploadContainerTablet: {
    height: 120,
  },
  uploadText: {
    color: 'rgba(4, 25, 51, 0.5)',
    textAlign: 'center',
    fontSize: 12,
  },
  uploadTextTablet: {
    fontSize: 14,
  },
  receiptImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    resizeMode: 'cover',
  },
  removeImageBadge: {
    height: 20,
    width: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fff',
    backgroundColor: '#004EAB',
    position: 'absolute',
    top: 4,     // Tucked perfectly into the top corner
    right: 4,   // Tucked perfectly into the right corner
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
  buttonTablet: {
    padding: 14,
    borderRadius: 12,
    marginTop: 28,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'RobotoCondensed400',
  },
  buttonTextTablet: {
    fontSize: 18,
  },
});