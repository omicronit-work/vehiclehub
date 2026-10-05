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
  useWindowDimensions,
  LayoutAnimation,
  Platform,
  UIManager,
  Image,
  Text,
  RefreshControl,
} from 'react-native';

import { useDispatch, useSelector } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';

// Components & Modals
import ServicesDcumentlist from '../components/ServicesDcumentlist.jsx';
import AddVehicle from '../modals/AddVehicle.jsx';
import AddService from '../modals/AddService.jsx';
import VehicleRemindersModal from '../modals/VehicleRemindersModal.jsx';
import { SkeletonLoader } from '../components/SkeletonLoader';
import ErrorState from '../components/ui/ErrorState.jsx';

// Assets (SVGs)
import Vehicle from '../assets/svg/Vehicle.jsx';
import VehicalSmall from '../assets/svg/VehicalSmall.jsx';
import PlusStroke from '../assets/svg/PlusStroke.jsx';

// Styles & Store
import { Typography } from '../styles/typography.js';
import { setVehiclesInformation } from '../store/vehicleSlice.js';
import { fetchVehicleByEmail } from '../store/fetchSlice.js';
import { setSelectedCar } from '../store/userSlice.js';
import { useUpcomingReminders, getVehicleBadgeMap } from '../util/useUpcomingReminders.js';
import { shadowSoft as shadow, MIN_TOUCH } from '../theme/tokens';
import { useTheme } from '../util/methods/useTheme.js';
import { useReduceMotion } from '../util/methods/useReduceMotion';
import { accent } from '../theme/accent';


if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const VEHICLE_CARD_HEIGHT = 74;

const TABS = [
  { key: 'services', label: 'Services' },
  { key: 'documents', label: 'Documents' },
  { key: 'fuel', label: 'Fuel' },
];

// Same four buckets for both tabs, worded to fit what each tab tracks.
// Fuel logs have no due-date bucket, so its only real filter is "All".
const FILTERS = {
  services: [
    { key: 'all', label: 'All' },
    { key: 'overdue', label: 'Overdue' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'done', label: 'Done' },
  ],
  documents: [
    { key: 'all', label: 'All' },
    { key: 'overdue', label: 'Expired' },
    { key: 'upcoming', label: 'Expiring' },
    { key: 'done', label: 'Valid' },
  ],
  fuel: [{ key: 'all', label: 'All' }],
};

/* ───────────────────────────────────────────── */
/* Sub-Components                                */
/* ───────────────────────────────────────────── */

