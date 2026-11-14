import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  Image,
  Modal,
  PanResponder,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import Text from './ui/AppText';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CloseX from '../assets/svg/CloseX.jsx';
import DownloadIcon from '../assets/svg/DownloadIcon.jsx';
import { saveImage } from '../util/saveImage';
import { shadow } from '../theme/tokens';
import { t as tr } from '../i18n';

const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_MS = 280;
const DISMISS_DISTANCE = 120;

const ExpandIcon = ({ size = 14, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const distance = touches => {
  const [a, b] = touches;
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
};

// Full-screen photo viewer, Facebook-style: fades in, pinch or double-tap to
// zoom, drag to pan while zoomed, swipe down to close, tap to hide controls.
const PhotoViewer = ({ uri, visible, onClose, fileName }) => {
  const insets = useSafeAreaInsets();
  const [chromeVisible, setChromeVisible] = useState(true);
  const [status, setStatus] = useState('idle'); // 'idle' | 'saving' | 'saved'
  const resetTimer = useRef(null);

  const scale = useRef(new Animated.Value(1)).current;
  const pan = useRef(new Animated.ValueXY()).current;
  const dismissY = useRef(new Animated.Value(0)).current;
  const intro = useRef(new Animated.Value(0)).current;
  const chrome = useRef(new Animated.Value(1)).current;

  // Animated values can't be read synchronously, so the gesture keeps its own copy.
  const g = useRef({
    scale: 1, x: 0, y: 0,
    startScale: 1, startX: 0, startY: 0, startDistance: 0,
    pinching: false, lastTap: 0, moved: false,
  }).current;

  useEffect(() => () => clearTimeout(resetTimer.current), []);

  useEffect(() => {
    if (!visible) return;
    g.scale = 1; g.x = 0; g.y = 0;
    scale.setValue(1);
    pan.setValue({ x: 0, y: 0 });
    dismissY.setValue(0);
    chrome.setValue(1);
    setChromeVisible(true);
    intro.setValue(0);
    Animated.timing(intro, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, g, scale, pan, dismissY, chrome, intro]);

  const zoomTo = (toScale, x = 0, y = 0) => {
    g.scale = toScale; g.x = x; g.y = y;
    Animated.parallel([
      Animated.spring(scale, { toValue: toScale, useNativeDriver: true, friction: 7 }),
      Animated.spring(pan, { toValue: { x, y }, useNativeDriver: true, friction: 7 }),
    ]).start();
  };

  const toggleChrome = () => {
    setChromeVisible(v => {
      Animated.timing(chrome, { toValue: v ? 0 : 1, duration: 160, useNativeDriver: true }).start();
      return !v;
    });
  };

  const close = () => {
    Animated.timing(intro, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => onClose());
  };

  // Keeps a zoomed photo from being dragged completely off screen.
  const clampPan = (x, y, s) => {
    const { width, height } = Dimensions.get('window');
    const maxX = (width * (s - 1)) / 2;
    const maxY = (height * (s - 1)) / 2;
    return [Math.max(-maxX, Math.min(maxX, x)), Math.max(-maxY, Math.min(maxY, y))];
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: evt => {
          g.moved = false;
          g.pinching = false;
          g.startScale = g.scale;
          g.startX = g.x;
          g.startY = g.y;
          if (evt.nativeEvent.touches.length === 2) {
            g.pinching = true;
            g.startDistance = distance(evt.nativeEvent.touches);
          }
        },
        onPanResponderMove: (evt, gs) => {
          const touches = evt.nativeEvent.touches;
          if (Math.abs(gs.dx) > 6 || Math.abs(gs.dy) > 6) g.moved = true;

          if (touches.length === 2) {
            // A second finger can land mid-gesture.
            if (!g.pinching) {
              g.pinching = true;
              g.startDistance = distance(touches);
              g.startScale = g.scale;
            }
            g.moved = true;
            const next = Math.max(0.8, Math.min(MAX_SCALE, (g.startScale * distance(touches)) / g.startDistance));
            g.scale = next;
            scale.setValue(next);
            return;
          }
          if (g.pinching) return; // one finger lifted after a pinch

          if (g.scale > 1.01) {
            const [x, y] = clampPan(g.startX + gs.dx, g.startY + gs.dy, g.scale);
            g.x = x; g.y = y;
            pan.setValue({ x, y });
          } else {
            dismissY.setValue(gs.dy);
          }
        },
        onPanResponderRelease: (evt, gs) => {
          if (g.pinching) {
            if (g.scale < 1.05) zoomTo(1);
            else {
              const [x, y] = clampPan(g.x, g.y, g.scale);
              zoomTo(g.scale, x, y);
            }
            return;
          }

          if (!g.moved) {
            const now = Date.now();
            if (now - g.lastTap < DOUBLE_TAP_MS) {
              g.lastTap = 0;
              if (g.scale > 1.01) zoomTo(1);
              else {
                // Zoom in on the tapped point, like the native gallery.
                const { width, height } = Dimensions.get('window');
                const x = (width / 2 - evt.nativeEvent.pageX) * (DOUBLE_TAP_SCALE - 1);
                const y = (height / 2 - evt.nativeEvent.pageY) * (DOUBLE_TAP_SCALE - 1);
                zoomTo(DOUBLE_TAP_SCALE, ...clampPan(x, y, DOUBLE_TAP_SCALE));
              }
            } else {
              g.lastTap = now;
              setTimeout(() => {
                if (g.lastTap === now) toggleChrome();
              }, DOUBLE_TAP_MS);
            }
            return;
          }

          if (g.scale <= 1.01) {
            if (Math.abs(gs.dy) > DISMISS_DISTANCE || Math.abs(gs.vy) > 1.2) {
              close();
            } else {
              Animated.spring(dismissY, { toValue: 0, useNativeDriver: true, friction: 7 }).start();
            }
          }
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handleDownload = async () => {
    if (status === 'saving') return;
    setStatus('saving');
    try {
      const result = await saveImage(uri, fileName ? `${fileName}_${Date.now()}` : undefined);
      setStatus(result === 'saved' ? 'saved' : 'idle');
      if (result === 'saved') {
        clearTimeout(resetTimer.current);
        resetTimer.current = setTimeout(() => setStatus('idle'), 2500);
      }
    } catch (error) {
      setStatus('idle');
      Alert.alert(tr('Download failed'), error?.message || tr('Please try again.'));
    }
  };

  // Backdrop fades out as the photo is swiped away.
  const backdropOpacity = Animated.multiply(
    intro,
    dismissY.interpolate({
      inputRange: [-300, 0, 300],
      outputRange: [0.35, 1, 0.35],
      extrapolate: 'clamp',
    }),
  );
  const introScale = intro.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] });

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={close}>
      <StatusBar barStyle="light-content" />
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdropOpacity }]} />

      <Animated.View
        {...responder.panHandlers}
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: intro,
            transform: [
              { translateY: dismissY },
              { translateX: pan.x },
              { translateY: pan.y },
              { scale: Animated.multiply(scale, introScale) },
            ],
          },
        ]}
      >
        <Image style={StyleSheet.absoluteFill} source={{ uri }} resizeMode="contain" />
      </Animated.View>

      <Animated.View
        pointerEvents={chromeVisible ? 'box-none' : 'none'}
        style={[StyleSheet.absoluteFill, { opacity: Animated.multiply(chrome, intro) }]}
      >
        <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel={tr('Close')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.roundButton}
          >
            <CloseX size={14} color="#fff" strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 20 }]} pointerEvents="box-none">
          <TouchableOpacity
            onPress={handleDownload}
            disabled={status === 'saving'}
            accessibilityRole="button"
            accessibilityLabel={tr('Download photo')}
            activeOpacity={0.85}
            style={styles.downloadButton}
          >
            {status === 'saving' ? (
              <ActivityIndicator size="small" color="#041933" />
            ) : (
              <DownloadIcon size={18} color="#041933" strokeWidth={2} />
            )}
            <Text style={styles.downloadText}>
              {status === 'saving' ? tr('Saving…') : status === 'saved' ? tr('Saved to gallery') : tr('Download')}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
};

