import React, { useContext, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { MIN_TOUCH } from '../../theme/tokens';

// One app-wide "Deleted · Undo" bar. Call showUndo() from anywhere; the host
// is mounted once in App.jsx.
const UNDO_MS = 6000;
let listener = null;

/** showUndo({ message: 'Fuel log deleted', onUndo }) */
export const showUndo = payload => listener?.(payload);

export const UndoSnackbarHost = () => {
  // Mounted beside (not inside) the app's SafeAreaProvider, so read the
  // context directly and fall back to no inset.
  const insets = useContext(SafeAreaInsetsContext) || { bottom: 0 };
  const [item, setItem] = useState(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef(null);

  useEffect(() => {
    listener = next => {
      clearTimeout(timer.current);
      setItem({ ...next, key: Date.now() });
    };
    return () => {
      listener = null;
      clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    if (!item) return;
    Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    timer.current = setTimeout(() => setItem(null), UNDO_MS);
  }, [item, opacity]);

  if (!item) return null;

  const undo = () => {
    clearTimeout(timer.current);
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
        accessibilityLabel={`Undo: ${item.message}`}
        hitSlop={8}
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.6 }]}
      >
        <Text style={styles.buttonText}>UNDO</Text>
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