const VehicleCard = React.memo(({ item, selected, onPress, onBadgePress, palette, badge, width }) => {
  const hasImage = typeof item.imageUrl === 'string' && item.imageUrl.trim().length > 0;
  const subtitle = [item.model, item.year].filter(Boolean).join(' · ');
  const a11yLabel = [item.brand, item.model, item.year].filter(Boolean).join(' ')
    + (badge ? `, ${badge.count} due` : '');

  return (
    <Pressable
      onPress={onPress}
      style={styles.cardWrapper}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ selected }}
      accessibilityHint={selected ? undefined : 'Shows this vehicle\'s records'}
      accessibilityActions={badge ? [{ name: 'reminders', label: 'Show due reminders' }] : undefined}
      onAccessibilityAction={e => {
        if (e.nativeEvent.actionName === 'reminders') onBadgePress();
      }}
    >
      <View
        style={[
          styles.vehicleCard,
          { width },
          shadow(selected ? 2 : 1),
          {
            backgroundColor: selected ? palette.selectedBg : palette.cardBg,
            borderColor: selected ? accent.primary : palette.cardBorder,
          },
        ]}
      >
        <View
          style={[
            styles.vehicleTile,
            { backgroundColor: selected ? accent.primary : palette.tileBg },
          ]}
        >
          {hasImage ? (
            <Image source={{ uri: item.imageUrl }} style={styles.vehicleTileImage} />
          ) : (
            <VehicalSmall
              width={34}
              height={17}
              color={selected ? '#fff' : palette.tileIcon}
            />
          )}
        </View>

        <View style={styles.vehicleText}>
          <Text numberOfLines={1} style={[styles.vehicleBrand, { color: palette.text }]}>
            {item.brand}
          </Text>
          {!!subtitle && (
            <Text numberOfLines={1} style={[styles.vehicleModel, { color: palette.muted }]}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>

      {badge && (
        <Pressable
          onPress={onBadgePress}
          hitSlop={{ top: 13, bottom: 13, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={`${badge.count} due for ${item.brand}. Show reminders`}
          style={[styles.dueBadge, { backgroundColor: badge.color }]}
        >
          <Text style={styles.dueBadgeText} maxFontSizeMultiplier={1.3}>{badge.count} due</Text>
        </Pressable>
      )}
    </Pressable>
  );
});

/* ───────────────────────────────────────────── */
/* Main Home Component                           */
/* ───────────────────────────────────────────── */

const Home = () => {
  const isDark = useTheme();
  const reduceMotion = useReduceMotion();

  // Follows rotation / split-screen / foldables, with a floor so text fits.
  const { width: windowWidth } = useWindowDimensions();
  // Two cards fill the row exactly like the two tab chips below (20px page gutter,
// 12px card gap), so vehicle cards and Services/Documents chips share one width.
  const cardWidth = Math.max(150, Math.floor((windowWidth - 40 - 12) / 2));

  const [addVehicleModal, setAddVehicleModal] = useState(false);
  const [AddServiceModal, setAddServiceModal] = useState(false);
  const [AddDocumentModal, setAddDocumentModal] = useState(false);
  const [AddFuelLogModal, setAddFuelLogModal] = useState(false);
  const [refreshServices, setRefreshServices] = useState(0);

  const [category, setCategory] = useState('services');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoaded = useRef(false);
  const dispatch = useDispatch();

  const { userEmail } = useSelector((state) => state.user);
  const vehicles = useSelector((state) => state.vehicle.vehiclesInformation || []);

  const { items: reminders, refetch: refetchReminders } = useUpcomingReminders(userEmail);
  const vehicleBadges = useMemo(() => getVehicleBadgeMap(reminders), [reminders]);
  const [remindersVehicleId, setRemindersVehicleId] = useState(null);
  const remindersVehicle = vehicles.find(v => v.id === remindersVehicleId);

  // Bucket counts for the selected vehicle, reported up by ServicesDcumentlist.
  // The hero tiles and the filter chips both read from this one value, so they
  // can never disagree with the list underneath. Kept across reloads (null
  // reports are ignored) so the hero doesn't flash to 0 on every vehicle switch.
  const [listStats, setListStats] = useState(null);
  const [listLoading, setListLoading] = useState(true);
  const handleStatsChange = useCallback(next => {
    if (next) setListStats(next);
  }, []);

  const scrollRef = useRef(null);
  const selectedIdRef = useRef(null);
  const selectedVehicleId = vehicles[0]?.id;

  // Skeleton only until the first successful load; returning to the tab
  // refreshes silently so the screen and scroll position stay put.
  const loadVehicles = useCallback(async ({ pull = false } = {}) => {
    try {
      if (!hasLoaded.current) setLoading(true);
      if (pull) {
        setRefreshing(true);
        setRefreshServices(prev => prev + 1);
        refetchReminders();
      }
      const data = await fetchVehicleByEmail(userEmail);
      const list = data || [];

      let ordered = list;
      const currentIndex = selectedIdRef.current
        ? list.findIndex(v => v.id === selectedIdRef.current)
        : -1;

      if (currentIndex > 0) {
        ordered = [...list];
        const [selected] = ordered.splice(currentIndex, 1);
        ordered.unshift(selected);
      }

      selectedIdRef.current = ordered[0]?.id ?? null;

      dispatch(setVehiclesInformation(ordered));
      dispatch(setSelectedCar(selectedIdRef.current));
      setLoadError(false);
      hasLoaded.current = true;
    } catch (error) {
      console.log('Vehicle Fetch Error::', error);
      setLoadError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userEmail, dispatch, refetchReminders]);

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={() => loadVehicles({ pull: true })}
      tintColor={isDark ? accent.light : accent.primary}
      colors={[accent.primary]}
    />
  );

  useFocusEffect(
    useCallback(() => {
      if (!userEmail) return;
      // Records may have changed on another tab (e.g. added from Garage);
      // the list refreshes silently since it's the same vehicle.
      if (hasLoaded.current) {
        setRefreshServices(prev => prev + 1);
        refetchReminders();
      }
      loadVehicles();
    }, [userEmail, loadVehicles, refetchReminders])
  );

  // A filter only makes sense for the list it was picked on.
  useEffect(() => {
    setFilter('all');
  }, [category, selectedVehicleId]);

  const palette = useMemo(
    () => ({
      text: isDark ? '#fff' : '#0F1F3D',
      muted: isDark ? 'rgba(255,255,255,0.55)' : '#64748B',
      countBg: isDark ? 'rgba(255,255,255,0.10)' : '#E6EBF3',
      countText: isDark ? 'rgba(255,255,255,0.65)' : '#64748B',
      cardBg: isDark ? '#0A1E3C' : '#fff',
      cardBorder: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,31,61,0.06)',
      selectedBg: isDark ? accent.lightAlpha(0.20) : '#EAF1FF',
      tileBg: isDark ? 'rgba(255,255,255,0.08)' : '#EEF1F6',
      tileIcon: isDark ? 'rgba(255,255,255,0.6)' : '#64748B',
      addPillBg: isDark ? accent.lightAlpha(0.24) : accent.tint,
      addPillText: isDark ? accent.light : accent.primary,
      railBg: isDark ? 'rgba(255,255,255,0.06)' : '#E8EDF5',
      railChipBg: isDark ? '#0A1E3C' : '#fff',
      railActiveText: isDark ? '#fff' : '#0F1F3D',
      railInactiveText: isDark ? 'rgba(255,255,255,0.5)' : '#64748B',
      chipBg: isDark ? '#0A1E3C' : '#fff',
      chipBorder: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,31,61,0.08)',
      chipCount: {
        all: isDark ? accent.light : accent.primary,
        overdue: isDark ? '#FF9C90' : '#DC2626',
        upcoming: isDark ? '#FFD180' : '#D97706',
        done: isDark ? '#9CE6B0' : '#16A34A',
      },
      emptyIconWell: isDark ? 'rgba(255,255,255,0.06)' : accent.lightAlpha(0.08),
      emptyIcon: isDark ? 'rgba(255,255,255,0.5)' : accent.lightAlpha(0.55),
    }),
    [isDark],
  );

  const handleSelectVehicle = useCallback((index) => {
    if (index === 0) return;

    if (!reduceMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    const updated = [...vehicles];
    const [selected] = updated.splice(index, 1);
    updated.unshift(selected);

    selectedIdRef.current = selected.id;
    dispatch(setVehiclesInformation(updated));
    dispatch(setSelectedCar(selected.id));

    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ x: 0, animated: !reduceMotion });
    });
  }, [vehicles, dispatch, reduceMotion]);

  const activeCounts = !listLoading && listStats ? listStats[category] : null;
  const isDocuments = category === 'documents';
  const isFuel = category === 'fuel';

  // The extended FAB is the single "add" entry point once the active list has
  // records; an empty list renders its own inline button instead.
  const showFab =
    !loading &&
    !listLoading &&
    vehicles.length > 0 &&
    (activeCounts?.all ?? 0) > 0;

  const openAddForCategory = useCallback(() => {
    if (category === 'documents') {
      setAddDocumentModal(true);
    } else if (category === 'fuel') {
      setAddFuelLogModal(true);
    } else {
      setAddServiceModal(true);
    }
  }, [category]);

  const addVehiclePill = (
    <TouchableOpacity
      onPress={() => setAddVehicleModal(true)}
      activeOpacity={0.8}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel="Add vehicle"
      style={[styles.addVehiclePill, { backgroundColor: palette.addPillBg }]}
    >
      <PlusStroke color={palette.addPillText} size={17} />
      <Text style={[styles.addVehiclePillText, { color: palette.addPillText }]}>Vehicle</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.screen}>
      <View style={[styles.body, { backgroundColor: isDark ? '#061530' : '#F4F7FB' }]}>
        {loading ? (
          <View style={styles.skeletonWrap}>
            <SkeletonLoader isDark={isDark} />
          </View>
        ) : loadError && vehicles.length === 0 ? (
          // A failed load must not look like "No vehicles yet" — that led
          // users to re-add vehicles they already had.
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            refreshControl={refreshControl}
          >
            <ErrorState
              title="Couldn't load your vehicles"
              onRetry={() => loadVehicles()}
            />
          </ScrollView>
        ) : vehicles.length === 0 ? (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={refreshControl}
          >
            <View style={styles.titleRow}>
              <Text style={[styles.titleText, { color: palette.text }]}>All Vehicles</Text>
            </View>

            <View style={styles.emptyStateContainer}>
              <View style={[styles.emptyIconWell, { backgroundColor: palette.emptyIconWell }]}>
                <Vehicle color={palette.emptyIcon} />
              </View>

              <View style={styles.emptyTextContainer}>
                <Text style={[styles.emptyTitle, { color: palette.text }]}>
                  No vehicles yet
                </Text>
                <Text style={[styles.emptySubtitle, { color: palette.muted }]}>
                  Add your vehicle to start tracking services.
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setAddVehicleModal(true)}
                activeOpacity={0.85}
                accessibilityRole="button"
                style={[styles.addButton, shadow(3, accent.primary)]}
              >
                <View style={styles.addButtonIconWell}>
                  <PlusStroke color="#fff" size={18} />
                </View>
                <Text style={styles.addButtonText}>Add vehicle</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={refreshControl}
          >
            {/* ── Title row ── */}
            <View style={styles.titleRow}>
              <View style={styles.titleGroup}>
                <Text style={[styles.titleText, { color: palette.text }]}>All Vehicles</Text>
                <View style={[styles.countBadge, { backgroundColor: palette.countBg }]}>
                  <Text style={[styles.countBadgeText, { color: palette.countText }]}>
                    {vehicles.length}
                  </Text>
                </View>
              </View>
              {addVehiclePill}
            </View>

            {/* ── Vehicle carousel ── */}
            <ScrollView
              ref={scrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.carousel}
              contentContainerStyle={styles.carouselContent}
            >
              {vehicles.map((item, index) => (
                <VehicleCard
                  key={item.id ?? `${item.brand}-${item.model}-${index}`}
                  item={item}
                  selected={index === 0}
                  onPress={() => handleSelectVehicle(index)}
                  onBadgePress={() => setRemindersVehicleId(item.id)}
                  palette={palette}
                  badge={vehicleBadges[item.id]}
                  width={cardWidth}
                />
              ))}
            </ScrollView>

            {/* ── Segmented tab bar ── */}
            <View
              style={[styles.tabRail, { backgroundColor: palette.railBg }]}
              accessibilityRole="tablist"
            >
              {TABS.map(tab => {
                const active = category === tab.key;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    onPress={() => setCategory(tab.key)}
                    activeOpacity={0.85}
                    accessibilityRole="tab"
                    accessibilityLabel={tab.label}
                    accessibilityState={{ selected: active }}
                    style={[
                      styles.tabChip,
                      active && [{ backgroundColor: palette.railChipBg }, shadow(1)],
                    ]}
                  >
                    <Text
                      style={[
                        styles.tabText,
                        {
                          color: active ? palette.railActiveText : palette.railInactiveText,
                          fontWeight: active ? '700' : '500',
                        },
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ── Filter chips ── */}
           

            <ServicesDcumentlist
              AddServiceModal={AddServiceModal}
              setAddServiceModal={setAddServiceModal}
              refreshTrigger={refreshServices}
              category={category}
              filter={filter}
              AddDocumentModal={AddDocumentModal}
              setAddDocumentModal={setAddDocumentModal}
              AddFuelLogModal={AddFuelLogModal}
              setAddFuelLogModal={setAddFuelLogModal}
              onLoadingChange={setListLoading}
              onStatsChange={handleStatsChange}
              onDataChanged={refetchReminders}
            />
          </ScrollView>
        )}

        {/* ── Floating Action Button ── */}
        {showFab && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={openAddForCategory}
            accessibilityRole="button"
            accessibilityLabel={isFuel ? 'Log fuel' : isDocuments ? 'Add document' : 'Add service'}
            style={[styles.fab, shadow(4, accent.primary)]}
          >
            <PlusStroke color="#fff" size={17} />
            <Text style={styles.fabText}>{isFuel ? 'Fuel' : isDocuments ? 'Document' : 'Service'}</Text>
          </TouchableOpacity>
        )}
      </View>

      <AddVehicle
        addVehicleModal={addVehicleModal}
        setAddVehicleModal={setAddVehicleModal}
        onVehicleAdded={() => loadVehicles()}
      />

      <VehicleRemindersModal
        visible={!!remindersVehicleId}
        onClose={() => setRemindersVehicleId(null)}
        vehicle={remindersVehicle}
        items={vehicleBadges[remindersVehicleId]?.items}
      />

      <AddService
        AddServiceModal={AddServiceModal}
        setAddServiceModal={setAddServiceModal}
        onServiceAdded={() => {
          setRefreshServices(prev => prev + 1);
          refetchReminders();
        }}
      />
    </View>
  );
};

