import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Linking,
  ScrollView,
  AppState,
  TextInput,
  Alert,
} from 'react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Typography } from '../styles/typography.js';
import { themecolors } from '../styles/themecolors.js';
import { setTheme, setAccent } from '../store/themeSlice.js';
import { bumpProfileVersion, clearUser, deleteUserAccountData } from '../store/userSlice.js';
import { resetVehicles } from '../store/vehicleSlice.js';
import { getGoogleCredential, signOutOfGoogle } from '../util/googleAuth.js';
import ConfirmDeleteModal from '../modals/ConfirmDeleteModal.jsx';
import auth from '@react-native-firebase/auth';
import SettingsSVG from '../assets/svg/SettingSVG.jsx';
import UserIcon from '../assets/svg/UserIcon.jsx';
import Currency from '../assets/svg/Currency.jsx';
import Ring from '../assets/svg/Ring.jsx';
import Arrow from '../assets/svg/Arrow.jsx';
import Moon from '../assets/svg/Moon.jsx';
import HelpIcon from '../assets/svg/HelpIcon.jsx';
import PrivacyIcon from '../assets/svg/PrivacyIcon.jsx';
import PrivacyModal from '../modals/PrivacyModal.jsx';
import Logout from '../assets/svg/Logout.jsx';
import TrashIcon from '../assets/svg/TrashIcon.jsx';
import { useNavigation } from '@react-navigation/native';

import CurrencyModal from '../modals/CurrencyModal.jsx';
import ProfileSettingModal from '../modals/ProfileSettingModal.jsx';
import ColorPickerModal from '../modals/ColorPickerModal.jsx';
import { currencies } from '../util/currencies.js';
import { getRate, BASE_CURRENCY } from '../util/fx.js';
import {
  isNotificationsEnabled,
  requestNotificationPermission,
  openNotificationSettings,
  cancelAllReminders,
} from '../util/notifications.js';
import { shadowSoft as shadow } from '../theme/tokens';
import { accent } from '../theme/accent';

// Cross-platform shadow helper (matches Home.jsx / VehicleInformations.jsx)

const SUPPORT_EMAIL = 'contact@zecodeek-it.com';

// Defined outside Settings so they aren't remounted on every render.
const IconWell = ({ color, children }) => (
  <View style={[styles.iconWell, { backgroundColor: color }]}>{children}</View>
);

const SettingsRow = ({ t, icon, iconBg, label, labelColor, onPress, disabled, isLast, right }) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled || !onPress}
    activeOpacity={0.7}
    accessibilityRole="button"
    accessibilityLabel={label}
    style={[
      styles.row,
      !isLast && { borderBottomWidth: 1, borderBottomColor: t.divider },
      disabled && styles.rowDisabled,
    ]}
  >
    <View style={styles.itemLeft}>
      <IconWell color={iconBg || t.iconWell}>{icon}</IconWell>
      <Text style={[styles.itemTitle, { color: labelColor || t.text }]}>{label}</Text>
    </View>
    {right ?? (onPress && !disabled ? <Arrow color={t.arrow} /> : null)}
  </TouchableOpacity>
);

const SectionLabel = ({ t, children }) => (
  <Text style={[styles.sectionLabel, { color: t.muted }]}>{children}</Text>
);

