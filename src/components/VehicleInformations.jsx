import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { MIN_TOUCH, shadowSoft } from '../theme/tokens';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Text from './ui/AppText';
import { useDispatch, useSelector } from 'react-redux';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchDocumentssByid, fetchServicesByid, fetchFuelLogsById } from '../store/fetchSlice';
// Adjust this path if deleteUserService / deleteUserDocument live elsewhere.
import { deleteUserRecord, bumpRecordsVersion } from '../store/userSlice.js';
import { showUndo } from './ui/UndoSnackbar.jsx';
import { themecolors } from '../styles/themecolors.js';
import { sortDocuments, sortServices } from '../util/dateStatus.js';
import { formatKm, formatEff, costPerUnit } from '../util/distance';
import { useDistanceUnit } from '../util/schedule/scheduleSettings';
import { computeFuelEfficiency, summarizeFuel } from '../util/fuelEfficiency.js';
import { formatMoney, formatRecordMoney, symbolFor, useCurrency } from '../util/methods/useCurrency';
import { recordLabel } from '../util/recordSummary';
import ErrorState from './ui/ErrorState.jsx';
import SkeletonBlock from './ui/SkeletonBlock.jsx';

// SVG Icons
import NotFound from '../assets/svg/NotFound.jsx';
import Vehicle from '../assets/svg/Vehicle.jsx';
import FuelLogCard from './FuelLogCard.jsx';
import ViewServiceModal from '../modals/ViewServiceModal.jsx';
import ViewDocumentModal from '../modals/ViewDocumentModal.jsx';
import ViewFuelModal from '../modals/ViewFuelModal.jsx';
import ServiceUpdate from '../modals/ServiceUpdate.jsx';
import DocumentUpdate from '../modals/DocumentUpdate.jsx';
import FuelUpdate from '../modals/FuelUpdate.jsx';
import AddService from '../modals/AddService.jsx';
import AddDocument from '../modals/AddDocument.jsx';
import AddFuelLog from '../modals/AddFuelLog.jsx';
import ConfirmDeleteModal from '../modals/ConfirmDeleteModal.jsx';
import { accent } from '../theme/accent';
import ScheduleList from './schedule/ScheduleList.jsx';
import DocumentCard from './schedule/DocumentCard.jsx';
import ServiceRecordCard from './schedule/ServiceRecordCard.jsx';
import { FilterChips, SectionLabel } from './schedule/ScheduleParts.jsx';
import QuickAddMenu from './QuickAddMenu.jsx';
import PlusStroke from '../assets/svg/PlusStroke.jsx';
import { getDocumentBucket } from '../util/statusBuckets';
import PhotoPreview from './PhotoPreview.jsx';
import { useVehicleSchedules } from '../util/schedule/useVehicleSchedules';
import { useScheduleHost } from '../util/schedule/scheduleHostContext';
import { t as tr } from '../i18n';


// The schedule view is the vehicle's service screen, so it's labelled
// "Services"; the old record-only Services list was dropped in its favour.
const TABS = ['Schedule', 'Documents', 'Fuel'];
const TAB_LABELS = { Schedule: 'Services' };
// Older callers may still ask for the 'Services' tab.
const resolveTab = name => (name === 'Services' ? 'Schedule' : name);


// Fixed semantic accents — same hue in light and dark mode, matches
// ServicesDcumentlist so status reads as the same color language app-wide.
const STATUS_ACCENT = {
  danger: '#E5484D',
  warning: '#F5A524',
  success: '#2BAA6D',
};

// Shared card shadow (matches ServicesDcumentlist's cardShadow exactly).
// Also reused on the active tab pill so it "lifts" off the track the same
// way the floating white segment does in the reference screenshot.
// Shared soft card shadow (theme/tokens).
const cardShadow = shadowSoft(1.5);

// Shortest time an edited card shows its skeleton (matches the detail screens).
const EDIT_SKELETON_MIN_MS = 600;

