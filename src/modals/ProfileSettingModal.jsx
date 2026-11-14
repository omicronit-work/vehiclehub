import {
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  Image,
  ActivityIndicator,
} from 'react-native';
import Text from '../components/ui/AppText';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Modal from 'react-native-modal';
import { pickImage } from '../util/methods/useImagePicker';
import { useSelector } from 'react-redux';

import CameraWhite from '../assets/svg/CameraWhite.jsx';
import CloseX from '../assets/svg/CloseX.jsx';
import Close from '../assets/svg/Close.jsx';

import { fetchUserByEmail } from '../store/fetchSlice.js';
import { saveUserToFirestore } from '../store/userSlice.js';

import { Typography } from '../styles/typography.js';
import { Colors } from '../styles/colors.js';
import { themecolors } from '../styles/themecolors.js';

// Firebase Auth imports
import {
  getAuth,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from '@react-native-firebase/auth';
import { uploadImage, deleteImage } from '../util/imageStorage';
import SkeletonBlock from '../components/ui/SkeletonBlock.jsx';
import { accent } from '../theme/accent';
import { useHideAdsWhile } from '../util/ads';
import { getInitials } from '../util/initials';
import { useSheetFooterInset } from '../util/methods/useSheetFooterInset';
import { t as tr } from '../i18n';

const FieldError = ({ message, color }) => {
  if (!message) return null;
  return (
    <View style={styles.fieldErrorRow}>
      <View style={[styles.fieldErrorDot, { backgroundColor: color }]} />
      <Text style={[styles.fieldErrorText, { color }]}>{message}</Text>
    </View>
  );
};

// ─── Password strength (visual only, no behavior change) ─────────────────────

const getPasswordStrength = (pass) => {
  if (!pass) return { score: 0, label: '' };
  let score = 0;
  if (pass.length >= 6) score += 1;
  if (pass.length >= 10) score += 1;
  if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 1;
  if (/\d/.test(pass)) score += 1;
  if (/[^A-Za-z0-9]/.test(pass)) score += 1;
  const capped = Math.min(score, 4);
  const labels = [tr('Too short'), tr('Weak'), tr('Okay'), tr('Good'), tr('Strong')];
  return { score: capped, label: labels[capped] };
};

const STRENGTH_COLORS = ['#E53935', '#E53935', '#F9A825', '#7CB342', '#2E7D32'];

const ProfileSettingModal = ({ userProfile, setUserProfile, onProfileUpdated, updateData, setUpdateData, onDeleteAccount }) => {
  useHideAdsWhile(userProfile);
  // The sheet is drawn edge-to-edge (statusBarTranslucent), so without this
  // the system navigation bar covers its last rows.
  const bottomInset = useSheetFooterInset();
  const { theme } = useSelector((store) => store.theme);

  const [userData, setUserData] = useState(null);
  const [originalData, setOriginalData] = useState(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [imageRemoved, setImageRemoved] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);


  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');

  const { userEmail } = useSelector((state) => state.user);
  const firebaseUser = getAuth().currentUser;
  // Google accounts are managed by Google: no password, and the profile is
  // read-only in the app.
  const isPasswordUser = !!firebaseUser?.providerData?.some(p => p.providerId === 'password');

  // ─── Theme palette ───────────────────────────────────────────────────────────

  const c = useMemo(() => {
    const dark = theme === 'dark';
    return {
      dark,
      sheet: dark ? themecolors.darkBlue : themecolors.white,
      text: dark ? themecolors.white : Colors.darkBlue,
      subtext: dark ? 'rgba(255,255,255,0.55)' : '#6B7A8D',
      inputBg: dark ? 'rgba(255,255,255,0.06)' : '#F6F8FB',
      inputBorder: dark ? 'rgba(255,255,255,0.12)' : '#E8EDF4',
      placeholder: dark ? 'rgba(255,255,255,0.4)' : '#A0AABA',
      skeleton: dark ? 'rgba(255,255,255,0.08)' : '#E1E9EE',
      accent: accent.primary,
      accentSoft: dark ? accent.lightAlpha(0.16) : accent.alpha(0.08),
      accentBorder: dark ? accent.lightAlpha(0.65) : accent.primary,
      accentBorderFilled: dark ? accent.lightAlpha(0.65) : accent.primary,
      onAccent: '#FFFFFF',
      danger: '#E53935',
      dangerSoft: 'rgba(229,57,53,0.10)',
      success: dark ? '#81C784' : '#2E7D32',
      successSoft: dark ? 'rgba(129,199,132,0.14)' : 'rgba(46,125,50,0.10)',
      handle: dark ? 'rgba(255,255,255,0.22)' : '#D7DEE8',
      divider: dark ? 'rgba(255,255,255,0.08)' : '#EEF2F7',
      iconBtnBg: dark ? 'rgba(255,255,255,0.08)' : '#F1F4F9',
      avatarRing: dark ? accent.lightAlpha(0.35) : accent.alpha(0.15),
      disabledBtn: dark ? 'rgba(255,255,255,0.12)' : '#D1D5DB',
      disabledBtnText: dark ? 'rgba(255,255,255,0.35)' : '#9CA3AF',
    };
  }, [theme]);

  const s = useMemo(() => makeStyles(c), [c]);

  // ─── Data fetch ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!userProfile) return undefined;
    let cancelled = false;
    // Redux may not have the email yet right after sign-in; the auth user does.
    const authUser = getAuth().currentUser;
    const email = userEmail || authUser?.email;
    // Shown when the profile doc is missing, the read fails, or it is slow
    // (a server read can hang on a bad connection) — never a skeleton forever.
    const fallback = {
      email,
      name: authUser?.displayName || '',
      photo: authUser?.photoURL || '',
    };
    const apply = res => {
      if (cancelled) return;
      setUserData(res);
      // Store original data snapshot for change detection
      setOriginalData({ name: res?.name || '', photo: res?.photo || '' });
    };

    const timer = setTimeout(() => apply(fallback), 6000);
    (async () => {
      try {
        const res = email ? await fetchUserByEmail(email) : null;
        clearTimeout(timer);
        apply(res ? { email, ...res } : fallback);
      } catch (error) {
        console.log('Error fetching user:', error);
        clearTimeout(timer);
        apply(fallback);
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
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

  // ─── Check if data has changed ───────────────────────────────────────────────

  const hasChanges = useMemo(() => {
    if (!userData || !originalData) return false;
    if (isChangingPassword) return true; // Always allow save in password change mode
    if (selectedImage) return true;
    if (imageRemoved) return true;
    if ((userData.name || '').trim() !== (originalData.name || '').trim()) return true;
    if ((userData.photo || '') !== (originalData.photo || '')) return true;
    return false;
  }, [userData, originalData, selectedImage, imageRemoved, isChangingPassword]);

  // ─── Errors ──────────────────────────────────────────────────────────────────

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

  // ─── Media ───────────────────────────────────────────────────────────────────



  const handleSelectImage = async () => {
    const response = await pickImage();

    if (response.assets?.[0]) {
      const localUri = response.assets[0].uri;
      setSelectedImage(localUri);
      setImageRemoved(false);
      clearError('image');
    }
  };

  const handleRemoveImage = useCallback(() => {
    if (userData?.photo && !selectedImage) {
      deleteImage(userData.photo);
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

  const handleCloseModal = () => {
    setUserProfile(false);
    setUpdateData(false);
    setIsChangingPassword(false);
    setOldPassword('');
    setNewPassword('');
    setImageRemoved(false);
    setSelectedImage(null);
    setIsUploading(false);
    setUserData(null);
    setOriginalData(null);
    setFocusedField(null);
    clearAllErrors();
    setSuccessMessage('');
  };

  const handleCancelPasswordChange = () => {
    setIsChangingPassword(false);
    setOldPassword('');
    setNewPassword('');
    clearError('oldPassword');
    clearError('newPassword');
    clearError('general');
    setSuccessMessage('');
  };

  const displayImage = useMemo(() => {
    if (imageRemoved) return null;
    if (selectedImage) return selectedImage;
    return userData?.photo || null;
  }, [imageRemoved, selectedImage, userData?.photo]);

  const strength = useMemo(() => getPasswordStrength(newPassword), [newPassword]);

  // ─── Validation ──────────────────────────────────────────────────────────────

  const validate = () => {
    const newErrors = {};

    if (!isChangingPassword) {
      if (!userData?.name?.trim()) {
        newErrors.name = tr('Full name is required.');
      }
    }

    if (isChangingPassword) {
      if (!oldPassword.trim()) {
        newErrors.oldPassword = tr('Please enter your current password.');
      }

      if (!newPassword.trim()) {
        newErrors.newPassword = tr('Please enter a new password.');
      } else if (newPassword.trim().length < 6) {
        newErrors.newPassword = tr('Password must be at least 6 characters.');
      } else if (newPassword.trim() === oldPassword.trim()) {
        newErrors.newPassword = tr('New password must be different from the current one.');
      }
    }

    return newErrors;
  };

  // ─── Re-authenticate ──────────────────────────────────────────────────────────

  const reauthenticateUser = async (currentPassword) => {
    if (!firebaseUser) throw new Error(tr('No user is currently signed in.'));
    if (!firebaseUser.email) throw new Error(tr('No email associated with the current user.'));

    const credential = EmailAuthProvider.credential(
      firebaseUser.email,
      currentPassword,
    );
    await reauthenticateWithCredential(firebaseUser, credential);
  };

  // ─── Map Firebase error codes ─────────────────────────────────────────────────

  const mapFirebaseError = (code) => {
    switch (code) {
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return { field: 'oldPassword', message: tr('Current password is incorrect.') };
      case 'auth/too-many-requests':
        return { field: 'oldPassword', message: tr('Too many attempts. Please wait and try again.') };
      case 'auth/requires-recent-login':
        return { field: 'general', message: tr('Session expired. Please log out and log back in.') };
      case 'auth/weak-password':
        return { field: 'newPassword', message: tr('Password is too weak. Use at least 6 characters.') };
      case 'auth/email-already-in-use':
        return { field: 'email', message: tr('This email is already used by another account.') };
      case 'auth/invalid-email':
        return { field: 'email', message: tr('Please enter a valid email address.') };
      default:
        return { field: 'general', message: tr('Something went wrong. Please try again.') };
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
      await reauthenticateUser(oldPassword.trim());
      // Firebase Auth owns the password; nothing is written to Firestore.
      await updatePassword(firebaseUser, newPassword.trim());

      setIsChangingPassword(false);
      setOldPassword('');
      setNewPassword('');

      setSuccessMessage(tr('Password changed successfully.'));
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

  // Plain function: it calls validate/handleChangePassword, which are rebuilt
  // every render, so memoizing it only risked a stale closure.
  const handleUpdateProfile = async () => {
    if (!userData || !firebaseUser) return;

    if (isChangingPassword) {
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

      if (selectedImage) {
        const uploadResult = await uploadImage(selectedImage);

        if (uploadResult?.success) {
          finalImageUrl = uploadResult.url;
        } else {
          setErrors({ image: uploadResult?.message || tr('Image upload failed. Please try again.') });
          setIsUploading(false);
          return;
        }
      }

      await saveUserToFirestore({
        name: userData.name?.trim() || '',
        email: firebaseUser.email || '',
        photo: finalImageUrl || '',
        termCondition: userData.termCondition || false,
        updatedAt: new Date().toISOString(),
      });

      setUserData((prev) => ({
        ...prev,
        photo: finalImageUrl,
        email: firebaseUser.email,
      }));

      // Update original data snapshot after successful save
      setOriginalData({
        name: userData.name?.trim() || '',
        photo: finalImageUrl || '',
      });

      setSelectedImage(null);
      setImageRemoved(false);
      // Return to read-only view after a successful save
      setUpdateData(true);

      setSuccessMessage(tr('Your profile has been updated successfully.'));
      onProfileUpdated?.();
    } catch (error) {
      console.error('Profile update error:', error);
      const { field, message } = mapFirebaseError(error.code);
      setErrors({ [field]: message });
    } finally {
      setIsUploading(false);
    }
  };

  // ─── Skeleton ─────────────────────────────────────────────────────────────────

  const renderSkeleton = () => (
    <View style={s.inner}>
      <View style={s.handle} />
      <View style={s.headerRow}>
        <SkeletonBlock color={c.skeleton} width={120} height={20} />
        <SkeletonBlock color={c.skeleton} width={32} height={32} borderRadius={16} />
      </View>
      <View style={{ alignItems: 'center', marginTop: 20, marginBottom: 8 }}>
        <SkeletonBlock color={c.skeleton} width={96} height={96} borderRadius={48} />
        <SkeletonBlock color={c.skeleton} width={140} height={16} style={{ marginTop: 14 }} />
        <SkeletonBlock color={c.skeleton} width={180} height={12} style={{ marginTop: 8 }} />
      </View>
      <View style={{ gap: 16, marginTop: 20 }}>
        <SkeletonBlock color={c.skeleton} width={80} height={12} />
        <SkeletonBlock color={c.skeleton} width="100%" height={52} borderRadius={14} />
        <SkeletonBlock color={c.skeleton} width={80} height={12} />
        <SkeletonBlock color={c.skeleton} width="100%" height={52} borderRadius={14} />
        <SkeletonBlock color={c.skeleton} width={80} height={12} />
        <SkeletonBlock color={c.skeleton} width="100%" height={52} borderRadius={14} />
      </View>
      <SkeletonBlock color={c.skeleton} width="100%" height={52} borderRadius={14} style={{ marginTop: 28 }} />
    </View>
  );

  // ─── Avatar ───────────────────────────────────────────────────────────────────

  // Google accounts take their photo from Google, so there's nothing to edit here.
  const canEditPhoto = !updateData && isPasswordUser;

  const renderAvatar = () => (
    <View style={s.avatarWrap}>
      <TouchableOpacity
        activeOpacity={canEditPhoto ? 0.85 : 1}
        onPress={canEditPhoto ? handleSelectImage : null}
        disabled={!canEditPhoto}
        accessibilityRole={canEditPhoto ? 'button' : undefined}
        accessibilityLabel={canEditPhoto ? tr('Change photo') : undefined}
      >
        <View style={s.avatarRing}>
          <View style={s.avatar}>
            {displayImage ? (
              <Image source={{ uri: displayImage }} style={s.avatarImage} />
            ) : (
              <Text style={s.avatarInitials}>
                {getInitials(userData.name) || 'UN'}
              </Text>
            )}
          </View>
          {canEditPhoto && (
            <View style={s.cameraBadge}>
              <CameraWhite />
            </View>
          )}
          {canEditPhoto && displayImage ? (
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={tr('Remove photo')}
              onPress={handleRemoveImage}
              style={s.removeBadge}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              activeOpacity={0.85}>
              <Close />
            </TouchableOpacity>
          ) : null}
        </View>
      </TouchableOpacity>

      <Text style={s.avatarName} numberOfLines={1}>
        {userData.name || tr('Your name')}
      </Text>
      {userData.email ? (
        <Text style={s.avatarEmail} numberOfLines={1}>
          {userData.email}
        </Text>
      ) : null}

      {updateData && (
        // <TouchableOpacity
        //   onPress={handleSelectImage}
        //   activeOpacity={0.8}
        //   style={s.changePhotoChip}>
        //   <Text style={s.changePhotoChipText}>
        //     {displayImage ? 'Change photo' : 'Add photo'}
        //   </Text>
        // </TouchableOpacity>
        <></>
      )}
    </View>
  );

  // ─── Strength meter ───────────────────────────────────────────────────────────

  const renderStrengthMeter = () => {
    if (!newPassword) return null;
    const color = STRENGTH_COLORS[strength.score];
    return (
      <View style={s.strengthWrap}>
        <View style={s.strengthTrack}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={[
                s.strengthSegment,
                { backgroundColor: i < strength.score ? color : c.divider },
              ]}
            />
          ))}
        </View>
        <Text style={[s.strengthLabel, { color }]}>{strength.label}</Text>
      </View>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  const fieldValues = { name: userData?.name, oldPassword, newPassword };
  const inputStyle = (field, hasError, extra) => [
    s.input,
    extra,
    !!String(fieldValues[field] ?? '').trim() && s.inputFilled,
    focusedField === field && s.inputFocused,
    hasError && s.inputError,
  ];

  // ─── Delete account (Google Play requires it in-app) ───────────────────────────
  const renderDeleteAccount = () =>
    onDeleteAccount ? (
      <TouchableOpacity
        style={s.deleteBtn}
        onPress={() => {
          Keyboard.dismiss();
          onDeleteAccount();
        }}
        disabled={isUploading}
        accessibilityRole="button"
        accessibilityLabel={tr('Delete account')}
        activeOpacity={0.7}>
        <Text style={s.deleteBtnText}>{tr('Delete account')}</Text>
      </TouchableOpacity>
    ) : null;

  // ─── VIEW MODE: Read-only profile display ─────────────────────────────────────
  const renderViewMode = () => (
    <View style={s.inner}>
      <View style={s.handle} />

      {/* Header */}
      <View style={s.headerRow}>
        <View>
          <Text style={s.title}>{tr('Profile')}</Text>
          <Text style={s.subtitle}>{tr('Your personal details')}</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={tr('Close')}
          onPress={handleCloseModal}
          style={s.closeBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <CloseX size={12} color={c.accent} />
        </TouchableOpacity>
      </View>

      {/* Avatar - read only */}
      {renderAvatar()}

      {/* Info Fields - read only */}
      <View style={{ marginTop: 28, gap: 18 }}>
        <View style={{ gap: 7 }}>
          <Text style={s.label}>{tr('Full Name')}</Text>
          <View style={[s.input, s.inputDisabled, { justifyContent: 'center' }]}>
            <Text style={[s.readOnlyText, { color: c.text }]}>
              {userData.name || '—'}
            </Text>
          </View>
        </View>

        <View style={{ gap: 7 }}>
          <Text style={s.label}>{tr('Email')}</Text>
          <View style={[s.input, s.inputDisabled, { justifyContent: 'center' }]}>
            <Text style={[s.readOnlyText, { color: c.text }]}>
              {userData.email || '—'}
            </Text>
          </View>
        </View>

        {isPasswordUser && (
          <View style={{ gap: 7 }}>
            <View style={s.labelRow}>
              <Text style={s.label}>{tr('Password')}</Text>
            </View>
            <View style={[s.input, s.inputDisabled, s.passwordRow]}>
              <Text style={s.passwordDots}>••••••••••</Text>
            </View>
          </View>
        )}
      </View>

      {!isPasswordUser && (
        <Text style={[s.subtitle, { marginTop: 24, textAlign: 'center' }]}>
          {tr('Signed in with Google. Your name and photo are managed by your Google account.')}
        </Text>
      )}

      {/* Edit Button — switches to edit mode (updateData = false) */}
      {isPasswordUser && (
      <TouchableOpacity
        style={s.primaryBtn}
        onPress={() => {
          setUpdateData(false);
          setSuccessMessage('');
          clearAllErrors();
        }}
        activeOpacity={0.85}>
        <Text style={s.primaryBtnText}>{tr('Edit Profile')}</Text>
      </TouchableOpacity>
      )}

      {renderDeleteAccount()}
    </View>
  );

  // ─── EDIT MODE: Editable fields ───────────────────────────────────────────────
  const renderEditMode = () => (
    <View style={s.inner}>
      <View style={s.handle} />

      {/* Header */}
      <View style={s.headerRow}>
        {isChangingPassword ? (
          <TouchableOpacity
            onPress={handleCancelPasswordChange}
            style={s.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={s.backChevron}>‹</Text>
            <Text style={s.backText}>{tr('Back')}</Text>
          </TouchableOpacity>
        ) : (
          <View>
            <Text style={s.title}>{tr('Edit Profile')}</Text>
            <Text style={s.subtitle}>{tr('Update your personal details')}</Text>
          </View>
        )}

        <TouchableOpacity accessibilityRole="button" accessibilityLabel={tr('Close')}
          onPress={handleCloseModal}
          style={s.closeBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <CloseX size={12} color={c.accent} />
        </TouchableOpacity>
      </View>

      {isChangingPassword && (
        <View style={s.passwordHeader}>
          <Text style={s.title}>{tr('Change Password')}</Text>
          <Text style={s.subtitle}>
            {tr('Confirm your current password, then choose a new one')}
          </Text>
        </View>
      )}

      {/* Avatar block — only on profile view */}
      {!isChangingPassword && renderAvatar()}
      {!isChangingPassword && errors.image ? (
        <View style={{ alignItems: 'center', marginTop: 8 }}>
          <FieldError message={errors.image} color={c.danger} />
        </View>
      ) : null}

      {/* General error banner */}
      {errors.general && (
        <View style={s.errorBanner}>
          <View style={s.bannerBar} />
          <Text style={s.errorBannerText}>{errors.general}</Text>
        </View>
      )}

      {/* Success banner */}
      {successMessage ? (
        <View style={s.successBanner}>
          <View style={[s.bannerBar, { backgroundColor: c.success }]} />
          <Text style={s.successBannerText}>{successMessage}</Text>
        </View>
      ) : null}

      {/* Fields */}
      <View style={{ marginTop: 22, gap: 18 }}>
        {!isChangingPassword && (
          <>
            <View style={{ gap: 7 }}>
              <Text style={s.label}>{tr('Full Name')}</Text>
              <TextInput
                style={inputStyle('name', errors.name)}
                value={userData.name || ''}
                onChangeText={handleNameChange}
                onFocus={() => setFocusedField('name')}
                onBlur={() => setFocusedField(null)}
                placeholder={tr('Enter your name')}
                placeholderTextColor={c.placeholder}
              />
              <FieldError message={errors.name} color={c.danger} />
            </View>

            <View style={{ gap: 7 }}>
              <View style={s.labelRow}>
                <Text style={s.label}>{tr('Email')}</Text>
                <Text style={s.lockedTag}>{tr('Locked')}</Text>
              </View>
              <TextInput
                style={[s.input, s.inputDisabled]}
                value={userData.email || ''}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={false}
                placeholderTextColor={c.placeholder}
              />
            </View>
          </>
        )}

        {/* Password */}
        {!isChangingPassword ? (
          <View style={{ gap: 7 }}>
            <View style={s.labelRow}>
              <Text style={s.label}>{tr('Password')}</Text>
              <TouchableOpacity
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                onPress={() => {
                  setIsChangingPassword(true);
                  setSuccessMessage('');
                  clearError('oldPassword');
                  clearError('newPassword');
                }}>
                <Text style={s.link}>{tr('Change')}</Text>
              </TouchableOpacity>
            </View>
            <View style={[s.input, s.inputDisabled, s.passwordRow]}>
              <Text style={s.passwordDots}>••••••••••</Text>
            </View>
          </View>
        ) : (
          <View style={{ gap: 18 }}>
            {/* Current Password */}
            <View style={{ gap: 7 }}>
              <Text style={s.label}>{tr('Current Password')}</Text>
              <View style={s.inputFieldWrap}>
                <TextInput
                  style={inputStyle('oldPassword', errors.oldPassword, {
                    paddingRight: 48,
                  })}
                  value={oldPassword}
                  onChangeText={(text) => {
                    setOldPassword(text);
                    clearError('oldPassword');
                    clearError('general');
                  }}
                  onFocus={() => setFocusedField('oldPassword')}
                  onBlur={() => setFocusedField(null)}
                  secureTextEntry={true}
                  placeholder={tr('Enter current password')}
                  placeholderTextColor={c.placeholder}
                  autoComplete="password"
                  textContentType="password"
                />
              </View>
              <FieldError message={errors.oldPassword} color={c.danger} />
            </View>

            {/* New Password */}
            <View style={{ gap: 7 }}>
              <Text style={s.label}>{tr('New Password')}</Text>
              <View style={s.inputFieldWrap}>
                <TextInput
                  style={inputStyle('newPassword', errors.newPassword, {
                    paddingRight: 48,
                  })}
                  value={newPassword}
                  onChangeText={(text) => {
                    setNewPassword(text);
                    clearError('newPassword');
                  }}
                  onFocus={() => setFocusedField('newPassword')}
                  onBlur={() => setFocusedField(null)}
                  secureTextEntry={true}
                  placeholder={tr('Min. 6 characters')}
                  placeholderTextColor={c.placeholder}
                  autoComplete="new-password"
                  textContentType="newPassword"
                />
              </View>
              {renderStrengthMeter()}
              <FieldError message={errors.newPassword} color={c.danger} />
            </View>

            <Text style={s.hint}>
              {tr('Use at least 6 characters, mixing letters and numbers.')}
            </Text>
          </View>
        )}
      </View>

      {/* Save - disabled if no changes */}
      <TouchableOpacity
        style={[
          s.primaryBtn,
          (!hasChanges || isUploading) && {opacity:0.5}
        ]}
        onPress={handleUpdateProfile}
        disabled={!hasChanges || isUploading}
        activeOpacity={0.85}>
        {isUploading ? (
          <View style={s.btnLoadingRow}>
            <ActivityIndicator size="small" color={c.onAccent} />
            <Text style={s.primaryBtnText}>
              {isChangingPassword ? tr('Changing...') : tr('Saving...')}
            </Text>
          </View>
        ) : (
          <Text style={[s.primaryBtnText, !hasChanges &&  null]}>
            {isChangingPassword ? tr('Change Password') : tr('Save Profile')}
          </Text>
        )}
      </TouchableOpacity>

      {!isChangingPassword && renderDeleteAccount()}
    </View>
  );

  return (
    <View style={s.container}>
      <Modal
        isVisible={userProfile}
        style={s.modal}
        statusBarTranslucent
        backdropOpacity={0.55}
        backdropTransitionOutTiming={0}
        onBackdropPress={() => {
          Keyboard.dismiss();
          handleCloseModal();
        }}
        onBackButtonPress={handleCloseModal}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <KeyboardAvoidingView style={s.sheet} behavior={keyboardBehavior}>
            {userData ? (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ flexGrow: 1, paddingBottom: bottomInset }}>
                {updateData || !isPasswordUser ? renderViewMode() : renderEditMode()}
              </ScrollView>
            ) : (
              <View style={{ paddingBottom: bottomInset }}>{renderSkeleton()}</View>
            )}
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

export default ProfileSettingModal;

// ─── Static styles (theme-independent) ───────────────────────────────────────

const styles = StyleSheet.create({
  fieldErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  fieldErrorDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  fieldErrorText: {
    fontSize: 12,
    flexShrink: 1,
  },
});

// ─── Themed styles ────────────────────────────────────────────────────────────

const makeStyles = (c) =>
  StyleSheet.create({
    container: {},
    modal: { margin: 0, justifyContent: 'flex-end' },
    sheet: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '92%',
      backgroundColor: c.sheet,
      boxShadow: '0px -6px 16px rgba(0, 0, 0, 0.12)',
    },
    inner: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 32 },

    handle: {
      alignSelf: 'center',
      width: 44,
      height: 5,
      borderRadius: 3,
      backgroundColor: c.handle,
      marginBottom: 18,
    },

    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      color: c.text,
      fontSize: 20,
      fontWeight: '700',
      letterSpacing: 0.2,
      fontFamily: Typography.font.regular,
    },
    subtitle: {
      color: c.subtext,
      fontSize: 13,
      marginTop: 3,
      fontFamily: Typography.font.regular,
    },
    passwordHeader: { marginTop: 16 },

    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 2,
    },
    backChevron: {
      color: c.accent,
      fontSize: 24,
      lineHeight: 30,
      marginRight: 4,
      fontWeight: '600',
    },
    backText: {
      color: c.accent,
      fontSize: 15,
      top: 1,
      textAlign: 'center',
      fontWeight: '600',
      fontFamily: Typography.font.regular,
    },
    closeBtn: {
      height: 34,
      width: 34,
      borderRadius: 17,
      backgroundColor: c.accentSoft,
      justifyContent: 'center',
      alignItems: 'center',
    },

    // Avatar
    avatarWrap: { alignItems: 'center', marginTop: 22 },
    avatarRing: {
      padding: 4,
      borderRadius: 50,
      backgroundColor: c.avatarRing,
    },
    avatar: {
      height: 92,
      width: 92,
      borderRadius: 46,
      backgroundColor: c.accent,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    avatarImage: {
      height: '100%',
      width: '100%',
      resizeMode: 'cover',
    },
    avatarInitials: {
      fontSize: 32,
      color: '#fff',
      fontWeight: '600',
      fontFamily: Typography.font.regular,
    },
    cameraBadge: {
      position: 'absolute',
      bottom: 2,
      right: 2,
      height: 30,
      width: 30,
      borderRadius: 15,
      backgroundColor: c.accent,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2.5,
      borderColor: c.sheet,
    },
    removeBadge: {
      position: 'absolute',
      top: 0,
      right: 0,
      height: 26,
      width: 26,
      borderRadius: 13,
      backgroundColor: c.danger,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2.5,
      borderColor: c.sheet,
    },
    avatarName: {
      marginTop: 14,
      color: c.text,
      fontSize: 17,
      fontWeight: '700',
      fontFamily: Typography.font.regular,
    },
    avatarEmail: {
      marginTop: 2,
      color: c.subtext,
      fontSize: 13,
      fontFamily: Typography.font.regular,
    },
    changePhotoChip: {
      marginTop: 10,
      paddingVertical: 6,
      paddingHorizontal: 14,
      borderRadius: 999,
      backgroundColor: c.accentSoft,
    },
    changePhotoChipText: {
      color: c.accent,
      fontSize: 13,
      fontWeight: '600',
      fontFamily: Typography.font.regular,
    },

    // Fields
    label: {
      color: c.text,
      fontSize: 13,
      fontWeight: '600',
      letterSpacing: 0.3,
      textTransform: 'uppercase',
      opacity: 0.9,
      fontFamily: Typography.font.regular,
    },
    labelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    lockedTag: {
      color: c.subtext,
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      fontFamily: Typography.font.regular,
    },
    link: {
      color: c.accent,
      fontSize: 12,
      fontWeight:'400',
      fontFamily: Typography.font.regular,
    },
    input: {
      width: '100%',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderWidth: 1.5,
      borderRadius: 14,
      minHeight: 52,
      borderColor: c.inputBorder,
      backgroundColor: c.inputBg,
      color: c.text,
      fontSize: 15,
      fontFamily: Typography.font.regular,
    },
    inputFilled: { borderColor: c.accentBorderFilled },
    inputFocused: {
      borderColor: c.accentBorder,
      backgroundColor: c.accentSoft,
    },
    inputDisabled: { opacity: 0.65 },
    inputError: {
      borderColor: c.danger,
      backgroundColor: c.dangerSoft,
    },
    inputFieldWrap: { position: 'relative', justifyContent: 'center' },
    eyeBtn: { position: 'absolute', right: 16 },

    passwordRow: { justifyContent: 'center' },
    passwordDots: {
      color: c.text,
      fontSize: 18,
      letterSpacing: 3,
      lineHeight: 22,
    },

    // Read-only text
    readOnlyText: {
      fontSize: 15,
      fontFamily: Typography.font.regular,
    },

    // Strength meter
    strengthWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 4,
    },
    strengthTrack: {
      flex: 1,
      flexDirection: 'row',
      gap: 4,
    },
    strengthSegment: {
      flex: 1,
      height: 4,
      borderRadius: 2,
    },
    strengthLabel: {
      fontSize: 12,
      fontWeight: '600',
      width: 56,
      textAlign: 'right',
      fontFamily: Typography.font.regular,
    },

    hint: {
      color: c.subtext,
      fontSize: 12,
      lineHeight: 17,
      marginTop: -6,
      fontFamily: Typography.font.regular,
    },

    // Banners
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.dangerSoft,
      borderRadius: 12,
      paddingVertical: 12,
      paddingRight: 14,
      marginTop: 16,
      overflow: 'hidden',
    },
    successBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.successSoft,
      borderRadius: 12,
      paddingVertical: 12,
      paddingRight: 14,
      marginTop: 16,
      overflow: 'hidden',
    },
    bannerBar: {
      width: 4,
      alignSelf: 'stretch',
      borderRadius: 2,
      backgroundColor: c.danger,
      marginLeft: 0,
      marginRight: 12,
    },
    errorBannerText: {
      flex: 1,
      color: c.danger,
      fontSize: 13,
      lineHeight: 18,
      fontFamily: Typography.font.regular,
    },
    successBannerText: {
      flex: 1,
      color: c.success,
      fontSize: 13,
      lineHeight: 18,
      fontFamily: Typography.font.regular,
    },

    // Primary button
    primaryBtn: {
      backgroundColor: c.accent,
      height: 48,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 28,
      boxShadow: `0px 6px 12px ${accent.alpha(0.3)}`,
    },
    deleteBtn: {
      alignSelf: 'center',
      marginTop: 18,
      paddingVertical: 10,
      paddingHorizontal: 16,
    },
    deleteBtnText: {
      color: c.danger,
      fontSize: 14,
      fontWeight: '600',
      fontFamily: Typography.font.regular,
    },
    btnDisabled: {},
    btnDisabledText: {
      color: c.disabledBtnText,
    },
    btnLoadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    primaryBtnText: {
      color: c.onAccent,
      fontFamily: 'RobotoCondensed500',
      fontSize: 16,
      textAlign: 'center',
    },
  });
