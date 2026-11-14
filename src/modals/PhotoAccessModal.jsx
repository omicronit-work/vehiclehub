import React, { useEffect, useState } from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import Text from '../components/ui/AppText';
import Modal from 'react-native-modal';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

import { Typography } from '../styles/typography.js';
import { useAppTheme } from '../theme/useAppTheme';
import { accent } from '../theme/accent';
import { shadow } from '../theme/tokens';
import { subscribePhotoAccess } from '../util/methods/useImagePicker';
import { useHideAdsWhile } from '../util/ads';
import { t as tr } from '../i18n';

const PhotoIcon = ({ color, size = 28 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x={3} y={4} width={18} height={16} rx={3} stroke={color} strokeWidth={1.8} />
    <Circle cx={9} cy={9.5} r={1.8} stroke={color} strokeWidth={1.8} />
    <Path
      d="M3.5 17l5-4.5 3.5 3 3-2.5 5.5 4.5"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const ShieldIcon = ({ color }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 3l7 3v5.5c0 4.3-3 8-7 9.5-4-1.5-7-5.2-7-9.5V6l7-3z"
      stroke={color}
      strokeWidth={1.8}
      strokeLinejoin="round"
    />
    <Path
      d="M9 12l2 2 4-4"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

/**
 * App-wide consent sheet shown before the first photo pick. Mounted once in
 * App.jsx; pickImage() opens it and waits for the answer.
 */
const PhotoAccessModal = () => {
  const t = useAppTheme();
  const [request, setRequest] = useState(null);

  useEffect(() => subscribePhotoAccess(setRequest), []);
  useHideAdsWhile(!!request);

  const answer = (granted) => {
    request?.resolve(granted);
    setRequest(null);
  };

  const tint = t.isDark ? accent.lightAlpha(0.16) : accent.tint;
  const iconColor = t.isDark ? accent.light : accent.primary;
  const noteBg = t.isDark ? 'rgba(255,255,255,0.05)' : '#F4F7FB';
  const cancelBg = t.isDark ? 'rgba(255,255,255,0.08)' : '#EEF1F5';

  return (
    <Modal
      statusBarTranslucent
      isVisible={!!request}
      onBackdropPress={() => answer(false)}
      onBackButtonPress={() => answer(false)}
      backdropOpacity={0.55}
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
            <PhotoIcon color={iconColor} />
          </View>
        </View>

        <Text style={[styles.title, { color: t.text }]}>{tr('Allow photo access')}</Text>
        <Text style={[styles.message, { color: t.textMuted }]}>
          {tr('VehicleHub needs permission to open your photos so you can attach receipts, documents and vehicle pictures.')}
        </Text>

        <View style={[styles.note, { backgroundColor: noteBg }]}>
          <ShieldIcon color={iconColor} />
          <Text style={[styles.noteText, { color: t.textMuted }]}>
            {tr('Only the photo you pick is shared — nothing else on your device.')}
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: cancelBg }]}
            activeOpacity={0.8}
            onPress={() => answer(false)}
            accessibilityRole="button"
          >
            <Text style={[styles.buttonText, { color: t.text }]}>{tr('Not now')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: accent.primary }, shadow(2, accent.primary)]}
            activeOpacity={0.85}
            onPress={() => answer(true)}
            accessibilityRole="button"
          >
            <Text style={[styles.buttonText, { color: t.onPrimary }]}>{tr('Allow')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default PhotoAccessModal;

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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 22,
  },
  noteText: {
    flex: 1,
    fontFamily: Typography.font.regular,
    fontSize: 12,
    lineHeight: 17,
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
