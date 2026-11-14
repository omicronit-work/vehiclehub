import React, { useEffect, useRef, useMemo } from 'react';
import { useReduceMotion } from '../util/methods/useReduceMotion';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  Image,
  PanResponder,
  Animated,
  Alert,
} from 'react-native';
import Text from './ui/AppText';
import { useSelector } from 'react-redux';
import { themecolors } from '../styles/themecolors.js';
import VehicleColored from '../assets/svg/VehicleColored.jsx';
import EditIcon from '../assets/svg/EditIcon.jsx';
import DustBin from '../assets/svg/DustBin.jsx';
import { hitSlop } from '../theme/tokens';
import { statusTones } from '../theme/statusTones';
import StatusChip from './StatusChip';
import SkeletonBlock from './ui/SkeletonBlock.jsx';
import { formatKm } from '../util/distance';
import { useDistanceUnit } from '../util/schedule/scheduleSettings';
import { t as tr } from '../i18n';
import { brandName, vehicleName } from '../i18n/brands';

const DELETE_WIDTH = 44;
const EDIT_ICON_SIZE = 15;

const VehicleCard = ({
  item,
  swipedItemId,
  setSwipedItemId,
  onEdit,
  onDelete,
  setImageUrl,
  onCardPress,
  // Overdue / due-soon items, most urgent first (util/vehicleAttention.js):
  // [{ key, title, label, tone }]. The most urgent shows as Home's chip.
  attention = [],
  // True while this vehicle's records are still loading: shimmer in the chip's place.
  attentionLoading = false,
}) => {
  const { theme } = useSelector(state => state.theme);
  const isDark = theme === 'dark';

  // ─── Theme-aware palette ───────────────────────────────────────────────
  const c = useMemo(
    () => ({
      surface: isDark ? themecolors.darkBlue : '#FFFFFF',
      brand: isDark ? themecolors.white : '#041933',
      model: isDark ? 'rgba(200,220,255,0.7)' : '#041933',
      placeholderBorder: isDark ? 'rgba(255,255,255,0.12)' : '#EEF1F5',
      border: isDark ? 1 : 0,
      color: isDark ? 'rgba(255, 255, 255, 0.16)': null,
      // Destructive action stays the same red in both themes.
      delete: '#C13D0C',
    }),
    [isDark],
  );

  const isSwipedLeft = swipedItemId === item.id;
  const deleteWidth = useRef(new Animated.Value(0)).current;

  const reduceMotion = useReduceMotion();
  const distUnit = useDistanceUnit();

  useEffect(() => {
    Animated.timing(deleteWidth, {
      toValue: isSwipedLeft ? DELETE_WIDTH : 0,
      duration: reduceMotion ? 0 : 250,
      useNativeDriver: false,
    }).start();
  }, [isSwipedLeft, deleteWidth, reduceMotion]);

  const name = vehicleName(item, { year: true });
  const odometer = Number(item.currentOdometer) > 0 ? formatKm(item.currentOdometer, distUnit) : '';
  const tones = useMemo(() => statusTones(isDark), [isDark]);
  const top = attention[0];
  const more = attention.length - 1;
  const attentionText = attention.map(a => `${a.title}: ${a.label}`).join('; ');

  const startEdit = () => {
    setSwipedItemId(null);
    setImageUrl(item.imageUrl);
    onEdit(item);
  };

  // Swipe-to-delete is hard to discover, so long-press offers the same
  // actions (and screen readers get them as custom actions below).
  const openActions = () => {
    Alert.alert(name || tr('home.vehicle'), undefined, [
      { text: tr('common.edit'), onPress: startEdit },
      { text: tr('dlg.delete'), style: 'destructive', onPress: () => onDelete(item) },
      { text: tr('common.cancel'), style: 'cancel' },
    ]);
  };

  const settle = (_, gestureState) => {
    if (gestureState.dx < -80) {
      setSwipedItemId(item.id);
    } else {
      setSwipedItemId(null);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,

      onMoveShouldSetPanResponder: (_, gestureState) => {
        return (
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) &&
          Math.abs(gestureState.dx) > 10
        );
      },

      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        return (
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) &&
          Math.abs(gestureState.dx) > 10
        );
      },

      onPanResponderRelease: (...args) => settle(...args),
      // A parent (e.g. the list scrolling) took the gesture over: settle the
      // card instead of leaving it half-open.
      onPanResponderTerminate: (...args) => settle(...args),
    })
  ).current;

  return (
    // Shadow on the outer view, swipe handlers on the inner one: on Android
    // (Fabric) a view with both boxShadow and responder handlers swallows
    // taps, so the card, edit and long-press never fire.
    <View style={[styles.cardShadow, { backgroundColor: c.surface }]}>
    <View style={[styles.card, { backgroundColor: c.surface, borderWidth: c.border, borderColor:c.color }]} {...panResponder.panHandlers}>
      <TouchableOpacity
        style={styles.cardContent}
        activeOpacity={0.9}
        onPress={() => onCardPress(item)}
        onLongPress={openActions}
        delayLongPress={350}
        accessibilityRole="button"
        accessibilityLabel={[name, odometer, attentionText].filter(Boolean).join(', ')}
        accessibilityHint={tr('Opens vehicle details. Long press for edit and delete.')}
        accessibilityActions={[
          { name: 'edit', label: tr('veh.edit') },
          { name: 'delete', label: tr('veh.delete') },
        ]}
        onAccessibilityAction={e => {
          if (e.nativeEvent.actionName === 'edit') startEdit();
          if (e.nativeEvent.actionName === 'delete') onDelete(item);
        }}
      >
        {item.imageUrl ? (
          <Image
            style={styles.image}
            source={{ uri: item.imageUrl }}
          />
        ) : (
          <View style={[styles.imagePlaceholder, { borderColor: c.placeholderBorder }]}>
            <VehicleColored />
          </View>
        )}

        <View style={styles.infoWrapper}>
          <View style={styles.infoText}>
            <Text style={[styles.brandText, { color: c.brand }]}>{brandName(item.brand)}</Text>
            <Text style={[styles.modelText, { color: c.model }]}>
              {[item.model, item.year].filter(Boolean).join(' ')}
              {odometer ? ` · ${odometer}` : ''}
            </Text>
            {attentionLoading && !top && (
              <View style={styles.statusRow}>
                <SkeletonBlock width={150} height={24} borderRadius={10} style={styles.statusChip} />
              </View>
            )}
            {top && (
              <View style={styles.statusRow}>
                <StatusChip
                  // Status first: a long document name then truncates, not the days left.
                  label={`${top.label} · ${top.title}`}
                  colors={tones[top.tone]}
                  maxWidth="100%"
                  style={styles.statusChip}
                />
                {more > 0 && (
                  <Text style={[styles.moreText, { color: tones[top.tone].text }]} maxFontSizeMultiplier={1.3}>
                    +{more}
                  </Text>
                )}
              </View>
            )}
          </View>

          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              startEdit();
            }}
            hitSlop={hitSlop(EDIT_ICON_SIZE)}
            accessibilityRole="button"
            accessibilityLabel={tr('Edit {0}', { 0: name })}
          >
            <EditIcon />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      <Animated.View style={[styles.deleteButton, { width: deleteWidth, backgroundColor: c.delete }]}>
        <TouchableOpacity
          style={styles.deleteButtonInner}
          onPress={() => onDelete(item)}
          accessibilityRole="button"
          accessibilityLabel={tr('Delete {0}', { 0: name })}
          accessibilityElementsHidden={!isSwipedLeft}
          importantForAccessibility={isSwipedLeft ? 'auto' : 'no-hide-descendants'}
        >
          <DustBin />
        </TouchableOpacity>
      </Animated.View>
    </View>
    </View>
  );
};

