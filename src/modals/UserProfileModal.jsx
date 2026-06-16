import {
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  Image,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Modal from 'react-native-modal';
import { launchImageLibrary } from 'react-native-image-picker';
import CameraWhite from '../assets/svg/CameraWhite.jsx';
import CloseIcon from '../assets/svg/CloseIcon.jsx';
import Close from '../assets/svg/Close.jsx';
import EyeSvg from '../assets/svg/EyeSvg';
import CloseEye from '../assets/svg/CloseEye';
import { fetchUserByEmail } from '../store/fetchSlice.js';
import { saveUserToFirestore } from '../store/userSlice.js';
import { useSelector } from 'react-redux';

// Firebase Auth imports
import auth from '@react-native-firebase/auth';

const StaticSkeletonBlock = ({ width, height, borderRadius = 4, style }) => (
  <View
    style={[
      {
        width,
        height,
        borderRadius,
        backgroundColor: '#E1E9EE',
      },
      style,
    ]}
  />
);

const FieldError = ({ message }) => {
  if (!message) return null;
  return <Text style={styles.errorText}>{message}</Text>;
};

const UserProfileModal = ({ userProfile, setUserProfile, onProfileUpdated }) => {
  const [userData, setUserData] = useState(null);
  const [securedPass, setSecurePass] = useState(true);
  const [securedOldPass, setSecureOldPass] = useState(true);
  const [securedNewPass, setSecureNewPass] = useState(true);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [imageRemoved, setImageRemoved] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');

  const { userEmail } = useSelector((state) => state.user);

  const firebaseUser = auth().currentUser;

  useEffect(() => {
    const getUser = async () => {
      try {
        const res = await fetchUserByEmail(userEmail);
        setUserData(res);
      } catch (error) {
        console.log('Error fetching user:', error);
      }
    };

    if (userEmail && userProfile) {
      getUser();
    }
  }, [userEmail, userProfile]);

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

  const clearError = (field) => {
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const clearAllErrors = () => setErrors({});

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

  const handleSelectImage = async () => {
    const hasPermission = await requestPermission();
    if (!hasPermission) {
      setErrors((prev) => ({
        ...prev,
        image: 'Permission denied. Please allow access to photos.',
      }));
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
      clearError('image');
    }
  };

  const handleRemoveImage = useCallback(() => {
    if (userData?.photo && !selectedImage) {
      deleteImageFromServer(userData.photo);
    }
    setSelectedImage(null);
    setImageRemoved(true);
    setUserData((prevState) => ({
      ...prevState,
      photo: '',
    }));
  }, [userData?.photo, selectedImage]);

  const handleNameChange = (text) => {
    clearError('name');
    setUserData((prevState) => ({
      ...prevState,
      name: text,
    }));
  };

  const handleEmailChange = (text) => {
    clearError('email');
    setUserData((prevState) => ({
      ...prevState,
      email: text,
    }));
  };

  const handleCloseModal = () => {
    setUserProfile(false);
    setIsChangingPassword(false);
    setOldPassword('');
    setNewPassword('');
    setSecureOldPass(true);
    setSecureNewPass(true);
    setImageRemoved(false);
    setSelectedImage(null);
    setIsUploading(false);
    setUserData(null);
    clearAllErrors();
    setSuccessMessage('');
  };

  const displayImage = useMemo(() => {
    if (imageRemoved) return null;
    if (selectedImage) return selectedImage;
    return userData?.photo || null;
  }, [imageRemoved, selectedImage, userData?.photo]);

  // ─── Validation ──────────────────────────────────────────────────────────────

  const validate = () => {
    const newErrors = {};

    if (!isChangingPassword) {
      if (!userData?.name?.trim()) {
        newErrors.name = 'Full name is required.';
      }
      // Email is read-only (editable={false}), so we skip email validation here.
    }

    if (isChangingPassword) {
      if (!oldPassword.trim()) {
        newErrors.oldPassword = 'Please enter your current password.';
      }

      if (!newPassword.trim()) {
        newErrors.newPassword = 'Please enter a new password.';
      } else if (newPassword.trim().length < 6) {
        newErrors.newPassword = 'Password must be at least 6 characters.';
      } else if (newPassword.trim() === oldPassword.trim()) {
        newErrors.newPassword = 'New password must be different from the current one.';
      }
    }

    return newErrors;
  };

  // ─── Re-authenticate ──────────────────────────────────────────────────────────
  // Always pass the password explicitly — never rely on closure values here.

  const reauthenticateUser = async (currentPassword) => {
    if (!firebaseUser) throw new Error('No user is currently signed in.');
    if (!firebaseUser.email) throw new Error('No email associated with the current user.');

    const credential = auth.EmailAuthProvider.credential(
      firebaseUser.email,
      currentPassword,
    );
    await firebaseUser.reauthenticateWithCredential(credential);
  };

  // ─── Map Firebase error codes ─────────────────────────────────────────────────

  const mapFirebaseError = (code) => {
    switch (code) {
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return { field: 'oldPassword', message: 'Current password is incorrect.' };
      case 'auth/too-many-requests':
        return { field: 'oldPassword', message: 'Too many attempts. Please wait and try again.' };
      case 'auth/requires-recent-login':
        return { field: 'general', message: 'Session expired. Please log out and log back in.' };
      case 'auth/weak-password':
        return { field: 'newPassword', message: 'Password is too weak. Use at least 6 characters.' };
      case 'auth/email-already-in-use':
        return { field: 'email', message: 'This email is already used by another account.' };
      case 'auth/invalid-email':
        return { field: 'email', message: 'Please enter a valid email address.' };
      default:
        return { field: 'general', message: 'Something went wrong. Please try again.' };
    }
  };

  // ─── Password Change Handler ──────────────────────────────────────────────────

  const handleChangePassword = async () => {
    setSuccessMessage('');
    const validationErrors = validate();

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    clearAllErrors();
    setIsUploading(true);

    try {
      // Step 1: Re-authenticate with the current password
      await reauthenticateUser(oldPassword.trim());

      // Step 2: Update the password in Firebase Auth
      await firebaseUser.updatePassword(newPassword.trim());

      // Step 3: Update Firestore with the new password so it stays in sync.
      await saveUserToFirestore({
        name: userData.name?.trim() || '',
        email: firebaseUser.email || '',
        photo: userData.photo || '',
        termCondition: userData.termCondition || false,
        updatedAt: new Date().toISOString(),
        pass: newPassword.trim(),
      });

      // Step 4: Keep local userData in sync so the display-only field reflects
      // the new password immediately without a re-fetch.
      setUserData((prev) => ({ ...prev, pass: newPassword.trim() }));

      // Step 4: Reset the password form
      setIsChangingPassword(false);
      setOldPassword('');
      setNewPassword('');
      setSecureOldPass(true);
      setSecureNewPass(true);

      setSuccessMessage('Password changed successfully.');
      onProfileUpdated?.();
    } catch (error) {
      console.error('Password change error:', error);
      const { field, message } = mapFirebaseError(error.code);
      setErrors({ [field]: message });
    } finally {
      setIsUploading(false);
    }
  };

  // ─── Profile Update Handler (name + photo only) ───────────────────────────────

  const handleUpdateProfile = useCallback(async () => {
    if (!userData || !firebaseUser) return;

    if (isChangingPassword) {
      // Delegate to the dedicated password handler
      await handleChangePassword();
      return;
    }

    setSuccessMessage('');
    const validationErrors = validate();

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    clearAllErrors();
    setIsUploading(true);

    try {
      let finalImageUrl = imageRemoved ? null : userData.photo || null;

      // Upload new image if one was selected
      if (selectedImage) {
        const uploadResult = await uploadImageToServer(selectedImage);

        if (uploadResult?.success) {
          finalImageUrl = uploadResult.url;
        } else {
          setErrors({ image: 'Image upload failed. Please try again.' });
          setIsUploading(false);
          return;
        }
      }

      // Save updated profile data to Firestore
      // Email is read-only in the UI, so we keep the existing Firebase Auth email.
      await saveUserToFirestore({
        name: userData.name?.trim() || '',
        email: firebaseUser.email || '',   // always use the authoritative Auth email
        photo: finalImageUrl || '',
        termCondition: userData.termCondition || false,
        updatedAt: new Date().toISOString(),
        pass: userData.pass || '',         // keep existing value untouched
      });

      // Sync local state
      setUserData((prev) => ({
        ...prev,
        photo: finalImageUrl,
        email: firebaseUser.email,
      }));

      setSelectedImage(null);
      setImageRemoved(false);

      setSuccessMessage('Your profile has been updated successfully.');
      onProfileUpdated?.();
    } catch (error) {
      console.error('Profile update error:', error);
      const { field, message } = mapFirebaseError(error.code);
      setErrors({ [field]: message });
    } finally {
      setIsUploading(false);
    }
  }, [
    userData,
    selectedImage,
    imageRemoved,
    isChangingPassword,
    oldPassword,
    newPassword,
    firebaseUser,
    onProfileUpdated,
  ]);

  // ─── Skeleton ─────────────────────────────────────────────────────────────────

  const renderSkeleton = () => (
    <View style={styles.modalInner}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <StaticSkeletonBlock width={32} height={32} borderRadius={8} />
          <StaticSkeletonBlock width={120} height={16} />
        </View>
        <StaticSkeletonBlock width={24} height={24} borderRadius={12} />
      </View>

      <View style={{ marginTop: 26, gap: 16 }}>
        <View style={{ gap: 8 }}>
          <StaticSkeletonBlock width={80} height={14} />
          <StaticSkeletonBlock width="100%" height={40} borderRadius={12} />
        </View>
        <View style={{ gap: 8 }}>
          <StaticSkeletonBlock width={50} height={14} />
          <StaticSkeletonBlock width="100%" height={40} borderRadius={12} />
        </View>
        <View style={{ gap: 8 }}>
          <StaticSkeletonBlock width={70} height={14} />
          <StaticSkeletonBlock width="100%" height={40} borderRadius={12} />
        </View>
      </View>
    </View>
  );

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <Modal
        isVisible={userProfile}
        style={styles.modal}
        statusBarTranslucent
        backdropColor="rgba(4, 25, 51, 0.6)"
        onBackdropPress={() => {
          Keyboard.dismiss();
          handleCloseModal();
        }}
        onBackButtonPress={handleCloseModal}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <KeyboardAvoidingView style={styles.modalView} behavior={keyboardBehavior}>
            {userData ? (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ flexGrow: 1 }}>
                <View style={styles.modalInner}>
                  {/* Profile Header */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}>
                    {displayImage ? (
                      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                        <TouchableOpacity onPress={handleSelectImage} activeOpacity={0.7}>
                          <View style={styles.profileIconContainer}>
                            <Image
                              source={{ uri: displayImage }}
                              style={styles.profileImage}
                            />
                            <TouchableOpacity
                              onPress={handleRemoveImage}
                              style={styles.removeImageBadge}
                              activeOpacity={0.7}>
                              <Close />
                            </TouchableOpacity>
                          </View>
                        </TouchableOpacity>
                        <Text style={{ color: '#041933', fontWeight: '500' }}>
                          {userData.name}
                        </Text>
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                        <TouchableOpacity onPress={handleSelectImage} activeOpacity={0.7}>
                          <View style={styles.profileIconContainer}>
                            <Text style={styles.initialsText}>
                              {userData.name?.slice(0, 2).toUpperCase() || 'UN'}
                            </Text>
                            <View style={styles.badge}>
                              <CameraWhite />
                            </View>
                          </View>
                        </TouchableOpacity>
                        <Text style={{ color: '#041933', fontWeight: '500' }}>
                          {userData.name}
                        </Text>
                      </View>
                    )}

                    <TouchableOpacity onPress={handleCloseModal}>
                      <CloseIcon />
                    </TouchableOpacity>
                  </View>

                  {/* Image error */}
                  <FieldError message={errors.image} />

                  {/* General error banner */}
                  {errors.general && (
                    <View style={styles.errorBanner}>
                      <Text style={styles.errorBannerText}>{errors.general}</Text>
                    </View>
                  )}

                  {/* Success banner */}
                  {successMessage ? (
                    <View style={styles.successBanner}>
                      <Text style={styles.successBannerText}>{successMessage}</Text>
                    </View>
                  ) : null}

                  {/* Form Fields */}
                  <View style={{ marginTop: 26, gap: 16 }}>

                    {/* Full Name & Email — hidden while changing password */}
                    {!isChangingPassword && (
                      <>
                        <View style={{ gap: 4 }}>
                          <Text style={styles.label}>Full Name</Text>
                          <TextInput
                            style={[styles.input, errors.name && styles.inputError]}
                            value={userData.name || ''}
                            onChangeText={handleNameChange}
                          />
                          <FieldError message={errors.name} />
                        </View>

                        <View style={{ gap: 4 }}>
                          <Text style={styles.label}>Email</Text>
                          <View style={{ opacity: 0.6 }}>
                            <TextInput
                              style={styles.input}
                              value={userData.email || ''}
                              keyboardType="email-address"
                              autoCapitalize="none"
                              editable={false}
                            />
                          </View>
                        </View>
                      </>
                    )}

                    {/* Password Section */}
                    {!isChangingPassword ? (
                      /* ── Display-only password row ── */
                      <View style={{ gap: 4 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={styles.label}>Password</Text>
                          <TouchableOpacity
                            onPress={() => {
                              setIsChangingPassword(true);
                              setSuccessMessage('');
                              clearError('oldPassword');
                              clearError('newPassword');
                            }}>
                            <Text style={[styles.label, styles.linkText]}>
                              Change password
                            </Text>
                          </TouchableOpacity>
                        </View>
                        <View style={{ position: 'relative', justifyContent: 'center' }}>
                          <TextInput
                            style={[styles.input, { paddingRight: 44 }]}
                            value={userData.pass || ''}
                            secureTextEntry={securedPass}
                            editable={false}
                          />
                          <TouchableOpacity
                            onPress={() => setSecurePass(!securedPass)}
                            style={{ position: 'absolute', right: 12 }}>
                            {securedPass
                              ? <CloseEye color="#041933" />
                              : <EyeSvg color="#041933" />}
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      /* ── Change-password form ── */
                      <View style={{ gap: 16 }}>
                        {/* Current Password */}
                        <View style={{ gap: 4 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={styles.label}>Current Password</Text>
                            <TouchableOpacity
                              onPress={() => {
                                setIsChangingPassword(false);
                                setOldPassword('');
                                setNewPassword('');
                                clearError('oldPassword');
                                clearError('newPassword');
                                clearError('general');
                              }}>
                              <Text style={[styles.label, styles.linkText]}>
                                Cancel
                              </Text>
                            </TouchableOpacity>
                          </View>
                          <View style={{ position: 'relative', justifyContent: 'center' }}>
                            <TextInput
                              style={[
                                styles.input,
                                { paddingRight: 44 },
                                errors.oldPassword && styles.inputError,
                              ]}
                              value={oldPassword}
                              onChangeText={(text) => {
                                setOldPassword(text);
                                clearError('oldPassword');
                                clearError('general');
                              }}
                              secureTextEntry={securedOldPass}
                              placeholder="Enter current password"
                              placeholderTextColor="#A0AABA"
                              autoComplete="password"
                              textContentType="password"
                            />
                            <TouchableOpacity
                              onPress={() => setSecureOldPass(!securedOldPass)}
                              style={{ position: 'absolute', right: 12 }}>
                              {securedOldPass
                                ? <CloseEye color="#041933" />
                                : <EyeSvg color="#041933" />}
                            </TouchableOpacity>
                          </View>
                          <FieldError message={errors.oldPassword} />
                        </View>

                        {/* New Password */}
                        <View style={{ gap: 4 }}>
                          <Text style={styles.label}>New Password</Text>
                          <View style={{ position: 'relative', justifyContent: 'center' }}>
                            <TextInput
                              style={[
                                styles.input,
                                { paddingRight: 44 },
                                errors.newPassword && styles.inputError,
                              ]}
                              value={newPassword}
                              onChangeText={(text) => {
                                setNewPassword(text);
                                clearError('newPassword');
                              }}
                              secureTextEntry={securedNewPass}
                              placeholder="Min. 6 characters"
                              placeholderTextColor="#A0AABA"
                              autoComplete="new-password"
                              textContentType="newPassword"
                            />
                            <TouchableOpacity
                              onPress={() => setSecureNewPass(!securedNewPass)}
                              style={{ position: 'absolute', right: 12 }}>
                              {securedNewPass
                                ? <CloseEye color="#041933" />
                                : <EyeSvg color="#041933" />}
                            </TouchableOpacity>
                          </View>
                          <FieldError message={errors.newPassword} />
                        </View>

                        {/* Password strength hint */}
                        <Text style={styles.hintText}>
                          Use at least 6 characters, mixing letters and numbers.
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Save Button */}
                  <TouchableOpacity
                    style={[styles.updateButton, isUploading && styles.buttonDisabled]}
                    onPress={handleUpdateProfile}
                    disabled={isUploading}
                    activeOpacity={0.8}>
                    <Text style={styles.updateButtonText}>
                      {isUploading
                        ? isChangingPassword ? 'Changing...' : 'Saving...'
                        : isChangingPassword ? 'Change Password' : 'Save Profile'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            ) : (
              renderSkeleton()
            )}
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

export default UserProfileModal;

const styles = StyleSheet.create({
  container: { flex: 1 },
  modal: { margin: 0, justifyContent: 'flex-end' },
  modalView: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '90%',
    backgroundColor: '#fff',
  },
  modalInner: { marginHorizontal: 24, marginTop: 24, marginBottom: 24 },
  profileIconContainer: {
    height: 32,
    width: 32,
    backgroundColor: '#004EAB',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  profileImage: {
    height: '100%',
    width: '100%',
    borderRadius: 8,
    resizeMode: 'cover',
  },
  initialsText: {
    fontSize: 14,
    fontFamily: 'RobotoCondensed400',
    color: '#fff',
  },
  badge: {
    height: 14,
    width: 14,
    borderRadius: 7,
    backgroundColor: '#004EAB',
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    top: -4,
    right: -4,
    borderWidth: 0.6,
    borderColor: '#fff',
  },
  removeImageBadge: {
    height: 14,
    width: 14,
    borderRadius: 7,
    backgroundColor: '#004EAB',
    position: 'absolute',
    top: -4,
    right: -4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.6,
    borderColor: '#fff',
  },
  label: {
    color: '#041933',
    fontSize: 14,
    fontFamily: 'RobotoCondensed400',
  },
  linkText: {
    color: '#004EAB',
    textDecorationLine: 'underline',
  },
  input: {
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderRadius: 12,
    height: 40,
    borderColor: '#EEF1F5',
    color: '#041933',
  },
  inputError: {
    borderColor: '#E53935',
  },
  errorText: {
    color: '#E53935',
    fontSize: 12,
    fontFamily: 'RobotoCondensed400',
    marginTop: 2,
  },
  errorBanner: {
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  errorBannerText: {
    color: '#C62828',
    fontSize: 13,
    fontFamily: 'RobotoCondensed400',
  },
  successBanner: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  successBannerText: {
    color: '#2E7D32',
    fontSize: 13,
    fontFamily: 'RobotoCondensed400',
  },
  hintText: {
    color: '#6B7A8D',
    fontSize: 12,
    fontFamily: 'RobotoCondensed400',
    marginTop: -8,
  },
  updateButton: {
    backgroundColor: '#004EAB',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  updateButtonText: {
    color: '#FFFFFF',
    fontFamily: 'RobotoCondensed400',
    fontSize: 14,
  },
});
