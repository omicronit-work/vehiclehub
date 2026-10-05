import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { shadowSoft } from '../theme/tokens';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  Alert,
} from 'react-native';

import NotFound from '../assets/svg/NotFound.jsx';
import PlusStroke from '../assets/svg/PlusStroke.jsx';
import EditIcon from '../assets/svg/EditIcon.jsx';
import TrashIcon from '../assets/svg/TrashIcon.jsx';
import FuelIcon from '../assets/svg/FuelIcon.jsx';
import AddDocument from '../modals/AddDocument.jsx';
import DocumentUpdate from '../modals/DocumentUpdate.jsx';
import ServiceUpdate from '../modals/ServiceUpdate.jsx';
import AddFuelLog from '../modals/AddFuelLog.jsx';
import ViewFuelModal from '../modals/ViewFuelModal.jsx';
import FuelUpdate from '../modals/FuelUpdate.jsx';
import ConfirmDeleteModal from '../modals/ConfirmDeleteModal.jsx';
import ErrorState from './ui/ErrorState.jsx';
import { useSelector } from 'react-redux';
import { useIsFocused } from '@react-navigation/native';
import { fetchDocumentssByid, fetchServicesByid, fetchFuelLogsById } from '../store/fetchSlice.js';
import { deleteUserService, deleteUserDocument, deleteUserFuelLog } from '../store/userSlice.js';
import { cancelReminder, reminderId } from '../util/notifications.js';
import { themecolors } from '../styles/themecolors.js';
import { toMillis, getServiceStatus, getDocumentStatus } from '../util/dateStatus.js';
import { computeFuelEfficiency, efficiencyUnit } from '../util/fuelEfficiency.js';
import { useCurrency } from '../util/methods/useCurrency';
import {
  getServiceBucket,
  getDocumentBucket,
  countServiceBuckets,
  countDocumentBuckets,
} from '../util/statusBuckets.js';
import { accent } from '../theme/accent';


const SERVICE_NAME = [
  { id: 1, name: 'Engine Oil Refill', icon: require('../assets/icons/oil.png') },
  { id: 2, name: 'Oil Filter', icon: require('../assets/icons/filter.png') },
  { id: 3, name: 'Tires Change', icon: require('../assets/icons/tyre.png') },
  { id: 4, name: 'Gear Oil', icon: require('../assets/icons/oil.png') },
  { id: 5, name: 'Brake Pads', icon: require('../assets/icons/break.png') },
  { id: 6, name: 'Full Body Servicing', icon: require('../assets/icons/service.png') },
];

// Static requires hoisted out of render so we don't call require() every pass.
// Icons are tinted per status at render time, so one asset serves both themes.
const DOC_ICON = require('../assets/icons/document.png');
const FALLBACK_ICON = require('../assets/icons/serviceBlack.png');

// Shared soft card shadow (theme/tokens).
const cardShadow = shadowSoft(1.5);

// ---- Sorting -------------------------------------------------------------

// Most urgent first: services with a next-due date by that date (overdue
// naturally floats to the top), then completed ones newest-first.
const sortServices = (list) =>
  [...list].sort((a, b) => {
    const na = toMillis(a.nextServiceDate);
    const nb = toMillis(b.nextServiceDate);
    if (na !== null && nb !== null) return na - nb;
    if (na !== null) return -1;
    if (nb !== null) return 1;

    const da = toMillis(a.serviceDate);
    const db = toMillis(b.serviceDate);
    if (da === null && db === null) return 0;
    if (da === null) return 1;
    if (db === null) return -1;
    return db - da;
  });

// Sorted by EXPIRY so overdue / due-soon items stay at the top.
const sortDocuments = (list) =>
  [...list].sort((a, b) => {
    const ta = toMillis(a.expiryDate) ?? toMillis(a.issueDate);
    const tb = toMillis(b.expiryDate) ?? toMillis(b.issueDate);
    if (ta === null && tb === null) return 0;
    if (ta === null) return 1;
    if (tb === null) return -1;
    return ta - tb;
  });

// ---- Skeleton (module scope so it isn't recreated every render) ----------

