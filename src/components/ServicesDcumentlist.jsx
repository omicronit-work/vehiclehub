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
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Text from './ui/AppText';

import NotFound from '../assets/svg/NotFound.jsx';
import FuelLogCard from './FuelLogCard.jsx';
import AddDocument from '../modals/AddDocument.jsx';
import DocumentUpdate from '../modals/DocumentUpdate.jsx';
import ServiceUpdate from '../modals/ServiceUpdate.jsx';
import AddFuelLog from '../modals/AddFuelLog.jsx';
import ViewFuelModal from '../modals/ViewFuelModal.jsx';
import FuelUpdate from '../modals/FuelUpdate.jsx';
import ConfirmDeleteModal from '../modals/ConfirmDeleteModal.jsx';
import ErrorState from './ui/ErrorState.jsx';
import SkeletonBlock from './ui/SkeletonBlock.jsx';
import { useDispatch, useSelector } from 'react-redux';
import { fetchDocumentssByid, fetchServicesByid, fetchFuelLogsById } from '../store/fetchSlice.js';
import { deleteUserRecord, bumpRecordsVersion } from '../store/userSlice.js';
import { showUndo } from './ui/UndoSnackbar.jsx';
import { cancelReminder, reminderId } from '../util/notifications.js';
import { themecolors } from '../styles/themecolors.js';
import {
  getServiceStatus,
  getDocumentStatus,
  formatDate,
  documentDateLabel,
  sortDocuments,
  sortServices,
} from '../util/dateStatus.js';
import { computeFuelEfficiency, fuelBadge } from '../util/fuelEfficiency.js';
import { formatRecordMoney, useCurrency } from '../util/methods/useCurrency';
import { serviceLabel } from '../util/serviceFields';
import { recordLabel } from '../util/recordSummary';
import { useDistanceUnit } from '../util/schedule/scheduleSettings';
import {
  getServiceBucket,
  getDocumentBucket,
  countServiceBuckets,
  countDocumentBuckets,
} from '../util/statusBuckets.js';
import { accent } from '../theme/accent';
import ServiceTypeIcon from '../assets/svg/ServiceTypeIcon';
import DocumentTypeIcon from '../assets/svg/DocumentTypeIcon';
import { ExpiredStatIcon, ScheduleSummaryCard, SectionLabel, ValidStatIcon } from './schedule/ScheduleParts';
import { useScheduleHost } from '../util/schedule/scheduleHostContext';
import { statusTones } from '../theme/statusTones';
import StatusChip from './StatusChip';
import { toMillis } from '../util/dateStatus.js';
import { fuelDisplayName } from '../util/fuelTypes';
import { t as tr } from '../i18n';
import { documentLabel } from '../util/documentFields';



// Static requires hoisted out of render so we don't call require() every pass.
// Icons are tinted per status at render time, so one asset serves both themes.

// A cold-start Firestore read on a slow network routinely takes 10s+, so a
// slow load first gets a hint under the skeleton; only a much longer wait
// (or a real error) switches to the retry state.
const SLOW_HINT_MS = 8000;
const LOAD_TIMEOUT_MS = 30000;

// Last-loaded lists per `${email}|${vehicleId}`, kept for the session so
// returning to a vehicle (or remounting Home) shows its records instantly
// while a silent refresh runs, instead of a skeleton on every switch.
const listCache = new Map();

// Shared soft card shadow (theme/tokens).
const cardShadow = shadowSoft(1.5);

// ---- Skeleton (module scope so it isn't recreated every render) ----------

const SKELETON = {
  icon: { width: 48, height: 48, borderRadius: 14 },
  lineLong: { width: 130, height: 10, borderRadius: 10 },
  lineShort: { width: 80, height: 10, borderRadius: 10 },
  action: { width: 44, height: 44, borderRadius: 22 },
};