const VehicleInformations = ({ selectedCar, tabRequest }) => {
  const { userEmail } = useSelector(state => state.user);
  // Re-renders when the currency changes, so amounts show the new symbol.
  const { code: appCurrency } = useCurrency();
  const dispatch = useDispatch();
  const { theme } = useSelector(state => state.theme);
  const isDark = theme === 'dark';
  const insets = useSafeAreaInsets();

  // ─── Theme-aware palette (aligned with ServicesDcumentlist) ─────────────
  const c = useMemo(
    () => ({
      cardBg: isDark ? 'rgba(4, 25, 51, 1)' : '#fff',
      cardBorder: isDark ? accent.lightAlpha(0.20) : 'rgba(4,25,51,0.05)',
      selectedBorder: isDark ? accent.primary : accent.primary,
      text: isDark ? themecolors.white : 'rgba(4, 25, 51, 1)',
      muted: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(4, 25, 51, 0.5)',
      tab: isDark ? accent.light : accent.primary,
      emptyTitle: isDark ? accent.softAlpha(0.8) : accent.alpha(0.8),
      emptyDesc: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(4, 25, 51, 0.5)',
      fallbackVehicle: isDark ? accent.light : accent.primary,
      iconWell: isDark ? accent.lightAlpha(0.16) : accent.alpha(0.08),
      emptyIconWell: isDark ? accent.lightAlpha(0.10) : accent.alpha(0.06),

      // Segmented toggle — light gray track, white floating pill on the
      // active tab (matches the reference screenshot), blue label when
      // active vs. muted gray when inactive.
      tabTrackBg: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(4, 25, 51, 0.045)',
      tabActiveBg: isDark ? 'rgba(255,255,255,0.14)' : '#fff',
      tabInactiveText: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(4, 25, 51, 0.45)',

      status: {
        danger: {
          text: isDark ? '#FF9C90' : '#C62828',
          bg: isDark ? 'rgba(229,72,77,0.16)' : 'rgba(229,72,77,0.09)',
          accent: STATUS_ACCENT.danger,
        },
        warning: {
          text: isDark ? '#FFD180' : '#A66200',
          bg: isDark ? 'rgba(245,165,36,0.16)' : 'rgba(245,165,36,0.10)',
          accent: STATUS_ACCENT.warning,
        },
        success: {
          text: isDark ? '#9CE6B0' : '#1E8A4C',
          bg: isDark ? 'rgba(43,170,109,0.16)' : 'rgba(43,170,109,0.10)',
          accent: STATUS_ACCENT.success,
        },
        neutral: {
          text: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(4,25,51,0.5)',
          bg: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(4,25,51,0.05)',
          accent: isDark ? 'rgba(255,255,255,0.28)' : 'rgba(4,25,51,0.16)',
        },
      },
    }),
    [isDark],
  );

  const [tab, setTab] = useState(
    tabRequest && TABS.includes(resolveTab(tabRequest.tab)) ? resolveTab(tabRequest.tab) : 'Schedule',
  );
  // One "+ Add" button (same menu as Home) instead of a per-tab button.
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [services, setServices] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [fuelLogs, setFuelLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [selectedId, setSelectedId] = useState(null);
  const [isSelectedcard, setIsSelected] = useState(false);

  const [updateData, setUpdateData] = useState(null);
  const [forView, setForView] = useState(false);
  const [forDocumentView, setForDocumentView] = useState(false);
  const [forFuelView, setForFuelView] = useState(false);

  const [serviceData, setServiceData] = useState(null);
  const [documentData, setDocumentData] = useState(null);
  const [fuelData, setFuelData] = useState(null);

  const [addServiceModal, setAddServiceModal] = useState(false);
  const [addDocumentModal, setAddDocumentModal] = useState(false);
  const [addFuelLogModal, setAddFuelLogModal] = useState(false);

  const [serviceUpdateModal, setServiceUpdateModal] = useState(false);
  const [documentUpdateModal, setDocumentUpdateModal] = useState(false);
  const [fuelUpdateModal, setFuelUpdateModal] = useState(false);

  const [deletingId, setDeletingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  // True while reloading after an add/edit, so the user sees a loader instead
  // of a stale (or empty) list during the round trip.
  const [refreshing, setRefreshing] = useState(false);
  // The record just edited: only its card shows a skeleton while the list
  // reloads, instead of an "Updating…" row over the whole list.
  // Held for at least EDIT_SKELETON_MIN_MS so a quick reload doesn't just flicker.
  const [editedId, setEditedId] = useState(null);
  const editStartedRef = useRef(0);
  useEffect(() => {
    if (refreshing || !editedId) return undefined;
    const wait = Math.max(0, EDIT_SKELETON_MIN_MS - (Date.now() - editStartedRef.current));
    const timer = setTimeout(() => setEditedId(null), wait);
    return () => clearTimeout(timer);
  }, [refreshing, editedId]);
  const markEdited = useCallback(id => {
    editStartedRef.current = Date.now();
    setEditedId(id);
  }, []);
  // Re-read on focus so a currency change in Settings shows up immediately.
  const isFocused = useIsFocused();
  const distUnit = useDistanceUnit();

  // The Services tab (key 'Schedule') shows schedules, then the vehicle's
  // service records as History — so service-record actions apply there.
  const isServiceTab = tab === 'Schedule';
  const isFuelTab = tab === 'Fuel';
  const isScheduleTab = tab === 'Schedule';
  const isDocumentsTab = tab === 'Documents';
  const scheduleHost = useScheduleHost();

  const fuelSummary = useMemo(() => summarizeFuel(fuelLogs), [fuelLogs]);

  // Filters under the tabs, both starting on All. Services: schedules
  // (Upcoming) or service records (History). Documents: expired or still valid.
  const [serviceFilter, setServiceFilter] = useState('all');
  const [docFilter, setDocFilter] = useState('all');
  const expiredDocs = useMemo(() => documents.filter(d => getDocumentBucket(d) === 'overdue'), [documents]);
  const validDocs = useMemo(() => documents.filter(d => getDocumentBucket(d) !== 'overdue'), [documents]);

  const listData = useMemo(() => {
    if (isServiceTab) return services;
    if (isFuelTab) return fuelLogs;
    return documents;
  }, [isServiceTab, isFuelTab, services, documents, fuelLogs]);

  const shownDocs = docFilter === 'expired' ? expiredDocs : docFilter === 'valid' ? validDocs : documents;

  // The vehicle's last known odometer reading (bumped on every service/fuel
  // save) — needed to turn a service's stored nextServiceMileage into a
  // "due in ~X km" chip. Only ever set from the object form of selectedCar.
  const currentOdometer =
    typeof selectedCar === 'object' ? Number(selectedCar?.currentOdometer) : NaN;

  const clearSelection = useCallback(() => {
    setIsSelected(false);
    setSelectedId(null);
  }, []);

  const handleTabChange = useCallback(
    selectedTab => {
      if (tab !== selectedTab) {
        clearSelection();
        setTab(selectedTab);
      }
    },
    [tab, clearSelection],
  );

  // Home's "View all" can reopen an already-mounted detail on another tab.
  useEffect(() => {
    if (tabRequest && TABS.includes(resolveTab(tabRequest.tab))) {
      clearSelection();
      setTab(resolveTab(tabRequest.tab));
    }
  }, [tabRequest, clearSelection]);

  // Keyed on the id (not the object, which is recreated on every refetch).
  // Skeleton only for a vehicle not shown yet; refocusing refreshes silently
  // so records added from another tab appear.
  const carId = typeof selectedCar === 'object' ? selectedCar?.id : selectedCar;
  const loadedCarRef = useRef(null);
  const schedule = useVehicleSchedules(carId);

  useEffect(() => {
    if (!isFocused) return undefined;
    let isCancelled = false;

    const fetchData = async () => {
      try {
        if (!userEmail || !carId) {
          setLoading(false);
          setRefreshing(false);
          return;
        }

        if (loadedCarRef.current !== carId) setLoading(true);
        setLoadError(false);
        const [serviceRes, docRes, fuelRes] = await Promise.all([
          fetchServicesByid(userEmail, carId),
          fetchDocumentssByid(userEmail, carId),
          fetchFuelLogsById(userEmail, carId),
        ]);

        if (!isCancelled) {
          setServices(sortServices(serviceRes || []));
          setDocuments(sortDocuments(docRes || []));
          setFuelLogs(computeFuelEfficiency(fuelRes || []));
          loadedCarRef.current = carId;
        }
      } catch (error) {
        if (!isCancelled) {
          console.error('Error handling sync:', error);
          setLoadError(true);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    fetchData();

    return () => {
      isCancelled = true;
    };
  }, [carId, userEmail, refreshTrigger, isFocused]);


  const handleEditPress = useCallback(
    (item, index) => {
      setSelectedId(item.id || index);
      setIsSelected(true);

      if (isFuelTab) {
        setUpdateData(fuelLogs[index]);
        setFuelUpdateModal(true);
      } else if (!isServiceTab) {
        setDocumentData(item);
        setUpdateData(documents[index]);
        setDocumentUpdateModal(true);
      } else {
        setUpdateData(services[index]);
        setForView(false);
        setServiceUpdateModal(true);
      }
    },
    [isServiceTab, isFuelTab, documents, services, fuelLogs],
  );

  const handleDeletePress = useCallback(
    (item) => {
      if (!item.id) {
        Alert.alert(tr('Cannot delete'), tr('This record is missing an id.'));
        return;
      }

      const kind = isFuelTab ? 'fuel' : isServiceTab ? 'service' : 'document';
      const name = recordLabel(item, kind, v => formatRecordMoney(item, v));
      setDeleteTarget({ item, name });
    },
    [isServiceTab, isFuelTab],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    const { item } = deleteTarget;
    const kind = isFuelTab ? 'fuel' : isServiceTab ? 'service' : 'document';

    try {
      setDeletingId(item.id);
      const undo = await deleteUserRecord(userEmail, carId, kind, item.id);
      if (kind === 'fuel') setFuelLogs((prev) => prev.filter((f) => f.id !== item.id));
      else if (kind === 'service') setServices((prev) => prev.filter((s) => s.id !== item.id));
      else setDocuments((prev) => prev.filter((d) => d.id !== item.id));
      // Lets the Dashboard refresh its totals in the background.
      if (kind !== 'document') dispatch(bumpRecordsVersion());
      
      setDeleteTarget(null);
      clearSelection();

      // Mis-taps happen even with a confirmation: offer to put it back.
      const label = kind === 'fuel' ? tr('Fuel log') : kind === 'service' ? tr('Service') : tr('Document');
      if (undo) {
        showUndo({
          message: tr('{0} deleted', { 0: label }),
          onUndo: () => {
            undo();
            dispatch(bumpRecordsVersion());
            setRefreshTrigger(prev => prev + 1);
          },
        });
      }
    } catch (error) {
      console.error('Delete failed:', error);
      Alert.alert(tr('Error'), tr('Could not delete this item. Please try again.'));
    } finally {
      setDeletingId(null);
    }
  }, [deleteTarget, isServiceTab, isFuelTab, userEmail, carId, clearSelection, dispatch]);

  // Same choices as Home's "+ Add": switch to the matching tab, then open its form.
  const handleQuickAdd = useCallback(key => {
    if (key === 'fuel') {
      setTab('Fuel');
      setAddFuelLogModal(true);
    } else if (key === 'document') {
      setTab('Documents');
      setAddDocumentModal(true);
    } else if (key === 'service') {
      setTab('Schedule');
      setAddServiceModal(true);
    } else if (key === 'schedule') {
      setTab('Schedule');
      if (scheduleHost) scheduleHost.navigate('ScheduleForm', { vehicleId: carId });
      else setAddServiceModal(true);
    }
  }, [scheduleHost, carId]);

  // Documents open their own page in place (like a schedule), as on Home.
  const openDocument = useCallback(
    item => {
      if (scheduleHost) {
        scheduleHost.navigate('DocumentDetail', {
          vehicleId: carId,
          documentId: item.id,
          document: item,
          // Edited or renewed: skeleton on this document's card while it reloads.
          onChanged: () => {
            markEdited(item.id);
            setRefreshing(true);
            setRefreshTrigger(n => n + 1);
          },
        });
        return;
      }
      setDocumentData(item);
      setForDocumentView(true);
    },
    [scheduleHost, carId, markEdited],
  );

  const reloadSchedule = schedule.reload;
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshTrigger(prev => prev + 1);
    clearSelection();
    // A new service or reading can change what the schedule shows.
    reloadSchedule();
  }, [clearSelection, reloadSchedule]);

  // After an edit: skeleton on that record's card only.
  const handleEdited = useCallback(id => {
    if (id) markEdited(id);
    handleRefresh();
  }, [handleRefresh, markEdited]);

  // Skeleton mirrors ServicesDcumentlist's SkeletonRow shape (accent strip +
  // icon well + two lines) instead of a plain card with no strip.
  const renderSkeletonCard = key => (
    <View
      key={key}
      accessibilityLabel={tr('Updating')}
      style={[styles.card, cardShadow, { backgroundColor: c.cardBg, borderWidth: 1, borderColor: c.cardBorder }]}
    >
      <View style={styles.cardContent}>
        <View style={[styles.iconContainer, { backgroundColor: c.iconWell }]}>
          <SkeletonBlock style={styles.skeletonIcon} />
        </View>
        <View style={styles.textGroup}>
          <SkeletonBlock style={styles.skeletonTitle} />
          <SkeletonBlock style={styles.skeletonDate} />
        </View>
      </View>
      <SkeletonBlock style={styles.skeletonEdit} />
    </View>
  );
  const renderSkeleton = () =>
    Array.from({ length: 3 }).map((_, index) => renderSkeletonCard(`skeleton-${index}`));

  // A failed load must not read as "No service records yet".
  const servicesFailed = loadError && !loading && services.length === 0;
  const renderServicesError = () => (
    <ErrorState
      title={tr('Couldn\'t load this vehicle\'s records')}
      onRetry={() => setRefreshTrigger(n => n + 1)}
    />
  );

  // Fuel tab header: the vehicle's economy and spend at a glance.
  const renderFuelSummary = sum => {
    // Amounts in the selected currency (never converted).
    const money = v => (v != null ? formatMoney(v, symbolFor(appCurrency)) : '—');
    const stats = [
      { label: tr('Last'), value: sum.lastEfficiency != null ? formatEff(sum.lastEfficiency, sum.effUnit, distUnit) : '—' },
      { label: tr('Best'), value: sum.bestEfficiency != null ? formatEff(sum.bestEfficiency, sum.effUnit, distUnit) : '—' },
      { label: tr('Cost / {0}', { 0: distUnit }), value: sum.costPerKm != null ? money(costPerUnit(sum.costPerKm, distUnit)) : '—' },
      { label: tr('Total spent'), value: money(sum.totalCost) },
      { label: tr('Fuel bought'), value: `${Number(sum.totalQty.toFixed(1)).toLocaleString()} ${sum.unit}` },
      { label: tr('Distance'), value: formatKm(sum.distance, distUnit) },
    ];
    return (
      <View style={[styles.fuelSummary, cardShadow, { backgroundColor: c.cardBg }]}>
        <Text style={[styles.fuelSummaryLabel, { color: c.muted }]}>{tr('AVERAGE ECONOMY')}</Text>
        <Text style={[styles.fuelSummaryValue, { color: sum.avgEfficiency != null ? c.status.success.text : c.muted }]}>
          {sum.avgEfficiency != null ? formatEff(sum.avgEfficiency, sum.effUnit, distUnit) : tr('Needs two full tanks')}
        </Text>
        <Text style={[styles.fuelSummaryMeta, { color: c.muted }]}>
          {sum.fillUps === 1 ? tr('1 fill-up') : tr('{0} fill-ups', { 0: sum.fillUps })}
          {sum.avgPrice != null ? tr('· avg {0} / {1}', { 0: money(sum.avgPrice), 1: sum.unit }) : ''}
        </Text>
        <View style={styles.fuelStatGrid}>
          {stats.map(st => (
            <View key={st.label} style={[styles.fuelStat, { backgroundColor: c.iconWell }]}>
              <Text style={[styles.fuelStatLabel, { color: c.muted }]}>{st.label}</Text>
              <Text numberOfLines={1} style={[styles.fuelStatValue, { color: c.text }]}>{st.value}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // Fuel tab rows (services and documents have their own cards) — the same
  // card as Home's Fuel tab, so a fill-up looks identical on both screens.
  const renderItem = (item, index) => {
    const itemId = item.id || index;
    return (
      <FuelLogCard
        key={item.id?.toString?.() || index.toString()}
        item={item}
        money={v => formatRecordMoney(item, v)}
        distUnit={distUnit}
        selected={selectedId === itemId && isSelectedcard}
        busy={deletingId === item.id}
        onPress={() => {
          setIsSelected(true);
          setSelectedId(itemId);
          setFuelData(item);
          setForFuelView(true);
        }}
        onEdit={() => handleEditPress(item, index)}
        onDelete={() => handleDeletePress(item)}
      />
    );
  };

  // Services tab → History: a completed service as a schedule-style card,
  // with the same view / edit / delete actions as the compact row.
  const renderServiceCard = (item, index) => {
    // Just edited: a skeleton until the saved copy is back.
    if (item.id && item.id === editedId) return renderSkeletonCard(item.id);
    const itemId = item.id || index;
    const isActive = isSelectedcard && selectedId === itemId;
    const isDeleting = deletingId === item.id;
    return (
      <View key={item.id?.toString?.() || index.toString()} style={isDeleting && styles.deleting}>
        <ServiceRecordCard
          item={item}
          money={v => formatRecordMoney(item, v)}
          unit={distUnit}
          currentOdometer={currentOdometer}
          selected={isActive}
          onPress={() => {
            setIsSelected(true);
            setSelectedId(itemId);
            setServiceData(item);
            setForView(true);
          }}
          onLongPress={() => handleDeletePress(item)}
        />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {selectedCar?.imageUrl ? (
        // Whole photo over a blurred copy; tap (or the expand badge) opens it
        // full screen, like the other photos in the app.
        <PhotoPreview
          uri={selectedCar.imageUrl}
          height={130}
          fileName="VehicleHub_Vehicle"
          style={styles.vehiclePhoto}
        />
      ) : (
        <View style={[styles.image, styles.fallbackImageContainer]}>
          <Vehicle color={c.fallbackVehicle} width={110} height={52} />
        </View>
      )}

      {/* ── Segmented Services / Documents toggle ─────────────────────────
          Light gray track with a white floating pill behind the active
          label (matches the reference screenshot), blue label on active,
          muted gray on inactive. No count badges. */}
      <View style={[styles.tabTrack, { backgroundColor: c.tabTrackBg }]}>
        {TABS.map(tabName => {
          const isActive = tab === tabName;

          return (
            <TouchableOpacity
              key={tabName}
              onPress={() => handleTabChange(tabName)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tr('{0} tab', { 0: tr(TAB_LABELS[tabName] || tabName) })}
              activeOpacity={0.85}
              style={[
                styles.tabPill,
                isActive && [styles.tabPillActive, { backgroundColor: c.tabActiveBg }, cardShadow],
              ]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.tabPillText,
                  { color: isActive ? c.tab : c.tabInactiveText },
                ]}
              >
                {tr(TAB_LABELS[tabName] || tabName)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {isScheduleTab ? (
        <View style={styles.listWrapper}>
          <ScrollView
            style={styles.bleedScroll}
            contentContainerStyle={[styles.scrollContent, styles.scheduleScroll]}
            showsVerticalScrollIndicator={false}
          >
            <FilterChips
              style={styles.filterChips}
              value={serviceFilter}
              onChange={setServiceFilter}
              options={[
                {
                  value: 'all',
                  label: tr('All'),
                  count: schedule.data && !loading ? schedule.evaluations.length + services.length : null,
                },
                { value: 'upcoming', label: tr('Upcoming'), count: schedule.data ? schedule.evaluations.length : null },
                { value: 'history', label: tr('Completed'), count: loading ? null : services.length },
              ]}
            />

            {serviceFilter === 'all' ? (
              <>
                {/* Schedules first, then the records under COMPLETED. */}
                <ScheduleList
                  vehicleId={carId}
                  schedule={schedule}
                  embedded
                  hideEmpty={!loading && services.length > 0}
                />
                {servicesFailed && renderServicesError()}
                {(loading || services.length > 0) && (
                  <View style={schedule.evaluations.length > 0 ? styles.historySection : styles.documentList}>
                    {schedule.evaluations.length > 0 && <SectionLabel>{tr('COMPLETED')}</SectionLabel>}
                    {loading ? renderSkeleton() : services.map((item, index) => renderServiceCard(item, index))}
                  </View>
                )}
              </>
            ) : serviceFilter === 'upcoming' ? (
              <ScheduleList vehicleId={carId} schedule={schedule} embedded />
            ) : (
              // Completed service records.
              <View style={styles.documentList}>
                {loading ? (
                  renderSkeleton()
                ) : servicesFailed ? (
                  renderServicesError()
                ) : services.length > 0 ? (
                  services.map((item, index) => renderServiceCard(item, index))
                ) : (
                  <Text style={[styles.filterEmpty, { color: c.emptyDesc }]}>
                    {tr('No service records yet. Completed services show up here.')}
                  </Text>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      ) : (
      <View style={styles.listWrapper}>
      <ScrollView
        style={[styles.flexFill, styles.bleedScroll]}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 90 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View>
          {refreshing && !editedId && listData.length > 0 && (
            <View style={styles.refreshingRow} accessibilityLiveRegion="polite">
              <ActivityIndicator size="small" color={c.muted} />
              <Text style={[styles.refreshingText, { color: c.muted }]}>{tr('Updating…')}</Text>
            </View>
          )}
          {loading || (refreshing && listData.length === 0) ? (
            renderSkeleton()
          ) : loadError && listData.length === 0 ? (
            <ErrorState
              title={tr('Couldn\'t load this vehicle\'s records')}
              onRetry={() => setRefreshTrigger(n => n + 1)}
            />
          ) : listData.length === 0 ? (
            <View style={styles.emptyContentContainer}>
              <View style={[styles.emptyIconWell, { backgroundColor: c.emptyIconWell }]}>
                <NotFound />
              </View>
              <View style={styles.textGroupCenter}>
                <Text style={[styles.titleText, { color: c.emptyTitle }]}>
                  {isFuelTab ? tr('No fuel logs yet') : isServiceTab ? tr('No service records yet') : tr('No documents yet')}
                </Text>
                <Text style={[styles.descriptionText, { color: c.emptyDesc }]}>
                  {isFuelTab
                    ? tr('Log a fill-up to start tracking cost and efficiency.')
                    : isServiceTab
                    ? tr('Add a record to keep your maintenance history up to date.')
                    : tr('Upload your documents to keep your vehicle organised.')}
                </Text>
              </View>
            </View>
          ) : (
            <View style={isDocumentsTab && styles.documentList}>
              {isFuelTab && fuelSummary && renderFuelSummary(fuelSummary)}
              {isDocumentsTab && (
                <FilterChips
                  value={docFilter}
                  onChange={setDocFilter}
                  options={[
                    { value: 'all', label: tr('All'), count: documents.length },
                    { value: 'expired', label: tr('Expired'), count: expiredDocs.length },
                    { value: 'valid', label: tr('Valid'), count: validDocs.length },
                  ]}
                />
              )}
              {isDocumentsTab ? (
                shownDocs.length > 0 ? (
                  shownDocs.map(item => item.id === editedId ? renderSkeletonCard(item.id) : (
                    <DocumentCard
                      key={item.id}
                      item={item}
                      onPress={() => openDocument(item)}
                      onLongPress={() => handleDeletePress(item)}
                    />
                  ))
                ) : (
                  <Text style={[styles.filterEmpty, { color: c.emptyDesc }]}>
                    {docFilter === 'expired' ? tr('Nothing has expired.') : tr('No valid documents.')}
                  </Text>
                )
              ) : (
                listData.map((item, index) =>
                  item.id && item.id === editedId
                    ? renderSkeletonCard(item.id)
                    : renderItem(item, index),
                )
              )}
            </View>
          )}
        </View>
      </ScrollView>
      </View>
      )}

      {/* Always visible (never hides on scroll), on every tab. */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setQuickAddOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={tr('Add fuel, service, document or schedule')}
        style={[styles.addFab, shadowSoft(4, accent.primary)]}
      >
        <PlusStroke color="#fff" size={17} />
        <Text style={styles.addFabText}>{tr('Add')}</Text>
      </TouchableOpacity>
      <QuickAddMenu
        visible={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onSelect={handleQuickAdd}
        isDark={isDark}
      />

      <View>
        <AddService
          AddServiceModal={addServiceModal}
          setAddServiceModal={setAddServiceModal}
          onServiceAdded={handleRefresh}
        />

        <AddDocument
          AddDocumentModal={addDocumentModal}
          setAddDocumentModal={setAddDocumentModal}
          onDocumentAdded={handleRefresh}
        />

        <AddFuelLog
          AddFuelLogModal={addFuelLogModal}
          setAddFuelLogModal={setAddFuelLogModal}
          onFuelLogAdded={handleRefresh}
        />

        <ViewFuelModal
          fuelData={fuelData}
          setFuelData={setFuelData}
          forFuelView={forFuelView}
          setForFuelView={(val) => {
            setForFuelView(val);
            if (!val) clearSelection();
          }}
          setIsSelected={setIsSelected}
        />

        <FuelUpdate
          FuelUpdateModal={fuelUpdateModal}
          setFuelUpdateModal={(val) => {
            setFuelUpdateModal(val);
            if (!val) clearSelection();
          }}
          updateData={updateData}
          onFuelLogUpdated={() => handleEdited(updateData?.id)}
          setSelectedCard={setIsSelected}
        />

        <ViewServiceModal
          serviceData={serviceData}
          setServiceData={setServiceData}
          forView={forView}
          setForView={(val) => {
            setForView(val);
            if (!val) clearSelection();
          }}
          setIsSelected={setIsSelected}
          onEdit={item => {
            const index = services.findIndex(s => s.id === item.id);
            setForView(false);
            handleEditPress(item, index);
          }}
        />

        <ViewDocumentModal
          documentData={documentData}
          setDocumentData={setDocumentData}
          forDocumentView={forDocumentView}
          setForDocumentView={(val) => {
            setForDocumentView(val);
            if (!val) clearSelection();
          }}
        />

        <ServiceUpdate
          ServiceUpdateModal={serviceUpdateModal}
          setServiceUpdateModal={(val) => {
            setServiceUpdateModal(val);
            if (!val) clearSelection();
          }}
          updateData={updateData}
          forView={forView}
          setForView={setForView}
          setSelectedCard={setIsSelected}
          onServiceUpdated={() => handleEdited(updateData?.id)}
        />

        <DocumentUpdate
          DocumentUpdateModal={documentUpdateModal}
          setForView={setForView}
          setDocumentUpdateModal={(val) => {
            setDocumentUpdateModal(val);
            if (!val) clearSelection();
          }}
          updateData={updateData}
          setSelectedCard={setIsSelected}
          onDocumentUpdated={() => handleEdited(updateData?.id)}
        />

        <ConfirmDeleteModal
          visible={!!deleteTarget}
          title={isFuelTab ? tr('Delete fuel log') : isServiceTab ? tr('Delete service record') : tr('Delete document')}
          itemName={deleteTarget?.name}
          loading={!!deleteTarget && deletingId === deleteTarget.item.id}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
        />
      </View>
    </View>
  );
};

export default VehicleInformations;

const styles = StyleSheet.create({
  container: { flex: 1 },
  image: { width: '100%', height: 130, borderRadius: 20 },
  vehiclePhoto: { borderRadius: 20, borderWidth: 0 },
  // No photo: a short placeholder, so the records start higher up.
  fallbackImageContainer: {
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Segmented toggle
  tabTrack: {
    flexDirection: 'row',
    marginTop: 22,
    padding: 4,
    borderRadius: 14,
    gap: 4,
  },
  tabPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabPillActive: {},
  tabPillText: {
    fontFamily: 'RobotoCondensed500',
    fontSize: 13,
  },

  listWrapper: { flex: 1 },
  // Same look as Home's "+ Add" button.
  addFab: {
    position: 'absolute',
    bottom: 16,
    right: 4,
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
  addFabText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'RobotoCondensed500',
    fontWeight: '700',
  },
  refreshingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  refreshingText: { fontSize: 13, fontFamily: 'RobotoCondensed400' },
  // Reaches into the page padding so card shadows aren't clipped at the
  // scroll view's edges; the content is padded back into place.
  bleedScroll: { marginHorizontal: -20 },
  scrollContent: { paddingTop: 4, paddingHorizontal: 20 },
  // Room under the last card so the "+ Schedule" button never covers it.
  scheduleScroll: { paddingBottom: 96 },
  flexFill: { flex: 1 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  deleting: { opacity: 0.5 },
  // Room between cards, matching the schedule list.
  documentList: { gap: 14, paddingTop: 14 },
  historySection: { marginTop: 22, gap: 14 },
  filterChips: { paddingTop: 14 },
  filterEmpty: { fontFamily: 'RobotoCondensed400', fontSize: 14, textAlign: 'center', paddingVertical: 32 },
  emptyContentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    width: '100%',
    paddingVertical: 44,
  },
  emptyIconWell: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fuelSummary: { marginTop: 12, marginHorizontal: 2, borderRadius: 16, padding: 16 },
  fuelSummaryLabel: { fontSize: 11, fontFamily: 'RobotoCondensed500', letterSpacing: 1.2 },
  fuelSummaryValue: { fontSize: 26, fontFamily: 'RobotoCondensed500', fontWeight: '700', marginTop: 4 },
  fuelSummaryMeta: { fontSize: 12, fontFamily: 'RobotoCondensed400', marginTop: 2 },
  fuelStatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  fuelStat: { flexBasis: '31%', flexGrow: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, gap: 2 },
  fuelStatLabel: { fontSize: 11, fontFamily: 'RobotoCondensed400' },
  fuelStatValue: { fontSize: 13, fontFamily: 'RobotoCondensed500' },
  card: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 8,
    borderRadius: 16,
    marginHorizontal: 2,
    overflow: 'hidden',
  },
  cardContent: { flexDirection: 'row', gap: 12, flex: 1, alignItems: 'center', paddingRight: 8 },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textGroup: { gap: 5, flex: 1 },
  textGroupCenter: { gap: 6 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
  },
  icon: { width: 22, height: 22, resizeMode: 'contain' },
  title: {
    fontSize: 15,
    fontFamily: 'RobotoCondensed500',
    letterSpacing: 0.1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  date: {
    fontSize: 12,
    fontFamily: 'RobotoCondensed400',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
    maxWidth: 170,
  },
  statusText: {
    fontSize: 11,
    fontFamily: 'RobotoCondensed400',
  },
  button: {
    marginTop: 4,
    height: 48,
    minWidth: 180,
    maxWidth: 230,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    borderRadius: 24,
    get backgroundColor() { return accent.primary; },
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontFamily: 'RobotoCondensed500',
    fontSize: 14,
    letterSpacing: 0.2,
  },
  titleText: {
    fontSize: 16,
    textAlign: 'center',
    fontFamily: 'RobotoCondensed500',
  },
  descriptionText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 12,
  },
  skeletonIcon: {
    width: 20,
    height: 20,
    borderRadius: 5,
  },
  skeletonTitle: {
    width: 130,
    height: 10,
    borderRadius: 10,
  },
  skeletonDate: {
    width: 80,
    height: 10,
    borderRadius: 10,
    marginTop: 4,
  },
  skeletonEdit: {
    width: 22,
    height: 22,
    borderRadius: 6,
  },
});