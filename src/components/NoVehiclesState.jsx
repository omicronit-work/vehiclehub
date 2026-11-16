import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Text from './ui/AppText';
import Vehicle from '../assets/svg/Vehicle.jsx';
import PlusStroke from '../assets/svg/PlusStroke.jsx';
import { Typography } from '../styles/typography';
import { shadowSoft as shadow } from '../theme/tokens';
import { accent } from '../theme/accent';
import { t as tr } from '../i18n';

/**
 * "No vehicles yet" with an Add vehicle button. Shared by Home and the
 * Dashboard so an empty garage looks the same everywhere.
 */
const NoVehiclesState = ({ isDark, textColor, mutedColor, onAdd }) => (
  <View style={styles.container}>
    <View
      style={[
        styles.iconWell,
        { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : accent.lightAlpha(0.08) },
      ]}
    >
      <Vehicle color={isDark ? 'rgba(255,255,255,0.5)' : accent.lightAlpha(0.55)} />
    </View>

    <View style={styles.textContainer}>
      <Text style={[styles.title, { color: textColor }]}>{tr('home.noVehicles')}</Text>
      <Text style={[styles.subtitle, { color: mutedColor }]}>{tr('home.noVehiclesHint')}</Text>
    </View>

    <TouchableOpacity
      onPress={onAdd}
      activeOpacity={0.85}
      accessibilityRole="button"
      style={[styles.addButton, shadow(3, accent.primary)]}
    >
      <View style={styles.addButtonIconWell}>
        <PlusStroke color="#fff" size={18} />
      </View>
      <Text style={styles.addButtonText}>{tr('Add vehicle')}</Text>
    </TouchableOpacity>
  </View>
);

export default NoVehiclesState;

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  iconWell: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    marginTop: 20,
    gap: 8,
    alignItems: 'center',
  },
  title: {
    fontFamily: Typography.font.regular,
    fontSize: Typography.textsize.medium,
  },
  subtitle: {
    fontFamily: Typography.font.light,
    fontSize: Typography.textsize.small,
    textAlign: 'center',
  },
  addButton: {
    minHeight: 48,
    paddingHorizontal: 8,
    paddingRight: 22,
    get backgroundColor() { return accent.primary; },
    borderRadius: 24,
    marginTop: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  addButtonIconWell: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontFamily: Typography.font.regular,
    fontSize: Typography.textsize.small,
    letterSpacing: 0.2,
  },
});