export default Home;

/* ───────────────────────────────────────────── */
/* Styles                                        */
/* ───────────────────────────────────────────── */

const styles = StyleSheet.create({
  // Teal behind the sheet so the rounded top corners sit on the Header colour.
  screen: {
    flex: 1,
    get backgroundColor() { return accent.primary; },
  },
  body: {
    flex: 1,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    marginTop: 5,
    overflow: 'hidden',
  },
  skeletonWrap: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    // The extended FAB (42 tall, 10 from the bottom) must clear the last card.
    paddingBottom: 80,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  titleText: {
    fontSize: 20,
    fontFamily: 'RobotoCondensed500',
    fontWeight: '700',
  },
  countBadge: {
    minWidth: 30,
    minHeight: 26,
    borderRadius: 13,
    paddingHorizontal: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: {
    fontSize: 12,
    fontFamily: 'RobotoCondensed500',
  },
  addVehiclePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: MIN_TOUCH,
    paddingHorizontal: 16,
    borderRadius: 22,
  },
  addVehiclePillText: {
    fontSize: 13,
    fontFamily: 'RobotoCondensed500',
    fontWeight: '700',
  },
  carousel: {
    marginTop: 12, // breathing room under the title row; cardWrapper adds 10 more for the badge
    marginHorizontal: -20, // let the cards scroll edge-to-edge
  },
  carouselContent: {
    paddingHorizontal: 20,
    paddingBottom: 6, // room for the card shadow
    gap: 12,
  },
  cardWrapper: {
    paddingTop: 13, // space for the "N due" badge straddling the card's top edge
  },
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 6,
    borderRadius: 12,
    borderWidth: 2,
    minHeight: VEHICLE_CARD_HEIGHT,
  },
  vehicleTile: {
    width: 58,
    height: 58,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  vehicleTileImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  vehicleText: {
    flex: 1,
    gap: 1,
  },
  vehicleBrand: {
    fontSize: 17,
    fontFamily: 'RobotoCondensed500',
    fontWeight: '700',
  },
  vehicleModel: {
    fontSize: 14,
    fontFamily: 'RobotoCondensed400',
  },
  dueBadge: {
    position: 'absolute',
    top: 0,
    right: 5,
    minHeight: 18,
    paddingHorizontal: 8,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dueBadgeText: {
    color: '#fff',
    fontSize: 12,
    lineHeight: 15,
    fontFamily: 'RobotoCondensed500',
    fontWeight: '700',
    includeFontPadding: false,
  },
  tabRail: {
    flexDirection: 'row',
    marginTop: 14,
    padding: 3,
    borderRadius: 14,
    gap: 3,
  },
  tabChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: MIN_TOUCH,
    borderRadius: 11,
  },
  tabText: {
    fontSize: 13,
    fontFamily: 'RobotoCondensed500',
  },
  chipScroll: {
    marginTop: 14,
    marginHorizontal: -20,
    flexGrow: 0,
  },
  chipRow: {
    paddingHorizontal: 20,
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: MIN_TOUCH,
    paddingHorizontal: 20,
    borderRadius: 22,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontFamily: 'RobotoCondensed500',
    fontWeight: '700',
  },
  emptyStateContainer: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  emptyIconWell: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
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
  fab: {
    position: 'absolute',
    bottom: 10,
    right: 20,
    minHeight: MIN_TOUCH,
    paddingHorizontal: 16,
    borderRadius: 22,
    get backgroundColor() { return accent.primary; },
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    zIndex: 999,
  },
  fabText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'RobotoCondensed500',
    fontWeight: '700',
  },
});
