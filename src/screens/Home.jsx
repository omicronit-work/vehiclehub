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
  Image,
  RefreshControl,
} from 'react-native';
import Text from '../components/ui/AppText';
import AdBanner from '../components/AdBanner';

import { useDispatch, useSelector } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

// Components & Modals
import ServicesDcumentlist from '../components/ServicesDcumentlist.jsx';
import HomeScheduleSummary from '../components/schedule/HomeScheduleSummary.jsx';
import ScheduleHost from '../components/schedule/ScheduleHost.jsx';
import { themecolors } from '../styles/themecolors.js';
import AddVehicle from '../modals/AddVehicle.jsx';
import AddService from '../modals/AddService.jsx';
import QuickAddMenu from '../components/QuickAddMenu.jsx';
import ScheduleFormModal from '../modals/ScheduleFormModal.jsx';
import { SkeletonLoader } from '../components/SkeletonLoader';
import ErrorState from '../components/ui/ErrorState.jsx';

// Assets (SVGs)
import Vehicle from '../assets/svg/Vehicle.jsx';
import VehicalSmall from '../assets/svg/VehicalSmall.jsx';
import PlusStroke from '../assets/svg/PlusStroke.jsx';

// Styles & Store
import { Typography } from '../styles/typography.js';
import { setVehiclesInformation } from '../store/vehicleSlice.js';
import { fetchCachedVehiclesByEmail, fetchVehicleByEmail } from '../store/fetchSlice.js';
import { useVisitSkeleton } from '../util/methods/useVisitSkeleton';
import { setSelectedCar } from '../store/userSlice.js';
import { useUpcomingReminders } from '../util/useUpcomingReminders.js';
import { shadowSoft as shadow, MIN_TOUCH } from '../theme/tokens';
import { useTheme } from '../util/methods/useTheme.js';
import { useReduceMotion } from '../util/methods/useReduceMotion';
import { accent } from '../theme/accent';
import { t as tr } from '../i18n';
import { brandName, vehicleName } from '../i18n/brands';

const VEHICLE_CARD_HEIGHT = 74;
// Remembered between launches: the last selected vehicle and Home tab.
const LAST_VEHICLE_KEY = 'home:lastVehicleId';
const LAST_TAB_KEY = 'home:lastTab';

const TABS = [
  { key: 'services', get label() { return tr('cat.services'); } },
  { key: 'documents', get label() { return tr('cat.documents'); } },
  { key: 'fuel', get label() { return tr('cat.fuel'); } },
];

// Same four buckets for both tabs, worded to fit what each tab tracks.
// Fuel logs have no due-date bucket, so its only real filter is "All".
const FILTERS = {
  services: [
    { key: 'all', get label() { return tr('filter.all'); } },
    { key: 'overdue', get label() { return tr('filter.overdue'); } },
    { key: 'upcoming', get label() { return tr('filter.upcoming'); } },
    { key: 'done', get label() { return tr('filter.done'); } },
  ],
  documents: [
    { key: 'all', get label() { return tr('filter.all'); } },
    { key: 'overdue', get label() { return tr('filter.expired'); } },
    { key: 'upcoming', get label() { return tr('filter.expiring'); } },
    { key: 'done', get label() { return tr('filter.valid'); } },
  ],
  fuel: [{ key: 'all', get label() { return tr('filter.all'); } }],
};

/* ───────────────────────────────────────────── */
/* Sub-Components                                */
/* ───────────────────────────────────────────── */

