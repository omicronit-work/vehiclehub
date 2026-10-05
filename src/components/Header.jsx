import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  Animated,
  Image,
  Pressable,
  Easing,
  AppState,
} from 'react-native';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

import Wheels from '../assets/svg/Wheels.jsx';
import { fetchUserByEmail } from '../store/fetchSlice.js';
import ProfileSettingModal from '../modals/ProfileSettingModal.jsx';
import { useReduceMotion } from '../util/methods/useReduceMotion';
import { accent } from '../theme/accent';

/* ---------- helpers ---------- */

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const getInitials = (name = '') => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/* ---------- skeleton (pulsing placeholder while user loads) ---------- */

const Skeleton = ({ reduceMotion }) => {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (reduceMotion) {
      pulse.setValue(0.7);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);

  return (
    <View style={styles.row}>
      <View style={styles.leftGroup}>
        <View style={styles.logoRing}>
          <Wheels width={AVATAR_SIZE} height={AVATAR_SIZE} />
        </View>
        <View style={styles.greetingBlock}>
          <Animated.View style={[styles.skelLine, { width: 64, opacity: pulse }]} />
          <Animated.View style={[styles.skelLine, styles.skelLineWide, { opacity: pulse }]} />
        </View>
      </View>
      <Animated.View style={[styles.avatarRing, { opacity: pulse }]}>
        <View style={styles.avatar} />
      </Animated.View>
    </View>
  );
};

/* ---------- header ---------- */

const Header = () => {
  const { userEmail, profileVersion } = useSelector((state) => state.user);
  const reduceMotion = useReduceMotion();

  const [userData, setUserData] = useState(null);
  // True once a load has settled (success, missing doc or error), so a failed
  // fetch shows the bar without a name instead of a skeleton forever.
  const [settled, setSettled] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [greeting, setGreeting] = useState(getGreeting);
  const [profileVisible, setProfileVisible] = useState(false);
  const [updateData, setUpdateData] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;
  const avatarScale = useRef(new Animated.Value(0.6)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  const loadUser = useCallback(async () => {
    if (!userEmail) return;
    try {
      const data = await fetchUserByEmail(userEmail);
      setUserData(data);
      setPhotoFailed(false);
    } catch (err) {
      console.error('Failed to fetch user:', err);
    } finally {
      setSettled(true);
    }
  }, [userEmail]);

  useEffect(() => {
    loadUser();
  }, [loadUser, profileVersion]);

  // The header lives above the tabs, so "focus" is the app returning to the
  // foreground: refresh the greeting then (and every minute while open), and
  // retry the profile if it failed to load.
  const userDataRef = useRef(userData);
  userDataRef.current = userData;
  useEffect(() => {
    const tick = setInterval(() => setGreeting(getGreeting()), 60 * 1000);
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active') return;
      setGreeting(getGreeting());
      if (!userDataRef.current) loadUser();
    });
    return () => {
      clearInterval(tick);
      sub.remove();
    };
  }, [loadUser]);

  // Entrance animation runs when data arrives, not on mount
  useEffect(() => {
    if (!settled) return;
    if (reduceMotion) {
      fadeAnim.setValue(1);
      translateY.setValue(0);
      avatarScale.setValue(1);
      return;
    }
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 450,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 450,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(avatarScale, {
        toValue: 1,
        friction: 6,
        tension: 80,
        delay: 120,
        useNativeDriver: true,
      }),
    ]).start();
  }, [settled, reduceMotion, fadeAnim, translateY, avatarScale]);

  const firstName = userData?.name?.trim().split(/\s+/)[0];
  const initials = getInitials(userData?.name);

  const onPressIn = () =>
    Animated.spring(pressScale, {
      toValue: 0.88,
      useNativeDriver: true,
    }).start();

  const onPressOut = () =>
    Animated.spring(pressScale, {
      toValue: 1,
      friction: 4,
      useNativeDriver: true,
    }).start();

  // Open profile in VIEW mode.
  // In ProfileSettingModal, updateData === true means read-only view mode,
  // so the user must tap "Edit Profile" before editing.
  const handleOpenProfile = useCallback(() => {
    setUpdateData(true);
    setProfileVisible(true);
  }, []);

  const avatarNode = (
    <Pressable
      onPress={handleOpenProfile}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Open your profile"
    >
      <View style={styles.avatarRing}>
        <View style={styles.avatar}>
          {userData?.photo && !photoFailed ? (
            <Image
              source={{ uri: userData.photo }}
              style={styles.avatarImage}
              onError={() => setPhotoFailed(true)}
            />
          ) : (
            <Text style={styles.avatarText}>{initials}</Text>
          )}
        </View>
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {!settled ? (
        <Skeleton reduceMotion={reduceMotion} />
      ) : (
        <Animated.View
          style={[styles.row, { opacity: fadeAnim, transform: [{ translateY }] }]}
        >
          <View style={styles.leftGroup}>
            <View style={styles.logoRing}>
              <Wheels width={AVATAR_SIZE} height={AVATAR_SIZE} />
            </View>
            <View style={styles.greetingBlock}>
              <Text style={styles.greeting}>{greeting}</Text>
              {firstName ? (
                <Text style={styles.userName} numberOfLines={1}>
                  {firstName}
                </Text>
              ) : null}
            </View>
          </View>

          <Animated.View
            style={{ transform: [{ scale: Animated.multiply(avatarScale, pressScale) }] }}
          >
            {avatarNode}
          </Animated.View>
        </Animated.View>
      )}

      <ProfileSettingModal
        userProfile={profileVisible}
        setUserProfile={setProfileVisible}
        updateData={updateData}
        setUpdateData={setUpdateData}
        onProfileUpdated={loadUser}
      />
    </SafeAreaView>
  );
};

export default Header;

/* ---------- styles ---------- */

const AVATAR_SIZE = 36;

const styles = StyleSheet.create({
  safeArea: {
    get backgroundColor() { return accent.primary; },
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 14,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    paddingRight: 12,
  },
  greetingBlock: {
    alignItems: 'flex-start',
  },
  greeting: {
    fontFamily: 'RobotoCondensed500',
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(255, 255, 255, 0.65)',
  },
  userName: {
    fontFamily: 'RobotoCondensed500',
    fontWeight: '700',
    fontSize: 16,
    color: '#fff',
    maxWidth: 140,
  },
  avatarRing: {
    height: AVATAR_SIZE + 6,
    width: AVATAR_SIZE + 6,
    borderRadius: (AVATAR_SIZE + 6) / 2,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Same footprint as avatarRing so logo and profile are identical in size
  logoRing: {
    height: AVATAR_SIZE + 6,
    width: AVATAR_SIZE + 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    height: AVATAR_SIZE,
    width: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },
  avatarText: {
    fontFamily: 'RobotoCondensed500',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.5,
    get color() { return accent.primary; },
  },
  skelLine: {
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    marginBottom: 6,
  },
  skelLineWide: {
    width: 96,
    height: 14,
    borderRadius: 7,
    marginBottom: 0,
  },
});
