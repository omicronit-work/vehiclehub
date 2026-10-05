import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
  Alert,
  BackHandler,
  RefreshControl,
} from 'react-native';
import { Typography } from '../styles/typography.js';
import { useDispatch, useSelector } from 'react-redux';
import { fetchVehicleByEmail } from '../store/fetchSlice.js';
import { setaddVehicalModalRd, deleteUserVehicle, setTrigger, setSelectedCar as setSelectedCarRd } from '../store/userSlice.js';
import { useFocusEffect } from '@react-navigation/native';

import { Colors } from '../styles/colors.js';
import { themecolors } from '../styles/themecolors.js';

// Components & Assets
import VehicleCard from '../components/VehicleCard.jsx';
import Car from '../assets/svg/Car.jsx';
import PlusStroke from '../assets/svg/PlusStroke.jsx';
import SkeletonVehicleCard from '../skeleton/SkeletonVehicleCard.jsx';
import VehicalUpdate from '../modals/VehicleUpdate.jsx';
import VehicleInformations from '../components/VehicleInformations.jsx';
import VehicleInfo from '../assets/svg/VehicleInfo.jsx';
import ExportIcon from '../assets/svg/ExportIcon.jsx';
import ExportReportModal from '../modals/ExportReportModal.jsx';
import ConfirmDeleteModal from '../modals/ConfirmDeleteModal.jsx';
import ErrorState from '../components/ui/ErrorState.jsx';
import Arrow from '../assets/svg/Arrow.jsx';
import { shadow, MIN_TOUCH, brand } from '../theme/tokens';
import { accent } from '../theme/accent';

// Premium Shadow Profile System

const Vehicle = () => {
  const { userEmail, Trigger, selectedCar: selectedCarId } = useSelector(state => state.user);
  const { theme } = useSelector(state => state.theme);
  const isDark = theme === 'dark';

  const [vehicle, setVehicle] = useState([]);
  const [swipedItemId, setSwipedItemId] = useState(null);
  const [VehicleUpdateModal, setVehicalUpdate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [EditValue, setEditValue] = useState([]);
  const [ImageUrl, setImageUrl] = useState(null);
  const [vehicleinformation, setvehicleInformation] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [exportVisible, setExportVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoaded = useRef(false);
  const dispatch = useDispatch();

  // ─── Executive Theme Design Tokens ────────────────────────────────────────
  const c = useMemo(
    () => ({
      screenBg: isDark ? '#070F1C' : accent.primary,
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
  const loadVehicle = useCallback(async ({ pull = false } = {}) => {
    if (!hasLoaded.current) setLoading(true);
    if (pull) setRefreshing(true);
    setSwipedItemId(null);

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
      dispatch(setTrigger(false));
    }
  }, [userEmail, dispatch]);

  // Derived from the list, so the open detail always shows refetched data.
  const selectedCar = useMemo(
    () => vehicle.find(v => v.id === detailId) || null,
    [vehicle, detailId],
  );

  const closeDetail = useCallback(() => setvehicleInformation(false), []);

  // Android back leaves the vehicle detail instead of the Garage tab.
  useFocusEffect(
    useCallback(() => {
      if (!vehicleinformation) return undefined;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        closeDetail();
        return true;
      });
      return () => sub.remove();
    }, [vehicleinformation, closeDetail])
  );

  useFocusEffect(
    useCallback(() => {
      if (!userEmail) return;
      loadVehicle();
      // `Trigger` is intentional: add/edit modals flip it to force a refetch.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userEmail, Trigger, loadVehicle])
  );

  const handleEdit = useCallback((item) => {
    setEditValue(item);
    setVehicalUpdate(true);
    setImageUrl(item.imageUrl);
  }, []);

  // Swipe → Delete only asks; the vehicle (and all its records) is removed
  // once the user confirms in the dialog.
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

  const renderItem = useCallback(
    ({ item }) => (
      <VehicleCard
        item={item}
        swipedItemId={swipedItemId}
        setSwipedItemId={setSwipedItemId}
        onEdit={handleEdit}
        onDelete={handleDelete}
        setImageUrl={setImageUrl}
        onCardPress={handleCardPress}
      />
    ),
    [swipedItemId, handleEdit, handleDelete, handleCardPress],
  );

  const keyExtractor = useCallback(
    (item, index) => item.id?.toString() || index.toString(),
    [],
  );

  if (loading) {
    return (
      <View style={[styles.screen, { backgroundColor: c.screenBg }]}>
        <View style={[styles.container, { backgroundColor: c.surface }]}>
          <View style={styles.headerRow}>
            <View style={[styles.iconBox, { backgroundColor: c.countBg }]}>
              <Car color={c.accent} />
            </View>
            <Text style={[styles.title, { color: c.title }]}>My Garage</Text>
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
          <View style={{ flex: 1 }}>
            <View style={styles.headerRow}>
              <TouchableOpacity
                onPress={closeDetail}
                accessibilityRole="button"
                accessibilityLabel="Back to My Garage"
                style={[styles.backButton, { backgroundColor: c.countBg }]}
                activeOpacity={0.7}
              >
                <Arrow color={c.accent} style={styles.backChevron} />
                <Text style={[styles.exportButtonText, { color: c.accent }]}>Back</Text>
              </TouchableOpacity>
              <Text style={[styles.title, styles.detailTitle, { color: c.title }]} numberOfLines={1}>
                {selectedCar?.brand || 'Vehicle Overview'}
              </Text>
              <TouchableOpacity
                onPress={() => setExportVisible(true)}
                accessibilityRole="button"
                accessibilityLabel="Export service history"
                style={[styles.exportButton, { backgroundColor: c.countBg }]}
                activeOpacity={0.7}
              >
                <ExportIcon size={16} color={c.accent} />
                <Text style={[styles.exportButtonText, { color: c.accent }]}>Export</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.fullHeight}>
              <VehicleInformations selectedCar={selectedCar} />
            </View>
          </View>
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
                onPress={() => dispatch(setaddVehicalModalRd(true))}
                accessibilityRole="button"
                accessibilityLabel="Add vehicle"
                style={[styles.addButtonHeader, shadow(1), { backgroundColor: brand.primary }]}
                activeOpacity={0.85}
              >
                <PlusStroke color="#fff" size={18} />
              </TouchableOpacity>
            </View>

            {/* Main Vehicle Stream */}
            <FlatList
              data={vehicle}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
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
                    onPress={() => dispatch(setaddVehicalModalRd(true))}
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

        <VehicalUpdate
          VehicleUpdateModal={VehicleUpdateModal}
          setVehicalUpdate={setVehicalUpdate}
          EditValue={EditValue}
          onVehicleUpdated={loadVehicle}
        />

        <ExportReportModal
          visible={exportVisible}
          onClose={() => setExportVisible(false)}
          vehicle={selectedCar}
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
    marginTop: 6,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 0,
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    marginBottom: 16,
  },
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
  title: {
    fontSize: 20,
    fontFamily: Typography.font.bold || Typography.font.regular,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: Typography.font.regular,
    marginTop: 1,
  },
  detailTitle: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
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
  exportButton: {
    minHeight: MIN_TOUCH,
    paddingHorizontal: 14,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  exportButtonText: {
    fontFamily: Typography.font.medium,
    fontSize: 13,
  },
  addButtonHeader: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullHeight: {
    minHeight: '100%',
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