const SkeletonRow = ({ colors }) => (
  <View style={[styles.skeletonCard, cardShadow, { backgroundColor: colors?.cardBg || '#fff' }]}>
    <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center', flex: 1 }}>
      <SkeletonBlock {...SKELETON.icon} />
      <View style={{ gap: 8 }}>
        <SkeletonBlock {...SKELETON.lineLong} />
        <SkeletonBlock {...SKELETON.lineShort} />
      </View>
    </View>
    <SkeletonBlock {...SKELETON.action} />
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

// Shortest time an edited card shows its skeleton (matches the detail screens).
const EDIT_SKELETON_MIN_MS = 600;

const ServicesDcumentlist = ({
  category,
  filter = 'all', // 'all' | 'overdue' | 'upcoming' | 'done'
  setAddServiceModal,
  refreshTrigger,
  savedTrigger, // bumped by the parent after it saves a record, so the reload shows a loader
  AddDocumentModal,
  setAddDocumentModal,
  AddFuelLogModal,
  setAddFuelLogModal,
  onLoadingChange, // 👈 lets the parent hide its floating "+" while the list loads
  onStatsChange, // 👈 { services, documents, fuel } bucket counts for the parent's stat tiles + filter chips (null while loading)
  onDataChanged, // 👈 lets the parent refresh anything derived from services/documents (e.g. upcoming reminders)
}) => {
  const { userEmail, selectedCar } = useSelector((state) => state.user);
  // Re-renders when the currency changes, so amounts show the new symbol.
  useCurrency();
  const dispatch = useDispatch();
  const { theme } = useSelector((state) => state.theme);
  const isDark = theme === 'dark';

  const c = useMemo(
    () => ({
      cardBg: isDark ? 'rgba(4, 25, 51, 1)' : '#fff',
      cardBorder: isDark ? accent.lightAlpha(0.20) : 'rgba(15,31,61,0.06)',
      selectedBorder: isDark ? accent.primary : accent.primary,
      text: isDark ? themecolors.white : '#0F1F3D',
      muted: isDark ? 'rgba(255,255,255,0.55)' : '#64748B',
      // Body text, not a hint: must stay readable (≥ 4.5:1) on the page.
      emptyText: isDark ? 'rgba(255,255,255,0.68)' : 'rgba(4,25,51,0.62)',
      emptyIconWell: isDark ? accent.lightAlpha(0.10) : accent.alpha(0.06),
      editBg: isDark ? accent.lightAlpha(0.16) : accent.tint,
      deleteBg: isDark ? 'rgba(255,156,144,0.16)' : '#FDECEA',
      deleteIcon: isDark ? '#FF9C90' : '#C62828',

      status: statusTones(isDark),
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
  // True while reloading after an add/edit, so the user sees a loader instead
  // of a stale (or empty) list during the round trip.
  const [refreshing, setRefreshing] = useState(false);
  const refreshAfterSave = useCallback(() => {
    setRefreshing(true);
    setRefreshTriggerdoc((prev) => prev + 1);
  }, []);
  // The record just edited: only its row shows a skeleton while the list
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
  const refreshAfterEdit = useCallback((id) => {
    if (id) {
      editStartedRef.current = Date.now();
      setEditedId(id);
    }
    refreshAfterSave();
  }, [refreshAfterSave]);
  const [loadError, setLoadError] = useState(false);
  const [slowLoad, setSlowLoad] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  // Which vehicle the current lists belong to. The skeleton is only for a
  // vehicle we haven't shown yet; refreshes of the same vehicle are silent so
  // the list (and scroll position) doesn't flash away.
  const loadedKeyRef = useRef(null);
  // Re-read on focus so a currency change in Settings shows up immediately.
  const distUnit = useDistanceUnit();

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

  // Home → Documents mirrors Home → Services: a summary card, then the
  // papers that need renewing (expired / expiring, soonest first), then the
  // rest. Null for the other tabs or while there's nothing to show.
  const documentsView = useMemo(() => {
    if (isFuelCategory || isServiceCategory || documents.length === 0) return null;
    const needsRenewal = d => ['danger', 'warning'].includes(getDocumentStatus(d).tone);
    const expired = documents.filter(d => getDocumentStatus(d).tone === 'danger').length;
    const soon = documents.filter(d => getDocumentStatus(d).tone === 'warning').length;
    const parts = [expired && tr('list.expiredCount', { n: expired }), soon && tr('list.expiringCount', { n: soon })].filter(Boolean);
    return {
      text: parts.length ? parts.join(' · ') : tr('list.allUpToDate'),
      // Summary card counts: expired vs. everything still valid (incl. expiring soon).
      stats: [
        { key: 'expired', label: tr('filter.expired'), value: expired, icon: color => <ExpiredStatIcon color={color} /> },
        { key: 'valid', label: tr('filter.valid'), value: documents.length - expired, icon: color => <ValidStatIcon color={color} /> },
      ],
      renew: visibleData
        .filter(needsRenewal)
        .sort((a, b) => (toMillis(a.expiryDate) ?? 0) - (toMillis(b.expiryDate) ?? 0)),
      valid: visibleData.filter(d => !needsRenewal(d)),
    };
  }, [documents, visibleData, isFuelCategory, isServiceCategory]);

  // Home's ScheduleHost, so a document opens as a page inside Home.
  const scheduleHost = useScheduleHost();
  const showDocumentsHeader = !isFuelCategory && !isServiceCategory && !loadError;

  const savedMounted = useRef(false);
  useEffect(() => {
    if (!savedMounted.current) {
      savedMounted.current = true;
      return;
    }
    refreshAfterSave();
  }, [savedTrigger, refreshAfterSave]);

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
      const cached = listCache.get(key);
      setServices(cached?.services || []);
      setDocuments(cached?.documents || []);
      setFuelLogs(cached?.fuelLogs || []);
      setLoading(!cached);
      if (cached) loadedKeyRef.current = key;
    }
    setLoadError(false);
    setSlowLoad(false);

    let isCancelled = false;

    const hintTimer = setTimeout(() => {
      if (!isCancelled) setSlowLoad(true);
    }, SLOW_HINT_MS);

    // A slow or offline Firestore read must not leave the skeleton up
    // indefinitely: after a while show the retry state instead. If the data
    // arrives later it still replaces it.
    const slowTimer = setTimeout(() => {
      if (isCancelled) return;
      setLoading(false);
      setRefreshing(false);
      setLoadError(true);
    }, LOAD_TIMEOUT_MS);

    const fetchData = async () => {
      try {
        const [res, documentData, fuelRes] = await Promise.all([
          fetchServicesByid(userEmail, selectedCar),
          fetchDocumentssByid(userEmail, selectedCar),
          fetchFuelLogsById(userEmail, selectedCar),
        ]);

        const lists = {
          services: sortServices(res || []),
          documents: sortDocuments(documentData || []),
          fuelLogs: computeFuelEfficiency(fuelRes || []),
        };
        listCache.set(key, lists);
        if (!isCancelled) {
          setServices(lists.services);
          setDocuments(lists.documents);
          setFuelLogs(lists.fuelLogs);
          setLoadError(false);
          loadedKeyRef.current = key;
        }
      } catch (error) {
        if (!isCancelled) {
          console.error('Error fetching services/documents/fuel logs:', error);
          setLoadError(true);
        }
      } finally {
        clearTimeout(hintTimer);
        clearTimeout(slowTimer);
        if (!isCancelled) {
          setLoading(false);
          setRefreshing(false);
          setSlowLoad(false);
        }
      }
    };

    if (userEmail && selectedCar) {
      fetchData();
    } else {
      clearTimeout(hintTimer);
      clearTimeout(slowTimer);
      setLoading(false);
      setRefreshing(false);
    }

    return () => {
      isCancelled = true;
      clearTimeout(hintTimer);
      clearTimeout(slowTimer);
    };
  }, [selectedCar, userEmail, refreshTrigger, refreshTriggerdoc, retryKey]);

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
        Alert.alert(tr('Cannot delete'), tr('This record is missing an id.'));
        return;
      }

      const kind = isFuelCategory ? 'fuel' : isServiceCategory ? 'service' : 'document';
      const name = recordLabel(item, kind, v => formatRecordMoney(item, v));
      setDeleteTarget({ item, name });
    },
    [isServiceCategory, isFuelCategory],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    const { item } = deleteTarget;
    const kind = isFuelCategory ? 'fuel' : isServiceCategory ? 'service' : 'document';

    try {
      setDeletingId(item.id);
      const undo = await deleteUserRecord(userEmail, selectedCar, kind, item.id);
      if (kind === 'fuel') setFuelLogs((prev) => prev.filter((f) => f.id !== item.id));
      else if (kind === 'service') setServices((prev) => prev.filter((s) => s.id !== item.id));
      else setDocuments((prev) => prev.filter((d) => d.id !== item.id));
      // Lets the Dashboard refresh its totals in the background.
      if (kind !== 'document') dispatch(bumpRecordsVersion());
      setRefreshTriggerdoc((prev) => prev + 1);
      setDeleteTarget(null);
      

      // Mis-taps happen even with a confirmation: offer to put it back.
      const deletedKey = kind === 'fuel' ? 'list.fuelDeleted' : kind === 'service' ? 'list.serviceDeleted' : 'list.documentDeleted';
      if (undo) {
        showUndo({
          message: tr(deletedKey),
          onUndo: () => {
            undo();
            dispatch(bumpRecordsVersion());
            setRefreshTriggerdoc((prev) => prev + 1);
          },
        });
      }
    } catch (error) {
      console.error('Delete failed:', error);
      Alert.alert(tr('Error'), tr('Could not delete this item. Please try again.'));
    } finally {
      setDeletingId(null);
    }
  }, [deleteTarget, isServiceCategory, isFuelCategory, userEmail, selectedCar, dispatch]);

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
    // Just edited: this row alone shows a skeleton until the reload lands.
    if (item.id && item.id === editedId) {
      return (
        <View key={item.id.toString()} style={styles.editedSkeleton} accessibilityLabel={tr('Updating')}>
          <SkeletonRow colors={c} />
        </View>
      );
    }
    const isService = isServiceCategory;
    const title = isFuelCategory ? fuelDisplayName(item) : isService ? serviceLabel(item.name) : documentLabel(item.documentName);

    // Documents show a labelled expiry (or issue) date — see documentDateLabel.
    // Services show when they were done; when they're due next has its own line.
    const dateLabel = isFuelCategory
      ? formatDate(item.date)
      : isService
      ? tr('rec.done', { date: formatDate(item.serviceDate) })
      : documentDateLabel(item);
    // Each record in the currency it was saved in, never converted.
    const money = v => formatRecordMoney(item, v);

    const itemId = item.id || index;
    const isSelected = selectedId === itemId && selectedCard;
    const isBusy = deletingId === item.id;

    const status = isFuelCategory
      ? { label: fuelBadge(item, distUnit), tone: item.efficiency != null ? 'success' : 'neutral' }
      : isService
      ? getServiceStatus(item)
      : getDocumentStatus(item);
    const statusColors = c.status[status.tone];


    const a11yName = title || tr('Unnamed');

    // Services and documents: compact row matching the schedule's Upcoming
    // rows — icon, name, date, status chip. Tap opens details (Edit/Delete
    // live there); long-press deletes directly.
    if (!isFuelCategory) {
      const chipLabel = isService && status.tone === 'success' ? tr('st.completed') : status.label;
      return (
        <TouchableOpacity
          key={item.id?.toString?.() || index.toString()}
          activeOpacity={0.8}
          disabled={isBusy}
          accessibilityRole="button"
          accessibilityLabel={[a11yName, dateLabel, chipLabel].filter(Boolean).join(', ')}
          accessibilityHint={tr('Opens details. Long press to delete.')}
          onPress={() => {
            handleCardPress(itemId);
            // Documents open their own page (like a schedule) inside Home.
            if (!isService && scheduleHost) {
              scheduleHost.navigate('DocumentDetail', {
                vehicleId: selectedCar,
                documentId: item.id,
                document: item,
                onChanged: () => refreshAfterEdit(item.id),
              });
              return;
            }
            setSelectedCard(true);
            setForView(true);
            handleEditPress(item, index);
          }}
          onLongPress={() => handleDeletePress(item)}
          style={[styles.serviceRow, cardShadow, { opacity: isBusy ? 0.5 : 1, backgroundColor: c.cardBg }]}
        >
          <View style={[styles.serviceRowIcon, { backgroundColor: statusColors.well }]}>
            {isService ? (
              <ServiceTypeIcon name={item.name} color={statusColors.text} size={20} />
            ) : (
              <DocumentTypeIcon name={item.documentName} color={statusColors.text} size={20} />
            )}
          </View>
          <View style={styles.textBlock}>
            <Text numberOfLines={1} style={[styles.serviceRowTitle, { color: c.text }]}>
              {a11yName}
            </Text>
            <Text numberOfLines={1} style={[styles.serviceRowSub, { color: c.muted }]}>
              {dateLabel}
            </Text>
          </View>
          <StatusChip label={chipLabel} colors={statusColors} />
        </TouchableOpacity>
      );
    }

    // Fuel logs: shared card, identical to the vehicle detail Fuel tab.
    return (
      <FuelLogCard
        key={item.id?.toString?.() || index.toString()}
        item={item}
        money={money}
        distUnit={distUnit}
        selected={isSelected}
        busy={isBusy}
        onPress={() => {
          handleCardPress(itemId);
          setSelectedCard(true);
          setFuelData(item);
          setForFuelView(true);
        }}
        onEdit={() => {
          setForView(false);
          handleEditPress(item, index);
        }}
        onDelete={() => handleDeletePress(item)}
      />
    );
  };

  const showSkeleton = loading || (refreshing && listData.length === 0);
  const hasAnyData = services.length + documents.length + fuelLogs.length > 0;
  const retry = () => setRetryKey((k) => k + 1);

  // One return, with the modals at the end in both states: they stay mounted
  // during the skeleton, so Add → Fuel / Document opens at once while the list
  // loads and a sheet isn't torn down mid-close by the reload after a save.
  return (
    <View style={styles.listContainer}>
      {showSkeleton ? (
        <>
          {slowLoad && (
            <View style={styles.refreshingRow} accessibilityLiveRegion="polite">
              <ActivityIndicator size="small" color={c.muted} />
              <Text style={[styles.refreshingText, { color: c.muted }]}>
                {tr('Still loading — your connection seems slow…')}
              </Text>
            </View>
          )}
          <SkeletonList colors={c} />
        </>
      ) : (
      <>
      {refreshing && !editedId && (
        <View style={styles.refreshingRow} accessibilityLiveRegion="polite">
          <ActivityIndicator size="small" color={c.muted} />
          <Text style={[styles.refreshingText, { color: c.muted }]}>{tr('Updating…')}</Text>
        </View>
      )}

      {loadError && (
        <ErrorState
          compact={hasAnyData}
          title={hasAnyData ? tr('list.refreshError') : tr('list.loadError')}
          message={hasAnyData ? tr('list.staleHint') : tr('list.notDeletedHint')}
          onRetry={retry}
        />
      )}

      {/* Documents: summary card first, like the schedule card on Services —
          also while the list is empty, with the empty state under DOCUMENTS. */}
      {showDocumentsHeader && (
        <>
          <View style={styles.docSummaryWrap}>
            <ScheduleSummaryCard
              title={tr('list.docRenewals')}
              text={documentsView?.text ?? tr('list.addPapers')}
              stats={documentsView?.stats}
              actionLabel={documents.length ? tr('home.add') : tr('sched.setUp')}
              total={documents.length}
              counts={{}}
              icon={color => <DocumentTypeIcon icon="document" color={color} size={20} />}
              onPress={handleAddPress}
            />
          </View>
          {documents.length === 0 && (
            <SectionLabel style={styles.docSectionLabel}>{tr('cat.documents').toUpperCase()}</SectionLabel>
          )}
        </>
      )}

      {!loadError && listData.length === 0 && (
        <View style={styles.emptyContentContainer}>
          <View style={[styles.emptyIconWell, { backgroundColor: c.emptyIconWell }]}>
            <NotFound />
          </View>
          <View style={{ gap: 6 }}>
            <Text style={[styles.titleText, { color: c.text }]}>
              {isFuelCategory ? tr('list.noFuel') : isServiceCategory ? tr('list.noService') : tr('list.noDocs')}
            </Text>
            <Text style={[styles.descriptionText, { color: c.emptyText }]}>
              {isFuelCategory ? tr('list.noFuelHint') : isServiceCategory ? tr('list.noServiceHint') : tr('list.noDocsHint')}
            </Text>
          </View>
        </View>
      )}

      {listData.length > 0 && visibleData.length === 0 && (
        <View style={styles.filteredEmpty}>
          <Text style={[styles.descriptionText, { color: c.muted }]}>
            {isFuelCategory ? tr('list.noFuelMatch') : isServiceCategory ? tr('list.noServiceMatch') : tr('list.noDocsMatch')}
          </Text>
        </View>
      )}

      {documentsView ? (
        <>
          {documentsView.renew.length > 0 && (
            <>
              <SectionLabel style={styles.docSectionLabel}>{tr('RENEW SOON')}</SectionLabel>
              {documentsView.renew.map((item, index) => renderItem(item, index))}
            </>
          )}
          {documentsView.valid.length > 0 && (
            <>
              <SectionLabel style={styles.docSectionLabel}>{tr('VALID')}</SectionLabel>
              {documentsView.valid.map((item, index) => renderItem(item, documentsView.renew.length + index))}
            </>
          )}
        </>
      ) : (
        visibleData.length > 0 && (
          <View>{visibleData.map((item, index) => renderItem(item, index))}</View>
        )
      )}
      </>
      )}

      <DocumentUpdate
        forView={forView}
        setForView={setForView}
        setSelectedCard={setSelectedCard}
        updateData={updateData}
        DocumentUpdateModal={DocumentUpdateModal}
        setDocumentUpdateModal={setDocumentUpdateModal}
        onDocumentUpdated={() => refreshAfterEdit(updateData?.id)}
        onDelete={(item) => {
          setDocumentUpdateModal(false);
          setSelectedCard(false);
          // Let the details sheet finish closing before the confirm opens —
          // two react-native-modals can't animate at once on iOS.
          setTimeout(() => handleDeletePress(item), 350);
        }}
      />

      <ServiceUpdate
        forView={forView}
        setForView={setForView}
        setSelectedCard={setSelectedCard}
        updateData={updateData}
        ServiceUpdateModal={ServiceUpdateModal}
        setServiceUpdateModal={setServiceUpdateModal}
        onServiceUpdated={() => refreshAfterEdit(updateData?.id)}
        onDelete={(item) => {
          setServiceUpdateModal(false);
          setSelectedCard(false);
          // Let the details sheet finish closing before the confirm opens —
          // two react-native-modals can't animate at once on iOS.
          setTimeout(() => handleDeletePress(item), 350);
        }}
      />

      <AddDocument
        AddDocumentModal={AddDocumentModal}
        setAddDocumentModal={setAddDocumentModal}
        onDocumentAdded={refreshAfterSave}
      />

      <AddFuelLog
        AddFuelLogModal={AddFuelLogModal}
        setAddFuelLogModal={setAddFuelLogModal}
        onFuelLogAdded={refreshAfterSave}
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
        onFuelLogUpdated={() => refreshAfterEdit(fuelData?.id)}
        setSelectedCard={setSelectedCard}
      />

      <ConfirmDeleteModal
        visible={!!deleteTarget}
        title={isFuelCategory ? tr('list.deleteFuel') : isServiceCategory ? tr('list.deleteService') : tr('list.deleteDocument')}
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
  refreshingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  refreshingText: {
    fontSize: 13,
    fontFamily: 'RobotoCondensed400',
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
    gap: 14,
  },
  docSummaryWrap: { marginTop: 14 },
  docSectionLabel: { marginTop: 18, marginBottom: 2 },
  serviceRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
  },
  serviceRowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceRowTitle: {
    fontSize: 16,
    fontFamily: 'RobotoCondensed500',
    fontWeight: '700',
  },
  serviceRowSub: {
    fontSize: 13,
    fontFamily: 'RobotoCondensed400',
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
  editedSkeleton: {
    marginTop: 10,
  },
  skeletonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingLeft: 14,
    paddingRight: 12,
    borderRadius: 20,
    overflow: 'hidden',
  },
});
