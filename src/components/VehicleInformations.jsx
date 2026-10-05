import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { shadowSoft } from '../theme/tokens';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  Animated,
  Alert,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSelector } from 'react-redux';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchDocumentssByid, fetchServicesByid, fetchFuelLogsById } from '../store/fetchSlice';
// Adjust this path if deleteUserService / deleteUserDocument live elsewhere.
import { deleteUserService, deleteUserDocument, deleteUserFuelLog } from '../store/userSlice.js';
import { themecolors } from '../styles/themecolors.js';
import { toMillis, getServiceStatus, getDocumentStatus } from '../util/dateStatus.js';
import { getMileageStatus } from '../util/mileageStatus.js';
import { computeFuelEfficiency, efficiencyUnit } from '../util/fuelEfficiency.js';
import { useCurrency } from '../util/methods/useCurrency';
import { useReduceMotion } from '../util/methods/useReduceMotion';
import ErrorState from './ui/ErrorState.jsx';

// SVG Icons
import NotFound from '../assets/svg/NotFound.jsx';
import Vehicle from '../assets/svg/Vehicle.jsx';
import PlusStroke from '../assets/svg/PlusStroke.jsx';
import EditIcon from '../assets/svg/EditIcon.jsx';
import SelectedEditIcon from '../assets/svg/SelectedEditIcon.jsx';
import FuelIcon from '../assets/svg/FuelIcon.jsx';
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

const SERVICE_NAME = [
  { id: 1, name: 'Engine Oil Refill', icon: require('../assets/icons/oil.png'), Wicon: require('../assets/icons/whiteOil.png') },
  { id: 2, name: 'Oil Filter', icon: require('../assets/icons/filter.png'), Wicon: require('../assets/icons/whiteFilter.png') },
  { id: 3, name: 'Tires Change', icon: require('../assets/icons/tyre.png'), Wicon: require('../assets/icons/whiteTyre.png') },
  { id: 4, name: 'Gear Oil', icon: require('../assets/icons/oil.png'), Wicon: require('../assets/icons/whiteOil.png') },
  { id: 5, name: 'Brake Pads', icon: require('../assets/icons/break.png'), Wicon: require('../assets/icons/whiteBreak.png') },
  { id: 6, name: 'Full Body Servicing', icon: require('../assets/icons/service.png'), Wicon: require('../assets/icons/whiteService.png') },
];

const TABS = ['Services', 'Documents', 'Fuel'];


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

// ---- Icons ----------------------------------------------------------------