const SkeletonRow = ({ colors }) => (
  <View style={[styles.skeletonCard, cardShadow, { backgroundColor: colors?.cardBg || '#fff' }]}>
    <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center', flex: 1 }}>
      <View style={[styles.skeletonIcon, { backgroundColor: colors?.skeleton || '#E3E3E3' }]} />
      <View style={{ gap: 8 }}>
        <View style={[styles.skeletonLineLong, { backgroundColor: colors?.skeleton || '#E3E3E3' }]} />
        <View style={[styles.skeletonLineShort, { backgroundColor: colors?.skeleton || '#E3E3E3' }]} />
      </View>
    </View>
    <View style={[styles.skeletonAction, { backgroundColor: colors?.skeleton || '#E3E3E3' }]} />
  </View>
);

const SkeletonList = ({ colors }) => (
  <View style={{ marginTop: 4 }}>
    {[0, 1, 2, 3, 4, 5].map((i) => (
      <View key={i} style={{ marginTop: i === 0 ? 0 : 12 }}>
        <SkeletonRow colors={colors} />
      </View>
    ))}
  </View>
);

// ---------------------------------------------------------------------------

const ServicesDcumentlist = ({
  category,
  filter = 'all', // 'all' | 'overdue' | 'upcoming' | 'done'
  setAddServiceModal,
  refreshTrigger,
  AddDocumentModal,
  setAddDocumentModal,
  AddFuelLogModal,
  setAddFuelLogModal,
  onLoadingChange, // 👈 lets the parent hide its floating "+" while the list loads
  onStatsChange, // 👈 { services, documents, fuel } bucket counts for the parent's stat tiles + filter chips (null while loading)
  onDataChanged, // 👈 lets the parent refresh anything derived from services/documents (e.g. upcoming reminders)
}) => {
  const { userEmail, selectedCar } = useSelector((state) => state.user);
  const { theme } = useSelector((state) => state.theme);
  const isDark = theme === 'dark';

  const c = useMemo(
    () => ({
      cardBg: isDark ? 'rgba(4, 25, 51, 1)' : '#fff',
      cardBorder: isDark ? accent.lightAlpha(0.20) : 'rgba(15,31,61,0.06)',
      selectedBorder: isDark ? accent.primary : accent.primary,
      text: isDark ? themecolors.white : '#0F1F3D',
      muted: isDark ? 'rgba(255,255,255,0.55)' : '#64748B',
      emptyText: isDark ? accent.softAlpha(0.6) : accent.alpha(0.55),
      emptyIconWell: isDark ? accent.lightAlpha(0.10) : accent.alpha(0.06),
      skeleton: isDark ? 'rgba(255,255,255,0.12)' : '#E3E3E3',
      editBg: accent.tint,
      deleteBg: isDark ? 'rgba(255,156,144,0.16)' : '#FDECEA',
      deleteIcon: isDark ? '#FF9C90' : '#C62828',

      status: {
        danger: {
          text: isDark ? '#FF9C90' : '#B91C1C',
          bg: isDark ? 'rgba(229,72,77,0.16)' : '#FDECEC',
          well: isDark ? 'rgba(229,72,77,0.16)' : '#FDEEEE',
        },
        warning: {
          text: isDark ? '#FFD180' : '#B45309',
          bg: isDark ? 'rgba(245,165,36,0.16)' : '#FEF3E2',
          well: isDark ? 'rgba(245,165,36,0.16)' : '#FEF4E4',
        },
        success: {
          text: isDark ? '#9CE6B0' : '#15803D',
          bg: isDark ? 'rgba(43,170,109,0.16)' : '#E6F6EC',
          well: isDark ? 'rgba(43,170,109,0.16)' : '#E9F7EF',
        },
        neutral: {
          text: isDark ? 'rgba(255,255,255,0.6)' : '#64748B',
          bg: isDark ? 'rgba(255,255,255,0.08)' : '#EEF2F7',
          well: isDark ? 'rgba(255,255,255,0.08)' : '#EEF2F7',
        },
      },
    }),
    [isDark],
  );

  const [services, setServices] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [fuelLogs, setFuelLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedCard, setSelectedCard] = useState(false);
  const [updateData, setUpdateData] = useState(null);
  const [forView, setForView] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [DocumentUpdateModal, setDocumentUpdateModal] = useState(false);
  const [ServiceUpdateModal, setServiceUpdateModal] = useState(false);
  const [FuelUpdateModal, setFuelUpdateModal] = useState(false);
  const [fuelData, setFuelData] = useState(null);
  const [forFuelView, setForFuelView] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [refreshTriggerdoc, setRefreshTriggerdoc] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  // Which vehicle the current lists belong to. The skeleton is only for a
  // vehicle we haven't shown yet; refreshes of the same vehicle are silent so
  // the list (and scroll position) doesn't flash away.
  const loadedKeyRef = useRef(null);
  // Re-read on focus so a currency change in Settings shows up immediately.
  const isFocused = useIsFocused();
  const { symbol: currencySymbol, fxRate } = useCurrency(isFocused);

  const isFuelCategory = category?.toLowerCase?.() === 'fuel';
  const isServiceCategory =
    !isFuelCategory &&
    (category?.toLowerCase?.() === 'service' ||
      category?.toLowerCase?.() === 'services');

  const listData = isFuelCategory ? fuelLogs : isServiceCategory ? services : documents;

  const visibleData = useMemo(() => {
    // Fuel logs are a plain history, not due-dated records — there's no
    // overdue/upcoming/done bucket to filter by, so "All" is the only view.
    if (isFuelCategory || filter === 'all') return listData;
    const bucketOf = isServiceCategory ? getServiceBucket : getDocumentBucket;
    return listData.filter((item) => bucketOf(item) === filter);
  }, [listData, filter, isServiceCategory, isFuelCategory]);

  // Skip the mount-time fire — the parent's own effects already cover initial load.
  const dataChangedMounted = useRef(false);
  useEffect(() => {
    if (!dataChangedMounted.current) {
      dataChangedMounted.current = true;
      return;
    }
    onDataChanged?.();
  }, [refreshTriggerdoc, onDataChanged]);

  // Report loading up so the parent's floating button can be gated on it.
  useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  // Report bucket counts for BOTH lists so the parent's stat tiles and filter
  // chips are derived from the exact records this component renders.
  useEffect(() => {
    if (loading) {
      onStatsChange?.(null);
      return;
    }
    onStatsChange?.({
      services: countServiceBuckets(services),
      documents: countDocumentBuckets(documents),
      // Fuel logs have no due-date buckets — only "all" is meaningful, but the
      // shape matches services/documents so the parent's generic `.all` gating
      // (e.g. the FAB's empty-list check) works the same for every category.
      fuel: { all: fuelLogs.length, overdue: 0, upcoming: 0, done: 0 },
    });
  }, [loading, services, documents, fuelLogs, onStatsChange]);

  // `category` is deliberately not a dependency: all three lists are fetched
  // together, so switching tabs needs no refetch.
  useEffect(() => {
    const key = `${userEmail}|${selectedCar}`;
    const isNewVehicle = loadedKeyRef.current !== key;
    if (isNewVehicle) {
      setServices([]);
      setDocuments([]);
      setFuelLogs([]);
      setLoading(true);
    }
    setLoadError(false);

    let isCancelled = false;

    const fetchData = async () => {
      try {
        const [res, documentData, fuelRes] = await Promise.all([
          fetchServicesByid(userEmail, selectedCar),
          fetchDocumentssByid(userEmail, selectedCar),
          fetchFuelLogsById(userEmail, selectedCar),
        ]);

        if (!isCancelled) {
          setServices(sortServices(res || []));
          setDocuments(sortDocuments(documentData || []));
          setFuelLogs(computeFuelEfficiency(fuelRes || [], res || []));
          loadedKeyRef.current = key;
        }
      } catch (error) {
        if (!isCancelled) {
          console.error('Error fetching services/documents/fuel logs:', error);
          setLoadError(true);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    if (userEmail && selectedCar) {
      fetchData();
    } else {
      setLoading(false);
    }

    return () => {
      isCancelled = true;
    };
  }, [selectedCar, userEmail, refreshTrigger, refreshTriggerdoc, retryKey]);

  const getServiceIcon = useCallback((name) => {
    const match = SERVICE_NAME.find((item) => item.name === name);
    return match ? match.icon : null;
  }, []);

  const formatDate = useCallback((dateValue) => {
    const ms = toMillis(dateValue);
    if (ms === null) return 'No date';
    return new Date(ms).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }, []);

  const handleEditPress = useCallback(
    (item, index) => {
      setSelectedId(item.id || index);
      if (isFuelCategory) {
        setFuelData(item);
        setFuelUpdateModal(true);
        return;
      }
      setUpdateData(item);
      if (isServiceCategory) {
        setServiceUpdateModal(true);
      } else {
        setDocumentUpdateModal(true);
      }
    },
    [isServiceCategory, isFuelCategory],
  );

  const handleDeletePress = useCallback(
    (item) => {
      if (!item.id) {
        Alert.alert('Cannot delete', 'This record is missing an id.');
        return;
      }

      const name = isFuelCategory ? item.fuelType : isServiceCategory ? item.name : item.documentName;
      setDeleteTarget({ item, name });
    },
    [isServiceCategory, isFuelCategory],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    const { item } = deleteTarget;

    try {
      setDeletingId(item.id);
      if (isFuelCategory) {
        await deleteUserFuelLog(userEmail, selectedCar, item.id);
        setFuelLogs((prev) => prev.filter((f) => f.id !== item.id));
      } else if (isServiceCategory) {
        await deleteUserService(userEmail, selectedCar, item.id);
        cancelReminder(reminderId('service', item.id));
        setServices((prev) => prev.filter((s) => s.id !== item.id));
      } else {
        await deleteUserDocument(userEmail, selectedCar, item.id);
        cancelReminder(reminderId('document', item.id));
        setDocuments((prev) => prev.filter((d) => d.id !== item.id));
      }
      setRefreshTriggerdoc((prev) => prev + 1);
      setDeleteTarget(null);
    } catch (error) {
      console.error('Delete failed:', error);
      Alert.alert('Error', 'Could not delete this item. Please try again.');
    } finally {
      setDeletingId(null);
    }
  }, [deleteTarget, isServiceCategory, isFuelCategory, userEmail, selectedCar]);

  const handleCardPress = useCallback((id) => {
    setSelectedId(id);
  }, []);

  const handleAddPress = useCallback(() => {
    if (isFuelCategory) {
      setAddFuelLogModal(true);
    } else if (isServiceCategory) {
      setAddServiceModal(true);
    } else {
      setAddDocumentModal(true);
    }
  }, [isServiceCategory, isFuelCategory, setAddServiceModal, setAddDocumentModal, setAddFuelLogModal]);

  const renderItem = (item, index) => {
    const isService = isServiceCategory;
    const title = isFuelCategory ? item.fuelType || 'Fuel' : isService ? item.name : item.documentName;

    // Documents show the ISSUE date (falling back to expiry if none).
    // Services show when they're DUE (falling back to when they were done).
    const dateLabel = isFuelCategory
      ? formatDate(item.date)
      : isService
      ? item.nextServiceDate
        ? `Due ${formatDate(item.nextServiceDate)}`
        : `Done ${formatDate(item.serviceDate)}`
      : formatDate(item.issueDate || item.expiryDate);

    const itemId = item.id || index;
    const isSelected = selectedId === itemId && selectedCard;
    const isBusy = deletingId === item.id;

    const status = isFuelCategory
      ? { label: item.fullTank ? 'Full tank' : 'Partial fill', tone: 'neutral' }
      : isService
      ? getServiceStatus(item)
      : getDocumentStatus(item);
    const statusColors = c.status[status.tone];

    // Fuel logs always get a second badge with the mileage.
    const mileage = isFuelCategory && item.efficiency != null
      ? { label: `${item.efficiency.toFixed(1)} ${efficiencyUnit(item.fuelType)}`, tone: 'success' }
      : null;
    const mileageColors = mileage ? c.status[mileage.tone] : null;

    const a11yName = title || 'Unnamed';
    const a11yLabel = [a11yName, dateLabel, status.label, mileage?.label].filter(Boolean).join(', ');

    return (
      <TouchableOpacity
        key={item.id?.toString?.() || index.toString()}
        activeOpacity={0.75}
        disabled={isBusy}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        accessibilityHint="Opens details"
        accessibilityState={{ selected: isSelected, busy: isBusy }}
        onPress={() => {
          handleCardPress(itemId);
          setSelectedCard(true);
          if (isFuelCategory) {
            setFuelData(item);
            setForFuelView(true);
          } else {
            setForView(true);
            handleEditPress(item, index);
          }
        }}
        style={[
          styles.card,
          cardShadow,
          {
            opacity: isBusy ? 0.5 : 1,
            backgroundColor: c.cardBg,
            borderColor: isSelected ? c.selectedBorder : c.cardBorder,
          },
        ]}
      >
        <View style={[styles.iconWell, { backgroundColor: statusColors.well }]}>
          {isFuelCategory ? (
            <FuelIcon color={statusColors.text} size={22} />
          ) : (
            <Image
              source={(isService ? getServiceIcon(item.name) : DOC_ICON) || FALLBACK_ICON}
              style={[styles.icon, { tintColor: statusColors.text }]}
            />
          )}
        </View>

        <View style={styles.textBlock}>
          <Text numberOfLines={1} style={[styles.title, { color: c.text }]}>
            {title || 'Unnamed'}
          </Text>
          <Text numberOfLines={1} style={[styles.date, { color: c.muted }]}>
            {dateLabel}
            {isFuelCategory && !!item.totalCost
              ? ` · ${currencySymbol} ${(item.totalCost * fxRate).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
              : ''}
          </Text>
          <View style={styles.badgeRow}>
            <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
              <Text numberOfLines={1} maxFontSizeMultiplier={1.5} style={[styles.statusText, { color: statusColors.text }]}>
                {status.label}
              </Text>
            </View>
            {mileage && (
              <View style={[styles.statusBadge, { backgroundColor: mileageColors.bg }]}>
                <Text numberOfLines={1} maxFontSizeMultiplier={1.5} style={[styles.statusText, { color: mileageColors.text }]}>
                  {mileage.label}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            onPress={() => {
              setForView(false);
              handleEditPress(item, index);
            }}
            disabled={isBusy}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${a11yName}`}
            style={[styles.actionButton, { backgroundColor: c.editBg }]}
          >
            <EditIcon />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleDeletePress(item)}
            disabled={isBusy}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${a11yName}`}
            style={[styles.actionButton, { backgroundColor: c.deleteBg }]}
          >
            <TrashIcon color={c.deleteIcon} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.listContainer}>
        <SkeletonList colors={c} />
      </View>
    );
  }

  const hasAnyData = services.length + documents.length + fuelLogs.length > 0;
  const retry = () => setRetryKey((k) => k + 1);

  return (
    <View style={styles.listContainer}>
      {loadError && (
        <ErrorState
          compact={hasAnyData}
          title={hasAnyData ? "Couldn't refresh" : "Couldn't load your records"}
          message={
            hasAnyData
              ? 'Showing what was loaded earlier. Check your connection.'
              : "Your records weren't deleted — we just couldn't reach the server."
          }
          onRetry={retry}
        />
      )}

      {!loadError && listData.length === 0 && (
        <View style={styles.emptyContentContainer}>
          <View style={[styles.emptyIconWell, { backgroundColor: c.emptyIconWell }]}>
            <NotFound />
          </View>
          <View style={{ gap: 6 }}>
            <Text style={[styles.titleText, { color: c.text }]}>
              {isFuelCategory ? 'No fuel logs yet' : isServiceCategory ? 'No service records yet' : 'No documents yet'}
            </Text>
            <Text style={[styles.descriptionText, { color: c.emptyText }]}>
              {isFuelCategory
                ? 'Log a fill-up to start tracking cost and efficiency.'
                : isServiceCategory
                ? 'Add a record to keep your maintenance history up to date.'
                : 'Upload your documents to keep your vehicle organised.'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleAddPress}
            activeOpacity={0.85}
            accessibilityRole="button"
            style={[styles.button, cardShadow]}
          >
            <PlusStroke color="#fff" size={18} />
            <Text style={styles.buttonText}>
              {isFuelCategory ? 'Log fuel' : isServiceCategory ? 'Add service record' : 'Add document'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {listData.length > 0 && visibleData.length === 0 && (
        <View style={styles.filteredEmpty}>
          <Text style={[styles.descriptionText, { color: c.muted }]}>
            {isFuelCategory
              ? 'No fuel logs match this filter.'
              : isServiceCategory
              ? 'No services match this filter.'
              : 'No documents match this filter.'}
          </Text>
        </View>
      )}

      {visibleData.length > 0 && (
        <View>{visibleData.map((item, index) => renderItem(item, index))}</View>
      )}

      <DocumentUpdate
        forView={forView}
        setForView={setForView}
        setSelectedCard={setSelectedCard}
        updateData={updateData}
        DocumentUpdateModal={DocumentUpdateModal}
        setDocumentUpdateModal={setDocumentUpdateModal}
        onDocumentUpdated={() => setRefreshTriggerdoc((prev) => prev + 1)}
      />

      <ServiceUpdate
        forView={forView}
        setForView={setForView}
        setSelectedCard={setSelectedCard}
        updateData={updateData}
        ServiceUpdateModal={ServiceUpdateModal}
        setServiceUpdateModal={setServiceUpdateModal}
        onServiceUpdated={() => setRefreshTriggerdoc((prev) => prev + 1)}
      />

      <AddDocument
        AddDocumentModal={AddDocumentModal}
        setAddDocumentModal={setAddDocumentModal}
        onDocumentAdded={() => setRefreshTriggerdoc((prev) => prev + 1)}
      />

      <AddFuelLog
        AddFuelLogModal={AddFuelLogModal}
        setAddFuelLogModal={setAddFuelLogModal}
        onFuelLogAdded={() => setRefreshTriggerdoc((prev) => prev + 1)}
      />

      <ViewFuelModal
        fuelData={fuelData}
        setFuelData={setFuelData}
        forFuelView={forFuelView}
        setForFuelView={setForFuelView}
        setIsSelected={setSelectedCard}
      />

      <FuelUpdate
        FuelUpdateModal={FuelUpdateModal}
        setFuelUpdateModal={setFuelUpdateModal}
        updateData={fuelData}
        onFuelLogUpdated={() => setRefreshTriggerdoc((prev) => prev + 1)}
        setSelectedCard={setSelectedCard}
      />

      <ConfirmDeleteModal
        visible={!!deleteTarget}
        title={isFuelCategory ? 'Delete fuel log' : isServiceCategory ? 'Delete service record' : 'Delete document'}
        itemName={deleteTarget?.name}
        loading={!!deleteTarget && deletingId === deleteTarget.item.id}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </View>
  );
};

export default ServicesDcumentlist;

const styles = StyleSheet.create({
  listContainer: {
    width: '100%',
  },
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
  filteredEmpty: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  card: {
    // Height comes from content. A '100%' height here collapses the card to
    // nothing because the parent ScrollView content has no fixed height.
    minHeight: 84,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingLeft: 14,
    paddingRight: 12,
    borderRadius: 20,
    borderWidth: 1,
    marginHorizontal: 2,
    gap: 14,
  },
  iconWell: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
  },
  textBlock: {
    gap: 3,
    flex: 1,
    minWidth: 0, // let long titles truncate instead of pushing the actions off-screen
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 14,
    fontFamily: 'RobotoCondensed500',
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  date: {
    fontSize: 12,
    fontFamily: 'RobotoCondensed400',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    maxWidth: '100%',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    maxWidth: '100%',
  },
  statusText: {
    fontSize: 11,
    fontFamily: 'RobotoCondensed400',
    flexShrink: 1,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    marginTop: 4,
    minHeight: 48,
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
  skeletonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingLeft: 14,
    paddingRight: 12,
    borderRadius: 20,
    marginHorizontal: 2,
    overflow: 'hidden',
  },
  skeletonIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
  },
  skeletonLineLong: {
    width: 130,
    height: 10,
    borderRadius: 10,
  },
  skeletonLineShort: {
    width: 80,
    height: 10,
    borderRadius: 10,
  },
  skeletonAction: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
});
