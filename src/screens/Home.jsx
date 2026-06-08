import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  Dimensions,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
  Image,
} from 'react-native';

import { useDispatch, useSelector } from 'react-redux';
import { Text } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import { useFocusEffect } from '@react-navigation/native';

// Components & Modals
import ServicesDcumentlist from '../components/ServicesDcumentlist.jsx';
import AddVehicle from '../modals/AddVehicle.jsx';
import AddService from '../modals/AddService.jsx';
import { SkeletonLoader } from '../components/SkeletonLoader';

// Assets (SVGs)
import Car from '../assets/svg/Car.jsx';
import Vehicle from '../assets/svg/Vehicle.jsx';
import AddIcon from '../assets/svg/AddIcon.jsx';
import PollyGon from '../assets/svg/PollyGon.jsx';
import VehicalSmall from '../assets/svg/VehicalSmall.jsx';
import FloatIcon from '../assets/svg/FloatIcon.jsx';

// Styles & Store
import { Typography } from '../styles/typography.js';
import { Colors } from '../styles/colors.js';
import { themecolors } from '../styles/themecolors.js';
import { setVehiclesInformation } from '../store/vehicleSlice.js';
import { fetchVehicleByEmail } from '../store/fetchSlice.js';
import { setSelectedCar } from '../store/userSlice.js';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.35;

/* FIX: Outside component + unconditional layout animations initialization */
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* ───────────────────────────────────────────── */
/* Custom Hooks                                  */
/* ───────────────────────────────────────────── */

const useTheme = () => {
  const { theme } = useSelector(store => store.theme);
  const [cachedTheme, setCachedTheme] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem('theme').then(setCachedTheme);
  }, [theme]);

  const isDark = useMemo(
    () => theme === 'dark' || cachedTheme === 'dark',
    [theme, cachedTheme],
  );

  return { isDark, theme: isDark ? 'dark' : 'light' };
};

/* ───────────────────────────────────────────── */
/* Sub-Components                                */
/* ───────────────────────────────────────────── */

const VehicleCard = React.memo(({ item, isFirst, onPress, themeStyles, hasAnyImage }) => {
  const scale = useRef(new Animated.Value(isFirst ? 1 : 0.97)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: isFirst ? 1 : 0.97,
      useNativeDriver: true,
      tension: 90,
      friction: 10,
    }).start();
  }, [isFirst]);

  const modelLabel =
    item.model?.length > 4 ? item.model.slice(0, 4) + '...' : item.model;

  return (
    <Pressable onPress={onPress} style={styles.cardWrapper}>
      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: themeStyles.cardBg(isFirst),
            transform: [{ scale }],
          },
        ]}
      >
        {!hasAnyImage ? (
          <View style={{
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative',
          }}>
            <VehicalSmall width={60} height={25} color={themeStyles.cardText(isFirst)} />
          </View>
        ) : (
          <View
            style={{
              width: '100%',
              height: 100,
              justifyContent: 'center',
              alignItems: 'center',
              position: 'relative',
            }}
          >
            {item.imageUrl === '' ? (
              <View style={{ position: 'absolute' }}>
                <VehicalSmall width={hasAnyImage ? 90 : 60} height={hasAnyImage ? 90 : 25} color={themeStyles.cardText(isFirst)} />
              </View>
            ) : null}

            {item.imageUrl?.trim() ? (
              <Image
                source={{ uri: item.imageUrl }}
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: 12,
                }}
              />
            ) : null}
          </View>
        )}

        <Text style={[styles.cardText, { color: themeStyles.cardText(isFirst) }]}>
          {item.brand} {modelLabel}
        </Text>
      </Animated.View>

      <View style={styles.polygonWrapper}>
        {isFirst && <PollyGon color="#004EAB" />}
      </View>
    </Pressable>
  );
});

/* ───────────────────────────────────────────── */
/* Main Home Component                           */
/* ───────────────────────────────────────────── */

