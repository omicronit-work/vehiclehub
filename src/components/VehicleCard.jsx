import React, { useEffect, useRef, useMemo } from 'react';
import { useReduceMotion } from '../util/methods/useReduceMotion';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  PanResponder,
  Animated,
  Alert,
} from 'react-native';
import { useSelector } from 'react-redux';
import { themecolors } from '../styles/themecolors.js';
import VehicleColored from '../assets/svg/VehicleColored.jsx';
import EditIcon from '../assets/svg/EditIcon.jsx';
import DustBin from '../assets/svg/DustBin.jsx';
import { hitSlop } from '../theme/tokens';

const DELETE_WIDTH = 72;
const EDIT_ICON_SIZE = 15;

const VehicleCard = ({
  item,
  swipedItemId,
  setSwipedItemId,
  onEdit,
  onDelete,
  setImageUrl,
  onCardPress,
  reminderBadge,
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

  useEffect(() => {
    Animated.timing(deleteWidth, {
      toValue: isSwipedLeft ? DELETE_WIDTH : 0,
      duration: reduceMotion ? 0 : 250,
      useNativeDriver: false,
    }).start();
  }, [isSwipedLeft, deleteWidth, reduceMotion]);

  const name = [item.brand, item.model, item.year].filter(Boolean).join(' ');

  const startEdit = () => {
    setSwipedItemId(null);
    setImageUrl(item.imageUrl);
    onEdit(item);
  };

  // Swipe-to-delete is hard to discover, so long-press offers the same
  // actions (and screen readers get them as custom actions below).
  const openActions = () => {
    Alert.alert(name || 'Vehicle', undefined, [
      { text: 'Edit', onPress: startEdit },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(item) },
      { text: 'Cancel', style: 'cancel' },
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
    <View style={[styles.card, { backgroundColor: c.surface, borderWidth: c.border, borderColor:c.color }]} {...panResponder.panHandlers}>
      {reminderBadge && (
        <View style={[styles.reminderBadge, { backgroundColor: reminderBadge.color, borderColor: c.surface }]} />
      )}

      <TouchableOpacity
        style={styles.cardContent}
        activeOpacity={0.9}
        onPress={() => onCardPress(item)}
        onLongPress={openActions}
        delayLongPress={350}
        accessibilityRole="button"
        accessibilityLabel={`${name}${reminderBadge ? ', has reminders due' : ''}`}
        accessibilityHint="Opens vehicle details. Long press for edit and delete."
        accessibilityActions={[
          { name: 'edit', label: 'Edit vehicle' },
          { name: 'delete', label: 'Delete vehicle' },
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
          <View>
            <Text style={[styles.brandText, { color: c.brand }]}>{item.brand}</Text>
            <Text style={[styles.modelText, { color: c.model }]}>{item.model} {item.year}</Text>
          </View>

          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              startEdit();
            }}
            hitSlop={hitSlop(EDIT_ICON_SIZE)}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${name}`}
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
          accessibilityLabel={`Delete ${name}`}
          accessibilityElementsHidden={!isSwipedLeft}
          importantForAccessibility={isSwipedLeft ? 'auto' : 'no-hide-descendants'}
        >
          <DustBin />
          <Text style={styles.deleteText} numberOfLines={1}>Delete</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

export default React.memo(VehicleCard);

const styles = StyleSheet.create({
  card: {
    minHeight: 86,
    borderRadius: 12,
    elevation: 4,
    marginTop: 2,
    marginHorizontal: 2,
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
    fontFamily: 'RobotoCondensed400',
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
    gap: 4,
  },
  deleteText: {
    color: '#fff',
    fontFamily: 'RobotoCondensed500',
    fontSize: 12,
  },
  reminderBadge: {
    // Top-left, not top-right — the edit icon already sits in the top-right
    // corner of the card content.
    position: 'absolute',
    top: 8,
    left: 8,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 1.5,
    zIndex: 5,
  },
});