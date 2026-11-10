import { useCallback, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { useReduceMotion } from './useReduceMotion';

/**
 * A floating "+ Add" button that slides away while the list scrolls down and
 * comes back on scrolling up or near the top, so it never sits for good on
 * top of a card's own buttons (edit, delete).
 *
 *   const fab = useHideOnScroll();
 *   <ScrollView onScroll={fab.onScroll} scrollEventThrottle={16} />
 *   <Animated.View style={fab.style} pointerEvents={fab.visible ? 'box-none' : 'none'}>…
 *
 * Call fab.show() when the list's content changes (another tab or vehicle).
 */
const NEAR_TOP = 24;
const MIN_DELTA = 6;

export const useHideOnScroll = () => {
  const reduceMotion = useReduceMotion();
  const anim = useRef(new Animated.Value(1)).current;
  const shown = useRef(true);
  const lastY = useRef(0);
  const [visible, setVisible] = useState(true);

  const set = useCallback(next => {
    if (shown.current === next) return;
    shown.current = next;
    setVisible(next);
    Animated.timing(anim, {
      toValue: next ? 1 : 0,
      duration: reduceMotion ? 0 : 180,
      useNativeDriver: true,
    }).start();
  }, [anim, reduceMotion]);

  const onScroll = useCallback(e => {
    const y = e.nativeEvent.contentOffset.y;
    const dy = y - lastY.current;
    lastY.current = y;
    if (y < NEAR_TOP) set(true);
    else if (dy > MIN_DELTA) set(false);
    else if (dy < -MIN_DELTA) set(true);
  }, [set]);

  const show = useCallback(() => {
    lastY.current = 0;
    set(true);
  }, [set]);

  const style = {
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [90, 0] }) }],
  };

  return { onScroll, show, style, visible };
};