// The whole photo (contain) over a blurred copy of itself, so nothing is
// cropped and the frame never shows empty bars. `style` sizes the frame.
export const FitImage = ({ uri, style }) => {
  const { resizeMode, ...frameStyle } = StyleSheet.flatten(style) || {};
  return (
    <View style={[styles.fit, frameStyle]}>
      <Image style={StyleSheet.absoluteFill} source={{ uri }} resizeMode="cover" blurRadius={18} />
      <Image style={StyleSheet.absoluteFill} source={{ uri }} resizeMode="contain" />
    </View>
  );
};

// Attached photo (receipt, document, service bill). The whole image is shown
// (contain) over a blurred copy of itself, so nothing is cropped and the frame
// never shows empty bars. Tapping opens the full-screen viewer.
const PhotoPreview = ({ uri, borderColor = 'transparent', fileName, height = 200, style }) => {
  const [open, setOpen] = useState(false);

  if (!uri) return null;

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setOpen(true)}
        accessibilityRole="imagebutton"
        accessibilityLabel={tr('Open photo full screen')}
        style={[styles.frame, shadow(2), { height, borderColor }, style]}
      >
        <FitImage uri={uri} style={StyleSheet.absoluteFill} />
        <View style={styles.expandBadge}>
          <ExpandIcon />
        </View>
      </TouchableOpacity>

      <PhotoViewer uri={uri} visible={open} onClose={() => setOpen(false)} fileName={fileName} />
    </>
  );
};

export default PhotoPreview;

const styles = StyleSheet.create({
  fit: { overflow: 'hidden', backgroundColor: '#0A1E38' },
  frame: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: '#0A1E38',
  },
  expandBadge: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(4,25,51,0.6)',
  },

  backdrop: { backgroundColor: '#000' },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    flexDirection: 'row',
  },
  roundButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 48,
    paddingHorizontal: 24,
    borderRadius: 24,
    backgroundColor: '#fff',
  },
  downloadText: { fontSize: 15, fontFamily: 'RobotoCondensed500', color: '#041933' },
});
