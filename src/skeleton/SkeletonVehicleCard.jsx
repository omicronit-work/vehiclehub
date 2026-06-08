import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

const SkeletonVehicleCard = () => {
  const shimmerAnim = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const translateX = shimmerAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: [-200, 200],
  });

  const ShimmerBox = ({ width, height, borderRadius = 8 }) => (
    <View style={[styles.shimmerBase, { width, height, borderRadius }]}>
      <Animated.View
        style={[
          styles.shimmerHighlight,
          { transform: [{ translateX }] },
        ]}
      />
    </View>
  );

  return (
    <View style={styles.card}>
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
    backgroundColor: '#fff',
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
    backgroundColor: '#EEF1F5',
  },
  shimmerHighlight: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F5F7FA',
    opacity: 0.6,
  },
});

export default SkeletonVehicleCard;