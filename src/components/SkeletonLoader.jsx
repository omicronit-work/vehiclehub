import React, { useEffect, useRef } from 'react';

import {
  Animated,
  ScrollView,
  View,
  StyleSheet,
  Dimensions,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.39;

export const SkeletonLoader = ({ isDark }) => {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: false,
      }),
    ).start();
  }, []);

  const backgroundColor = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [
      isDark ? '#16345C' : '#E5E7EB',
      isDark ? '#244C7D' : '#F3F4F6',
    ],
  });

  const SkeletonBox = ({ width, height, style }) => (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: 10,
          backgroundColor,
        },
        style,
      ]}
    />
  );

  return (
    <View style={styles.filledContainer}>
      <View style={[styles.titleRow, { justifyContent: 'space-between' }]}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <SkeletonBox width={24} height={24} />
          <SkeletonBox width={120} height={20} />
        </View>

        <SkeletonBox width={24} height={24} />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: 16 }}
      >
        {[1, 2, 3].map(item => (
          <View key={item} style={{ marginRight: 12 }}>
            <SkeletonBox
              width={CARD_WIDTH}
              height={110}
              style={{ borderRadius: 16 }}
            />
          </View>
        ))}
      </ScrollView>

      <View style={styles.tabRow}>
        <SkeletonBox width={80} height={20} />
        <SkeletonBox width={100} height={20} />
      </View>

      <View style={{ marginTop: 20, width: '100%', gap: 16 }}>
        {[1, 2, 3, 4].map(item => (
          <SkeletonBox
            key={item}
            width={'100%'}
            height={80}
            style={{ borderRadius: 16 }}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  filledContainer: {
    alignItems: 'flex-start',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  tabRow: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 10,
  },
});