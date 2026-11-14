import React, { useContext, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import Text from './AppText';
import { SafeAreaInsetsContext, initialWindowMetrics } from 'react-native-safe-area-context';
import { MIN_TOUCH } from '../../theme/tokens';
import { t as tr } from '../../i18n';

// One app-wide "Deleted · Undo" bar. Call showUndo() from anywhere; the host
// is mounted once in App.jsx.
const UNDO_MS = 6000;
let listener = null;

/**
 * showUndo({ message: 'Fuel log deleted', onUndo, onExpire })
 * onExpire runs once the chance to undo is gone: the bar timed out or was
 * replaced by another one. Without a mounted host it runs straight away.
 */
export const showUndo = payload => {
  if (listener) listener(payload);
  else payload?.onExpire?.();
};

export const UndoSnackbarHost = () => {
  // Mounted beside (not inside) the navigator's safe-area provider, so there's
  // usually no context here: fall back to the window's own insets. Keeps the
  // bar above the tab bar, whose height includes this inset.
  const insets = useContext(SafeAreaInsetsContext) || initialWindowMetrics?.insets || { bottom: 0 };
  const [item, setItem] = useState(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef(null);
  // The bar on screen, read by callbacks outside render.
  const current = useRef(null);

  const expire = () => {
    const shown = current.current;
    current.current = null;
    shown?.onExpire?.();
  };

  useEffect(() => {
    listener = next => {
      clearTimeout(timer.current);
      expire(); // a new bar ends the chance to undo the previous one
      const shown = { ...next, key: Date.now() };
      current.current = shown;
      setItem(shown);
    };
    return () => {
      listener = null;
      clearTimeout(timer.current);
      expire();
    };
  }, []);

  useEffect(() => {
    if (!item) return;
    Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    timer.current = setTimeout(() => {
      expire();
      setItem(null);
    }, UNDO_MS);
  }, [item, opacity]);

  if (!item) return null;

  const undo = () => {
    clearTimeout(timer.current);
    current.current = null;
    setItem(null);
    item.onUndo?.();
  };

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: insets.bottom + 84, opacity }]}
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.message} numberOfLines={2}>
        {item.message}
      </Text>
      <Pressable
        onPress={undo}
        accessibilityRole="button"
        accessibilityLabel={tr('Undo: {0}', { 0: item.message })}
        hitSlop={8}
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.6 }]}
      >
        <Text style={styles.buttonText}>{tr('UNDO')}</Text>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: '#1F2937',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 6,
    zIndex: 9999,
    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.25)',
  },
  message: { flex: 1, color: '#FFFFFF', fontSize: 14 },
  button: {
    minHeight: MIN_TOUCH,
    minWidth: MIN_TOUCH,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#8FC1FF', fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
});