const Home = () => {
  const { isDark } = useTheme();

  const [addVehicleModal, setAddVehicleModal] = useState(false);
  const [AddServiceModal, setAddServiceModal] = useState(false);
  const [refreshServices, setRefreshServices] = useState(0);

  const [category, setCategory] = useState('services');
  const [loading, setLoading] = useState(true);
  const dispatch = useDispatch();

  const { userEmail } = useSelector((state) => state.user);
  const vehicles = useSelector((state) => state.vehicle.vehiclesInformation || []);

  const [contentHeight, setContentHeight] = useState(0);
  const [layoutHeight, setLayoutHeight] = useState(0);
  const [showFab, setShowFab] = useState(false);

  const loadVehicles = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchVehicleByEmail(userEmail);
      dispatch(setVehiclesInformation(data || []));
    } catch (error) {
      console.log('Vehicle Fetch Error::', error);
    } finally {
      setLoading(false);
    }
  }, [userEmail, dispatch]);

  useFocusEffect(
    useCallback(() => {
      if (!userEmail) return;
      loadVehicles();
    }, [userEmail])
  );

  useEffect(() => {
    if (vehicles?.length > 0) {
      dispatch(setSelectedCar(vehicles[0].id));
    }
  }, [vehicles, dispatch]);

  /* ── Theme Styling ── */
  const themeStyles = useMemo(
    () => ({
      titleColor: isDark ? '#fff' : '#041933',
      emptyColor: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,78,171,0.5)',
      containerBg: isDark ? themecolors.blackBlue : themecolors.white,
      cardBg: isFirst =>
        isFirst ? '#004EAB' : isDark ? 'rgba(9,42,87,1)' : '#fff',
      cardText: isFirst => (isFirst ? '#fff' : '#004EAB'),
    }),
    [isDark],
  );

  const handleAddVehiclePress = useCallback(() => {
    setAddVehicleModal(true);
  }, []);

  const handleSelectVehicle = useCallback((index) => {
    if (index === 0) return;

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    const updated = [...vehicles];
    const [selected] = updated.splice(index, 1);
    updated.unshift(selected);

    dispatch(setVehiclesInformation(updated));
  }, [vehicles, dispatch]);

  const hasAnyImage = useMemo(
    () =>
      vehicles.some(
        v => typeof v.imageUrl === 'string' && v.imageUrl.trim().length > 0
      ),
    [vehicles]
  );

  // Toggle FAB visibility based on list overflowing layout container bounds
  useEffect(() => {
    if (contentHeight > 0 && layoutHeight > 0) {
      setShowFab(contentHeight > layoutHeight);
    }
  }, [contentHeight, layoutHeight]);

  return (
    <View style={styles.screen}>
      <View style={[styles.container, { backgroundColor: themeStyles.containerBg }]}>

        {loading ? (
          <SkeletonLoader />
        ) : vehicles.length === 0 ? (
          <>
            <View style={styles.titleRow}>
              <Car color={themeStyles.titleColor} />
              <Text style={[styles.titleText, { color: themeStyles.titleColor }]}>
                All Vehicles
              </Text>
            </View>

            <View style={styles.centeredContent}>
              <View style={styles.emptyStateContainer}>
                <Vehicle color={themeStyles.emptyColor} />

                <View style={styles.emptyTextContainer}>
                  <Text style={[styles.emptyTitle, { color: themeStyles.emptyColor }]}>
                    No Vehicles Found
                  </Text>
                  <Text style={[styles.emptySubtitle, { color: themeStyles.emptyColor }]}>
                    Add your vehicle to start tracking services.
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={handleAddVehiclePress}
                  style={styles.addButton}
                >
                  <AddIcon color="#fff" />
                  <Text style={styles.addButtonText}>Add Vehicle</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        ) : (
          /* FIX: Changed wrapper to Fragment to guarantee unrestricted flex layout tree propagation */
          <>
            <View style={[styles.titleRow, { justifyContent: 'space-between' }]}>
              <View style={{ flexDirection: 'row', flex: 1, gap: 8, alignItems: 'center' }}>
                <Car color={themeStyles.titleColor} />
                <Text style={[styles.titleText, { color: themeStyles.titleColor }]}>
                  All Vehicles
                </Text>
              </View>

              <TouchableOpacity onPress={() => setAddVehicleModal(true)}>
                <AddIcon color="#004EAB" />
              </TouchableOpacity>
            </View>

            {/* Horizontal Carousel Container Wrapper */}
            <View style={styles.horizontalScrollWrapper}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 2, gap: 12 }}
              >
                {vehicles.map((item, index) => (
                  <VehicleCard
                    key={`${item.brand}-${item.model}-${item.year}-${index}`}
                    item={item}
                    isFirst={index === 0}
                    onPress={() => handleSelectVehicle(index)}
                    themeStyles={themeStyles}
                    hasAnyImage={hasAnyImage}
                  />
                ))}
              </ScrollView>
            </View>

            <View style={styles.tabRow}>
              <TouchableOpacity onPress={() => setCategory('services')}>
                <Text style={[styles.tabText, { opacity: category === 'services' ? 1 : 0.6 }]}>
                  Services
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setCategory('documents')}>
                <Text style={[styles.tabText, { opacity: category === 'documents' ? 1 : 0.6 }]}>
                  Documents
                </Text>
              </TouchableOpacity>
            </View>

            {/* FIX: Set functional vertical layout heights using explicit styles and contentContainer padding */}
            <ScrollView
              style={styles.mainVerticalScroll}
              contentContainerStyle={{ paddingBottom: 190 }}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={(w, h) => setContentHeight(h)}
              onLayout={e => setLayoutHeight(e.nativeEvent.layout.height)}
            >
              <ServicesDcumentlist
                AddServiceModal={AddServiceModal}
                setAddServiceModal={setAddServiceModal}
                refreshTrigger={refreshServices}
                category={category}
              />
            </ScrollView>
          </>
        )}

        {/* ── Floating Action Button ── */}
        {showFab && category === 'services' && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setAddServiceModal(true)}
            style={styles.fab}
          >
            <FloatIcon />
          </TouchableOpacity>
        )}

        {/* ── Modals ── */}
        <AddVehicle
          addVehicleModal={addVehicleModal}
          setAddVehicleModal={setAddVehicleModal}
          onVehicleAdded={loadVehicles}
        />

        <AddService
          AddServiceModal={AddServiceModal}
          setAddServiceModal={setAddServiceModal}
          onServiceAdded={() => setRefreshServices(prev => prev + 1)}
        />
      </View>
    </View>
  );
};

