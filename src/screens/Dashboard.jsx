import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  Animated,
  Easing,
  TouchableOpacity,
  Pressable,
  Modal,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSelector } from 'react-redux';
import { useIsFocused } from '@react-navigation/native';
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
import { useCurrency } from '../util/methods/useCurrency';
import { getExpenseSummary, EXPENSE_CATEGORIES } from '../store/userSlice.js';
import { fetchVehicleByEmail } from '../store/fetchSlice.js';
import { useReduceMotion } from '../util/methods/useReduceMotion';
import ErrorState from '../components/ui/ErrorState.jsx';
import { MIN_TOUCH, shadowSoft } from '../theme/tokens';
import { accent } from '../theme/accent';

const PILL_HIT_SLOP = { top: 8, bottom: 8, left: 6, right: 6 };

const AnimatedView = Animated.createAnimatedComponent(View);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_FULL = [
  'January','February','March','April','May','June',
  'July', 'August','September','October', 'November', 'December',
];

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

const buildSmoothPath = pts => {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
};

const Dashboard = () => {
  const { theme } = useSelector(store => store.theme);
  const { userEmail, selectedCar } = useSelector(store => store.user);
  const isDark = theme === 'dark';
  const { width: windowWidth } = useWindowDimensions();
  const isFocused = useIsFocused();
  const reduceMotion = useReduceMotion();
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
    }),
    [isDark],
  );

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

  // Which vehicle the totals cover. `undefined` follows the vehicle selected
  // on Home; `null` means every vehicle. Shown in a pill so the numbers are
  // never ambiguous for multi-vehicle users.
  const [scopeOverride, setScopeOverride] = useState(undefined);
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

  useEffect(() => {
    setScopeOverride(undefined);
  }, [selectedCar]);

  const scopeId = scopeOverride === undefined ? selectedCar || null : scopeOverride;
  const scopeVehicle = vehicles.find(v => v.id === scopeId);
  const scopeLabel = scopeVehicle
    ? [scopeVehicle.brand, scopeVehicle.model].filter(Boolean).join(' ')
    : 'All vehicles';

  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [reloadKey, setReloadKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // 'year' → sum every month; 'month' → currently selected month
  const [categoryView, setCategoryView] = useState('year');

  // ─── Firestore-backed data ────────────────────────────────────────────────
  const [monthlyBase, setMonthlyBase] = useState(Array(12).fill(0));
  const [categoryMatrix, setCategoryMatrix] = useState(
    EXPENSE_CATEGORIES.map(() => Array(12).fill(0)),
  );
  const [categoryLabels] = useState(
    EXPENSE_CATEGORIES.map((label, i) => ({
      label,
      color: catColor(i),
    })),
  );

  const chartAnim = useRef(new Animated.Value(0)).current;
  const lineAnim = useRef(new Animated.Value(0)).current;
  const pieAnim = useRef(new Animated.Value(0)).current;
  const sliceAnimsRef = useRef(EXPENSE_CATEGORIES.map(() => new Animated.Value(0)));

  // Currency (falls back to the base currency for symbol AND rate together)
  const { symbol: currencySymbol, fxRate: rate } = useCurrency(isFocused);

  // Expense summary from Firestore for the scoped vehicle (or all vehicles)
  useEffect(() => {
    if (!isFocused || !userEmail) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getExpenseSummary(userEmail, {
          vehicleId: scopeId || undefined,
          year: selectedYear,
        });
        if (cancelled) return;
        setMonthlyBase(res.monthlyTotals);
        setCategoryMatrix(res.categoryMonthly);
        setStatus('ready');
      } catch (e) {
        console.warn('Failed to load expense summary', e);
        // A failed load must not read as "No expenses recorded".
        if (!cancelled) setStatus('error');
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isFocused, userEmail, scopeId, selectedYear, reloadKey]);

  const reload = () => {
    setReloadKey(k => k + 1);
  };

  // Entrance animations
  useEffect(() => {
    if (!isFocused) return;
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
  }, [isFocused, rate, monthlyBase, categoryMatrix, chartAnim, lineAnim, pieAnim, reduceMotion]);

  // ─── Layout constants ─────────────────────────────────────────────────────
  const chartHeight = 180;
  const cardPadding = 14;
  const chartWidth = windowWidth - 24 * 2 - cardPadding * 2;
  const slotWidth = chartWidth / MONTHS.length;
  const dynamicFontSize = chartWidth < 280 ? 11 : 12;

  // ─── Converted data ───────────────────────────────────────────────────────
  const monthly = useMemo(
    () => monthlyBase.map(v => ({ value: v * rate, isPlaceholder: v <= 0 })),
    [monthlyBase, rate],
  );

  // Donut/legend values: switch between whole-year sum and one month
  const catCostData = useMemo(
    () =>
      categoryLabels.map((cat, ci) => {
        const row = categoryMatrix[ci] || [];
        const value =
          categoryView === 'year'
            ? row.reduce((sum, v) => sum + v, 0) * rate
            : (row[selectedMonth] ?? 0) * rate;
        return { ...cat, value };
      }),
    [categoryLabels, categoryMatrix, categoryView, selectedMonth, rate],
  );

  const totalCost = useMemo(
    () => catCostData.reduce((sum, item) => sum + item.value, 0),
    [catCostData],
  );

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

  const linePath = useMemo(() => buildSmoothPath(pointData), [pointData]);
  const areaPath = useMemo(() => {
    if (!pointData.length) return '';
    const first = pointData[0];
    const last = pointData[pointData.length - 1];
    return `${linePath} L ${last.x} ${chartHeight} L ${first.x} ${chartHeight} Z`;
  }, [linePath, pointData, chartHeight]);

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
    return catCostData
      .map((slice, i) => ({ ...slice, animIndex: i }))
      .filter(s => s.value > 0)
      .map(slice => {
        const rawLength = (slice.value / totalCost) * DONUT_CIRCUMFERENCE;
        const sliceLength = Math.max(rawLength - SLICE_GAP, 1);
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

  const formatMoney = v => Math.round(v).toLocaleString();

  return (
    <View style={[styles.screen, { backgroundColor: c.screenBg }]}>
      <View style={[styles.container, { backgroundColor: c.container }]}>
        <View style={[styles.titleContainer, styles.titleRow, { justifyContent: 'space-between' }]}>
          <View style={styles.titleContainer}>
            <DashBoardIcon color={isDark ? '#fff' : '#041933'} />
            <Text style={[styles.headerText, { color: c.titleText }]}>
              Expense Dashboard
            </Text>
          </View>
          <TouchableOpacity
            ref={yearPillRef}
            onPress={openYearMenu}
            hitSlop={PILL_HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel={`Year: ${selectedYear}. Change year`}
            style={[styles.periodPill, { backgroundColor: c.pillBg }]}
          >
            <Text style={[styles.periodText, { color: c.link }]}>{selectedYear}</Text>
            <PrevCheck />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          ref={vehiclePillRef}
          onPress={openVehicleMenu}
          hitSlop={PILL_HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={`Showing expenses for ${scopeLabel}. Change vehicle`}
          style={[styles.periodPill, styles.vehiclePill, { backgroundColor: c.pillBg }]}
        >
          <Text style={[styles.periodText, { color: c.muted }]}>Vehicle:</Text>
          <Text style={[styles.periodText, styles.vehiclePillName, { color: c.link }]} numberOfLines={1}>
            {scopeLabel}
          </Text>
          <PrevCheck />
        </TouchableOpacity>

        {status === 'loading' ? (
          <View style={styles.statusWrap}>
            <ActivityIndicator color={c.link} />
          </View>
        ) : status === 'error' ? (
          <ErrorState title="Couldn't load your expenses" onRetry={() => { setStatus('loading'); reload(); }} />
        ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); reload(); }}
              tintColor={c.link}
              colors={[c.link]}
            />
          }
        >
          {/* ── CARD 1: MONTHLY EXPENSES ── */}
          <View style={[styles.card, cardShadow, { backgroundColor: c.cardBg, borderColor: c.cardBorder, marginTop: 12 }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: c.cardTitle }]}>Monthly Expenses</Text>
              <TouchableOpacity
                ref={pillRef}
                onPress={openMenu}
                hitSlop={PILL_HIT_SLOP}
                accessibilityRole="button"
                accessibilityLabel={`Month: ${MONTHS_FULL[selectedMonth]}. Change month`}
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
                  ? `No expenses recorded in ${MONTHS_FULL[selectedMonth]}${selectedYear !== CURRENT_YEAR ? ` ${selectedYear}` : ''}`
                  : `spent in ${MONTHS_FULL[selectedMonth]}${selectedYear !== CURRENT_YEAR ? ` ${selectedYear}` : ''}`}
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
                      ? 'no expenses'
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
          <View style={[styles.card, { marginBottom: 40 }, cardShadow, { backgroundColor: c.cardBg, borderColor: c.cardBorder }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: c.cardTitle }]}>Expenses by Category</Text>
              <TouchableOpacity
                onPress={() => setCategoryView(v => (v === 'year' ? 'month' : 'year'))}
                hitSlop={PILL_HIT_SLOP}
                accessibilityRole="button"
                accessibilityLabel={`Showing ${categoryView === 'year' ? 'this year' : MONTHS_FULL[selectedMonth]}. Switch to ${categoryView === 'year' ? 'selected month' : 'whole year'}`}
                style={[styles.periodPill, { backgroundColor: c.pillBg }]}
              >
                <Text style={[styles.periodText, { color: c.link }]}>
                  {categoryView === 'year' ? 'This year' : MONTHS_FULL[selectedMonth]}
                </Text>
                <PrevCheck />
              </TouchableOpacity>
            </View>

            <View style={styles.donutContainer}>
              <View
                style={{ width: DONUT_SIZE, height: DONUT_SIZE }}
                accessible
                accessibilityLabel={`Total ${categoryView === 'year' ? 'this year' : `in ${MONTHS_FULL[selectedMonth]}`}: ${currencySymbol} ${formatMoney(totalCost)}`}
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
                        strokeLinecap="round"
                        rotation={slice.rotation}
                        origin={`${DONUT_C}, ${DONUT_C}`}
                      />
                    );
                  })}
                </Svg>
                <AnimatedView style={[styles.donutCenter, { opacity: pieAnim }]} pointerEvents="none">
                  <Text style={[styles.donutCenterLabel, { color: c.muted }]}>
                    {categoryView === 'year' ? 'TOTAL · YEAR' : 'TOTAL · MONTH'}
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
                return (
                  <View
                    key={index}
                    accessible
                    accessibilityLabel={`${slice.label}: ${currencySymbol} ${formatMoney(slice.value)}, ${pct} percent`}
                    style={[styles.legendRow, empty && { opacity: 0.45 }]}
                  >
                    <View style={[styles.legendDot, { backgroundColor: slice.color }]} />
                    <Text style={[styles.legendLabel, { color: c.text }]}>{slice.label}</Text>
                    <Text style={[styles.legendValue, { color: c.text }]}>
                      <Text style={{ color: c.muted }}>{currencySymbol} </Text>
                      {formatMoney(slice.value)}
                    </Text>
                    <Text style={[styles.legendPct, { color: c.muted }]}>{pct}%</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>
        )}
      </View>

      {/* ── VEHICLE DROPDOWN ── */}
      <Modal
        transparent
        visible={vehicleMenuOpen}
        animationType="fade"
        onRequestClose={() => setVehicleMenuOpen(false)}
      >
        <Pressable style={styles.menuBackdrop} onPress={() => setVehicleMenuOpen(false)}>
          <View
            style={[
              styles.menu,
              styles.vehicleMenu,
              cardShadow,
              {
                top: vehicleMenuPos.top,
                left: vehicleMenuPos.left,
                backgroundColor: c.menuBg,
                borderColor: c.menuBorder,
              },
            ]}
          >
            <Text style={[styles.menuTitle, { color: c.muted }]}>SHOW EXPENSES FOR</Text>
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {[{ id: null, label: 'All vehicles' }, ...vehicles.map(v => ({
                id: v.id,
                label: [v.brand, v.model].filter(Boolean).join(' ') || 'Vehicle',
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
                      numberOfLines={1}
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
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)}>
          <View
            style={[
              styles.menu,
              cardShadow,
              {
                top: menuPos.top,
                right: menuPos.right,
                backgroundColor: c.menuBg,
                borderColor: c.menuBorder,
              },
            ]}
          >
            <Text style={[styles.menuTitle, { color: c.muted }]}>MONTHS · {selectedYear}</Text>
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
        onRequestClose={() => setYearMenuOpen(false)}
      >
        <Pressable style={styles.menuBackdrop} onPress={() => setYearMenuOpen(false)}>
          <View
            style={[
              styles.menu,
              cardShadow,
              {
                top: yearMenuPos.top,
                right: yearMenuPos.right,
                backgroundColor: c.menuBg,
                borderColor: c.menuBorder,
              },
            ]}
          >
            <Text style={[styles.menuTitle, { color: c.muted }]}>SELECT YEAR</Text>
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
  titleRow: {
    minHeight: 42, // same row height as Home's title row
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerText: {
    fontSize: 18,
    fontFamily: Typography.font.regular,
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
  statusWrap: {
    paddingVertical: 60,
    alignItems: 'center',
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
});