const Settings = ({ setIsLoggedIn }) => {
  const { theme, accent: accentHex } = useSelector((store) => store.theme);
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const isDark = theme === 'dark';
  const [isDarkMode, setIsDarkMode] = useState(isDark);

  // Currency modal state
  const [currencyVisible, setCurrencyVisible] = useState(false);
  const [privacyModal, setPrivacyModal] = useState(false);
  const [updateData, setUpdateData] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState(
    currencies.find((c) => c.code === 'BDT') || currencies[0]
  );

  const [colorVisible, setColorVisible] = useState(false);

  // Profile modal state
  const [profileVisible, setProfileVisible] = useState(false);

  // Notifications toggle state
  const [notificationsOn, setNotificationsOn] = useState(false);

  // ─── Scroll lock: only allow scrolling when content truly overflows ─
  // Rounding + 1px tolerance prevents sub-pixel differences from
  // enabling that tiny 1–2px scroll when everything actually fits.
  const [containerHeight, setContainerHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const scrollEnabled =
    Math.round(contentHeight) > Math.round(containerHeight) + 1;

  // ─── Theme-aware palette (matches the token pattern used across the app) ─
  const t = useMemo(
    () => ({
      screenBg: accent.primary,
      surface: isDark ? themecolors.darkBlue : themecolors.white,
      text: isDark ? themecolors.white : 'rgba(4, 25, 51, 1)',
      muted: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(4,25,51,0.5)',
      arrow: isDark ? themecolors.white : themecolors.deepBlue,
      accent: isDark ? accent.light : accent.primary,
      cardBg: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
      cardBorder: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(4,25,51,0.06)',
      divider: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(4,25,51,0.06)',
      iconWell: isDark ? accent.lightAlpha(0.14) : accent.alpha(0.07),
      trackOn: accent.primary,
      trackOff: isDark ? 'rgba(255,255,255,0.18)' : accent.alpha(0.18),
      logout: '#C13D0C',
      // Fixed red, not the accent — destructive rows stay red whatever App Color is.
      logoutWell: isDark ? 'rgba(193,61,12,0.22)' : 'rgba(193,61,12,0.10)',
      inputBorder: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(4,25,51,0.15)',
      placeholder: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(4,25,51,0.4)',
    }),
    [isDark],
  );

  // Load saved currency on mount
  useEffect(() => {
    const loadCurrency = async () => {
      const saved = await AsyncStorage.getItem('selectedCurrency');
      if (saved) setSelectedCurrency(JSON.parse(saved));
    };
    loadCurrency();
  }, []);

  // keep local state synced with redux theme
  useEffect(() => {
    setIsDarkMode(isDark);
  }, [isDark]);

  // Reflect the OS-level notification permission in the toggle
  const refreshNotificationStatus = useCallback(async () => {
    try {
      const enabled = await isNotificationsEnabled();
      setNotificationsOn(enabled);
    } catch (error) {
      console.log('Error reading notification status:', error);
    }
  }, []);

  useEffect(() => {
    refreshNotificationStatus();
  }, [refreshNotificationStatus]);

  // Permission may be changed from the OS settings screen while the app is
  // backgrounded, so re-check whenever the app comes back to the foreground.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') refreshNotificationStatus();
    });
    return () => subscription.remove();
  }, [refreshNotificationStatus]);

  const handleToggle = async (value) => {
    setIsDarkMode(value);
    const newTheme = value ? 'dark' : 'light';
    dispatch(setTheme(newTheme));
    await AsyncStorage.setItem('theme', newTheme);
  };

  // The OS never lets an app revoke its own notification permission, so
  // turning the toggle off just deep-links into system settings — the
  // toggle then syncs back via the AppState listener above.
  const handleNotificationToggle = async () => {
    if (notificationsOn) {
      await openNotificationSettings();
      return;
    }

    try {
      const granted = await requestNotificationPermission();
      if (granted) {
        setNotificationsOn(true);
      } else {
        // Already denied once — the OS prompt won't show again.
        await openNotificationSettings();
      }
    } catch (error) {
      console.log('Error requesting notification permission:', error);
    }
  };

  const handleCurrencySelect = async (item) => {
    setSelectedCurrency(item);
    await AsyncStorage.setItem('selectedCurrency', JSON.stringify(item));
    getRate(BASE_CURRENCY, item.code).catch(() => {});
  };

  const handleSupport = async () => {
    const subject = 'VehicleHub Support Request';
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;

    // canOpenURL is unreliable for mailto on Android 11+, so just try; with
    // no mail app, show the address instead of silently doing nothing.
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.log('Error opening mail app:', error);
      Alert.alert(
        'Contact support',
        `No email app is set up on this device. Email us at ${SUPPORT_EMAIL}`,
      );
    }
  };

  // Everything tied to the signed-in user on this device is cleared, so the
  // next person to sign in doesn't inherit reminders, a selected car or the
  // previous Google account.
  const clearSession = async () => {
    await cancelAllReminders();
    await signOutOfGoogle();
    await AsyncStorage.removeItem('keepSignedIn');
    dispatch(clearUser());
    dispatch(resetVehicles());
    setIsLoggedIn(false);
  };

  const logOut = async () => {
    try {
      await auth().signOut();
    } catch (error) {
      console.log(error);
    }
    await clearSession();
  };

  const handleLogout = () => {
    Alert.alert('Log out?', 'You can sign back in any time. Your data stays in your account.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logOut },
    ]);
  };

  // ─── Account deletion ────────────────────────────────────────────────────
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const currentUser = auth().currentUser;
  const isPasswordUser = !!currentUser?.providerData?.some(p => p.providerId === 'password');

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteVisible(false);
    setDeletePassword('');
    setDeleteError('');
  };

  const handleDeleteAccount = async () => {
    const user = auth().currentUser;
    if (!user) return;
    if (isPasswordUser && !deletePassword) {
      setDeleteError('Enter your password to confirm.');
      return;
    }

    setDeleting(true);
    setDeleteError('');
    try {
      // Firebase only deletes accounts with a fresh login, so re-authenticate
      // first — before any data is removed.
      const credential = isPasswordUser
        ? auth.EmailAuthProvider.credential(user.email, deletePassword)
        : (await getGoogleCredential()).credential;
      await user.reauthenticateWithCredential(credential);

      await deleteUserAccountData(user.email);
      await user.delete();

      setDeleteVisible(false);
      await clearSession();
    } catch (error) {
      console.log('Delete account error:', error);
      if (error.code === 'cancelled') {
        setDeleteError('');
      } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setDeleteError('Incorrect password.');
      } else if (error.code === 'auth/user-mismatch') {
        setDeleteError('Choose the same Google account you signed in with.');
      } else {
        setDeleteError("Your account couldn't be deleted. Check your connection and try again.");
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.container, { backgroundColor: t.surface }]}>
        {/* Title stays fixed at the top */}
        <View style={styles.titleContainer}>
          <SettingsSVG color={t.text} />
          <Text style={[styles.titleText, { color: t.text }]}>Settings</Text>
        </View>

        {/* Scrollable body — completely locked when content fits on screen */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            !scrollEnabled && { paddingBottom: 0 },
          ]}
          bounces={false}
          alwaysBounceVertical={false}
          overScrollMode="never"
          scrollEnabled={scrollEnabled}
          onLayout={(e) => setContainerHeight(e.nativeEvent.layout.height)}
          onContentSizeChange={(w, h) => setContentHeight(h)}
        >
          {/* Account */}
          <SectionLabel t={t}>ACCOUNT</SectionLabel>
          <View style={[styles.card, { backgroundColor: t.cardBg, borderColor: t.cardBorder }, shadow(1)]}>
            <SettingsRow
              t={t}
              icon={<UserIcon color={t.text} />}
              label="Profile Settings"
              onPress={() => setProfileVisible(true)}
            />
            <SettingsRow
              t={t}
              icon={<Currency color={t.text} />}
              label="Currency"
              onPress={() => setCurrencyVisible(true)}
              right={
                <View style={styles.itemLeft}>
                  <Text style={[styles.itemValue, { color: t.arrow }]}>
                    {selectedCurrency.symbol} {selectedCurrency.code}
                  </Text>
                  <Arrow color={t.arrow} />
                </View>
              }
            />
            <SettingsRow
              t={t}
              icon={<Ring color={t.text} />}
              label="Notifications"
              right={
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleNotificationToggle}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityRole="switch"
                  accessibilityLabel="Notifications"
                  accessibilityState={{ checked: notificationsOn }}
                  style={[
                    styles.track,
                    { backgroundColor: notificationsOn ? t.trackOn : t.trackOff },
                  ]}
                >
                  <View
                    style={[
                      styles.thumb,
                      { transform: [{ translateX: notificationsOn ? 16 : 0 }] },
                    ]}
                  />
                </TouchableOpacity>
              }
            />
            <SettingsRow
              t={t}
              icon={<Moon color={t.text} />}
              label="Dark Mode"
              right={
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleToggle(!isDarkMode)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityRole="switch"
                  accessibilityLabel="Dark mode"
                  accessibilityState={{ checked: isDarkMode }}
                  style={[
                    styles.track,
                    { backgroundColor: isDarkMode ? t.trackOn : t.trackOff },
                  ]}
                >
                  <View
                    style={[
                      styles.thumb,
                      { transform: [{ translateX: isDarkMode ? 16 : 0 }] },
                    ]}
                  />
                </TouchableOpacity>
              }
            />
            <SettingsRow
              t={t}
              icon={<View style={[styles.swatch, { backgroundColor: accentHex }]} />}
              label="App Color"
              onPress={() => setColorVisible(true)}
              isLast
              right={
                <View style={styles.itemLeft}>
                  <Text style={[styles.itemValue, { color: t.arrow }]}>{accentHex}</Text>
                  <Arrow color={t.arrow} />
                </View>
              }
            />
          </View>

          {/* Support */}
          <SectionLabel t={t}>SUPPORT</SectionLabel>
          <View style={[styles.card, { backgroundColor: t.cardBg, borderColor: t.cardBorder }, shadow(1)]}>
            <SettingsRow
              t={t}
              icon={<HelpIcon color={t.text} />}
              label="Help & Support"
              onPress={handleSupport}
            />
            <SettingsRow
              t={t}
              icon={<PrivacyIcon color={t.text} />}
              label="Privacy & Policy"
              onPress={() => setPrivacyModal(true)}
              isLast
            />
          </View>

          {/* Log out / Delete account (delete hidden for Google sign-in users) */}
          <View
            style={[
              styles.card,
              styles.logoutCard,
              { backgroundColor: t.cardBg, borderColor: t.cardBorder },
              shadow(1),
            ]}
          >
            <SettingsRow
              t={t}
              icon={<Logout color={t.logout} />}
              iconBg={t.logoutWell}
              label="Log Out"
              labelColor={t.logout}
              onPress={handleLogout}
              right={false}
              isLast={!isPasswordUser}
            />
            {isPasswordUser && (
              <SettingsRow
                t={t}
                icon={<TrashIcon width={18} height={18} color={t.logout} />}
                iconBg={t.logoutWell}
                label="Delete Account"
                labelColor={t.logout}
                onPress={() => setDeleteVisible(true)}
                right={false}
                isLast
              />
            )}
          </View>
        </ScrollView>
      </View>

      {/* Modals */}
      <CurrencyModal
        visible={currencyVisible}
        onClose={() => setCurrencyVisible(false)}
        selected={selectedCurrency}
        onSelect={handleCurrencySelect}
      />
      {/* updateData={false} => opens directly in EDIT mode (no "Edit Profile" tap needed) */}
      <ProfileSettingModal
        userProfile={profileVisible}
        setUserProfile={setProfileVisible}
        updateData={false}
        setUpdateData={setUpdateData}
        onProfileUpdated={() => dispatch(bumpProfileVersion())}
      />
      <ColorPickerModal
        visible={colorVisible}
        value={accentHex}
        onClose={() => setColorVisible(false)}
        onApply={(hex) => {
          setColorVisible(false);
          // Remounts the screens in the new colour (see App.jsx).
          dispatch(setAccent(hex));
        }}
      />
      <PrivacyModal
        privacyModal={privacyModal}
        setPrivacyModal={setPrivacyModal}
      />
      <ConfirmDeleteModal
        visible={deleteVisible}
        title="Delete account"
        description={`This permanently deletes your account and all your vehicles, services, documents and fuel logs. This can't be undone.${isPasswordUser ? '' : ' You will be asked to confirm with Google.'}`}
        confirmLabel="Delete"
        loading={deleting}
        onCancel={closeDeleteModal}
        onConfirm={handleDeleteAccount}
      >
        {isPasswordUser && (
          <TextInput
            value={deletePassword}
            onChangeText={v => { setDeletePassword(v); setDeleteError(''); }}
            placeholder="Password"
            placeholderTextColor={t.placeholder}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password"
            textContentType="password"
            accessibilityLabel="Password"
            returnKeyType="done"
            onSubmitEditing={handleDeleteAccount}
            editable={!deleting}
            style={[styles.passwordInput, { color: t.text, borderColor: deleteError ? t.logout : t.inputBorder }]}
          />
        )}
        {!!deleteError && (
          <Text style={[styles.deleteError, { color: t.logout }]}>{deleteError}</Text>
        )}
      </ConfirmDeleteModal>
    </View>
  );
};

