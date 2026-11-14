import {
  StyleSheet,
  TouchableOpacity,
  View,
  Linking,
  ScrollView,
  AppState,
  TextInput,
  Alert,
} from 'react-native';
import Text from '../components/ui/AppText';
import AdBanner from '../components/AdBanner';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { useDispatch, useSelector } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Typography } from '../styles/typography.js';
import { themecolors } from '../styles/themecolors.js';
import { setTheme, setAccent } from '../store/themeSlice.js';
import { bumpProfileVersion, clearUser, deleteUserAccountData, saveUserCountry, saveUserCurrency } from '../store/userSlice.js';
import CountryPickerSheet from '../modals/CountryPickerSheet.jsx';
import { findCountry, setSelectedCountry, useSelectedCountry } from '../util/countries';
import { resetVehicles } from '../store/vehicleSlice.js';
import { getGoogleCredential, signOutOfGoogle } from '../util/googleAuth.js';
import ConfirmDeleteModal from '../modals/ConfirmDeleteModal.jsx';
import {
  getAuth,
  signOut,
  EmailAuthProvider,
  reauthenticateWithCredential,
  deleteUser,
} from '@react-native-firebase/auth';
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

import CurrencyModal from '../modals/CurrencyModal.jsx';
import ProfileSettingModal from '../modals/ProfileSettingModal.jsx';
import ColorPickerModal from '../modals/ColorPickerModal.jsx';
import { DEFAULT_CURRENCY } from '../util/currencies.js';
import {
  isManualCurrency, onCurrencyChange, savedOrDefaultCurrency, setManualCurrency,
} from '../util/methods/useCurrency';
import {
  isNotificationsEnabled,
  requestNotificationPermission,
  openNotificationSettings,
  cancelAllReminders,
} from '../util/notifications.js';
import { shadowSoft as shadow } from '../theme/tokens';
import { accent } from '../theme/accent';
import { useNavigation } from '@react-navigation/native';
import Car from '../assets/svg/Car.jsx';
import ServiceTypeIcon from '../assets/svg/ServiceTypeIcon.jsx';
import { setDistanceUnit, useDistanceUnit } from '../util/schedule/scheduleSettings';
import ScheduleHost from '../components/schedule/ScheduleHost.jsx';
import { useScheduleHost } from '../util/schedule/scheduleHostContext';
import { EVENTS, setUserProps, track } from '../util/analytics.js';
import LanguageModal from '../modals/LanguageModal.jsx';
import { rescheduleAllReminders, resyncScheduleReminders } from '../util/reminderSync';
import { setLanguage, t as tr, useLanguage } from '../i18n';
import { languageInfo } from '../i18n/languages';

// Cross-platform shadow helper (matches Home.jsx / VehicleInformations.jsx)

const SUPPORT_EMAIL = 'contact@zecodeek-it.com';

// Language picker is hidden for now; flip to true to bring it back.
const SHOW_LANGUAGE = false;

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

// Rendered inside Settings' ScheduleHost, so the page opens in this tab.
const ServiceAlertsRow = props => {
  const host = useScheduleHost();
  const navigation = useNavigation();
  return <SettingsRow {...props} onPress={() => (host || navigation).navigate('ServiceAlerts')} />;
};

// Settings → Backup (screens/BackupScreen.jsx). Opens inside this tab, like
// Service alerts (header and tab bar stay).
const BackupIcon = ({ color }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 8.5a4 4 0 0 1-.5 9.5" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
    <Path d="M12 20v-8M9 14.5 12 11.5l3 3" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);
const GlobeIcon = ({ color }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.6} />
    <Path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
  </Svg>
);

const BackupRow = ({ t }) => {
  const host = useScheduleHost();
  const navigation = useNavigation();
  return (
    <SettingsRow
      t={t}
      icon={<BackupIcon color={t.text} />}
      label={tr('set.backup')}
      onPress={() => (host || navigation).navigate('Backup')}
      isLast
    />
  );
};