const VehicleCard = React.memo(({ item, selected, onPress, palette, width }) => {
  const hasImage = typeof item.imageUrl === 'string' && item.imageUrl.trim().length > 0;
  const subtitle = [item.model, item.year].filter(Boolean).join(' · ');
  const a11yLabel = vehicleName(item, { year: true });

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ selected }}
      accessibilityHint={selected ? undefined : tr('Shows this vehicle\'s records')}
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
            {brandName(item.brand)}
          </Text>
          {!!subtitle && (
            <Text numberOfLines={2} style={[styles.vehicleModel, { color: palette.muted }]}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>
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
  // "+" menu, and the Add service (completed work) form it opens.
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [addRecordModal, setAddRecordModal] = useState(false);
  const [refreshServices, setRefreshServices] = useState(0);
  const [serviceSaved, setServiceSaved] = useState(0);
  // Bumped when a schedule is saved from the "+ Service" button, so the
  // schedule summary / Upcoming list reloads without refetching the history.
  const [scheduleSaved, setScheduleSaved] = useState(0);
  // Reloading after a vehicle was added: shows the skeleton instead of the
  // "No vehicles yet" empty state while the new vehicle is fetched.
  const [reloadingAfterSave, setReloadingAfterSave] = useState(false);

  const [category, setCategoryState] = useState('services');
  const setCategory = useCallback(next => {
    setCategoryState(next);
    AsyncStorage.setItem(LAST_TAB_KEY, next).catch(() => {});
  }, []);
  useEffect(() => {
    AsyncStorage.getItem(LAST_TAB_KEY)
      .then(saved => {
        if (saved && TABS.some(t => t.key === saved)) setCategoryState(saved);
      })
      .catch(() => {});
  }, []);
  const [filter, setFilter] = useState('all');
  // The tab is rebuilt on every visit. Vehicles already in the store (from
  // an earlier visit) show at once behind the short visit skeleton; the
  // full skeleton only waits on the network when nothing is known yet.
  const hasStoreVehicles = useSelector(state => !!state.vehicle.vehiclesInformation?.length);
  const [loading, setLoading] = useState(() => !hasStoreVehicles);
  const visitSkeleton = useVisitSkeleton();
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoaded = useRef(hasStoreVehicles);
  const dispatch = useDispatch();

  const { userEmail, selectedCar } = useSelector((state) => state.user);
  const vehicles = useSelector((state) => state.vehicle.vehiclesInformation || []);

  const { refetch: refetchReminders } = useUpcomingReminders(userEmail);

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
  const pendingScrollIdRef = useRef(null);
  // Selection is tracked by id; the carousel keeps its order so the cards
  // don't jump around under the user's finger.
  const selectedVehicleId = vehicles.some(v => v.id === selectedCar)
    ? selectedCar
    : vehicles[0]?.id;

  // Centre a card in the carousel (content padding 20, gap 12 — see styles).
  const scrollToVehicle = useCallback((index, animated = !reduceMotion) => {
    if (index < 0) return;
    const left = 20 + index * (cardWidth + 12);
    const x = Math.max(0, left - (windowWidth - cardWidth) / 2);
    scrollRef.current?.scrollTo({ x, animated });
  }, [cardWidth, windowWidth, reduceMotion]);

  // The carousel doesn't exist during the skeleton, so the selection effect
  // below can't scroll it. Open on the selected card once it has laid out.
  const carouselPositioned = useRef(false);
  const handleCarouselSized = () => {
    if (carouselPositioned.current) return;
    carouselPositioned.current = true;
    scrollToVehicle(vehicles.findIndex(v => v.id === selectedVehicleId), false);
  };

  // One selected vehicle app-wide: a car picked elsewhere (Garage, Dashboard)
  // becomes Home's selection too, instead of Home switching everything back
  // to its own last pick when it gains focus.
  useEffect(() => {
    if (!selectedCar || selectedCar === selectedIdRef.current) return;
    const index = vehicles.findIndex(v => v.id === selectedCar);
    if (index < 0) return;
    selectedIdRef.current = selectedCar;
    AsyncStorage.setItem(LAST_VEHICLE_KEY, selectedCar).catch(() => {});
    scrollToVehicle(index);
  }, [selectedCar, vehicles, scrollToVehicle]);

  // Skeleton only until the first successful load; returning to the tab
  // refreshes silently so the screen and scroll position stay put.
  const loadVehicles = useCallback(async ({ pull = false, afterSave = false } = {}) => {
    try {
      if (!hasLoaded.current) setLoading(true);
      if (afterSave) setReloadingAfterSave(true);
      if (pull) {
        setRefreshing(true);
        setRefreshServices(prev => prev + 1);
        refetchReminders();
      }
      const apply = async list => {
        // First load: reopen on the vehicle the user had selected last time.
        if (!selectedIdRef.current) {
          selectedIdRef.current = await AsyncStorage.getItem(LAST_VEHICLE_KEY).catch(() => null);
        }
        // Keep the current selection if that vehicle still exists.
        const keep = list.some(v => v.id === selectedIdRef.current);
        selectedIdRef.current = keep ? selectedIdRef.current : list[0]?.id ?? null;
        dispatch(setVehiclesInformation(list));
        dispatch(setSelectedCar(selectedIdRef.current));
      };

      // Cold start: show the garage as last synced to this phone straight
      // away, then replace it with the server's answer below.
      if (!hasLoaded.current) {
        const cached = await fetchCachedVehiclesByEmail(userEmail);
        if (cached && !hasLoaded.current) {
          await apply(cached);
          hasLoaded.current = true;
          setLoading(false);
        }
      }

      const data = await fetchVehicleByEmail(userEmail);
      await apply(data || []);
      setLoadError(false);
      hasLoaded.current = true;
    } catch (error) {
      console.log('Vehicle Fetch Error::', error);
      setLoadError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setReloadingAfterSave(false);
    }
  }, [userEmail, dispatch, refetchReminders]);

  // Select the vehicle that was just added so its (empty) records show.
  const handleVehicleAdded = useCallback(async (newId) => {
    if (newId) {
      selectedIdRef.current = newId;
      AsyncStorage.setItem(LAST_VEHICLE_KEY, newId).catch(() => {});
      pendingScrollIdRef.current = newId;
    }
    await loadVehicles({ afterSave: true });
  }, [loadVehicles]);

  // Bring a just-added vehicle into view once the reloaded list has rendered.
  useEffect(() => {
    const id = pendingScrollIdRef.current;
    if (!id) return;
    const index = vehicles.findIndex(v => v.id === id);
    if (index === -1) return;
    pendingScrollIdRef.current = null;
    requestAnimationFrame(() => scrollToVehicle(index));
  }, [vehicles, scrollToVehicle]);

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing || reloadingAfterSave}
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
      railChipBg: isDark ? 'rgba(255,255,255,0.14)' : '#fff',
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
    const selected = vehicles[index];
    if (!selected || selected.id === selectedVehicleId) return;

    selectedIdRef.current = selected.id;
    dispatch(setSelectedCar(selected.id));
    AsyncStorage.setItem(LAST_VEHICLE_KEY, selected.id).catch(() => {});
    scrollToVehicle(index);
  }, [vehicles, selectedVehicleId, dispatch, scrollToVehicle]);

  const activeCounts = !listLoading && listStats ? listStats[category] : null;

  // The extended FAB is the single "add" entry point once the active list has
  // records; an empty list renders its own inline button instead.
  // One "+" for every everyday action, whenever there's a vehicle to add to.
  const showFab = !loading && !visitSkeleton && vehicles.length > 0;

  const handleQuickAdd = useCallback(key => {
    if (key === 'fuel') {
      setCategory('fuel');
      setAddFuelLogModal(true);
    } else if (key === 'document') {
      setCategory('documents');
      setAddDocumentModal(true);
    } else if (key === 'service') {
      setCategory('services');
      setAddRecordModal(true);
    } else if (key === 'schedule') {
      setCategory('services');
      setAddServiceModal(true);
    }
  }, [setCategory]);


  const addVehiclePill = (
    <TouchableOpacity
      onPress={() => setAddVehicleModal(true)}
      activeOpacity={0.8}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={tr('home.addVehicle')}
      style={[styles.addVehiclePill, { backgroundColor: palette.addPillBg }]}
    >
      <PlusStroke color={palette.addPillText} size={17} />
      <Text style={[styles.addVehiclePillText, { color: palette.addPillText }]}>{tr('home.vehicle')}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.screen}>
      <View style={[styles.body, { backgroundColor: isDark ? '#061530' : '#F4F7FB' }]}>
        {/* A schedule tapped on Home opens its page here, in place of the list. */}
        <ScheduleHost
          pageStyle={[styles.schedulePage, { backgroundColor: isDark ? themecolors.darkBlue : '#FFFFFF' }]}
        >
        {loading || visitSkeleton || (reloadingAfterSave && vehicles.length === 0) ? (
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
              title={tr('home.loadError')}
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
              <Text style={[styles.titleText, { color: palette.text }]}>{tr('home.allVehicles')}</Text>
            </View>
            <AdBanner backgroundColor="transparent" style={styles.adSlot} />

            <View style={styles.emptyStateContainer}>
              <View style={[styles.emptyIconWell, { backgroundColor: palette.emptyIconWell }]}>
                <Vehicle color={palette.emptyIcon} />
              </View>

              <View style={styles.emptyTextContainer}>
                <Text style={[styles.emptyTitle, { color: palette.text }]}>
                  {tr('home.noVehicles')}
                </Text>
                <Text style={[styles.emptySubtitle, { color: palette.muted }]}>
                  {tr('home.noVehiclesHint')}
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
                <Text style={styles.addButtonText}>{tr('Add vehicle')}</Text>
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
                <Text style={[styles.titleText, { color: palette.text }]}>{tr('home.allVehicles')}</Text>
                <View style={[styles.countBadge, { backgroundColor: palette.countBg }]}>
                  <Text style={[styles.countBadgeText, { color: palette.countText }]}>
                    {vehicles.length}
                  </Text>
                </View>
              </View>
              {addVehiclePill}
            </View>
            <AdBanner backgroundColor="transparent" style={styles.adSlot} />

            {/* ── Vehicle carousel ── */}
            <ScrollView
              ref={scrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.carousel}
              contentContainerStyle={styles.carouselContent}
              onContentSizeChange={handleCarouselSized}
            >
              {vehicles.map((item, index) => (
                <VehicleCard
                  key={item.id ?? `${item.brand}-${item.model}-${index}`}
                  item={item}
                  selected={item.id === selectedVehicleId}
                  onPress={() => handleSelectVehicle(index)}
                  palette={palette}
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
           

            {/* Kept mounted on the other tabs (just hidden) so coming back to
                Services shows the loaded schedule at once instead of
                refetching it while the cached history list is already up. */}
            <View style={category === 'services' ? null : styles.hidden}>
              <HomeScheduleSummary
                vehicleId={selectedVehicleId}
                reloadKey={`${serviceSaved}-${refreshServices}-${scheduleSaved}`}
                historyCount={activeCounts?.all ?? null}
              />
            </View>

            <ServicesDcumentlist
              AddServiceModal={AddServiceModal}
              setAddServiceModal={setAddServiceModal}
              refreshTrigger={refreshServices}
              savedTrigger={serviceSaved}
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
        {/* Always visible: the single "add" entry point on Home. */}
        {showFab && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setQuickAddOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={tr('home.addHint')}
            style={[styles.fab, shadow(4, accent.primary)]}
          >
            <PlusStroke color="#fff" size={17} />
            <Text style={styles.fabText}>{tr('home.add')}</Text>
          </TouchableOpacity>
        )}
        </ScheduleHost>
      </View>

      <QuickAddMenu
        visible={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onSelect={handleQuickAdd}
        isDark={isDark}
      />

      <AddService
        AddServiceModal={addRecordModal}
        setAddServiceModal={setAddRecordModal}
        onServiceAdded={() => {
          setServiceSaved(prev => prev + 1);
          refetchReminders();
        }}
      />

      <AddVehicle
        addVehicleModal={addVehicleModal}
        setAddVehicleModal={setAddVehicleModal}
        onVehicleAdded={handleVehicleAdded}
      />

      {/* "+ Service" (and the empty list's add button) opens the Add Schedule form. */}
      <ScheduleFormModal
        visible={AddServiceModal}
        vehicleId={selectedVehicleId}
        onClose={() => setAddServiceModal(false)}
        onSaved={() => {
          setScheduleSaved(prev => prev + 1);
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
  hidden: { display: 'none' },
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
  // Same insets and white panel as the Vehicle tab, which hosts these pages too.
  schedulePage: {
    paddingHorizontal: 20,
    paddingTop: 18,
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
  // Ad under the "All Vehicles" title; takes no space until an ad loads.
  adSlot: { paddingHorizontal: 0, paddingTop: 12, paddingBottom: 0 },
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
    marginBottom: -8, // the content's bottom padding is shadow room, not spacing
    marginHorizontal: -20, // let the cards scroll edge-to-edge
  },
  carouselContent: {
    paddingHorizontal: 20,
    paddingVertical: 12, // room for the card shadow
    gap: 12,
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
