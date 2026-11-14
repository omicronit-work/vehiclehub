import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import Text from './ui/AppText';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import { t as tr } from '../i18n';
import { monthNames } from '../i18n';
import { localizeDigits } from '../i18n/localizeText';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

const MONTHS = monthNames('short');
const MONTHS_FULL = monthNames('long');

const TOP_PAD = 22;      // room for the selected bar's value label
const EMPTY_STUB = 4;    // height of the placeholder bar for months with no data
const BAR_RATIO = 0.56;  // bar width as a share of its month slot

/**
 * Monthly fuel economy as bars, coloured by whether each month beat the
 * year's average (dashed line). The y-axis starts at 60% of the lowest month
 * rather than 0 so a 13 → 15 km/L change reads at a glance. Months with no
 * fill-ups get a short grey stub. Below the bars: best and lowest month.
 */
const FuelEconomyChart = ({
  values,
  average,
  unit,
  selectedMonth,
  onSelectMonth,
  width,
  height = 170,
  colors: c,
  animKey,
  reduceMotion,
}) => {
  const slotWidth = width / MONTHS.length;
  const barWidth = Math.max(slotWidth * BAR_RATIO, 6);
  const fontSize = width < 280 ? 11 : 12;
  const format = v => `${v.toFixed(1)} ${unit}`;

  const growAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animKey) return;
    if (reduceMotion) {
      growAnim.setValue(1);
      return;
    }
    growAnim.setValue(0);
    Animated.timing(growAnim, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [animKey, reduceMotion, growAnim]);

  const present = useMemo(() => values.filter(v => v != null && v > 0), [values]);
  const lo = present.length ? Math.min(...present) * 0.6 : 0;
  const hi = present.length ? Math.max(...present) * 1.04 : 1;
  const plotH = height - TOP_PAD;
  const toY = v => TOP_PAD + (1 - (v - lo) / (hi - lo || 1)) * plotH;

  const bars = useMemo(
    () =>
      values.map((v, i) => {
        const empty = v == null || v <= 0;
        const y = empty ? height - EMPTY_STUB : toY(v);
        return {
          value: v,
          empty,
          slotLeft: slotWidth * i,
          x: slotWidth * i + (slotWidth - barWidth) / 2,
          y,
          h: height - y,
          aboveAvg: !empty && average != null && v >= average,
        };
      }),
    // toY only depends on lo/hi/plotH, which derive from values + height
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [values, average, height, slotWidth, barWidth],
  );

  const best = useMemo(() => {
    let b = -1;
    values.forEach((v, i) => { if (v > 0 && (b < 0 || v > values[b])) b = i; });
    return b;
  }, [values]);
  const worst = useMemo(() => {
    let w = -1;
    values.forEach((v, i) => { if (v > 0 && (w < 0 || v < values[w])) w = i; });
    return w;
  }, [values]);

  const avgY = average != null ? toY(average) : null;
  const selected = bars[selectedMonth];
  const labelX = selected ? Math.min(Math.max(selected.x + barWidth / 2, 22), width - 22) : 0;

  return (
    <>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width, height }}>
        <Svg width={width} height={height}>
          <Line x1="0" y1={height - 0.5} x2={width} y2={height - 0.5} stroke={c.grid} strokeWidth="1" />

          {bars.map((b, i) => {
            const isSelected = i === selectedMonth;
            const fill = b.empty
              ? c.grid
              : isSelected
                ? c.line
                : b.aboveAvg
                  ? c.barStrong
                  : c.barMuted;
            return (
              <AnimatedRect
                key={i}
                x={b.x}
                width={barWidth}
                y={growAnim.interpolate({ inputRange: [0, 1], outputRange: [height, b.y] })}
                height={growAnim.interpolate({ inputRange: [0, 1], outputRange: [0, b.h] })}
                rx={Math.min(barWidth / 2, 6)}
                fill={fill}
              />
            );
          })}

          {avgY != null && (
            <Line
              x1="0"
              y1={avgY}
              x2={width}
              y2={avgY}
              stroke={c.guide}
              strokeWidth="1.5"
              strokeDasharray="4,5"
            />
          )}

          {selected && !selected.empty && (
            <SvgText
              x={labelX}
              y={selected.y - 7}
              fill={c.link}
              fontSize="12"
              fontFamily="RobotoCondensed500"
              textAnchor="middle"
            >
              {localizeDigits(selected.value.toFixed(1))}
            </SvgText>
          )}
        </Svg>

        {bars.map((b, i) => (
          <Pressable
            key={`press-${i}`}
            onPress={() => onSelectMonth(i)}
            style={{ position: 'absolute', left: b.slotLeft, top: 0, width: slotWidth, height }}
          />
        ))}
      </View>

      <View style={[styles.monthLabels, { width }]}>
        {MONTHS.map((m, i) => (
          <Pressable
            key={i}
            onPress={() => onSelectMonth(i)}
            accessibilityRole="button"
            accessibilityLabel={`${MONTHS_FULL[i]}: ${bars[i].empty ? tr('no fill-ups') : format(bars[i].value)}`}
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
                  fontSize,
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

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: c.barStrong }]} />
          <Text style={[styles.legendText, { color: c.muted }]}>{tr('At or above average')}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: c.barMuted }]} />
          <Text style={[styles.legendText, { color: c.muted }]}>{tr('Below average')}</Text>
        </View>
      </View>

      {best >= 0 && worst >= 0 && best !== worst && (
        <View style={[styles.extremes, { borderTopColor: c.grid }]}>
          <Pressable
            style={styles.extreme}
            onPress={() => onSelectMonth(best)}
            accessibilityRole="button"
            accessibilityLabel={tr('Best month: {0}, {1}', { 0: MONTHS_FULL[best], 1: format(values[best]) })}
          >
            <Text style={[styles.extremeLabel, { color: c.muted }]}>{tr('BEST')}</Text>
            <Text style={[styles.extremeValue, { color: c.text }]}>{format(values[best])}</Text>
            <Text style={[styles.extremeMonth, { color: c.muted }]}>{MONTHS_FULL[best]}</Text>
          </Pressable>
          <View style={[styles.extremeDivider, { backgroundColor: c.grid }]} />
          <Pressable
            style={styles.extreme}
            onPress={() => onSelectMonth(worst)}
            accessibilityRole="button"
            accessibilityLabel={tr('Lowest month: {0}, {1}', { 0: MONTHS_FULL[worst], 1: format(values[worst]) })}
          >
            <Text style={[styles.extremeLabel, { color: c.muted }]}>{tr('LOWEST')}</Text>
            <Text style={[styles.extremeValue, { color: c.text }]}>{format(values[worst])}</Text>
            <Text style={[styles.extremeMonth, { color: c.muted }]}>{MONTHS_FULL[worst]}</Text>
          </Pressable>
        </View>
      )}
    </>
  );
};

export default FuelEconomyChart;

const styles = StyleSheet.create({
  monthLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
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
  legendRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 12,
    fontFamily: 'RobotoCondensed400',
  },
  extremes: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 12,
  },
  extreme: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  extremeDivider: {
    width: 1,
    alignSelf: 'stretch',
  },
  extremeLabel: {
    fontSize: 11,
    fontFamily: 'RobotoCondensed500',
    letterSpacing: 1.2,
  },
  extremeValue: {
    fontSize: 16,
    fontFamily: 'RobotoCondensed500',
  },
  extremeMonth: {
    fontSize: 12,
    fontFamily: 'RobotoCondensed400',
  },
});
