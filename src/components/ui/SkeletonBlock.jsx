import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../../util/methods/useTheme';
import { useReduceMotion } from '../../util/methods/useReduceMotion';

const DURATION = 1300;

const PALETTE = {
  light: { base: '#E6EBF1', highlight: 'rgba(255,255,255,0.75)' },
  dark: { base: 'rgba(255,255,255,0.08)', highlight: 'rgba(255,255,255,0.12)' },
};

// One placeholder shape for every skeleton in the app: a muted block with a
// soft highlight sweeping left → right. Static under the OS "Reduce motion"
// setting. `color` overrides the base colour when a screen needs its own.
const SkeletonBlock = ({ width, height, borderRadius = 8, color, style }) => {
  const isDark = useTheme();
  const reduceMotion = useReduceMotion();
  const palette = isDark ? PALETTE.dark : PALETTE.light;

  const [blockWidth, setBlockWidth] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion || !blockWidth) return undefined;
    progress.setValue(0);
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: DURATION,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [progress, reduceMotion, blockWidth]);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-blockWidth, blockWidth],
  });

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={e => setBlockWidth(e.nativeEvent.layout.width)}
      style={[
        styles.block,
        { width, height, borderRadius, backgroundColor: color || palette.base },
        style,
      ]}
    >
      {!reduceMotion && blockWidth > 0 && (
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}>
          <LinearGradient
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            colors={['transparent', palette.highlight, 'transparent']}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  block: { overflow: 'hidden' },
});

export default SkeletonBlock;
