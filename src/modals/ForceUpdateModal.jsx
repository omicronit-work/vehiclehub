import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Modal from 'react-native-modal';
import Svg, { Path } from 'react-native-svg';

import NativeAppUpdater from '../../specs/NativeAppUpdater';
import { Typography } from '../styles/typography.js';
import { useAppTheme } from '../theme/useAppTheme';
import { accent } from '../theme/accent';
import { shadow } from '../theme/tokens';
import { useHideAdsWhile } from '../util/ads';

const UpdateIcon = ({ color, size = 28 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M20 12a8 8 0 1 1-2.34-5.66"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
    />
    <Path
      d="M20 4v4.5h-4.5"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M12 8v5.5M9.5 11l2.5 2.5 2.5-2.5"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

/**
 * Blocks the whole app while a newer version is on Google Play. Mounted once
 * in App.jsx; re-checks every time the app returns to the foreground, so
 * leaving and coming back doesn't get around it. If Play can't be reached
 * (offline, sideloaded/debug build) the app is left usable.
 */
const ForceUpdateModal = () => {
  const t = useAppTheme();
  const [required, setRequired] = useState(false);
  const [starting, setStarting] = useState(false);
  const checking = useRef(false);

  useHideAdsWhile(required);

  const startUpdate = useCallback(async () => {
    if (!NativeAppUpdater) return;
    setStarting(true);
    try {
      // Accepting hands over to Play, which installs and restarts the app;
      // backing out leaves this sheet up.
      await NativeAppUpdater.startUpdate();
    } catch (error) {
      // Play won't run the in-app flow (e.g. not allowed yet on this device):
      // send them to the store listing instead.
      console.log('In-app update unavailable, opening Play Store:', error?.message);
      NativeAppUpdater.openStore().catch(err => console.log('Could not open Play Store:', err));
    } finally {
      setStarting(false);
    }
  }, []);

  const check = useCallback(async () => {
    if (!NativeAppUpdater || checking.current) return;
    checking.current = true;
    try {
      const info = await NativeAppUpdater.checkForUpdate();
      setRequired(info.available || info.inProgress);
      // An accepted update that was interrupted must be resumed (Play's rule
      // for immediate updates).
      if (info.inProgress) startUpdate();
    } catch (error) {
      console.log('Update check failed:', error?.message);
    } finally {
      checking.current = false;
    }
  }, [startUpdate]);

  useEffect(() => {
    check();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') check();
    });
    return () => sub.remove();
  }, [check]);

  const tint = t.isDark ? accent.lightAlpha(0.16) : accent.tint;
  const iconColor = t.isDark ? accent.light : accent.primary;
  const noteBg = t.isDark ? 'rgba(255,255,255,0.05)' : '#F4F7FB';
  const exitBg = t.isDark ? 'rgba(255,255,255,0.08)' : '#EEF1F5';

  return (
    <Modal
      statusBarTranslucent
      isVisible={required}
      // No dismissing: the only ways out are updating or closing the app.
      onBackButtonPress={() => BackHandler.exitApp()}
      backdropOpacity={0.7}
      useNativeDriverForBackdrop
      animationIn="zoomIn"
      animationOut="zoomOut"
      animationInTiming={220}
      animationOutTiming={180}
      style={styles.modal}
    >
      <View style={[styles.card, { backgroundColor: t.surface }, shadow(4, '#000000')]}>
        <View style={[styles.iconHalo, { backgroundColor: accent.lightAlpha(t.isDark ? 0.08 : 0.12) }]}>
          <View style={[styles.iconWell, { backgroundColor: tint }]}>
            <UpdateIcon color={iconColor} />
          </View>
        </View>

        <Text style={[styles.title, { color: t.text }]}>Update required</Text>
        <Text style={[styles.message, { color: t.textMuted }]}>
          A new version of VehicleHub is available. Please update to keep
          using the app.
        </Text>

        <View style={[styles.note, { backgroundColor: noteBg }]}>
          <Text style={[styles.noteText, { color: t.textMuted }]}>
            Your vehicles, logs and documents are safe — nothing is lost when
            you update.
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: exitBg }]}
            activeOpacity={0.8}
            onPress={() => BackHandler.exitApp()}
            accessibilityRole="button"
          >
            <Text style={[styles.buttonText, { color: t.text }]}>Close app</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: accent.primary }, shadow(2, accent.primary)]}
            activeOpacity={0.85}
            onPress={startUpdate}
            disabled={starting}
            accessibilityRole="button"
          >
            {starting ? (
              <ActivityIndicator color={t.onPrimary} />
            ) : (
              <Text style={[styles.buttonText, { color: t.onPrimary }]}>Update now</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default ForceUpdateModal;

const styles = StyleSheet.create({
  modal: {
    justifyContent: 'center',
    alignItems: 'center',
    margin: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
    alignItems: 'center',
  },
  iconHalo: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  iconWell: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: Typography.font.medium,
    fontSize: Typography.textsize.large,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontFamily: Typography.font.regular,
    fontSize: Typography.textsize.small,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 16,
  },
  note: {
    width: '100%',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 22,
  },
  noteText: {
    fontFamily: Typography.font.regular,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  button: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: Typography.font.medium,
    fontSize: Typography.textsize.small,
    fontWeight: '700',
  },
});
