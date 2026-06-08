import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  PanResponder,
  Animated,
} from 'react-native';
import VehicleColored from '../assets/svg/VehicleColored.jsx';
import EditIcon from '../assets/svg/EditIcon.jsx';
import DustBin from '../assets/svg/DustBin.jsx';

const VehicleCard = ({ 
  item, 
  swipedItemId, 
  setSwipedItemId, 
  onEdit, 
  onDelete, 
  setImageUrl, 
  onCardPress 
}) => {
  const isSwipedLeft = swipedItemId === item.id;
  const deleteWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(deleteWidth, {
      toValue: isSwipedLeft ? 24 : 0, // Increased to 75 so the delete button and icon are fully visible
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [isSwipedLeft]);

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

      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -80) {
          setSwipedItemId(item.id);
        } else {
          setSwipedItemId(null);
        }
      },
    })
  ).current;

  return (
    <View style={styles.card} {...panResponder.panHandlers}>
      <TouchableOpacity
        style={styles.cardContent}
        activeOpacity={0.9}
        onPress={() => onCardPress(item)}
      >
        {item.imageUrl ? (
          <Image
            style={styles.image}
            source={{ uri: item.imageUrl }}
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <VehicleColored />
          </View>
        )}

        <View style={styles.infoWrapper}>
          <View>
            <Text style={styles.brandText}>{item.brand}</Text>
            <Text style={styles.modelText}>{item.model} {item.year}</Text>
          </View>

          <TouchableOpacity onPress={(e) => {
            e.stopPropagation();
            setSwipedItemId(null);
            setImageUrl(item.imageUrl);
            onEdit(item);
          }}>
            <EditIcon />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      <Animated.View style={[styles.deleteButton, { width: deleteWidth }]}>
        <TouchableOpacity 
          style={styles.deleteButtonInner} 
          onPress={() => onDelete(item)}
        >
          <DustBin />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

export default React.memo(VehicleCard);

const styles = StyleSheet.create({
  card: {
    minHeight: 86,
    backgroundColor: '#FFFFFF',
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
    borderColor: '#EEF1F5',
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
    color: '#041933',
  },
  modelText: {
    fontFamily: 'RobotoCondensed300',
    fontSize: 13,
  },
  deleteButton: {
    backgroundColor: '#C13D0C',
    overflow: 'hidden',
  },
  deleteButtonInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});