const Settings = ({ setIsLoggedIn, route, navigation }) => {
  const distanceUnit = useDistanceUnit();
  const { theme, accent: accentHex } = useSelector((store) => store.theme);
  const dispatch = useDispatch();
  const isDark = theme === 'dark';
  const [isDarkMode, setIsDarkMode] = useState(isDark);

  // Currency modal state
  const [currencyVisible, setCurrencyVisible] = useState(false);
  const [countryVisible, setCountryVisible] = useState(false);
  const selectedCountry = findCountry(useSelectedCountry());
  const [languageVisible, setLanguageVisible] = useState(false);
  const language = useLanguage();
  const userEmail = useSelector(state => state.user.userEmail);
  const [privacyModal, setPrivacyModal] = useState(false);
  const [updateData, setUpdateData] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState(DEFAULT_CURRENCY);
  const [currencyAuto, setCurrencyAuto] = useState(true);

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
      // Fixed red, not the accent — destructive rows stay red whatever App Color is.
      // Dark mode uses a lighter red: #C13D0C is only ~3.3:1 on the dark surface.
      logout: isDark ? '#FF9C90' : '#C13D0C',
      logoutWell: isDark ? 'rgba(193,61,12,0.22)' : 'rgba(193,61,12,0.10)',
      inputBorder: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(4,25,51,0.15)',
      inputBorderFilled: isDark ? accent.light : accent.primary,
      placeholder: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(4,25,51,0.4)',
    }),
    [isDark],
  );

  // Load the currency, and follow automatic (time-zone based) changes
  useEffect(() => {
    const loadCurrency = async () => {
      setSelectedCurrency(await savedOrDefaultCurrency());
      setCurrencyAuto(!(await isManualCurrency()));
    };
    loadCurrency();
    return onCurrencyChange(loadCurrency);
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
    track(EVENTS.THEME_CHANGED, { theme: newTheme });
    setUserProps({ app_theme: newTheme });
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

  // ─── Currency switch ──────────────────────────────────────────────────────
  // Applied at once, no confirmation: amounts are never converted, the app
  // just shows them in the new currency.
  const handleCurrencySelect = async (item) => {
    if (item.code === selectedCurrency.code && !currencyAuto) return;
    setSelectedCurrency(item);
    setCurrencyAuto(false);
    // Saved on the account too, so every phone and sign-in uses it.
    saveUserCurrency(userEmail, item.code).catch(e => console.warn('Saving currency to account failed', e));
    await setManualCurrency(item);
  };

  // ─── Country switch ───────────────────────────────────────────────────────
  // Changes which fuel and document types the forms offer; saved records keep
  // their own type.
  const handleCountrySelect = (country) => {
    setCountryVisible(false);
    if (country.code === selectedCountry?.code) return;
    setSelectedCountry(country.code).catch(e => console.warn('Saving country failed', e));
    saveUserCountry(userEmail, country.code).catch(e => console.warn('Saving country to account failed', e));
  };

  const handleSupport = async () => {
    const subject = 'VehicleHub Support Request';
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;

    // canOpenURL is unreliable for mailto on Android 11+, so just try; with
    // no mail app, show the address instead of silently doing nothing.
    track(EVENTS.CONTACT_SUPPORT);
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.log('Error opening mail app:', error);
      Alert.alert(
        tr('support.noMailTitle'),
        tr('support.noMail', { email: SUPPORT_EMAIL }),
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
    track(EVENTS.LOGOUT);
    try {
      await signOut(getAuth());
    } catch (error) {
      console.log(error);
    }
    await clearSession();
  };

  const [logoutVisible, setLogoutVisible] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = () => setLogoutVisible(true);

  const confirmLogout = async () => {
    setLoggingOut(true);
    try {
      await logOut();
    } finally {
      setLoggingOut(false);
      setLogoutVisible(false);
    }
  };

  // ─── Account deletion ────────────────────────────────────────────────────
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const currentUser = getAuth().currentUser;
  const isPasswordUser = !!currentUser?.providerData?.some(p => p.providerId === 'password');

  // The Profile sheet opened from the header avatar sends the user here to
  // delete the account, so there is a single deletion flow.
  const deleteRequest = route?.params?.deleteAccount;
  useEffect(() => {
    if (!deleteRequest) return;
    setDeleteVisible(true);
    navigation?.setParams({ deleteAccount: undefined });
  }, [deleteRequest, navigation]);

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteVisible(false);
    setDeletePassword('');
    setDeleteError('');
  };

  const handleDeleteAccount = async () => {
    const user = getAuth().currentUser;
    if (!user) return;
    if (isPasswordUser && !deletePassword) {
      setDeleteError(tr('dlg.enterPassword'));
      return;
    }

    setDeleting(true);
    setDeleteError('');
    try {
      // Firebase only deletes accounts with a fresh login, so re-authenticate
      // first — before any data is removed.
      const credential = isPasswordUser
        ? EmailAuthProvider.credential(user.email, deletePassword)
        : (await getGoogleCredential()).credential;
      await reauthenticateWithCredential(user, credential);

      await deleteUserAccountData(user.email);
      await deleteUser(user);
      track(EVENTS.ACCOUNT_DELETED, { method: isPasswordUser ? 'password' : 'google' });

      setDeleteVisible(false);
      await clearSession();
    } catch (error) {
      console.log('Delete account error:', error);
      if (error.code === 'cancelled') {
        setDeleteError('');
      } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setDeleteError(tr('dlg.wrongPassword'));
      } else if (error.code === 'auth/user-mismatch') {
        setDeleteError(tr('dlg.sameGoogle'));
      } else {
        setDeleteError(tr('dlg.deleteFailed'));
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.container, { backgroundColor: t.surface }]}>
        {/* Service alerts opens here, in place of the list, so the header and
            tab bar stay put (same as schedule pages on Home and Vehicle). */}
        {/* Pages (Backup, Service alerts) sit closer to the top than the
            Settings list: their Back row is already 48 tall. */}
        <ScheduleHost pageStyle={styles.hostPage}>
        {/* Title stays fixed at the top */}
        <View style={styles.titleContainer}>
          <SettingsSVG color={t.text} />
          <Text style={[styles.titleText, { color: t.text }]}>{tr('set.title')}</Text>
        </View>
        <AdBanner backgroundColor="transparent" style={styles.adSlot} />

        {/* Scrollable body — completely locked when content fits on screen */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          // Reaches into the page padding so card shadows aren't clipped at
          // the scroll view's edges; the content is padded back into place.
          style={styles.scroll}
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
          <SectionLabel t={t}>{tr('set.account')}</SectionLabel>
          <View style={[styles.card, { backgroundColor: t.cardBg, borderColor: t.cardBorder }, shadow(1)]}>
            <SettingsRow
              t={t}
              icon={<UserIcon color={t.text} />}
              label={tr('set.profile')}
              onPress={() => setProfileVisible(true)}
            />
            <SettingsRow
              t={t}
              icon={<Currency color={t.text} />}
              label={tr('set.currency')}
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
              icon={<Text style={styles.countryFlag}>{selectedCountry?.flag || '🌐'}</Text>}
              label={tr('Country')}
              onPress={() => setCountryVisible(true)}
              right={
                <View style={styles.itemLeft}>
                  <Text style={[styles.itemValue, styles.countryValue, { color: t.arrow }]} numberOfLines={1}>
                    {selectedCountry ? tr(selectedCountry.name) : tr('Not set')}
                  </Text>
                  <Arrow color={t.arrow} />
                </View>
              }
            />
            <SettingsRow
              t={t}
              icon={<Ring color={t.text} />}
              label={tr('set.notifications')}
              right={
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleNotificationToggle}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityRole="switch"
                  accessibilityLabel={tr('set.notifications')}
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
            <ServiceAlertsRow t={t} icon={<ServiceTypeIcon icon="service" color={t.text} size={18} strokeWidth={1.6} />} label={tr('set.serviceAlerts')} />
            <SettingsRow
              t={t}
              icon={<Car color={t.text} />}
              label={tr('set.distance')}
              right={
                <View style={styles.itemLeft}>
                  {['km', 'mi'].map(u => (
                    <TouchableOpacity
                      key={u}
                      onPress={() => setDistanceUnit(u)}
                      accessibilityRole="button"
                      accessibilityLabel={u === 'km' ? tr('set.kilometres') : tr('set.milesLong')}
                      accessibilityState={{ selected: distanceUnit === u }}
                      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                      style={[
                        styles.unitChip,
                        { backgroundColor: distanceUnit === u ? t.trackOn : 'transparent', borderColor: t.trackOn },
                      ]}
                    >
                      <Text style={[styles.unitChipText, { color: distanceUnit === u ? '#fff' : t.text }]}>
                        {u === 'km' ? tr('set.km') : tr('set.miles')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              }
            />
            <SettingsRow
              t={t}
              icon={<Moon color={t.text} />}
              label={tr('set.darkMode')}
              right={
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleToggle(!isDarkMode)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityRole="switch"
                  accessibilityLabel={tr('set.darkMode')}
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
              label={tr('set.appColor')}
              onPress={() => setColorVisible(true)}
              isLast={!SHOW_LANGUAGE}
              right={
                <View style={styles.itemLeft}>
                  <Text style={[styles.itemValue, { color: t.arrow }]}>{accentHex}</Text>
                  <Arrow color={t.arrow} />
                </View>
              }
            />
            {SHOW_LANGUAGE && (
              <SettingsRow
                t={t}
                icon={<GlobeIcon color={t.text} />}
                label={tr('set.language')}
                onPress={() => setLanguageVisible(true)}
                isLast
                right={
                  <View style={styles.itemLeft}>
                    <Text style={[styles.itemValue, { color: t.arrow }]}>{languageInfo(language).native}</Text>
                    <Arrow color={t.arrow} />
                  </View>
                }
              />
            )}
          </View>

          {/* Your data */}
          <SectionLabel t={t}>{tr('set.data')}</SectionLabel>
          <View style={[styles.card, { backgroundColor: t.cardBg, borderColor: t.cardBorder }, shadow(1)]}>
            <BackupRow t={t} />
          </View>

          {/* Support */}
          <SectionLabel t={t}>{tr('set.support')}</SectionLabel>
          <View style={[styles.card, { backgroundColor: t.cardBg, borderColor: t.cardBorder }, shadow(1)]}>
            <SettingsRow
              t={t}
              icon={<HelpIcon color={t.text} />}
              label={tr('set.help')}
              onPress={handleSupport}
            />
            <SettingsRow
              t={t}
              icon={<PrivacyIcon color={t.text} />}
              label={tr('set.privacy')}
              onPress={() => setPrivacyModal(true)}
              isLast
            />
          </View>

          {/* Log out / Delete account */}
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
              label={tr('set.logout')}
              labelColor={t.logout}
              onPress={handleLogout}
              right={false}
            />
            {/* Required by Google Play for every account type, Google sign-ins
                included (they confirm with Google instead of a password). */}
            <SettingsRow
              t={t}
              icon={<TrashIcon width={18} height={18} color={t.logout} />}
              iconBg={t.logoutWell}
              label={tr('set.deleteAccount')}
              labelColor={t.logout}
              onPress={() => setDeleteVisible(true)}
              right={false}
              isLast
            />
          </View>
        </ScrollView>
        </ScheduleHost>
      </View>

      {/* Modals */}
      <CountryPickerSheet
        visible={countryVisible}
        selected={selectedCountry?.code}
        onConfirm={handleCountrySelect}
        onClose={() => setCountryVisible(false)}
      />

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
        onDeleteAccount={() => {
          setProfileVisible(false);
          // Opened once the profile sheet has animated out; two modals at
          // once don't stack reliably on Android.
          setTimeout(() => setDeleteVisible(true), 350);
        }}
      />
      {SHOW_LANGUAGE && <LanguageModal
        visible={languageVisible}
        onClose={() => setLanguageVisible(false)}
        selected={language}
        onSelect={code => {
          // Remounts the app in the new language (see App.jsx).
          setLanguage(code);
          // Scheduled notifications hold their text, so rebuild them in the
          // new language (silent: never asks for permission).
          if (userEmail) {
            rescheduleAllReminders(userEmail).catch(() => {});
            resyncScheduleReminders(userEmail).catch(() => {});
          }
          track(EVENTS.LANGUAGE_CHANGED, { language: code });
          setUserProps({ app_language: code });
        }}
      />}
      <ColorPickerModal
        visible={colorVisible}
        value={accentHex}
        onClose={() => setColorVisible(false)}
        onApply={(hex) => {
          setColorVisible(false);
          // Remounts the screens in the new colour (see App.jsx).
          dispatch(setAccent(hex));
          track(EVENTS.ACCENT_CHANGED, { color: hex });
        }}
      />
      <PrivacyModal
        privacyModal={privacyModal}
        setPrivacyModal={setPrivacyModal}
      />
      <ConfirmDeleteModal
        visible={logoutVisible}
        title={tr('dlg.logoutTitle')}
        description={tr('dlg.logoutBody')}
        confirmLabel={tr('dlg.logoutConfirm')}
        Icon={Logout}
        loading={loggingOut}
        onCancel={() => setLogoutVisible(false)}
        onConfirm={confirmLogout}
      />
      <ConfirmDeleteModal
        visible={deleteVisible}
        title={tr('dlg.deleteTitle')}
        description={isPasswordUser ? tr('dlg.deleteBody') : `${tr('dlg.deleteBody')} ${tr('dlg.deleteGoogle')}`}
        confirmLabel={tr('dlg.delete')}
        loading={deleting}
        onCancel={closeDeleteModal}
        onConfirm={handleDeleteAccount}
      >
        {isPasswordUser && (
          <TextInput
            value={deletePassword}
            onChangeText={v => { setDeletePassword(v); setDeleteError(''); }}
            placeholder={tr('dlg.password')}
            placeholderTextColor={t.placeholder}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password"
            textContentType="password"
            accessibilityLabel={tr('dlg.password')}
            returnKeyType="done"
            onSubmitEditing={handleDeleteAccount}
            editable={!deleting}
            style={[styles.passwordInput, { color: t.text, borderColor: deleteError ? t.logout : deletePassword ? t.inputBorderFilled : t.inputBorder }]}
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
  unitChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  unitChipText: {
    fontFamily: Typography.font.medium,
    fontSize: 13,
  },
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
  hostPage: {
    marginTop: -14,
  },
  titleContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  scroll: { marginHorizontal: -16 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 16, // only applied when content actually overflows
  },
  // Ad under the page title; takes no space until an ad loads.
  adSlot: { paddingHorizontal: 0, paddingTop: 10, paddingBottom: 2 },
  // Page title — same style as Home's "All Vehicles".
  titleText: {
    fontFamily: Typography.font.medium,
    fontWeight: '700',
    fontSize: 20,
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
    borderWidth: 1.5,
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
  countryFlag: { fontSize: 18 },
  countryValue: { maxWidth: 150 },
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
