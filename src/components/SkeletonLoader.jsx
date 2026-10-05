import React, { useEffect, useRef } from 'react';

import {
  Animated,
  ScrollView,
  View,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useSelector } from 'react-redux';
import { useReduceMotion } from '../util/methods/useReduceMotion';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.43;

export const SkeletonLoader = () => {
  const { theme } = useSelector(state => state.theme);
  const isDark = theme === 'dark';

  const shimmer = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    if (reduceMotion) {
      shimmer.setValue(0.5);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: false,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer, reduceMotion]);

  const backgroundColor = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [
      isDark ? '#0E2747' : '#E5E7EB',
      isDark ? '#1B3A63' : '#F3F4F6',
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
              height={78}
              style={{ borderRadius: 20 }}
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
            height={96}
            style={{ borderRadius: 20 }}
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