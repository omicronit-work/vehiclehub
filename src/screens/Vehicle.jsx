import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
  BackHandler,
  RefreshControl,
} from 'react-native';
import AdBanner from '../components/AdBanner';
import { Typography } from '../styles/typography.js';
import { useDispatch, useSelector } from 'react-redux';
import { fetchCachedVehiclesByEmail, fetchVehicleByEmail } from '../store/fetchSlice.js';
import { deleteUserVehicle, bumpRecordsVersion, setTrigger, setSelectedCar as setSelectedCarRd } from '../store/userSlice.js';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { themecolors } from '../styles/themecolors.js';

// Components & Assets
import VehicleCard from '../components/VehicleCard.jsx';
import Car from '../assets/svg/Car.jsx';
import PlusStroke from '../assets/svg/PlusStroke.jsx';
import SkeletonVehicleCard from '../skeleton/SkeletonVehicleCard.jsx';
import VehicalUpdate from '../modals/VehicleUpdate.jsx';
import AddVehicle from '../modals/AddVehicle.jsx';
import VehicleInformations from '../components/VehicleInformations.jsx';
import VehicleInfo from '../assets/svg/VehicleInfo.jsx';
import ConfirmDeleteModal from '../modals/ConfirmDeleteModal.jsx';
import ErrorState from '../components/ui/ErrorState.jsx';
import ScheduleHost from '../components/schedule/ScheduleHost.jsx';
import Arrow from '../assets/svg/Arrow.jsx';
import { shadow, MIN_TOUCH, brand } from '../theme/tokens';
import { accent } from '../theme/accent';
import { loadGarageRecords } from '../util/schedule/scheduleStore';
import { vehicleAttention } from '../util/vehicleAttention';
import { useDistanceUnit } from '../util/schedule/scheduleSettings';
import { consumeScheduleReturn, consumeVehicleOpen } from '../util/schedule/scheduleNav';
import { useVisitSkeleton } from '../util/methods/useVisitSkeleton';

// Premium Shadow Profile System

