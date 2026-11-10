import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { themecolors } from '../styles/themecolors.js';
import ShimmerBox from '../components/ui/SkeletonBlock.jsx';

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
    }),
    [isDark],
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

    boxShadow: '0px 0px 4px rgba(0, 0, 0, 0.05)',
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
});

export default SkeletonVehicleCard;