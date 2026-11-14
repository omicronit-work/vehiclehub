import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  Animated,
  Easing,
  TouchableOpacity,
  Pressable,
  Modal,
  RefreshControl,
} from 'react-native';
import Text from '../components/ui/AppText';
import AdBanner from '../components/AdBanner';
import { useSelector } from 'react-redux';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Line,
  Circle,
  Path,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';

import { Typography } from '../styles/typography';
import { themecolors } from '../styles/themecolors';
import DashBoardIcon from '../assets/svg/DashBoardIcon';
import PrevCheck from '../assets/svg/PrevCheck.jsx';
import { useCurrency, formatMoney, symbolFor } from '../util/methods/useCurrency';
import { getExpenseSummary, EXPENSE_CATEGORIES } from '../store/userSlice.js';
import { fetchVehicleByEmail } from '../store/fetchSlice.js';
import { useReduceMotion } from '../util/methods/useReduceMotion';
import { useVisitSkeleton } from '../util/methods/useVisitSkeleton';
import ErrorState from '../components/ui/ErrorState.jsx';
import SkeletonBlock from '../components/ui/SkeletonBlock.jsx';
import { MIN_TOUCH, shadowSoft } from '../theme/tokens';
import { accent } from '../theme/accent';
import FuelEconomyChart from '../components/FuelEconomyChart.jsx';
import RunningCostCard from '../components/RunningCostCard.jsx';
import SpendingByMonth from '../components/SpendingByMonth.jsx';
import { effToUnit, effUnitLabel } from '../util/distance';
import { useDistanceUnit } from '../util/schedule/scheduleSettings';
import { t as tr } from '../i18n';
import { monthNames } from '../i18n';
import { vehicleName } from '../i18n/brands';

const PILL_HIT_SLOP = { top: 8, bottom: 8, left: 6, right: 6 };

const AnimatedView = Animated.createAnimatedComponent(View);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

const MONTHS = monthNames('short');
const MONTHS_FULL = monthNames('long');

// One color per category, same order as EXPENSE_CATEGORIES
// The first category follows the user's accent colour.
const catColor = (i) => [accent.primary, '#84C34C', '#F27540', '#B84DD6', '#FF8A3D', '#8A94A6'][i % 6];

const CHART_TOP_PAD = 14;
const DOT_R = 3.5;
const DOT_R_SELECTED = 6;
const lineLengthEstimate = w => w * 1.7;

/* ── Donut geometry ── */
const DONUT_SIZE = 200;
const DONUT_C = DONUT_SIZE / 2;
const R_OUTER = 96;
const R_INNER = 62;
const DONUT_RADIUS = (R_OUTER + R_INNER) / 2;
const DONUT_STROKE_WIDTH = R_OUTER - R_INNER;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;
const SLICE_GAP = 3;

// Shared soft card shadow (theme/tokens).
const cardShadow = shadowSoft(1.5);

// Straight segments between the monthly dots. A smoothed curve overshoots
// around a single spike, implying spending in the empty months either side.
const buildLinePath = pts =>
  pts.length < 2 ? '' : pts.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ');

// Last expense summary per `${email}|${vehicle}|${year}`, kept for the
// session. The tab is rebuilt on every visit, so without this each visit
// waited for every vehicle's services and fuel logs behind the skeleton;
// now a revisit shows these figures at once and refreshes them quietly.
const summaryCache = new Map();