export default Home;

/* ───────────────────────────────────────────── */
/* Styles                                        */
/* ───────────────────────────────────────────── */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  container: {
    flex: 1,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    marginTop: 5,
    padding: 24,
    paddingBottom: 0,
    position: 'relative',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleText: {
    fontSize: 18,
    fontFamily: Typography.font.regular,
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    minHeight: '100%',
  },
  emptyStateContainer: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  emptyTextContainer: {
    marginTop: 20,
    gap: 8,
    alignItems: 'center',
  },
  emptyTitle: {
    fontFamily: Typography.font.regular,
    fontSize: Typography.textsize.medium,
  },
  emptySubtitle: {
    fontFamily: Typography.font.light,
    fontSize: Typography.textsize.small,
  },
  addButton: {
    width: 140,
    height: 40,
    backgroundColor: Colors.primary,
    borderRadius: 16,
    marginTop: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addButtonText: {
    color: '#fff',
    fontFamily: Typography.font.regular,
    fontSize: Typography.textsize.small,
  },
  filledContainer: {
    alignItems: 'flex-start',
    width: '100%',
  },
  cardWrapper: {
    alignItems: 'center',
    marginTop: 16,
  },
  card: {
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    width: CARD_WIDTH,

    gap: 10,
    elevation: 5,
  },
  cardText: {
    fontSize: 16,
    fontFamily: 'RobotoCondensed400',
    fontWeight: '600',
  },
  polygonWrapper: {
    alignSelf: 'flex-start',
    marginTop: -2,
    marginLeft: 10,
  },
  tabRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 24,
    
  },
  tabText: {
    fontFamily: 'RobotoCondensed400',
    fontSize: 16,
    color: '#004EAB',
  },
  horizontalScrollWrapper: {
    height: CARD_WIDTH * 1.15 + 20,
  },
  mainVerticalScroll: {
    flex: 1,
    marginTop: 12,
    minHeight:500
     
    
    
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 78, 171, 1)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    zIndex: 999,
  },
});