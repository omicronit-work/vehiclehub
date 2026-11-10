import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { accent } from '../theme/accent';
import { countryFlag, countryNameOf, useLocating } from '../util/userCountry';

const Pin = ({ color }) => (
  <Svg width={11} height={11} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 1113 0c0 5.4-6.5 11-6.5 11z"
      stroke={color}
      strokeWidth={2.2}
      strokeLinejoin="round"
    />
    <Circle cx={12} cy={10} r={2.4} stroke={color} strokeWidth={2.2} />
  </Svg>
);

// "📍 🇹🇭 Thailand" pill beside the Fuel type label: the country whose fuel
// names are being shown.
const FuelCountryBadge = ({ country, isDark }) => {
  const locating = useLocating();
  if (!country) return null;
  const name = countryNameOf(country);
  const color = isDark ? accent.light : accent.primary;
  return (
    <View
      style={[styles.badge, { backgroundColor: isDark ? accent.lightAlpha(0.14) : accent.alpha(0.08) }]}
      accessible
      accessibilityLabel={`Fuel types for ${name}`}
    >
      {/* Spinner while the location is being re-checked (e.g. after resume). */}
      {locating ? <ActivityIndicator size={11} color={color} /> : <Pin color={color} />}
      <Text style={[styles.text, { color }]} numberOfLines={1}>
        {countryFlag(country)} {name}
      </Text>
    </View>
  );
};

export default FuelCountryBadge;

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    height: 22,
    borderRadius: 11,
    maxWidth: '60%',
  },
  text: {
    fontSize: 12,
    fontFamily: 'RobotoCondensed500',
  },
});