const Dashboard = () => {
  const { theme } = useSelector(store => store.theme);
  const { userEmail, recordsVersion } = useSelector(store => store.user);
  const isDark = theme === 'dark';
  const { width: windowWidth } = useWindowDimensions();
  const isFocused = useIsFocused();
  const reduceMotion = useReduceMotion();
  // Skeleton on every visit to the tab, even when the figures load instantly.
  const visitSkeleton = useVisitSkeleton();
  const storeVehicles = useSelector(store => store.vehicle.vehiclesInformation);

  const c = useMemo(
    () => ({
      screenBg: accent.primary,
      container: isDark ? themecolors.blackBlue : themecolors.white,
      titleText: isDark ? themecolors.white : themecolors.darkBlue,
      cardBg: isDark ? 'rgba(238, 241, 245, 0.10)' : '#FFF',
      cardBorder: isDark ? accent.lightAlpha(0.25) : accent.alpha(0.10),
      cardTitle: isDark ? themecolors.white : '#041933',
      text: isDark ? themecolors.white : '#041933',
      muted: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(4,25,51,0.55)',
      grid: isDark ? '#FFFFFF20' : '#04193312',
      line: isDark ? accent.light : accent.primary,
      guide: isDark ? accent.lightAlpha(0.55) : accent.alpha(0.45),
      dotHollow: isDark ? '#1A2C44' : '#FFFFFF',
      link: isDark ? accent.light : accent.primary,
      pillBg: isDark ? 'rgba(255,255,255,0.08)' : accent.alpha(0.06),
      menuBg: isDark ? '#12233B' : '#FFFFFF',
      menuBorder: isDark ? accent.lightAlpha(0.25) : accent.alpha(0.12),
      menuSelectedBg: isDark ? accent.lightAlpha(0.18) : accent.alpha(0.08),
      donutTrack: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(4,25,51,0.05)',
      barStrong: isDark ? accent.lightAlpha(0.7) : accent.alpha(0.7),
      barMuted: isDark ? accent.lightAlpha(0.28) : accent.alpha(0.25),
      good: isDark ? '#5BD08A' : '#1F9254',
      goodBg: isDark ? 'rgba(91,208,138,0.14)' : 'rgba(31,146,84,0.10)',
      bad: isDark ? '#FF7A7E' : '#D93B40',
      badBg: isDark ? 'rgba(255,122,126,0.14)' : 'rgba(217,59,64,0.09)',
    }),
    [isDark],
  );

  // The dropdowns draw under the status bar so the dim covers the whole
  // screen, but Android's measureInWindow is relative to below that bar.
  const insets = useSafeAreaInsets();
  const menuTopOffset = Platform.OS === 'android' ? insets.top : 0;

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 150, right: 24 });
  const pillRef = useRef(null);

  // Year picker — getExpenseSummary already supports an arbitrary year,
  // this exposes it in the UI so past years aren't stuck unreachable.
  const CURRENT_YEAR = useMemo(() => new Date().getFullYear(), []);
  const YEAR_OPTIONS = useMemo(
    () => Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i),
    [CURRENT_YEAR],
  );
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [yearMenuOpen, setYearMenuOpen] = useState(false);
  const [yearMenuPos, setYearMenuPos] = useState({ top: 150, right: 24 });
  const yearPillRef = useRef(null);

  // Which vehicle the totals cover. `null` means every vehicle (the default).
  // Shown in a pill so the numbers are never ambiguous for multi-vehicle users.
  const [scopeOverride, setScopeOverride] = useState(null);
  const [vehicleMenuOpen, setVehicleMenuOpen] = useState(false);
  const [vehicleMenuPos, setVehicleMenuPos] = useState({ top: 150, left: 24 });
  const vehiclePillRef = useRef(null);
  const [fetchedVehicles, setFetchedVehicles] = useState(null);

  // Home normally fills the store; fetch directly if it hasn't yet.
  useEffect(() => {
    if (!userEmail || storeVehicles?.length || fetchedVehicles) return;
    fetchVehicleByEmail(userEmail).then(setFetchedVehicles).catch(() => {});
  }, [userEmail, storeVehicles, fetchedVehicles]);
  const vehicles = storeVehicles?.length ? storeVehicles : fetchedVehicles || [];

  // A picked vehicle that has since been deleted (e.g. in the Garage) falls
  // back to "All vehicles" instead of showing zeros under that label.
  const scopeGone = !!scopeOverride && !!storeVehicles?.length
    && !storeVehicles.some(v => v.id === scopeOverride);
  useEffect(() => {
    if (scopeGone) setScopeOverride(null);
  }, [scopeGone]);
  const scopeId = scopeGone ? null : scopeOverride;

  // "By month" opens the Spending view in this tab, in place of the
  // Dashboard (kept mounted underneath, so its scroll position survives).
  const [spending, setSpending] = useState(null);
  const closeSpending = useCallback(() => setSpending(null), []);
  useEffect(() => {
    setSpending(null);
  }, [scopeId]);
  const scopeVehicle = vehicles.find(v => v.id === scopeId);
  const scopeLabel = scopeVehicle
    ? vehicleName(scopeVehicle)
    : tr('All vehicles');

  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [reloadKey, setReloadKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  // Bumped once per completed fetch; the entrance animation keys off this so
  // it plays exactly once per load (not again on focus or currency re-read).
  const [dataVersion, setDataVersion] = useState(0);

  // 'year' → sum every month; 'month' → currently selected month
  const [categoryView, setCategoryView] = useState('year');

  // ─── Firestore-backed data ────────────────────────────────────────────────
  const [monthlyBase, setMonthlyBase] = useState(Array(12).fill(0));
  const [categoryMatrix, setCategoryMatrix] = useState(
    EXPENSE_CATEGORIES.map(() => Array(12).fill(0)),
  );
  const [categoryLabels] = useState(
    EXPENSE_CATEGORIES.map((key, i) => ({
      get label() { return tr(key); },
      color: catColor(i),
    })),
  );
  const [typeMonthly, setTypeMonthly] = useState([]);
  const [openCategory, setOpenCategory] = useState(null);
  const [rawEconomy, setEconomy] = useState({
    monthly: Array(12).fill(null),
    average: null,
    unit: null,
    mixedUnits: false,
  });

  const chartAnim = useRef(new Animated.Value(0)).current;
  const lineAnim = useRef(new Animated.Value(0)).current;
  const pieAnim = useRef(new Animated.Value(0)).current;
  const sliceAnimsRef = useRef(EXPENSE_CATEGORIES.map(() => new Animated.Value(0)));

  // Totals add up every record, shown in the app currency.
  const { code: currencyCode, ready: currencyReady } = useCurrency(isFocused);
  // Amounts are never converted, so the symbol follows the selected currency
  // at once, without waiting for a reload.
  const currencySymbol = symbolFor(currencyCode);
  const distUnit = useDistanceUnit();
  // Economy is stored per km; show it per mile when the user picked miles.
  const economy = useMemo(() => ({
    ...rawEconomy,
    monthly: rawEconomy.monthly.map(v => (v == null ? v : effToUnit(v, distUnit))),
    average: rawEconomy.average == null ? null : effToUnit(rawEconomy.average, distUnit),
    unit: rawEconomy.unit ? effUnitLabel(rawEconomy.unit, distUnit) : rawEconomy.unit,
  }), [rawEconomy, distUnit]);

  // Expense summary from Firestore for the scoped vehicle (or all vehicles).
  // Reloads on focus, and also in the background (tab not focused) as soon
  // as a cost is saved or deleted, so the tab is already current when opened.
  const fetchedVersionRef = useRef(null);
  const animatedViewRef = useRef(null);
  const loadedViewRef = useRef(null);
  const applySummary = useCallback(res => {
    setMonthlyBase(res.monthlyTotals);
    setCategoryMatrix(res.categoryMonthly);
    setTypeMonthly(res.typeMonthly || []);
    setEconomy({
      monthly: res.economyMonthly,
      average: res.economyAverage,
      unit: res.economyUnit,
      mixedUnits: res.economyMixedUnits,
    });
  }, []);

  useEffect(() => {
    if (!userEmail) return undefined;
    const viewKey = `${scopeId}|${selectedYear}`;
    const cacheKey = `${userEmail}|${viewKey}`;
    // Figures from an earlier visit: show them now (no network wait), then
    // the fetch below refreshes them in place.
    const cached = summaryCache.get(cacheKey);
    if (cached && loadedViewRef.current !== viewKey) {
      applySummary(cached);
      setStatus('ready');
      loadedViewRef.current = viewKey;
      if (isFocused && animatedViewRef.current !== viewKey) {
        animatedViewRef.current = viewKey;
        setDataVersion(v => v + 1);
      }
    }
    if (!currencyReady) return undefined;
    const fetchKey = `${recordsVersion}|${currencyCode}`;
    if (!isFocused && fetchedVersionRef.current === fetchKey) return undefined;
    fetchedVersionRef.current = fetchKey;
    let cancelled = false;
    // Another vehicle or year: the figures on screen belong to the old one,
    // so show the skeleton instead of them under the new name. Refreshes of
    // the same view stay quiet.
    if (loadedViewRef.current && loadedViewRef.current !== viewKey) setStatus('loading');
    (async () => {
      try {
        const res = await getExpenseSummary(userEmail, {
          vehicleId: scopeId || undefined,
          year: selectedYear,
          currency: currencyCode,
        });
        summaryCache.set(cacheKey, res);
        if (cancelled) return;
        applySummary(res);
        setStatus('ready');
        loadedViewRef.current = viewKey;
        // Animate when new data replaces what was shown (first load, another
        // vehicle or year). Background and on-focus refreshes of the same
        // view just update the numbers in place.
        if (isFocused && animatedViewRef.current !== viewKey) {
          animatedViewRef.current = viewKey;
          setDataVersion(v => v + 1);
        }
      } catch (e) {
        console.warn('Failed to load expense summary', e);
        // A failed load must not read as "No expenses recorded".
        if (!cancelled) setStatus('error');
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isFocused, userEmail, scopeId, selectedYear, reloadKey, recordsVersion, currencyCode, currencyReady, applySummary]);

  const reload = () => {
    setReloadKey(k => k + 1);
  };

  // Every visit to the tab replays the entrance animation right away with
  // the figures already loaded (kept current by the background refresh);
  // the on-focus reload above then updates them quietly, without a spinner.
  // A failed earlier load goes back to the skeleton.
  useEffect(() => {
    if (!isFocused) return;
    if (status === 'error') setStatus('loading');
    else if (status === 'ready') setDataVersion(v => v + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused]);

  // Entrance animations — once per completed load.
  useEffect(() => {
    // Wait for the visit skeleton to go, so the charts animate in on screen.
    if (!dataVersion || visitSkeleton) return;
    if (reduceMotion) {
      [chartAnim, lineAnim, pieAnim, ...sliceAnimsRef.current].forEach(v => v.setValue(1));
      return;
    }
    chartAnim.setValue(0);
    lineAnim.setValue(0);
    pieAnim.setValue(0);
    sliceAnimsRef.current.forEach(v => v.setValue(0));

    Animated.stagger(180, [
      Animated.parallel([
        Animated.timing(chartAnim, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(lineAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
      ]),
      Animated.parallel([
        Animated.timing(pieAnim, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.stagger(
          150,
          sliceAnimsRef.current.map(v =>
            Animated.timing(v, {
              toValue: 1,
              duration: 700,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: false,
            }),
          ),
        ),
      ]),
    ]).start();
  }, [dataVersion, visitSkeleton, chartAnim, lineAnim, pieAnim, reduceMotion]);

  // ─── Layout constants ─────────────────────────────────────────────────────
  const chartHeight = 180;
  const cardPadding = 14;
  const cardBorder = 1;
  const chartWidth = windowWidth - 24 * 2 - (cardPadding + cardBorder) * 2;
  const slotWidth = chartWidth / MONTHS.length;
  const dynamicFontSize = chartWidth < 280 ? 11 : 12;

  // ─── Chart data (already in the summary's currency) ────────────────────────
  const monthly = useMemo(
    () => monthlyBase.map(v => ({ value: v, isPlaceholder: v <= 0 })),
    [monthlyBase],
  );

  // Donut/legend values: switch between whole-year sum and one month
  const catCostData = useMemo(
    () =>
      categoryLabels.map((cat, ci) => {
        const row = categoryMatrix[ci] || [];
        const value =
          categoryView === 'year'
            ? row.reduce((sum, v) => sum + v, 0)
            : row[selectedMonth] ?? 0;
        return { ...cat, value };
      }),
    [categoryLabels, categoryMatrix, categoryView, selectedMonth],
  );

  const totalCost = useMemo(
    () => catCostData.reduce((sum, item) => sum + item.value, 0),
    [catCostData],
  );

  // Each category's service / fuel types with spend in the shown period,
  // biggest first — revealed by tapping the category in the legend.
  const typesByCategory = useMemo(() => {
    const groups = EXPENSE_CATEGORIES.map(() => []);
    typeMonthly.forEach(row => {
      const value =
        categoryView === 'year'
          ? row.monthly.reduce((sum, v) => sum + v, 0)
          : row.monthly[selectedMonth] ?? 0;
      if (value > 0 && groups[row.category]) groups[row.category].push({ label: row.label, value });
    });
    groups.forEach(g => g.sort((a, b) => b.value - a.value));
    return groups;
  }, [typeMonthly, categoryView, selectedMonth]);

  const peak = useMemo(() => Math.max(0, ...monthly.map(m => m.value)), [monthly]);
  const maxValue = peak > 0 ? peak * 1.08 : 1; // guard against divide-by-zero

  // ─── Chart points ─────────────────────────────────────────────────────────
  const pointData = useMemo(
    () =>
      monthly.map((m, i) => {
        const slotLeft = slotWidth * i;
        const v = m.isPlaceholder ? 0 : m.value;
        return {
          ...m,
          slotLeft,
          x: slotLeft + slotWidth / 2,
          y: CHART_TOP_PAD + (1 - v / maxValue) * (chartHeight - CHART_TOP_PAD),
        };
      }),
    [monthly, maxValue, chartHeight, slotWidth],
  );

  // In the current year the line stops at this month: months that haven't
  // happened yet have no spend, not a ৳0 drop.
  const linePoints = useMemo(() => {
    if (selectedYear !== CURRENT_YEAR) return pointData;
    return pointData.slice(0, new Date().getMonth() + 1);
  }, [pointData, selectedYear, CURRENT_YEAR]);

  const linePath = useMemo(() => buildLinePath(linePoints), [linePoints]);
  const areaPath = useMemo(() => {
    if (!linePath) return '';
    const first = linePoints[0];
    const last = linePoints[linePoints.length - 1];
    return `${linePath} L ${last.x} ${chartHeight} L ${first.x} ${chartHeight} Z`;
  }, [linePath, linePoints, chartHeight]);

  const LINE_LEN = lineLengthEstimate(chartWidth);
  const lineDashOffset = lineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [LINE_LEN, 0],
  });
  const areaOpacity = lineAnim.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [0, 0, 1],
  });

  const selectedPoint = pointData[selectedMonth];

  const openMenu = () => {
    if (pillRef.current?.measureInWindow) {
      pillRef.current.measureInWindow((x, y, w, h) => {
        setMenuPos({
          top: y + h + 6,
          right: Math.max(windowWidth - (x + w), 12),
        });
        setMenuOpen(true);
      });
    } else {
      setMenuOpen(true);
    }
  };

  const pickMonth = i => {
    setSelectedMonth(i);
    setMenuOpen(false);
  };

  const openYearMenu = () => {
    if (yearPillRef.current?.measureInWindow) {
      yearPillRef.current.measureInWindow((x, y, w, h) => {
        setYearMenuPos({
          top: y + h + 6,
          right: Math.max(windowWidth - (x + w), 12),
        });
        setYearMenuOpen(true);
      });
    } else {
      setYearMenuOpen(true);
    }
  };

  const openVehicleMenu = () => {
    if (vehiclePillRef.current?.measureInWindow) {
      vehiclePillRef.current.measureInWindow((x, y, w, h) => {
        setVehicleMenuPos({ top: y + h + 6, left: Math.max(x, 12) });
        setVehicleMenuOpen(true);
      });
    } else {
      setVehicleMenuOpen(true);
    }
  };

  const pickVehicle = id => {
    setScopeOverride(id);
    setVehicleMenuOpen(false);
  };

  const pickYear = y => {
    setSelectedYear(y);
    setYearMenuOpen(false);
  };

  const donutSlices = useMemo(() => {
    let cumulativeLength = 0;
    const slices = catCostData
      .map((slice, i) => ({ ...slice, animIndex: i }))
      .filter(s => s.value > 0);
    // A single category is a closed ring, with no neighbour to leave a gap for.
    const gap = slices.length > 1 ? SLICE_GAP : 0;
    return slices
      .map(slice => {
        const rawLength = (slice.value / totalCost) * DONUT_CIRCUMFERENCE;
        const sliceLength = Math.max(rawLength - gap, 1);
        const rotation = -90 + (cumulativeLength / DONUT_CIRCUMFERENCE) * 360;
        cumulativeLength += rawLength;
        return {
          ...slice,
          sliceLength,
          rotation,
          dashArray: `${sliceLength}, ${DONUT_CIRCUMFERENCE}`,
        };
      });
  }, [catCostData, totalCost]);

  const formatEconomy = v => `${v.toFixed(1)} ${economy.unit}`;

  const hasEconomy = economy.monthly.some(v => v != null && v > 0);
  const selectedEconomy = economy.monthly[selectedMonth];
  // Change vs the closest earlier month that has a reading (higher is better).
  const economyDelta = useMemo(() => {
    const current = economy.monthly[selectedMonth];
    if (!current) return null;
    for (let i = selectedMonth - 1; i >= 0; i--) {
      const prev = economy.monthly[i];
      if (prev) {
        const diff = current - prev;
        if (Math.abs(diff) < 0.05) return null;
        return { up: diff > 0, text: Math.abs(diff).toFixed(1), from: i };
      }
    }
    return null;
  }, [economy.monthly, selectedMonth]);
  const monthSuffix = `${MONTHS_FULL[selectedMonth]}${selectedYear !== CURRENT_YEAR ? ` ${selectedYear}` : ''}`;

  return (
    <View style={[styles.screen, { backgroundColor: c.screenBg }]}>
      <View style={[styles.container, { backgroundColor: c.container }]}>
        {spending && (
          <SpendingByMonth
            result={spending.result}
            vehicleName={spending.vehicleName}
            money={spending.money}
            c={c}
            active={isFocused}
            onBack={closeSpending}
          />
        )}
        <View style={[styles.fill, spending && styles.hidden]}>
        <View style={[styles.titleContainer, styles.titleRow, { justifyContent: 'space-between' }]}>
          <View style={styles.titleContainer}>
            <DashBoardIcon color={isDark ? '#fff' : '#041933'} />
            <Text style={[styles.headerText, { color: c.titleText }]}>
              {tr('Expense Dashboard')}
            </Text>
          </View>
        </View>
        <AdBanner backgroundColor="transparent" style={styles.adSlot} />

        <TouchableOpacity
          ref={vehiclePillRef}
          onPress={openVehicleMenu}
          hitSlop={PILL_HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={tr('Showing expenses for {0}. Change vehicle', { 0: scopeLabel })}
          style={[styles.periodPill, styles.vehiclePill, { backgroundColor: c.pillBg }]}
        >
          <Text style={[styles.periodText, { color: c.muted }]}>{tr('Vehicle:')}</Text>
          <Text style={[styles.periodText, styles.vehiclePillName, { color: c.link }]} numberOfLines={2}>
            {scopeLabel}
          </Text>
          <PrevCheck />
        </TouchableOpacity>

        {status === 'loading' || (visitSkeleton && status !== 'error') ? (
          <View accessibilityLabel={tr('Loading your expenses')}>
            {/* Monthly expenses card */}
            <View style={[styles.card, cardShadow, { backgroundColor: c.cardBg, borderColor: c.cardBorder, marginTop: 12 }]}>
              <View style={styles.cardHeader}>
                <SkeletonBlock width={130} height={16} />
                <SkeletonBlock width={84} height={28} borderRadius={14} />
              </View>
              <SkeletonBlock width={150} height={26} style={{ marginTop: 14 }} />
              <SkeletonBlock width={190} height={12} style={{ marginTop: 8 }} />
              <SkeletonBlock width="100%" height={chartHeight} borderRadius={12} style={{ marginTop: 16 }} />
            </View>
            {/* Expenses by category card */}
            <View style={[styles.card, cardShadow, { backgroundColor: c.cardBg, borderColor: c.cardBorder }]}>
              <View style={styles.cardHeader}>
                <SkeletonBlock width={150} height={16} />
                <SkeletonBlock width={84} height={28} borderRadius={14} />
              </View>
              <View style={styles.donutContainer}>
                <SkeletonBlock width={DONUT_SIZE} height={DONUT_SIZE} borderRadius={DONUT_SIZE / 2} />
              </View>
              <View style={{ gap: 10, marginTop: 8 }}>
                {[0, 1, 2].map(i => (
                  <SkeletonBlock key={i} width="100%" height={14} />
                ))}
              </View>
            </View>
          </View>
        ) : status === 'error' ? (
          <ErrorState title={tr('Couldn\'t load your expenses')} onRetry={() => { setStatus('loading'); reload(); }} />
        ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          // Reaches into the page padding so card shadows aren't clipped at
          // the scroll view's edges; the content is padded back into place.
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); reload(); }}
              tintColor={c.link}
              colors={[c.link]}
            />
          }
        >
          {/* What the vehicle really costs to run: cost per km and fuel economy
              over a period (util/runningCost.js). "All vehicles" adds every
              vehicle together. */}
          <RunningCostCard
            userEmail={userEmail}
            vehicleId={scopeVehicle?.id || null}
            vehicleName={scopeLabel}
            refreshKey={`${recordsVersion}|${reloadKey}`}
            currency={currencyCode}
            currencyReady={currencyReady}
            distUnit={distUnit}
            c={c}
            isDark={isDark}
            onOpenByMonth={setSpending}
          />

          {/* Nothing logged this year: say what fills this screen, instead of a
              page of zeros. With one vehicle picked, the running-cost cards
              above already say so. */}
          {monthlyBase.every(v => !v) && !scopeVehicle && (
            <View
              style={[styles.card, cardShadow, { backgroundColor: c.cardBg, borderColor: c.cardBorder, marginTop: 12 }]}
              accessibilityRole="text"
            >
              <Text style={[styles.cardTitle, { color: c.cardTitle }]}>{tr('Nothing spent in {0} yet', { 0: selectedYear })}</Text>
              <Text style={[styles.cardEmpty, { color: c.muted, marginTop: 6 }]}>
                {tr('Add a fuel log or a service with a cost, and what your vehicle costs each month in {0} shows up here. Tap "+ Add" on Home.', { 0: selectedYear })}
              </Text>
            </View>
          )}

          {/* The cards below cover one calendar year; their year picker sits
              here, apart from the running-cost period chips above, so the
              two never read as one control. */}
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionLabel, { color: c.muted }]}>{tr('YEAR IN DETAIL')}</Text>
            <TouchableOpacity
              ref={yearPillRef}
              onPress={openYearMenu}
              hitSlop={PILL_HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel={tr('Year: {0}. Change year', { 0: selectedYear })}
              style={[styles.periodPill, { backgroundColor: c.pillBg }]}
            >
              <Text style={[styles.periodText, { color: c.link }]}>{selectedYear}</Text>
              <PrevCheck />
            </TouchableOpacity>
          </View>

          {/* ── CARD 1: MONTHLY EXPENSES ── */}
          <View style={[styles.card, cardShadow, { backgroundColor: c.cardBg, borderColor: c.cardBorder, marginTop: 12 }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: c.cardTitle }]}>{tr('Monthly Expenses')}</Text>
              <TouchableOpacity
                ref={pillRef}
                onPress={openMenu}
                hitSlop={PILL_HIT_SLOP}
                accessibilityRole="button"
                accessibilityLabel={tr('Month: {0}. Change month', { 0: MONTHS_FULL[selectedMonth] })}
                style={[styles.periodPill, { backgroundColor: c.pillBg }]}
              >
                <Text style={[styles.periodText, { color: c.link }]}>
                  {MONTHS_FULL[selectedMonth]}
                </Text>
                <PrevCheck />
              </TouchableOpacity>
            </View>

            <View style={styles.selectedRow}>
              <Text style={[styles.selectedValue, { color: c.text }]}>
                <Text style={[styles.statCurrency, { color: c.muted }]}>{currencySymbol} </Text>
                {selectedPoint?.isPlaceholder ? '—' : formatMoney(selectedPoint?.value ?? 0)}
              </Text>
              <Text style={[styles.selectedCaption, { color: c.muted }]}>
                {selectedPoint?.isPlaceholder
                  ? tr('No expenses recorded in {0}', { 0: `${MONTHS_FULL[selectedMonth]}${selectedYear !== CURRENT_YEAR ? ` ${selectedYear}` : ''}` })
                  : tr('spent in {0}', { 0: `${MONTHS_FULL[selectedMonth]}${selectedYear !== CURRENT_YEAR ? ` ${selectedYear}` : ''}` })}
              </Text>
            </View>

            {/* Area chart */}
            <AnimatedView
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{
                width: chartWidth,
                height: chartHeight,
                opacity: chartAnim,
                transform: [
                  {
                    translateY: chartAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [14, 0],
                    }),
                  },
                ],
              }}
            >
              <Svg width={chartWidth} height={chartHeight}>
                <Defs>
                  <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={c.line} stopOpacity="0.28" />
                    <Stop offset="1" stopColor={c.line} stopOpacity="0.02" />
                  </LinearGradient>
                </Defs>

                <Line
                  x1="0"
                  y1={chartHeight - 0.5}
                  x2={chartWidth}
                  y2={chartHeight - 0.5}
                  stroke={c.grid}
                  strokeWidth="1"
                />

                <AnimatedPath d={areaPath} fill="url(#areaGrad)" fillOpacity={areaOpacity} />

                <AnimatedPath
                  d={linePath}
                  fill="none"
                  stroke={c.line}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray={`${LINE_LEN}, ${LINE_LEN}`}
                  strokeDashoffset={lineDashOffset}
                />

                {selectedPoint && (
                  <Line
                    x1={selectedPoint.x}
                    y1={selectedPoint.y}
                    x2={selectedPoint.x}
                    y2={chartHeight}
                    stroke={c.guide}
                    strokeWidth="1.5"
                    strokeDasharray="3,4"
                  />
                )}

                {pointData.map((p, i) =>
                  i === selectedMonth ? (
                    <React.Fragment key={i}>
                      <Circle cx={p.x} cy={p.y} r={DOT_R_SELECTED + 3} fill={c.dotHollow} />
                      <Circle
                        cx={p.x}
                        cy={p.y}
                        r={DOT_R_SELECTED}
                        fill={p.isPlaceholder ? c.dotHollow : c.line}
                        stroke={c.line}
                        strokeWidth="2.5"
                      />
                    </React.Fragment>
                  ) : (
                    <Circle
                      key={i}
                      cx={p.x}
                      cy={p.y}
                      r={DOT_R}
                      fill={p.isPlaceholder ? c.dotHollow : c.line}
                      stroke={p.isPlaceholder ? c.muted : c.line}
                      strokeWidth={p.isPlaceholder ? 1 : 0}
                    />
                  ),
                )}
              </Svg>

              {pointData.map((p, i) => (
                <Pressable
                  key={`press-${i}`}
                  onPress={() => setSelectedMonth(i)}
                  style={{
                    position: 'absolute',
                    left: p.slotLeft,
                    top: 0,
                    width: slotWidth,
                    height: chartHeight,
                  }}
                />
              ))}
            </AnimatedView>

            {/* Month labels */}
            <View style={[styles.monthLabels, { width: chartWidth }]}>
              {MONTHS.map((m, i) => (
                <Pressable
                  key={i}
                  onPress={() => setSelectedMonth(i)}
                  accessibilityRole="button"
                  accessibilityLabel={`${MONTHS_FULL[i]}: ${
                    monthly[i]?.isPlaceholder
                      ? tr('no expenses')
                      : `${currencySymbol} ${formatMoney(monthly[i]?.value ?? 0)}`
                  }`}
                  accessibilityState={{ selected: i === selectedMonth }}
                  style={{ width: slotWidth, alignItems: 'center', minHeight: 32, justifyContent: 'center' }}
                >
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="clip"
                    style={[
                      styles.monthText,
                      i === selectedMonth && { backgroundColor: c.pillBg },
                      {
                        fontSize: dynamicFontSize,
                        color: i === selectedMonth ? c.link : c.muted,
                        fontFamily: i === selectedMonth ? 'RobotoCondensed500' : 'RobotoCondensed400',
                      },
                    ]}
                  >
                    {m}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* ── CARD 2: EXPENSES BY CATEGORY ── */}
          <View style={[styles.card, cardShadow, { backgroundColor: c.cardBg, borderColor: c.cardBorder }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: c.cardTitle }]}>{tr('Expenses by Category')}</Text>
              <TouchableOpacity
                onPress={() => setCategoryView(v => (v === 'year' ? 'month' : 'year'))}
                hitSlop={PILL_HIT_SLOP}
                accessibilityRole="button"
                accessibilityLabel={tr('Showing {0}. Switch to {1}', { 0: categoryView === 'year' ? tr('this year') : MONTHS_FULL[selectedMonth], 1: categoryView === 'year' ? tr('selected month') : tr('whole year') })}
                style={[styles.periodPill, { backgroundColor: c.pillBg }]}
              >
                <Text style={[styles.periodText, { color: c.link }]}>
                  {categoryView === 'year' ? tr('This year') : MONTHS_FULL[selectedMonth]}
                </Text>
                <PrevCheck />
              </TouchableOpacity>
            </View>

            <View style={styles.donutContainer}>
              <View
                style={{ width: DONUT_SIZE, height: DONUT_SIZE }}
                accessible
                accessibilityLabel={tr('Total {0}: {1}', { 0: categoryView === 'year' ? tr('this year') : tr('in {0}', { 0: MONTHS_FULL[selectedMonth] }), 1: `${currencySymbol} ${formatMoney(totalCost)}` })}
              >
                <Svg width={DONUT_SIZE} height={DONUT_SIZE}>
                  <Circle
                    cx={DONUT_C}
                    cy={DONUT_C}
                    r={DONUT_RADIUS}
                    fill="none"
                    stroke={c.donutTrack}
                    strokeWidth={DONUT_STROKE_WIDTH}
                  />
                  {donutSlices.map(slice => {
                    const anim = sliceAnimsRef.current[slice.animIndex];
                    const dashOffset = anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [slice.sliceLength, 0],
                    });
                    return (
                      <AnimatedCircle
                        key={slice.animIndex}
                        cx={DONUT_C}
                        cy={DONUT_C}
                        r={DONUT_RADIUS}
                        fill="none"
                        stroke={slice.color}
                        strokeWidth={DONUT_STROKE_WIDTH}
                        strokeDasharray={slice.dashArray}
                        strokeDashoffset={dashOffset}
                        strokeLinecap="butt"
                        rotation={slice.rotation}
                        origin={`${DONUT_C}, ${DONUT_C}`}
                      />
                    );
                  })}
                </Svg>
                <AnimatedView style={[styles.donutCenter, { opacity: pieAnim }]} pointerEvents="none">
                  <Text style={[styles.donutCenterLabel, { color: c.muted }]}>
                    {categoryView === 'year' ? tr('TOTAL · YEAR') : tr('TOTAL · MONTH')}
                  </Text>
                  <Text style={[styles.donutCenterValue, { color: c.text }]} numberOfLines={1}>
                    <Text style={[styles.statCurrency, { color: c.muted }]}>{currencySymbol}</Text>
                    {' '}{formatMoney(totalCost)}
                  </Text>
                </AnimatedView>
              </View>
            </View>

            <View style={styles.legendList}>
              {catCostData.map((slice, index) => {
                const pct = totalCost > 0 ? Math.round((slice.value / totalCost) * 100) : 0;
                const empty = slice.value <= 0;
                const types = typesByCategory[index] || [];
                const isOpen = openCategory === index && types.length > 0;
                return (
                  <View key={index}>
                    <Pressable
                      disabled={!types.length}
                      onPress={() => setOpenCategory(o => (o === index ? null : index))}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: isOpen }}
                      accessibilityLabel={`${slice.label}: ${currencySymbol} ${formatMoney(slice.value)}, ${tr('{0} percent', { 0: pct })}${types.length ? `, ${types.length === 1 ? tr('1 type, tap to show') : tr('{0} types, tap to show', { 0: types.length })}` : ''}`}
                      style={[styles.legendRow, empty && { opacity: 0.45 }]}
                    >
                      <View style={[styles.legendDot, { backgroundColor: slice.color }]} />
                      <Text style={[styles.legendLabel, { color: c.text }]}>
                        {slice.label}
                        {types.length > 0 && (
                          <Text style={{ color: c.muted }}>{`  · ${types.length} ${types.length === 1 ? 'type' : 'types'} ${isOpen ? '▴' : '▾'}`}</Text>
                        )}
                      </Text>
                      <Text style={[styles.legendValue, { color: c.text }]}>
                        <Text style={{ color: c.muted }}>{currencySymbol} </Text>
                        {formatMoney(slice.value)}
                      </Text>
                      <Text style={[styles.legendPct, { color: c.muted }]}>{pct}%</Text>
                    </Pressable>
                    {isOpen && (
                      <View style={[styles.typeList, { borderLeftColor: slice.color }]}>
                        {types.map(type => (
                          <View
                            key={type.label}
                            accessible
                            accessibilityLabel={`${type.label}: ${currencySymbol} ${formatMoney(type.value)}`}
                            style={styles.typeRow}
                          >
                            <Text numberOfLines={1} style={[styles.typeLabel, { color: c.text }]}>{type.label}</Text>
                            <Text style={[styles.legendValue, { color: c.text }]}>
                              <Text style={{ color: c.muted }}>{currencySymbol} </Text>
                              {formatMoney(type.value)}
                            </Text>
                            <Text style={[styles.legendPct, { color: c.muted }]}>
                              {totalCost > 0 ? Math.round((type.value / totalCost) * 100) : 0}%
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          {/* ── CARD 3: FUEL ECONOMY ── (one vehicle only, and hidden until
              there's a trend to show) */}
          {scopeVehicle && hasEconomy ? (
          <View style={[styles.card, { marginBottom: 40 }, cardShadow, { backgroundColor: c.cardBg, borderColor: c.cardBorder }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: c.cardTitle }]}>{tr('Fuel economy by month')}</Text>
              {economy.average != null && (
                <Text style={[styles.cardSummary, { color: c.muted }]}>
                  {tr('Avg')}{' '}<Text style={{ color: c.text }}>{formatEconomy(economy.average)}</Text>
                </Text>
              )}
            </View>

            <>
                <View style={styles.selectedRow}>
                  <Text style={[styles.selectedValue, { color: c.text }]}>
                    {selectedEconomy ? selectedEconomy.toFixed(1) : '—'}
                    {!!selectedEconomy && (
                      <Text style={[styles.statCurrency, { color: c.muted }]}> {economy.unit}</Text>
                    )}
                  </Text>
                  {economyDelta ? (
                    <View
                      style={[styles.deltaChip, { backgroundColor: economyDelta.up ? c.goodBg : c.badBg }]}
                      accessible
                      accessibilityLabel={tr('{0} {1} from {2}', { 0: economyDelta.up ? tr('Up') : tr('Down'), 1: economyDelta.text, 2: MONTHS_FULL[economyDelta.from] })}
                    >
                      <Text style={[styles.deltaText, { color: economyDelta.up ? c.good : c.bad }]}>
                        {economyDelta.up ? '▲' : '▼'} {tr('{0} vs {1}', { 0: economyDelta.text, 1: MONTHS[economyDelta.from] })}
                      </Text>
                    </View>
                  ) : (
                    <Text style={[styles.selectedCaption, { color: c.muted }]}>
                      {selectedEconomy
                        ? tr('average in {0}', { 0: monthSuffix })
                        : tr('No fill-ups to measure in {0}', { 0: monthSuffix })}
                    </Text>
                  )}
                </View>
                <FuelEconomyChart
                  values={economy.monthly}
                  average={economy.average}
                  unit={economy.unit}
                  selectedMonth={selectedMonth}
                  onSelectMonth={setSelectedMonth}
                  width={chartWidth}
                  colors={c}
                  animKey={dataVersion}
                  reduceMotion={reduceMotion}
                />
                {economy.mixedUnits && (
                  <Text style={[styles.cardNote, { color: c.muted }]}>
                    {tr('Showing {0} only. Vehicles on other fuel types are left out.', { 0: economy.unit })}
                  </Text>
                )}
            </>
          </View>
          ) : (
            // Keeps the bottom breathing room the card used to provide.
            <View style={styles.listEndSpacer} />
          )}
        </ScrollView>
        )}
        </View>
      </View>

      {/* ── VEHICLE DROPDOWN ── */}
      <Modal
        transparent
        visible={vehicleMenuOpen}
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setVehicleMenuOpen(false)}
      >
        <Pressable style={styles.menuBackdrop} onPress={() => setVehicleMenuOpen(false)}>
          <View
            style={[
              styles.menu,
              styles.vehicleMenu,
              cardShadow,
              {
                top: vehicleMenuPos.top + menuTopOffset,
                left: vehicleMenuPos.left,
                backgroundColor: c.menuBg,
                borderColor: c.menuBorder,
              },
            ]}
          >
            <Text style={[styles.menuTitle, { color: c.muted }]}>{tr('SHOW EXPENSES FOR')}</Text>
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {[{ id: null, label: tr('All vehicles') }, ...vehicles.map(v => ({
                id: v.id,
                label: vehicleName(v) || tr('Vehicle'),
              }))].map(opt => {
                const selected = opt.id === scopeId;
                return (
                  <TouchableOpacity
                    key={opt.id ?? 'all'}
                    onPress={() => pickVehicle(opt.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={[styles.menuRow, selected && { backgroundColor: c.menuSelectedBg }]}
                  >
                    <Text
                      numberOfLines={2}
                      style={[
                        styles.menuMonth,
                        {
                          color: selected ? c.link : c.text,
                          fontFamily: selected ? 'RobotoCondensed500' : 'RobotoCondensed400',
                        },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* ── MONTH DROPDOWN ── */}
      <Modal
        transparent
        visible={menuOpen}
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)}>
          <View
            style={[
              styles.menu,
              cardShadow,
              {
                top: menuPos.top + menuTopOffset,
                right: menuPos.right,
                backgroundColor: c.menuBg,
                borderColor: c.menuBorder,
              },
            ]}
          >
            <Text style={[styles.menuTitle, { color: c.muted }]}>{tr('MONTHS · {0}', { 0: selectedYear })}</Text>
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {MONTHS_FULL.map((m, i) => {
                const item = monthly[i];
                const selected = i === selectedMonth;
                return (
                  <TouchableOpacity
                    key={i}
                    onPress={() => pickMonth(i)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={[styles.menuRow, selected && { backgroundColor: c.menuSelectedBg }]}
                  >
                    <Text
                      style={[
                        styles.menuMonth,
                        {
                          color: selected ? c.link : c.text,
                          fontFamily: selected ? 'RobotoCondensed500' : 'RobotoCondensed400',
                        },
                      ]}
                    >
                      {m}
                    </Text>
                    <Text style={[styles.menuValue, { color: selected ? c.link : c.muted }]}>
                      {item?.isPlaceholder ? '—' : `${currencySymbol} ${formatMoney(item?.value ?? 0)}`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* ── YEAR DROPDOWN ── */}
      <Modal
        transparent
        visible={yearMenuOpen}
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setYearMenuOpen(false)}
      >
        <Pressable style={styles.menuBackdrop} onPress={() => setYearMenuOpen(false)}>
          <View
            style={[
              styles.menu,
              cardShadow,
              {
                top: yearMenuPos.top + menuTopOffset,
                right: yearMenuPos.right,
                backgroundColor: c.menuBg,
                borderColor: c.menuBorder,
              },
            ]}
          >
            <Text style={[styles.menuTitle, { color: c.muted }]}>{tr('SELECT YEAR')}</Text>
            {YEAR_OPTIONS.map(y => {
              const selected = y === selectedYear;
              return (
                <TouchableOpacity
                  key={y}
                  onPress={() => pickYear(y)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[styles.menuRow, selected && { backgroundColor: c.menuSelectedBg }]}
                >
                  <Text
                    style={[
                      styles.menuMonth,
                      {
                        color: selected ? c.link : c.text,
                        fontFamily: selected ? 'RobotoCondensed500' : 'RobotoCondensed400',
                      },
                    ]}
                  >
                    {y}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

export default Dashboard;

const styles = StyleSheet.create({
  listEndSpacer: { height: 40 },
  screen: { flex: 1 },
  container: {
    flex: 1,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    marginTop: 5,
    overflow: 'hidden',
    padding: 24,
    paddingTop: 12, // same top gap as the Home title row
    paddingBottom: 0,
  },
  fill: { flex: 1 },
  hidden: { display: 'none' },
  scroll: { marginHorizontal: -16 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 8 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 28,
  },
  sectionLabel: {
    fontFamily: 'RobotoCondensed500',
    fontSize: 12,
    letterSpacing: 1.2,
  },
  titleRow: {
    minHeight: 42, // same row height as Home's title row
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Ad under the page title; takes no space until an ad loads.
  adSlot: { paddingHorizontal: 0, paddingTop: 10, paddingBottom: 2 },
  // Page title — same style as Home's "All Vehicles".
  headerText: {
    fontSize: 20,
    fontFamily: Typography.font.medium,
    fontWeight: '700',
  },
  card: {
    width: '100%',
    borderWidth: 1,
    padding: 14,
    borderRadius: 14,
    marginTop: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontFamily: 'RobotoCondensed500',
    fontSize: 16,
  },
  periodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 30,
    borderRadius: 15,
  },
  periodText: {
    fontFamily: 'RobotoCondensed400',
    fontSize: 13,
  },
  vehiclePill: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    marginTop: 4,
  },
  vehiclePillName: {
    flexShrink: 1,
    fontFamily: 'RobotoCondensed500',
  },
  vehicleMenu: {
    width: 240,
  },
  cardSummary: {
    fontSize: 13,
    fontFamily: 'RobotoCondensed400',
  },
  cardNote: {
    fontSize: 12,
    fontFamily: 'RobotoCondensed400',
    marginTop: 8,
  },
  cardEmpty: {
    fontSize: 13,
    fontFamily: 'RobotoCondensed400',
    lineHeight: 19,
    marginTop: 12,
    marginBottom: 4,
  },
  deltaChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  deltaText: {
    fontSize: 12,
    fontFamily: 'RobotoCondensed500',
  },
  statCurrency: {
    fontSize: 14,
    fontFamily: 'RobotoCondensed400',
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 10,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  selectedValue: {
    fontSize: 24,
    fontFamily: 'RobotoCondensed500',
  },
  selectedCaption: {
    fontSize: 12,
    fontFamily: 'RobotoCondensed400',
  },
  monthLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 2,
  },
  monthText: {
    textAlign: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
    borderRadius: 8,
    overflow: 'hidden',
    width: '100%',
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(4,25,51,0.25)',
  },
  menu: {
    position: 'absolute',
    width: 200,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 8,
  },
  menuTitle: {
    fontSize: 12,
    fontFamily: 'RobotoCondensed500',
    letterSpacing: 1.2,
    paddingHorizontal: 14,
    paddingBottom: 6,
  },
  menuRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    minHeight: MIN_TOUCH,
    gap: 12,
  },
  menuMonth: {
    fontSize: 13,
  },
  menuValue: {
    fontSize: 12,
    fontFamily: 'RobotoCondensed500',
  },
  donutContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  donutCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  donutCenterLabel: {
    fontSize: 12,
    fontFamily: 'RobotoCondensed500',
    letterSpacing: 1.2,
  },
  donutCenterValue: {
    fontSize: 20,
    fontFamily: 'RobotoCondensed500',
    maxWidth: R_INNER * 2 - 12,
  },
  legendList: {
    marginTop: 16,
    gap: 4,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 4,
  },
  legendLabel: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'RobotoCondensed400',
  },
  legendValue: {
    fontSize: 13,
    fontFamily: 'RobotoCondensed500',
  },
  legendPct: {
    fontSize: 12,
    fontFamily: 'RobotoCondensed400',
    width: 36,
    textAlign: 'right',
  },
  typeList: {
    marginLeft: 5,
    marginBottom: 6,
    paddingLeft: 17,
    borderLeftWidth: 2,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 5,
  },
  typeLabel: {
    flex: 1,
    fontSize: 12.5,
    fontFamily: 'RobotoCondensed400',
  },
});
