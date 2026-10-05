import React, { useEffect, useRef, useMemo } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { themecolors } from '../styles/themecolors.js';
import { useReduceMotion } from '../util/methods/useReduceMotion';

const SkeletonVehicleCard = () => {
  const { theme } = useSelector(state => state.theme);
  const isDark = theme === 'dark';

  // ─── Theme-aware palette ───────────────────────────────────────────────
  const c = useMemo(
    () => ({
      surface: isDark ? themecolors.darkBlue : '#fff',
      // Subtle outline to match the themed VehicleCard in dark mode.
      border: isDark ? 1 : 0,
      borderColor: isDark ? 'rgba(255,255,255,0.16)' : null,
      // Shimmer blocks: light greys vanish on dark, so use translucent whites.
      shimmerBase: isDark ? 'rgba(255,255,255,0.06)' : '#EEF1F5',
      shimmerHighlight: isDark ? 'rgba(255,255,255,0.14)' : '#F5F7FA',
    }),
    [isDark],
  );

  const shimmerAnim = useRef(new Animated.Value(-1)).current;
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    if (reduceMotion) {
      // Park the highlight off-card: a static placeholder.
      shimmerAnim.setValue(-1);
      return undefined;
    }
    const animation = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerAnim, reduceMotion]);

  const translateX = shimmerAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: [-200, 200],
  });

  const ShimmerBox = ({ width, height, borderRadius = 8 }) => (
    <View style={[styles.shimmerBase, { backgroundColor: c.shimmerBase, width, height, borderRadius }]}>
      <Animated.View
        style={[
          styles.shimmerHighlight,
          { backgroundColor: c.shimmerHighlight, transform: [{ translateX }] },
        ]}
      />
    </View>
  );

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderWidth: c.border, borderColor: c.borderColor }]}>
      <View style={styles.content}>
        {/* Image placeholder */}
        <ShimmerBox width={80} height={62} />

        {/* Text placeholders */}
        <View style={styles.textContainer}>
          <View style={styles.textWrapper}>
            <ShimmerBox width={120} height={18} borderRadius={4} />
            <ShimmerBox width={80} height={13} borderRadius={4} />
          </View>
          {/* Edit icon placeholder */}
          <ShimmerBox width={24} height={24} borderRadius={12} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: 12,
    overflow: 'hidden',

    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 12,
  },
  content: {
    flex: 1,
    padding: 12,
    flexDirection: 'row',
    gap: 12,
  },
  textContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  textWrapper: {
    gap: 8,
  },
  shimmerBase: {
    overflow: 'hidden',
  },
  shimmerHighlight: {
    width: '100%',
    height: '100%',
    opacity: 0.6,
  },
});

export default SkeletonVehicleCard;