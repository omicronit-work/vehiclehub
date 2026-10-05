import {
  Modal,
  PanResponder,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import LinearGradient from 'react-native-linear-gradient';

import { Typography } from '../styles/typography.js';
import { themecolors } from '../styles/themecolors.js';
import CloseX from '../assets/svg/CloseX.jsx';
import {
  accent,
  DEFAULT_ACCENT,
  contrastWithWhite,
  hexToHsv,
  hsvToHex,
  normalizeHex,
} from '../theme/accent';

const HUES = ['#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#FF0000'];
const PRESETS = [DEFAULT_ACCENT, '#004EAB', '#5B4BC4', '#B23A8A', '#C2410C', '#15803D', '#334155'];
const SQUARE_HEIGHT = 190;
const THUMB = 22;

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// Drag handler that reports the touch position inside the view, clamped to
// 0–1. Uses the grant position + gesture delta, since locationX jumps around
// once the finger leaves the view.
const useDrag = (widthRef, height, onChange) => {
  const start = useRef({ x: 0, y: 0 });
  const cb = useRef(onChange);
  cb.current = onChange;
  return useMemo(() => {
    const emit = (x, y) => {
      const w = widthRef.current || 1;
      cb.current(clamp(x / w, 0, 1), height ? clamp(y / height, 0, 1) : 0);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        start.current = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY };
        emit(start.current.x, start.current.y);
      },
      onPanResponderMove: (_, g) => emit(start.current.x + g.dx, start.current.y + g.dy),
    });
  }, [widthRef, height]);
};

const ColorPickerModal = ({ visible, value, onClose, onApply }) => {
  const { theme } = useSelector((store) => store.theme);
  const isDark = theme === 'dark';

  // HSV is the source of truth so hue survives dragging into grey/black.
  const [hsv, setHsv] = useState(() => hexToHsv(value));
  const [hexText, setHexText] = useState(value);
  const width = useRef(0);
  const [measuredWidth, setMeasuredWidth] = useState(0);

  useEffect(() => {
    if (visible) {
      setHsv(hexToHsv(value));
      setHexText(value);
    }
  }, [visible, value]);

  const hex = hsvToHex(hsv.h, hsv.s, hsv.v);
  const hueHex = hsvToHex(hsv.h, 1, 1);
  const lowContrast = contrastWithWhite(hex) < 3;

  const update = (next) => {
    setHsv(next);
    setHexText(hsvToHex(next.h, next.s, next.v));
  };

  const squareDrag = useDrag(width, SQUARE_HEIGHT, (x, y) => update({ ...hsv, s: x, v: 1 - y }));
  const hueDrag = useDrag(width, 0, (x) => update({ ...hsv, h: x * 359.99 }));

  const onHexChange = (text) => {
    setHexText(text);
    const parsed = normalizeHex(text);
    if (parsed) setHsv(hexToHsv(parsed));
  };

  const c = {
    bg: isDark ? themecolors.darkBlue : themecolors.white,
    text: isDark ? themecolors.white : 'rgba(4, 25, 51, 1)',
    muted: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(4,25,51,0.55)',
    border: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(4,25,51,0.12)',
    warning: isDark ? '#FFD180' : '#B45309',
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      backdropOpacity={0.55}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose} accessible={false}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <View style={[styles.sheet, { backgroundColor: c.bg }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: c.text }]}>App Color</Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[styles.closeButton, { backgroundColor: isDark ? accent.lightAlpha(0.14) : accent.alpha(0.08) }]}
          >
            <CloseX size={12} color={isDark ? accent.light : accent.primary} />
          </TouchableOpacity>
        </View>

        {/* Saturation (x) / brightness (y) square */}
        <View
          style={[styles.square, { backgroundColor: hueHex }]}
          onLayout={(e) => {
            width.current = e.nativeEvent.layout.width;
            setMeasuredWidth(e.nativeEvent.layout.width);
          }}
          accessibilityLabel="Saturation and brightness"
          {...squareDrag.panHandlers}
        >
          <LinearGradient
            pointerEvents="none"
            colors={['#FFFFFF', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(0,0,0,0)', '#000000']}
            style={StyleSheet.absoluteFill}
          />
          <View
            pointerEvents="none"
            style={[
              styles.thumb,
              {
                backgroundColor: hex,
                left: hsv.s * measuredWidth - THUMB / 2,
                top: (1 - hsv.v) * SQUARE_HEIGHT - THUMB / 2,
              },
            ]}
          />
        </View>

        {/* Hue bar */}
        <View style={styles.hueWrap} accessibilityLabel="Hue" {...hueDrag.panHandlers}>
          <LinearGradient
            pointerEvents="none"
            colors={HUES}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.hueBar}
          />
          <View
            pointerEvents="none"
            style={[
              styles.thumb,
              styles.hueThumb,
              { backgroundColor: hueHex, left: (hsv.h / 360) * measuredWidth - THUMB / 2 },
            ]}
          />
        </View>

        {/* Hex value + preview */}
        <View style={styles.hexRow}>
          <TextInput
            value={hexText}
            onChangeText={onHexChange}
            onBlur={() => setHexText(hex)}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={7}
            accessibilityLabel="Hex colour"
            style={[styles.hexInput, { color: c.text, borderColor: c.border }]}
          />
          <View style={[styles.preview, { backgroundColor: hex, borderColor: c.border }]} />
        </View>

        {/* Presets */}
        <View style={styles.presets}>
          {PRESETS.map((p) => (
            <TouchableOpacity
              key={p}
              onPress={() => update(hexToHsv(p))}
              accessibilityRole="button"
              accessibilityLabel={p === DEFAULT_ACCENT ? 'Default teal' : p}
              accessibilityState={{ selected: p === hex }}
              style={[styles.preset, { backgroundColor: p }, p === hex && { borderColor: c.text }]}
            />
          ))}
        </View>

        <Text style={[styles.note, { color: lowContrast ? c.warning : c.muted }]}>
          {lowContrast
            ? 'This colour is very light — white text on buttons and the header will be hard to read.'
            : 'Used for the header, buttons and highlights across the app.'}
        </Text>

        <View style={styles.actions}>
          <TouchableOpacity
            onPress={() => update(hexToHsv(DEFAULT_ACCENT))}
            accessibilityRole="button"
            style={[styles.button, styles.secondary, { borderColor: c.border }]}
          >
            <Text style={[styles.buttonText, { color: c.text }]}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onApply(hex)}
            accessibilityRole="button"
            style={[styles.button, { backgroundColor: hex }]}
          >
            <Text style={[styles.buttonText, { color: lowContrast ? '#041933' : '#FFFFFF' }]}>Apply</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default ColorPickerModal;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  title: { fontFamily: Typography.font.regular, fontSize: 18 },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  square: {
    height: SQUARE_HEIGHT,
    borderRadius: 14,
    overflow: 'hidden',
  },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  hueWrap: {
    height: THUMB + 8,
    justifyContent: 'center',
    marginTop: 14,
  },
  hueBar: {
    height: 12,
    borderRadius: 6,
  },
  hueThumb: {
    top: 4,
  },
  hexRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  hexInput: {
    flex: 1,
    height: 46,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontFamily: Typography.font.regular,
    fontSize: Typography.textsize.small,
    letterSpacing: 1,
  },
  preview: {
    width: 46,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
  },
  presets: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  preset: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  note: {
    fontFamily: Typography.font.regular,
    fontSize: 12,
    marginTop: 14,
    lineHeight: 17,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: {
    borderWidth: 1,
  },
  buttonText: {
    fontFamily: Typography.font.regular,
    fontSize: Typography.textsize.small,
  },
});