const Vehicle = () => {
  const { userEmail, Trigger, selectedCar: selectedCarId } = useSelector(state => state.user);
  const { theme } = useSelector(state => state.theme);
  const isDark = theme === 'dark';

  // Home has usually loaded the same list already: show it at once and
  // refresh in the background instead of a skeleton while the server answers.
  const storeVehicles = useSelector(state => state.vehicle.vehiclesInformation);
  const [vehicle, setVehicle] = useState(() => storeVehicles || []);
  const [swipedItemId, setSwipedItemId] = useState(null);
  const [VehicleUpdateModal, setVehicalUpdate] = useState(false);
  // The garage owns its Add Vehicle sheet: one mounted in another tab gets
  // hidden with that tab, leaving it open in state but invisible.
  const [addVehicleModal, setAddVehicleModal] = useState(false);
  const [loading, setLoading] = useState(() => !storeVehicles?.length);
  const [EditValue, setEditValue] = useState([]);
  const [ImageUrl, setImageUrl] = useState(null);
  const [vehicleinformation, setvehicleInformation] = useState(false);
  // Skeleton on every visit to the tab, even when the garage is cached.
  const visitSkeleton = useVisitSkeleton();
  const [detailId, setDetailId] = useState(null);
  // Which detail tab to open on (set by Home's "View all"); `at` makes a
  // repeat request for the same tab still apply.
  const [tabRequest, setTabRequest] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Reloading after a vehicle was added: skeleton instead of "Garage is Empty".
  const [reloadingAfterSave, setReloadingAfterSave] = useState(false);
  const navigation = useNavigation();
  const hasLoaded = useRef(!!storeVehicles?.length);
  // Set when Home's "View all" opened the detail: Back then returns to Home.
  const openedFromHome = useRef(false);
  const listRef = useRef(null);
  const dispatch = useDispatch();

  // ─── Executive Theme Design Tokens ────────────────────────────────────────
  const c = useMemo(
    () => ({
      // Same teal behind the rounded panel as Home / Dashboard / Settings,
      // so its top corners show in dark mode too.
      screenBg: accent.primary,
      surface: isDark ? themecolors.darkBlue : '#FFFFFF',
      cardSurface: isDark ? 'rgba(255, 255, 255, 0.03)' : '#F8FAFC',
      text: isDark ? themecolors.white : '#0F172A',
      title: isDark ? themecolors.white : '#1E293B',
      accent: isDark ? accent.light : accent.primary,
      muted: isDark ? accent.softAlpha(0.6) : '#64748B',
      countBg: isDark ? accent.lightAlpha(0.12) : accent.alpha(0.07),
      border: isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0',
    }),
    [isDark],
  );

  // Skeleton only on the very first load; later refetches (tab focus, edits)
  // run silently so an open vehicle detail and scroll position survive.
  const loadVehicle = useCallback(async ({ pull = false, afterSave = false } = {}) => {
    if (!hasLoaded.current) setLoading(true);
    if (pull) setRefreshing(true);
    if (afterSave) setReloadingAfterSave(true);
    setSwipedItemId(null);

    // Nothing on screen yet: show the copy stored on the phone straight away,
    // then replace it with the server's answer (which can take a while on a
    // slow connection). The skeleton only shows if nothing is stored at all.
    if (!hasLoaded.current) {
      const cached = await fetchCachedVehiclesByEmail(userEmail);
      if (cached && !hasLoaded.current) {
        setVehicle(cached);
        hasLoaded.current = true;
        setLoading(false);
      }
    }

    try {
      const vehicleData = await fetchVehicleByEmail(userEmail);
      setVehicle(vehicleData);
      setLoadError(false);
      hasLoaded.current = true;
    } catch (error) {
      console.log('Error fetching vehicle:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setReloadingAfterSave(false);
      dispatch(setTrigger(false));
    }
  }, [userEmail, dispatch]);

  // Derived from the list, so the open detail always shows refetched data.
  const selectedCar = useMemo(
    () => vehicle.find(v => v.id === detailId) || null,
    [vehicle, detailId],
  );

  const closeDetail = useCallback(() => setvehicleInformation(false), []);

  // Back (header button / Android back): to Home if that's where the user
  // came from, otherwise to the garage list.
  const goBack = useCallback(() => {
    if (openedFromHome.current) {
      openedFromHome.current = false;
      navigation.navigate('Home');
      return;
    }
    closeDetail();
  }, [navigation, closeDetail]);

  // Android back leaves the vehicle detail instead of the Garage tab.
  useFocusEffect(
    useCallback(() => {
      if (!vehicleinformation) return undefined;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        goBack();
        return true;
      });
      return () => sub.remove();
    }, [vehicleinformation, goBack])
  );

  // Every visit to the tab starts fresh: garage list, scrolled to the top.
  // Coming back from a schedule screen opened in a vehicle isn't a new visit.
  useFocusEffect(
    useCallback(() => {
      const openReq = consumeVehicleOpen();
      if (openReq) {
        consumeScheduleReturn();
        setSwipedItemId(null);
        setDetailId(openReq.vehicleId);
        dispatch(setSelectedCarRd(openReq.vehicleId));
        setTabRequest({ tab: openReq.tab, at: openReq.at });
        setvehicleInformation(true);
        openedFromHome.current = true;
        return;
      }
      if (consumeScheduleReturn()) return;
      openedFromHome.current = false;
      setvehicleInformation(false);
      setDetailId(null);
      setSwipedItemId(null);
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    }, [dispatch])
  );

  // The same due / expiry badges Home shows on its schedule, service and
  // document rows (util/vehicleAttention.js), so each garage card shows what
  // needs attention without opening the vehicle.
  const distUnit = useDistanceUnit();
  const recordsVersion = useSelector(state => state.user.recordsVersion);
  const [garageRecords, setGarageRecords] = useState({});
  const vehicleIdsKey = vehicle.map(v => v.id).join('|');
  const refetchAttention = useCallback(async () => {
    if (!userEmail || !vehicle.length) return;
    try {
      setGarageRecords(await loadGarageRecords(userEmail, vehicle));
    } catch (e) {
      console.log('Garage badges failed to load', e);
    }
    // vehicleIdsKey stands in for `vehicle`: reload when the set of vehicles changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail, vehicleIdsKey]);
  useEffect(() => { refetchAttention(); }, [refetchAttention, recordsVersion]);
  const attentionByVehicle = useMemo(() => {
    const map = {};
    vehicle.forEach(v => {
      const recs = garageRecords[v.id];
      // The card's own vehicle object is the freshest odometer.
      if (recs) map[v.id] = vehicleAttention({ ...recs, vehicle: v }, { unit: distUnit });
    });
    return map;
  }, [vehicle, garageRecords, distUnit]);

  useFocusEffect(
    useCallback(() => {
      if (!userEmail) return;
      loadVehicle({ afterSave: Trigger });
      refetchAttention();
      // `Trigger` is intentional: add/edit modals flip it to force a refetch.
    }, [userEmail, Trigger, loadVehicle, refetchAttention])
  );

  const handleEdit = useCallback((item) => {
    setEditValue(item);
    setVehicalUpdate(true);
    setImageUrl(item.imageUrl);
  }, []);

  // Swipe → Delete and Edit vehicle → Delete only ask; the vehicle (and all
  // its records) is removed once the user confirms in the dialog.
  const handleDelete = useCallback((item) => {
    setDeleteTarget(item);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteUserVehicle(userEmail, deleteTarget.id);
      // Don't leave Home / add-record modals pointing at a vehicle that's gone.
      if (selectedCarId === deleteTarget.id) dispatch(setSelectedCarRd(''));
      dispatch(bumpRecordsVersion());
      setDeleteTarget(null);
      setSwipedItemId(null);
      if (selectedCar?.id === deleteTarget.id) closeDetail();
      loadVehicle();
    } catch (error) {
      console.log(error);
      Alert.alert('Error', "The vehicle couldn't be deleted. Please try again.");
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, userEmail, loadVehicle, selectedCarId, selectedCar, closeDetail, dispatch]);

  const handleCardPress = useCallback((item) => {
    setDetailId(item.id);
    // Keeps the Redux-selected vehicle (which AddService/AddDocument/AddFuelLog
    // read to decide where a new record goes) in sync with whichever vehicle's
    // detail page is actually open here — otherwise adding a record from the
    // Garage tab could silently attach it to whatever vehicle Home last had
    // selected instead of the one on screen.
    dispatch(setSelectedCarRd(item.id));
    setvehicleInformation(true);
  }, [dispatch]);

  // The vehicle just edited: only its card shows a skeleton while the garage
  // reloads; the rest of the list stays as it is.
  const [editedVehicleId, setEditedVehicleId] = useState(null);
  const handleVehicleUpdated = useCallback(async () => {
    setEditedVehicleId(EditValue?.id ?? null);
    try {
      await loadVehicle();
    } finally {
      setEditedVehicleId(null);
    }
  }, [EditValue, loadVehicle]);

  const renderItem = useCallback(
    ({ item }) => item.id && item.id === editedVehicleId ? (
      <SkeletonVehicleCard />
    ) : (
      <VehicleCard
        item={item}
        swipedItemId={swipedItemId}
        setSwipedItemId={setSwipedItemId}
        onEdit={handleEdit}
        onDelete={handleDelete}
        setImageUrl={setImageUrl}
        onCardPress={handleCardPress}
        attention={attentionByVehicle[item.id]}
      />
    ),
    [swipedItemId, handleEdit, handleDelete, handleCardPress, attentionByVehicle, editedVehicleId],
  );

  const keyExtractor = useCallback(
    (item, index) => item.id?.toString() || index.toString(),
    [],
  );

  // A vehicle opened straight from Home skips the garage-list skeleton.
  const showVisitSkeleton = visitSkeleton && !vehicleinformation;
  if (loading || showVisitSkeleton || (reloadingAfterSave && vehicle.length === 0)) {
    return (
      <View style={[styles.screen, { backgroundColor: c.screenBg }]}>
        <View style={[styles.container, { backgroundColor: c.surface }]}>
          {/* Same layout as the loaded header, so nothing shifts when it loads. */}
          <View style={styles.headerRowBetween}>
            <View style={[styles.headerRow, styles.headerRowInBetween]}>
              <View style={[styles.iconBox, { backgroundColor: c.countBg }]}>
                <Car color={c.accent} />
              </View>
              <View style={styles.titleContainer}>
                <Text style={[styles.title, { color: c.title }]}>My Garage</Text>
                <Text style={[styles.subtitle, { color: c.muted }]}>Loading vehicles…</Text>
              </View>
            </View>
          </View>
          {[1, 2, 3].map((key) => (
            <SkeletonVehicleCard key={key} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: c.screenBg }]}>
      <View style={[styles.container, { backgroundColor: c.surface }]}>
        {vehicleinformation && selectedCar ? (
          // Schedule pages (card, alerts settings) open in place of this view.
          <ScheduleHost key={selectedCar.id}>
            <View style={[styles.headerRow, styles.detailHeaderRow]}>
              <TouchableOpacity
                onPress={goBack}
                accessibilityRole="button"
                accessibilityLabel={openedFromHome.current ? 'Back to Home' : 'Back to My Garage'}
                style={[styles.backButton, styles.backButtonFlush]}
                activeOpacity={0.7}
              >
                <Arrow color={c.accent} style={styles.backChevron} />
                <Text style={[styles.backButtonText, { color: c.accent }]}>Back</Text>
              </TouchableOpacity>
              <Text style={[styles.title, styles.detailTitle, { color: c.title }]} numberOfLines={2}>
                {[selectedCar?.brand, selectedCar?.model].filter(Boolean).join(' ') || 'Vehicle Overview'}
              </Text>
            </View>
            <View style={styles.fullHeight}>
              <VehicleInformations selectedCar={selectedCar} tabRequest={tabRequest} />
            </View>
          </ScheduleHost>
        ) : (
          <>
            {/* Dashboard Header Bar */}
            <View style={styles.headerRowBetween}>
              <View style={[styles.headerRow, styles.headerRowInBetween]}>
                <View style={[styles.iconBox, { backgroundColor: c.countBg }]}>
                  <Car color={c.accent} />
                </View>
                <View style={styles.titleContainer}>
                  <Text style={[styles.title, { color: c.title }]}>My Garage</Text>
                  <Text style={[styles.subtitle, { color: c.muted }]}>
                    {vehicle.length} {vehicle.length === 1 ? 'vehicle registered' : 'vehicles registered'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => setAddVehicleModal(true)}
                accessibilityRole="button"
                accessibilityLabel="Add vehicle"
                style={[styles.addButtonHeader, shadow(1), { backgroundColor: brand.primary }]}
                activeOpacity={0.85}
              >
                <PlusStroke color="#fff" size={18} />
              </TouchableOpacity>
            </View>
            <AdBanner backgroundColor="transparent" style={styles.adSlot} />

            {/* Main Vehicle Stream */}
            <FlatList
              ref={listRef}
              data={vehicle}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing || reloadingAfterSave}
                  onRefresh={() => loadVehicle({ pull: true })}
                  tintColor={c.accent}
                  colors={[c.accent]}
                />
              }
              ListEmptyComponent={
                loadError ? (
                  <ErrorState
                    title="Couldn't load your vehicles"
                    onRetry={() => loadVehicle()}
                  />
                ) : (
                <View style={[styles.emptyContainer, { backgroundColor: c.cardSurface, borderColor: c.border }]}>
                  <View style={[styles.emptyIconCircle, { backgroundColor: c.countBg }]}>
                    <VehicleInfo color={c.accent} />
                  </View>
                  <View style={styles.emptyTextGroup}>
                    <Text style={[styles.emptyText, { color: c.title }]}>Your Garage is Empty</Text>
                    <Text style={[styles.emptySubText, { color: c.muted }]}>
                      Add your vehicle details to monitor performance metrics, logs, and schedule services.
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setAddVehicleModal(true)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Add vehicle"
                    style={[styles.emptyAddButton, shadow(2), { backgroundColor: brand.primary }]}
                  >
                    <PlusStroke color="#fff" size={18} />
                    <Text style={styles.emptyAddButtonText}>Add Vehicle Now</Text>
                  </TouchableOpacity>
                </View>
                )
              }
            />
          </>
        )}

        <AddVehicle
          addVehicleModal={addVehicleModal}
          setAddVehicleModal={setAddVehicleModal}
          onVehicleAdded={() => loadVehicle({ afterSave: true })}
        />

        <VehicalUpdate
          VehicleUpdateModal={VehicleUpdateModal}
          setVehicalUpdate={setVehicalUpdate}
          EditValue={EditValue}
          onVehicleUpdated={handleVehicleUpdated}
          onDelete={handleDelete}
        />

        <ConfirmDeleteModal
          visible={!!deleteTarget}
          title="Delete vehicle"
          description={`Delete "${[deleteTarget?.brand, deleteTarget?.model].filter(Boolean).join(' ')}" and all of its services, documents and fuel logs? This can't be undone.`}
          loading={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
        />
      </View>
    </View>
  );
};

export default Vehicle;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    flex: 1,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
    marginTop: 5,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 0,
    position: 'relative',
    boxShadow: '0px -6px 16px rgba(0, 0, 0, 0.1)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    marginBottom: 16,
  },
  // Ad under the "My Garage" header; takes no space until an ad loads.
  adSlot: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 16 },
  headerRowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
    paddingHorizontal: 2,
  },
  headerRowInBetween: {
    marginBottom: 0,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    marginLeft: 12,
  },
  // Page title — same style as Home's "All Vehicles".
  title: {
    fontSize: 20,
    fontFamily: Typography.font.medium,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    fontFamily: Typography.font.regular,
    marginTop: 1,
  },
  detailTitle: {
    flex: 1,
    marginLeft: 4,
    marginRight: 12,
  },
  // Same spacing as the Settings → Backup header: the row sits closer to the
  // top and the chevron lines up with the content edge (touch area unchanged).
  detailHeaderRow: {
    marginTop: -8,
    marginBottom: 8,
  },
  backButtonFlush: {
    marginLeft: -14,
  },
  backButton: {
    minHeight: MIN_TOUCH,
    paddingHorizontal: 14,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backChevron: {
    transform: [{ rotate: '180deg' }],
  },
  backButtonText: {
    fontFamily: Typography.font.medium,
    fontWeight: '700',
    fontSize: 13,
  },
  addButtonHeader: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Fills the space left under the header row (not 100% of the screen,
  // which ran the detail under the ad banner and tab bar).
  fullHeight: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 36,
    paddingTop: 4,
    gap: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 56,
    paddingHorizontal: 28,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 16,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTextGroup: {
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 17,
    fontFamily: Typography.font.bold || Typography.font.regular,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  emptySubText: {
    fontSize: 13,
    fontFamily: Typography.font.regular,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: '92%',
  },
  emptyAddButton: {
    height: 46,
    paddingHorizontal: 26,
    borderRadius: 23,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyAddButtonText: {
    color: '#fff',
    fontFamily: Typography.font.regular,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
});