export default Settings;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    get backgroundColor() { return accent.primary; },
  },
  container: {
    flex: 1,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    marginTop: 5,
    overflow: 'hidden',
    paddingTop: 24,
    paddingHorizontal: 24,
    position: 'relative',
  },
  titleContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  scrollContent: {
    paddingBottom: 16, // only applied when content actually overflows
  },
  titleText: {
    fontFamily: Typography.font.regular,
    fontSize: 18,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: 'RobotoCondensed500',
    letterSpacing: 1.2,
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  logoutCard: {
    marginTop: 24,
  },
  passwordInput: {
    height: 46,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontFamily: Typography.font.regular,
    fontSize: Typography.textsize.small,
  },
  deleteError: {
    marginTop: 8,
    fontFamily: Typography.font.regular,
    fontSize: 12,
    textAlign: 'center',
  },
  row: {
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowDisabled: {
    opacity: 0.6,
  },
  itemLeft: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  itemTitle: {
    fontFamily: Typography.font.regular,
    fontSize: Typography.textsize.small,
  },
  itemValue: {
    fontFamily: Typography.font.regular,
    fontSize: Typography.textsize.small,
  },
  swatch: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  iconWell: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    width: 40,
    height: 24,
    borderRadius: 12,
    padding: 3,
    justifyContent: 'center',
  },
  thumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#fff',
  },
});