const TrashIcon = ({ color = '#C62828', size = 18 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M3 6h18" stroke={color} strokeWidth={2} strokeLinecap="round" />
    <Path
      d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path d="M10 11v6M14 11v6" stroke={color} strokeWidth={2} strokeLinecap="round" />
  </Svg>
);

// ─── Sorting ────────────────────────────────────────────────────────────────

const sortServices = (list) =>
  [...list].sort((a, b) => {
    const ta = toMillis(a.serviceDate);
    const tb = toMillis(b.serviceDate);
    if (ta === null && tb === null) return 0;
    if (ta === null) return 1;
    if (tb === null) return -1;
    return tb - ta;
  });

const sortDocuments = (list) =>
  [...list].sort((a, b) => {
    const ta = toMillis(a.expiryDate || a.issueDate);
    const tb = toMillis(b.expiryDate || b.issueDate);
    if (ta === null && tb === null) return 0;
    if (ta === null) return 1;
    if (tb === null) return -1;
    return ta - tb;
  });

// ─────────────────────────────────────────────────────────────────────────────

const VehicleInformations = ({ selectedCar }) => {
  const { userEmail } = useSelector(state => state.user);
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
      skeleton: isDark ? 'rgba(255,255,255,0.12)' : '#E3E3E3',
      fallbackVehicle: isDark ? accent.light : accent.primary,
      iconWell: isDark ? accent.lightAlpha(0.16) : accent.alpha(0.08),
      emptyIconWell: isDark ? accent.lightAlpha(0.10) : accent.alpha(0.06),

      // Segmented toggle — light gray track, white floating pill on the
      // active tab (matches the reference screenshot), blue label when
      // active vs. muted gray when inactive.
      tabTrackBg: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(4, 25, 51, 0.045)',
      tabActiveBg: isDark ? 'rgba(4, 25, 51, 1)' : '#fff',
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

  const [tab, setTab] = useState('Services');
  const [services, setServices] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [fuelLogs, setFuelLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const reduceMotion = useReduceMotion();

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
  // Re-read on focus so a currency change in Settings shows up immediately.
  const isFocused = useIsFocused();
  const { symbol: currencySymbol, fxRate } = useCurrency(isFocused);
  const animatedValue = useRef(new Animated.Value(0.3)).current;

  // One pulse loop while the skeleton shows, stopped when it hides (they used
  // to stack, one per load). Static placeholder under Reduce Motion.
  useEffect(() => {
    if (!loading) return undefined;
    if (reduceMotion) {
      animatedValue.setValue(0.5);
      return undefined;
    }
    const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue, {
            toValue: 0.7,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValue, {
            toValue: 0.3,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      );
    loop.start();
    return () => loop.stop();
  }, [loading, animatedValue, reduceMotion]);

  const isServiceTab = tab === 'Services';
  const isFuelTab = tab === 'Fuel';

  const listData = useMemo(() => {
    if (isServiceTab) return services;
    if (isFuelTab) return fuelLogs;
    return documents;
  }, [isServiceTab, isFuelTab, services, documents, fuelLogs]);

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

  // Keyed on the id (not the object, which is recreated on every refetch).
  // Skeleton only for a vehicle not shown yet; refocusing refreshes silently
  // so records added from another tab appear.
  const carId = typeof selectedCar === 'object' ? selectedCar?.id : selectedCar;
  const loadedCarRef = useRef(null);

  useEffect(() => {
    if (!isFocused) return undefined;
    let isCancelled = false;

    const fetchData = async () => {
      try {
        if (!userEmail || !carId) {
          setLoading(false);
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
          setFuelLogs(computeFuelEfficiency(fuelRes || [], serviceRes || []));
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
        }
      }
    };

    fetchData();

    return () => {
      isCancelled = true;
    };
  }, [carId, userEmail, refreshTrigger, isFocused]);

  const getServiceIcon = useCallback(name => {
    const match = SERVICE_NAME.find(
      item => item.name?.toLowerCase() === name?.toLowerCase(),
    );
    if (!match) {
      return isDark
        ? require('../assets/icons/serviceWhite.png')
        : require('../assets/icons/service.png');
    }
    return isDark ? match.Wicon : match.icon;
  }, [isDark]);

  const formatDate = useCallback(dateValue => {
    const ms = toMillis(dateValue);
    if (ms === null) return 'No date';

    return new Date(ms).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }, []);

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
        Alert.alert('Cannot delete', 'This record is missing an id.');
        return;
      }

      const name = isFuelTab ? item.fuelType : isServiceTab ? item.name : item.documentName;
      setDeleteTarget({ item, name });
    },
    [isServiceTab, isFuelTab],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    const { item } = deleteTarget;

    try {
      setDeletingId(item.id);
      if (isFuelTab) {
        await deleteUserFuelLog(userEmail, carId, item.id);
        setFuelLogs((prev) => prev.filter((f) => f.id !== item.id));
      } else if (isServiceTab) {
        await deleteUserService(userEmail, carId, item.id);
        setServices((prev) => prev.filter((s) => s.id !== item.id));
      } else {
        await deleteUserDocument(userEmail, carId, item.id);
        setDocuments((prev) => prev.filter((d) => d.id !== item.id));
      }
      setDeleteTarget(null);
      clearSelection();
    } catch (error) {
      console.error('Delete failed:', error);
      Alert.alert('Error', 'Could not delete this item. Please try again.');
    } finally {
      setDeletingId(null);
    }
  }, [deleteTarget, isServiceTab, isFuelTab, userEmail, carId, clearSelection]);

  const handleAddPress = useCallback(() => {
    if (isFuelTab) {
      setAddFuelLogModal(true);
    } else if (isServiceTab) {
      setAddServiceModal(true);
    } else {
      setAddDocumentModal(true);
    }
  }, [isServiceTab, isFuelTab]);

  const handleRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
    clearSelection();
  }, [clearSelection]);

  // Skeleton mirrors ServicesDcumentlist's SkeletonRow shape (accent strip +
  // icon well + two lines) instead of a plain card with no strip.
  const renderSkeleton = () => {
    return Array.from({ length: 3 }).map((_, index) => (
      <View
        key={`skeleton-${index}`}
        style={[styles.card, cardShadow, { backgroundColor: c.cardBg, borderWidth: 1, borderColor: c.cardBorder }]}
      >
        <View style={styles.skeletonAccent} />
        <View style={styles.cardContent}>
          <View style={[styles.iconContainer, { backgroundColor: c.iconWell }]}>
            <Animated.View style={[styles.skeletonIcon, { backgroundColor: c.skeleton, opacity: animatedValue }]} />
          </View>
          <View style={styles.textGroup}>
            <Animated.View style={[styles.skeletonTitle, { backgroundColor: c.skeleton, opacity: animatedValue }]} />
            <Animated.View style={[styles.skeletonDate, { backgroundColor: c.skeleton, opacity: animatedValue }]} />
          </View>
        </View>
        <Animated.View style={[styles.skeletonEdit, { backgroundColor: c.skeleton, opacity: animatedValue }]} />
      </View>
    ));
  };

  const renderItem = (item, index) => {
    const title = isFuelTab
      ? item.fuelType || 'Fuel'
      : isServiceTab
      ? item.name
      : item.documentName;
    const date = isFuelTab ? item.date : isServiceTab ? item.serviceDate : item.expiryDate || item.issueDate;
    const itemId = item.id || index;
    const isSelected = selectedId === itemId;
    const isActive = isSelected && isSelectedcard;
    const isDeleting = deletingId === item.id;

    const status = isFuelTab
      ? item.efficiency != null
        ? { label: `${item.efficiency.toFixed(1)} ${efficiencyUnit(item.fuelType)}`, tone: 'success' }
        : { label: item.fullTank ? 'Full tank' : 'Partial fill', tone: 'neutral' }
      : isServiceTab
      ? getServiceStatus(item)
      : getDocumentStatus(item);
    const statusColors = c.status[status.tone];

    const mileageStatus = isServiceTab ? getMileageStatus(item.nextServiceMileage, currentOdometer) : null;
    const mileageColors = mileageStatus ? c.status[mileageStatus.tone] : null;

    return (
      <TouchableOpacity
        key={item.id?.toString?.() || index.toString()}
        activeOpacity={0.75}
        disabled={isDeleting}
        onPress={() => {
          setIsSelected(true);
          setSelectedId(itemId);
          if (isFuelTab) {
            setFuelData(item);
            setForFuelView(true);
          } else if (!isServiceTab) {
            setDocumentData(item);
            setForDocumentView(true);
          } else {
            setServiceData(item);
            setForView(true);
          }
        }}
        accessibilityRole="button"
        accessibilityLabel={`View ${title || (isServiceTab ? 'service record' : 'document')}, ${status.label}`}
        style={[
          styles.card,
          cardShadow,
          {
            opacity: isDeleting ? 0.5 : 1,
            backgroundColor: c.cardBg,
            borderWidth: 1,
            borderColor: isActive ? c.selectedBorder : c.cardBorder,
          },
        ]}
      >
        {/* Left accent strip colored by status — matches ServicesDcumentlist
            so both lists scan the same way at a glance. */}
        <View style={[styles.accentBar, { backgroundColor: statusColors.accent }]} />

        <View style={styles.cardContent}>
          <View style={[styles.iconContainer, { backgroundColor: c.iconWell }]}>
            {isFuelTab ? (
              <FuelIcon color={statusColors.accent} size={22} />
            ) : (
              <Image
                source={
                  isServiceTab
                    ? getServiceIcon(item.name)
                    : isDark
                    ? require('../assets/icons/documentWhite.png')
                    : require('../assets/icons/document.png')
                }
                style={styles.icon}
              />
            )}
          </View>
          <View style={styles.textGroup}>
            <Text numberOfLines={1} style={[styles.title, { color: c.text }]}>
              {title || 'Unnamed'}
            </Text>

            <View style={styles.metaRow}>
              <Text style={[styles.date, { color: c.muted }]}>{formatDate(date)}</Text>
              {isFuelTab && !!item.totalCost && (
                <Text style={[styles.date, { color: c.muted }]}>
                  · {currencySymbol} {(item.totalCost * fxRate).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </Text>
              )}
              <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
                <Text
                  numberOfLines={1}
                  style={[styles.statusText, { color: statusColors.text }]}
                >
                  {status.label}
                </Text>
              </View>
              {mileageStatus && (
                <View style={[styles.statusBadge, { backgroundColor: mileageColors.bg }]}>
                  <Text numberOfLines={1} style={[styles.statusText, { color: mileageColors.text }]}>
                    {mileageStatus.label}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            onPress={() => handleEditPress(item, index)}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${title || (isServiceTab ? 'service record' : 'document')}`}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.actionButton}
          >
            {isActive ? <SelectedEditIcon /> : <EditIcon />}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleDeletePress(item)}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${title || (isServiceTab ? 'service record' : 'document')}`}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.actionButton}
            disabled={isDeleting}
          >
            <TrashIcon color={c.status.danger.text} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {selectedCar?.imageUrl ? (
        <Image
          style={styles.image}
          source={{ uri: selectedCar.imageUrl }}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.image, styles.fallbackImageContainer]}>
          <Vehicle color={c.fallbackVehicle} />
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
              accessibilityLabel={`${tabName} tab`}
              activeOpacity={0.85}
              style={[
                styles.tabPill,
                isActive && [styles.tabPillActive, { backgroundColor: c.tabActiveBg }, cardShadow],
              ]}
            >
              <Text
                style={[
                  styles.tabPillText,
                  { color: isActive ? c.tab : c.tabInactiveText },
                ]}
              >
                {tabName}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        style={styles.listWrapper}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 90 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View>
          {loading ? (
            renderSkeleton()
          ) : loadError && listData.length === 0 ? (
            <ErrorState
              title="Couldn't load this vehicle's records"
              onRetry={() => setRefreshTrigger(n => n + 1)}
            />
          ) : listData.length === 0 ? (
            <View style={styles.emptyContentContainer}>
              <View style={[styles.emptyIconWell, { backgroundColor: c.emptyIconWell }]}>
                <NotFound />
              </View>
              <View style={styles.textGroupCenter}>
                <Text style={[styles.titleText, { color: c.emptyTitle }]}>
                  {isFuelTab
                    ? 'No Fuel Logs Yet'
                    : isServiceTab
                    ? 'No Service Record Found'
                    : 'Documents List is Empty'}
                </Text>
                <Text style={[styles.descriptionText, { color: c.emptyDesc }]}>
                  {isFuelTab
                    ? 'Log a fill-up to start tracking cost and efficiency.'
                    : isServiceTab
                    ? 'Add a record to keep your maintenance history up to date.'
                    : 'Upload your documents to keep your vehicle organised.'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleAddPress}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={isFuelTab ? 'Log fuel' : isServiceTab ? 'Add service record' : 'Add new document'}
                style={[styles.button, cardShadow]}
              >
                <PlusStroke color="#fff" size={18} />
                <Text style={styles.buttonText}>
                  {isFuelTab ? 'Log Fuel' : isServiceTab ? 'Add Service Record' : 'Add New Document'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              {listData.map((item, index) => renderItem(item, index))}
            </View>
          )}
        </View>
      </ScrollView>

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
          onFuelLogUpdated={handleRefresh}
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
          onServiceUpdated={handleRefresh}
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
          onDocumentUpdated={handleRefresh}
        />

        <ConfirmDeleteModal
          visible={!!deleteTarget}
          title={isFuelTab ? 'Delete fuel log' : isServiceTab ? 'Delete service record' : 'Delete document'}
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
  image: { width: '100%', height: 160, borderRadius: 20 },
  fallbackImageContainer: {
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
    fontSize: 14,
  },

  listWrapper: { flex: 1 },
  scrollContent: { paddingTop: 4 },
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
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  skeletonAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: 'rgba(4,25,51,0.06)',
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