export default React.memo(VehicleCard);

const styles = StyleSheet.create({
  cardShadow: {
    borderRadius: 12,
    boxShadow: '0px 0px 8px rgba(10, 42, 85, 0.12)',
    marginTop: 2,
    marginHorizontal: 2,
  },
  card: {
    minHeight: 86,
    borderRadius: 12,
    flexDirection: 'row',
    overflow: 'hidden',
    position: 'relative',
  },
  cardContent: {
    flex: 1,
    padding: 12,
    flexDirection: 'row',
    gap: 12,
  },
  image: {
    width: 80,
    height: 62,
    borderRadius: 12,
  },
  imagePlaceholder: {
    width: 80,
    height: 62,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoWrapper: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  brandText: {
    fontFamily: 'RobotoCondensed500',
    fontWeight: '700', // same weight as Home's vehicle cards
    fontSize: 18,
  },
  modelText: {
    fontFamily: 'RobotoCondensed300',
    fontSize: 13,
  },
  deleteButton: {
    overflow: 'hidden',
  },
  deleteButtonInner: {
    flex: 1,
    width: DELETE_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoText: { flex: 1, gap: 2, paddingRight: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  statusChip: { flexShrink: 1 },
  moreText: { fontSize: 12, fontFamily: 'RobotoCondensed500', fontWeight: '700' },
});