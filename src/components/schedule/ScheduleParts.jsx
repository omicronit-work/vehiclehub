import React, { useMemo } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View, ScrollView, StatusBar } from 'react-native';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { accent } from '../../theme/accent';
import { MIN_TOUCH, shadowSoft } from '../../theme/tokens';
import { Typography } from '../../styles/typography';
import ServiceTypeIcon from '../../assets/svg/ServiceTypeIcon';
import Arrow from '../../assets/svg/Arrow';
import { useScheduleHost } from '../../util/schedule/scheduleHostContext';
import {
  STATUS,
  MODES,
  chipLabel,
  ruleText,
  formatDistance,
  formatYmd,
  formatDays,
  dueInWords,
} from '../../util/schedule/scheduleMath';

// Shared building blocks for the service schedule screens (spec section 6).

// Form controls (inputs, chips, segmented rail, buttons) share one corner
// radius and one text size so a form reads as one set.
export const CONTROL_RADIUS = 14;
export const CONTROL_FONT = 15;
// Every card on the schedule pages.
export const CARD_RADIUS = 18;

// Cards float on an even, all-sides shadow — no borders, no elevation.
const SHADOW_LIGHT = { boxShadow: '0px 0px 18px 1px rgba(10, 37, 64, 0.08)' };
const SHADOW_DARK = { boxShadow: '0px 0px 24px 2px rgba(0, 0, 0, 0.45)' };
export const cardShadow = SHADOW_LIGHT;

/* ── Palette ────────────────────────────────────────────────────────────── */

export const useSchedulePalette = () => {
  const theme = useSelector(state => state.theme.theme);
  const isDark = theme === 'dark';
  return useMemo(
    () => ({
      isDark,
      header: isDark ? '#070F1C' : accent.primary,
      headerPill: isDark ? accent.lightAlpha(0.14) : 'rgba(255,255,255,0.18)',
      surface: isDark ? '#0A1E38' : '#FFFFFF',
      // Page behind the cards: a step off the card colour so cards lift.
      screen: isDark ? '#061530' : '#F3F6F9',
      card: isDark ? '#0A1E38' : '#FFFFFF',
      shadow: isDark ? SHADOW_DARK : SHADOW_LIGHT,
      field: isDark ? 'rgba(255,255,255,0.06)' : '#F3F5F8',
      cardBorder: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(4,25,51,0.08)',
      text: isDark ? '#FFFFFF' : '#041933',
      muted: isDark ? 'rgba(255,255,255,0.62)' : 'rgba(4,25,51,0.6)',
      faint: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(4,25,51,0.45)',
      track: isDark ? 'rgba(255,255,255,0.1)' : '#E6EAF0',
      accent: isDark ? accent.light : accent.primary,
      accentTint: isDark ? accent.lightAlpha(0.12) : accent.alpha(0.08),
      // Vehicle.jsx's countBg: header pills on embedded pages.
      pillBg: isDark ? accent.lightAlpha(0.12) : accent.alpha(0.07),
      inputBg: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
      inputBorder: isDark ? 'rgba(255,255,255,0.18)' : '#DDE2E9',
      inputBorderActive: isDark ? accent.light : accent.primary,
      danger: isDark ? '#FF9C90' : '#C62828',
      railBg: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(4,25,51,0.05)',
      railChip: isDark ? 'rgba(255,255,255,0.14)' : '#FFFFFF',
      status: {
        [STATUS.OVERDUE]: {
          text: isDark ? '#FF9C90' : '#B42318',
          bg: isDark ? 'rgba(229,72,77,0.18)' : '#FDE8E8',
          bar: '#E5484D',
          soft: isDark ? 'rgba(229,72,77,0.10)' : '#FEF4F4',
          border: isDark ? 'rgba(229,72,77,0.35)' : '#F7C9C9',
        },
        [STATUS.SOON]: {
          text: isDark ? '#FFD180' : '#8A5300',
          bg: isDark ? 'rgba(245,165,36,0.18)' : '#FDF0CF',
          bar: '#E39B26',
          soft: isDark ? 'rgba(245,165,36,0.10)' : '#FEF8E7',
          border: isDark ? 'rgba(245,165,36,0.35)' : '#F4DC9C',
        },
        [STATUS.OK]: {
          text: isDark ? '#9CE6B0' : '#16794A',
          bg: isDark ? 'rgba(43,170,109,0.18)' : '#DDF3E6',
          bar: '#1F9D5C',
          soft: isDark ? 'rgba(43,170,109,0.10)' : '#F1FAF5',
          border: isDark ? 'rgba(43,170,109,0.35)' : '#BFE5CF',
        },
      },
    }),
    [isDark],
  );
};

/* ── Screen shell: coloured header with pill buttons, rounded body ──────── */

const HeaderPill = ({ label, onPress, p, chevron }) => (
  <TouchableOpacity
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
    activeOpacity={0.75}
    style={[styles.headerPill, { backgroundColor: p.headerPill }]}
  >
    <Text style={styles.headerPillText}>{chevron ? `‹ ${label}` : label}</Text>
  </TouchableOpacity>
);

export const ScreenShell = ({ title, left, right, footer, children, scroll = true }) => {
  const p = useSchedulePalette();
  const insets = useSafeAreaInsets();
  const host = useScheduleHost();
  const Body = scroll ? ScrollView : View;

  // Inside the Vehicle screen: no coloured header or status bar (the app
  // header and tab bar stay), just a Back / title / action row like the
  // vehicle detail's own.
  if (host) {
    return (
      <View style={styles.flex}>
        <View style={styles.embedHeader}>
          {left && <EmbedPill p={p} {...left} style={styles.embedPillLeft} />}
          <Text style={[styles.embedTitle, { color: p.text }]} numberOfLines={2} accessibilityRole="header">
            {title}
          </Text>
          {right && <EmbedPill p={p} {...right} />}
        </View>
        <Body
          style={styles.flex}
          contentContainerStyle={scroll ? styles.embedContent : undefined}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </Body>
        {footer && <View style={styles.embedFooter}>{footer}</View>}
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: p.header }]}>
      <StatusBar barStyle="light-content" backgroundColor={p.header} />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerSide}>
          {left && <HeaderPill p={p} {...left} />}
        </View>
        <Text style={styles.headerTitle} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
        <View style={[styles.headerSide, styles.headerSideRight]}>
          {right && <HeaderPill p={p} {...right} />}
        </View>
      </View>
      <View style={[styles.body, { backgroundColor: p.screen }]}>
        <Body
          style={styles.flex}
          contentContainerStyle={scroll ? styles.bodyContent : undefined}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </Body>
        {footer && (
          <View style={[styles.footer, p.shadow, { paddingBottom: Math.max(insets.bottom, 12) + 4, backgroundColor: p.card }]}>
            {footer}
          </View>
        )}
      </View>
    </View>
  );
};

// Same pill as the vehicle detail's Back / Export (Vehicle.jsx backButton).
const EmbedPill = ({ label, onPress, p, chevron, style }) => (
  <TouchableOpacity
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
    activeOpacity={0.7}
    style={[styles.embedPill, style]}
  >
    {chevron && <Arrow color={p.accent} style={styles.embedChevron} />}
    <Text style={[styles.embedPillText, { color: p.accent }]}>{label}</Text>
  </TouchableOpacity>
);

/* ── Small pieces ───────────────────────────────────────────────────────── */

export const SectionLabel = ({ children, style }) => {
  const p = useSchedulePalette();
  return <Text style={[styles.sectionLabel, { color: p.muted }, style]}>{children}</Text>;
};

export const StatusChip = ({ status, label, style, dot = false }) => {
  const p = useSchedulePalette();
  const s = p.status[status] || p.status[STATUS.OK];
  return (
    <View style={[styles.chip, dot && styles.chipWithDot, { backgroundColor: s.bg }, style]}>
      {dot && <View style={[styles.chipDot, { backgroundColor: s.bar }]} />}
      <Text style={[styles.chipText, { color: s.text }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
};

export const ProgressBar = ({ fill, status }) => {
  const p = useSchedulePalette();
  return (
    <View style={[styles.track, { backgroundColor: p.track }]}>
      <View style={[styles.bar, { width: `${Math.round(fill * 100)}%`, backgroundColor: p.status[status].bar }]} />
    </View>
  );
};

export const PrimaryAction = ({ title, onPress, disabled, loading, style, textStyle }) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      style={[styles.primary, { backgroundColor: accent.primary, opacity: disabled || loading ? 0.55 : 1 }, style]}
    >
      <Text style={[styles.primaryText, textStyle]}>{loading ? 'Saving…' : title}</Text>
    </TouchableOpacity>
  );
};

export const OutlineAction = ({ title, onPress, color, style }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.8}
    accessibilityRole="button"
    style={[styles.outline, { borderColor: color }, style]}
  >
    <Text style={[styles.outlineText, { color }]}>{title}</Text>
  </TouchableOpacity>
);

// `hide` (util/methods/useHideOnScroll) slides it away while the list
// scrolls down, so it can't sit on top of a card's buttons for good.
export const Fab = ({ label, onPress, bottom = 24, hide }) => {
  const button = (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label.replace('+', 'Add')}
      style={[styles.fab, { bottom, backgroundColor: accent.primary }, shadowSoft(4, accent.primary)]}
    >
      <Text style={styles.fabText}>{label}</Text>
    </TouchableOpacity>
  );
  if (!hide) return button;
  return (
    <Animated.View
      pointerEvents={hide.visible ? 'box-none' : 'none'}
      style={[StyleSheet.absoluteFill, hide.style]}
    >
      {button}
    </Animated.View>
  );
};

const ClockIcon = ({ color }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.8} />
    <Path d="M12 7v5l3 2" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// Summary-card stat icons (14px, drawn like ClockIcon).
export const UpcomingStatIcon = ({ color }) => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
    <Path
      d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const HistoryStatIcon = ({ color }) => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
    <Path
      d="M3.5 12a8.5 8.5 0 1 0 2.5-6M3.5 4v4h4M12 8v4l3 2"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const ExpiredStatIcon = ({ color }) => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
    <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} />
    <Path d="m9.2 9.2 5.6 5.6M14.8 9.2l-5.6 5.6" stroke={color} strokeWidth={2} strokeLinecap="round" />
  </Svg>
);

export const ValidStatIcon = ({ color }) => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
    <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} />
    <Path d="m8.5 12.2 2.4 2.4 4.6-4.8" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

/* ── Text helpers shared by list, detail and home ───────────────────────── */

/** "1,110 km left" / "Due now" / "Was due at 8,200 km · now 8,900 km" */
export const distanceLine = (e, unit, odometer) => {
  if (!e.distance) return '';
  const { left } = e.distance;
  if (left < 0) return `Was due at ${formatDistance(e.dueKm, unit)} · now ${formatDistance(odometer, unit)}`;
  if (left === 0) return 'Due now';
  return `${formatDistance(left, unit)} left`;
};

export const timeLine = e => {
  if (!e.time) return '';
  const { left } = e.time;
  if (left < 0) return `Was due ${formatYmd(e.dueDate)}`;
  if (left === 0) return 'Due today';
  return `${formatDays(left)} left`;
};

/** Second line of a Home "Upcoming" row. */
export const upcomingLine = (e, unit) => {
  if (e.headline === 'distance' && e.distance) {
    return e.distance.left < 0
      ? `Was due at ${formatDistance(e.dueKm, unit)}`
      : `Due at ${formatDistance(e.dueKm, unit)}`;
  }
  if (e.time) {
    const prefix = e.time.left < 0 ? 'Was due' : 'Due';
    const or = e.dueKm !== null && e.distance ? ` or ${formatDistance(e.dueKm, unit)}` : '';
    return `${prefix} ${formatYmd(e.dueDate)}${or}`;
  }
  return 'Add an odometer reading';
};

/* ── Cards ──────────────────────────────────────────────────────────────── */

// Big value + caption for one limit tile ("6,050 km" / "left").
// `words` lets other cards reword it (documents: "Expires today" / "expired").
const limitValue = (lim, fmt, words = {}) => {
  if (lim.left === 0) return { value: words.now || 'Due now', caption: '' };
  if (lim.left < 0) return { value: fmt(-lim.left), caption: words.over || 'overdue' };
  return { value: fmt(lim.left), caption: words.left || 'left' };
};

export const LimitTile = ({ p, label, lim, fmt, words }) => {
  const s = p.status[lim.status];
  const { value, caption } = limitValue(lim, fmt, words);
  return (
    <View style={[styles.tile, { backgroundColor: p.field }]}>
      <Text style={[styles.tileLabel, { color: p.muted }]}>{label}</Text>
      <Text style={styles.tileValueRow} numberOfLines={1}>
        <Text style={[styles.tileValue, { color: lim.status === STATUS.OK ? p.text : s.text }]}>{value}</Text>
        {!!caption && <Text style={[styles.tileCaption, { color: p.muted }]}>{` ${caption}`}</Text>}
      </Text>
      <ProgressBar fill={lim.fill} status={lim.status} />
    </View>
  );
};

export const ChevronRight = ({ color, size = 16 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M9 6l6 6-6 6" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

/** Screen 2: one rule — icon, status, a tile per limit and next due. */
export const ScheduleCard = ({ evaluation: e, unit, onPress }) => {
  const p = useSchedulePalette();
  const s = p.status[e.status];
  const label = chipLabel(e.chip, unit);
  const both = e.rule.mode === MODES.BOTH && e.distance && e.time;
  const timeFirst = e.headline === 'time';
  const nextDue =
    timeFirst || e.dueKm === null
      ? e.dueDate ? formatYmd(e.dueDate) : null
      : formatDistance(e.dueKm, unit);
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${e.rule.name}, ${label}${nextDue ? `, next due ${nextDue}` : ''}`}
      style={[styles.card, styles.cardPremium, p.shadow, { backgroundColor: p.card }]}
    >
      <View style={styles.cardTop}>
        <View style={[styles.cardIcon, { backgroundColor: s.bg }]}>
          <ServiceTypeIcon name={e.rule.serviceType || e.rule.name} color={s.text} size={22} />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.cardTitle, { color: p.text }]} numberOfLines={1}>
            {e.rule.name}
          </Text>
          <Text style={[styles.cardSub, { color: p.muted }]} numberOfLines={2}>
            {ruleText(e.rule, unit)}
          </Text>
        </View>
        <StatusChip status={e.status} label={label} dot />
      </View>

      {(e.distance || e.time) && (
        <View style={styles.tiles}>
          {e.distance && <LimitTile p={p} label="DISTANCE" lim={e.distance} fmt={v => formatDistance(v, unit)} />}
          {e.time && <LimitTile p={p} label="TIME" lim={e.time} fmt={formatDays} />}
        </View>
      )}
      {e.needsOdometer && (
        <Text style={[styles.cardHint, { color: p.muted }]}>Add an odometer reading to track distance.</Text>
      )}

      {!!nextDue && (
        <View style={[styles.cardFooter, { borderTopColor: p.cardBorder }]}>
          <View style={styles.flex}>
            <Text style={[styles.tileLabel, { color: p.muted }]}>NEXT DUE</Text>
            <Text style={[styles.nextDueValue, { color: p.text }]} numberOfLines={1}>
              {nextDue}
            </Text>
          </View>
          {both && (
            <View style={[styles.firstPill, { backgroundColor: p.accentTint }]}>
              <Text style={[styles.firstText, { color: p.accent }]}>
                {timeFirst ? 'Time comes first' : 'Distance comes first'}
              </Text>
            </View>
          )}
          <ChevronRight color={p.faint} />
        </View>
      )}
    </TouchableOpacity>
  );
};

/** A tappable settings-style row (icon well, title, subtitle, chevron). */
export const LinkRow = ({ icon, title, subtitle, onPress }) => {
  const p = useSchedulePalette();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={[styles.linkRow, p.shadow, { backgroundColor: p.card }]}
    >
      <View style={[styles.cardIcon, { backgroundColor: p.accentTint }]}>{icon}</View>
      <View style={styles.flex}>
        <Text style={[styles.linkTitle, { color: p.text }]}>{title}</Text>
        {!!subtitle && (
          <Text style={[styles.cardSub, { color: p.muted }]} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      <ChevronRight color={p.faint} />
    </TouchableOpacity>
  );
};

// A schedule that isn't due yet reads "In 120 days" / "In 4,000 km" rather
// than a bare "OK", using whichever limit is shown on the line beside it.
const upcomingChipLabel = (e, unit) => {
  if (e.status !== STATUS.OK) return chipLabel(e.chip, unit);
  if (e.headline === 'distance' && e.distance) return `In ${formatDistance(e.distance.left, unit)}`;
  if (e.time) return `In ${formatDays(e.time.left)}`;
  if (e.distance) return `In ${formatDistance(e.distance.left, unit)}`;
  return 'OK';
};

export const UpcomingRow = ({ evaluation: e, unit, onPress }) => {
  const p = useSchedulePalette();
  const s = p.status[e.status];
  const label = upcomingChipLabel(e, unit);
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`${e.rule.name}, ${dueInWords(e, unit)}`}
      style={[styles.row, p.shadow, { backgroundColor: p.card }]}
    >
      <View style={[styles.rowIcon, { backgroundColor: e.status === STATUS.OK ? p.field : s.bg }]}>
        <ServiceTypeIcon name={e.rule.serviceType || e.rule.name} color={e.status === STATUS.OK ? p.muted : s.text} size={20} />
      </View>
      <View style={styles.flex}>
        <Text style={[styles.cardTitle, { color: p.text }]} numberOfLines={1}>
          {e.rule.name}
        </Text>
        {/* Plain words first ("Due in 320 km or 12 days"); colour only when
            it needs attention: red overdue, amber due soon. */}
        <Text
          style={[styles.cardSub, { color: e.status === STATUS.OK ? p.muted : s.text }]}
          numberOfLines={2}
        >
          {dueInWords(e, unit)}
        </Text>
      </View>
      {e.status !== STATUS.OK && <StatusChip status={e.status} label={label} />}
    </TouchableOpacity>
  );
};

/**
 * Screen 1: "Service schedule · 1 overdue · 1 due soon · View all".
 * Home → Documents reuses it with its own `title`, `text`, `icon` and
 * `actionLabel` ("Document renewals · 2 expired · Add").
 * `stats` ([{ key, label, value, icon: color => node }]) replaces the text
 * line with "Upcoming: 2 | Completed: 2".
 */
export const ScheduleSummaryCard = ({
  counts,
  total,
  onPress,
  expanded = false,
  title = 'Service schedule',
  text: textProp,
  actionLabel,
  icon,
  stats,
}) => {
  const p = useSchedulePalette();
  // Always the amber "schedule" card from the design, whatever the counts.
  const s = p.isDark
    ? { card: 'rgba(245,165,36,0.12)', border: 'rgba(245,165,36,0.35)', well: 'rgba(245,165,36,0.22)', icon: '#FFD180' }
    : { card: '#FDF3D7', border: '#F5DD9E', well: '#FBE4A6', icon: '#8A5300' };
  const parts = [counts.overdue && `${counts.overdue} overdue`, counts.soon && `${counts.soon} due soon`].filter(Boolean);
  const text = textProp ?? (total === 0 ? 'Set up reminders for oil, tyres and more' : parts.length ? parts.join(' · ') : 'All up to date');
  const action = actionLabel ?? (!total ? 'Set up' : expanded ? 'Hide' : 'View all');
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${text}, ${action.toLowerCase()}`}
      accessibilityState={total ? { expanded } : undefined}
      style={[styles.summary, { backgroundColor: s.card, borderColor: s.border }]}
    >
      <View style={[styles.summaryIcon, { backgroundColor: s.well }]}>
        {icon ? icon(s.icon) : <ClockIcon color={s.icon} />}
      </View>
      <View style={styles.flex}>
        <Text style={[styles.cardTitle, { color: p.text }]}>{title}</Text>
        {stats?.length ? (
          <View style={styles.summaryStats}>
            {stats.map((st, i) => (
              <React.Fragment key={st.key}>
                {i > 0 && <Text style={[styles.cardSub, styles.summaryStatSep, { color: p.faint }]}>|</Text>}
                <View style={styles.summaryStat}>
                  {st.icon?.(p.muted)}
                  <Text style={[styles.cardSub, styles.summaryStatText, { color: p.muted }]}>
                    {`${st.label}: `}
                    <Text style={[styles.summaryStatValue, { color: p.text }]}>{st.value}</Text>
                  </Text>
                </View>
              </React.Fragment>
            ))}
          </View>
        ) : (
          <Text style={[styles.cardSub, { color: p.muted }]}>{text}</Text>
        )}
      </View>
      <Text style={[styles.viewAll, { color: p.accent }]}>{action}</Text>
    </TouchableOpacity>
  );
};

/* ── Form pieces ────────────────────────────────────────────────────────── */

export const FieldLabel = ({ children }) => {
  const p = useSchedulePalette();
  return <Text style={[styles.fieldLabel, { color: p.text }]}>{children}</Text>;
};

export const FieldError = ({ children }) => {
  const p = useSchedulePalette();
  return children ? <Text style={[styles.fieldError, { color: p.danger }]}>{children}</Text> : null;
};

// Filled field: soft fill at rest, accent outline only while focused (red
// on error). The outline is always 1.5 wide so focusing never shifts text.
export const inputStyle = (p, { active, error } = {}) => [
  styles.input,
  {
    backgroundColor: p.field,
    color: p.text,
    borderColor: error ? p.danger : active ? p.inputBorderActive : 'transparent',
    borderWidth: 1.5,
  },
];

export const Segmented = ({ options, value, onChange }) => {
  const p = useSchedulePalette();
  return (
    <View style={[styles.rail, { backgroundColor: p.railBg }]} accessibilityRole="tablist">
      {options.map(o => {
        const active = o.value === value;
        return (
          <TouchableOpacity
            key={o.value}
            onPress={() => onChange(o.value)}
            activeOpacity={0.85}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.railChip, active && [{ backgroundColor: p.railChip }, p.shadow]]}
          >
            <Text
              style={[styles.railText, { color: active ? p.text : p.muted, fontFamily: active ? Typography.font.medium : Typography.font.regular }]}
              numberOfLines={1}
            >
              {o.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

/**
 * Small pill filters under a tab bar ("Upcoming 3 · History 1"). `options`:
 * [{ value, label, count }]. Active pill is filled with the accent colour.
 */
export const FilterChips = ({ options, value, onChange, style }) => {
  const p = useSchedulePalette();
  return (
    <View style={[styles.filterRow, style]} accessibilityRole="radiogroup">
      {options.map(o => {
        const active = o.value === value;
        return (
          <TouchableOpacity
            key={o.value}
            onPress={() => onChange(o.value)}
            activeOpacity={0.8}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={o.count != null ? `${o.label}, ${o.count}` : o.label}
            style={[styles.filterChip, { backgroundColor: active ? p.accent : p.pillBg }]}
          >
            <Text style={[styles.filterText, { color: active ? '#fff' : p.accent }]}>{o.label}</Text>
            {o.count != null && (
              <View style={[styles.filterCount, { backgroundColor: active ? 'rgba(255,255,255,0.22)' : p.card }]}>
                <Text style={[styles.filterCountText, { color: active ? '#fff' : p.accent }]}>{o.count}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export const InfoBox = ({ children, style }) => {
  const p = useSchedulePalette();
  return <View style={[styles.infoBox, { backgroundColor: p.accentTint }, style]}>{children}</View>;
};

export const KeyValue = ({ k, v, last }) => {
  const p = useSchedulePalette();
  return (
    <View style={[styles.kv, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: p.cardBorder }]}>
      <Text style={[styles.kvKey, { color: p.text }]}>{k}</Text>
      <Text style={[styles.kvValue, { color: p.text }]}>{v}</Text>
    </View>
  );
};

export const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontFamily: Typography.font.medium, fontWeight: '700' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 18,
  },
  headerSide: { width: 92, alignItems: 'flex-start' },
  headerSideRight: { alignItems: 'flex-end' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#fff',
    fontFamily: Typography.font.medium,
    fontWeight: '700',
    fontSize: 18,
  },
  headerPill: {
    minHeight: MIN_TOUCH - 4,
    paddingHorizontal: 16,
    borderRadius: 22,
    justifyContent: 'center',
  },
  headerPillText: { color: '#fff', fontFamily: Typography.font.medium, fontSize: 14, fontWeight: '600' },
  body: {
    flex: 1,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
  },
  bodyContent: { padding: 16, paddingBottom: 40, gap: 12 },
  footer: { paddingHorizontal: 16, paddingTop: 12, flexDirection: 'row', gap: 12 },
  embedHeader: { flexDirection: 'row', alignItems: 'center', minHeight: 48, marginBottom: 4, gap: 4 },
  // The back pill's own padding lines its chevron up with the content edge
  // instead of indenting it; the 44 pt touch area stays the same.
  embedPillLeft: { marginLeft: -14 },
  embedTitle: { flex: 1, fontFamily: Typography.font.medium, fontWeight: '700', fontSize: 18 },
  embedPill: { minHeight: MIN_TOUCH, paddingHorizontal: 14, borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 6 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: { minHeight: 36, paddingHorizontal: 14, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterText: { fontFamily: Typography.font.medium, fontSize: 13 },
  filterCount: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  filterCountText: { fontFamily: Typography.font.medium, fontSize: 12, fontWeight: '700' },
  embedChevron: { transform: [{ rotate: '180deg' }] },
  embedPillText: { fontFamily: Typography.font.medium, fontWeight: '700', fontSize: 13 },
  embedContent: { paddingHorizontal: 4, paddingTop: 8, paddingBottom: 24, gap: 12 },
  embedFooter: { paddingTop: 12, paddingBottom: 12, flexDirection: 'row', gap: 12 },
  sectionLabel: { fontFamily: Typography.font.medium, fontSize: 12, letterSpacing: 1.2, marginTop: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, maxWidth: 170 },
  chipText: { fontFamily: Typography.font.medium, fontSize: 12, fontWeight: '700' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 6 },
  bar: { height: 6, borderRadius: 3 },
  // Same size, type and pill shape as the app's other buttons
  // (e.g. "+ Add service record": 48 tall, radius 24, 14 pt medium).
  primary: { flex: 1, height: 48, borderRadius: CONTROL_RADIUS, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  primaryText: { color: '#fff', fontFamily: Typography.font.medium, fontSize: CONTROL_FONT },
  outline: { height: 48, borderRadius: CONTROL_RADIUS, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  outlineText: { fontFamily: Typography.font.medium, fontSize: CONTROL_FONT },
  // Same as Home's floating "+ Service" button.
  fab: {
    position: 'absolute',
    right: 4,
    minHeight: MIN_TOUCH,
    paddingHorizontal: 16,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabText: { color: '#fff', fontFamily: Typography.font.medium, fontWeight: '700', fontSize: 13 },
  card: { borderRadius: CARD_RADIUS, padding: 16, gap: 4 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardPremium: { padding: 16, gap: 14 },
  cardIcon: { width: 44, height: 44, borderRadius: CONTROL_RADIUS, alignItems: 'center', justifyContent: 'center' },
  chipWithDot: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  tiles: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, borderRadius: CONTROL_RADIUS, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12, gap: 4 },
  tileLabel: { fontFamily: Typography.font.medium, fontWeight: '700', fontSize: 11, letterSpacing: 1.2 },
  tileValueRow: { marginTop: 2 },
  tileValue: { fontFamily: Typography.font.medium, fontWeight: '700', fontSize: 18, letterSpacing: -0.3 },
  tileCaption: { fontFamily: Typography.font.regular, fontSize: 13 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  nextDueValue: { fontFamily: Typography.font.medium, fontWeight: '700', fontSize: 16, marginTop: 2 },
  firstPill: { borderRadius: CONTROL_RADIUS, paddingHorizontal: 10, paddingVertical: 5 },
  firstText: { fontFamily: Typography.font.medium, fontWeight: '700', fontSize: 12 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: CARD_RADIUS, padding: 14 },
  linkTitle: { fontFamily: Typography.font.medium, fontWeight: '700', fontSize: CONTROL_FONT },
  cardTitle: { fontFamily: Typography.font.medium, fontWeight: '700', fontSize: 16 },
  cardSub: { fontFamily: Typography.font.regular, fontSize: 13, marginTop: 2 },
  cardHint: { fontFamily: Typography.font.regular, fontSize: 13, marginTop: 6 },
  limit: { marginTop: 8 },
  limitRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  limitLabel: { fontFamily: Typography.font.regular, fontSize: 13 },
  limitRight: { fontFamily: Typography.font.regular, fontSize: 13, flexShrink: 1, textAlign: 'right' },
  nextDue: { fontFamily: Typography.font.regular, fontSize: 14, marginTop: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, padding: 14 },
  rowIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 14 },
  // Same well as rowIcon (the history rows under it).
  summaryIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  summaryStats: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 2 },
  summaryStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  summaryStatText: { marginTop: 0 },
  summaryStatSep: { marginTop: 0, marginHorizontal: 8 },
  summaryStatValue: { fontFamily: Typography.font.medium, fontWeight: '700' },
  viewAll: { fontFamily: Typography.font.medium, fontWeight: '700', fontSize: 14 },
  fieldLabel: { fontFamily: Typography.font.regular, fontSize: 14, marginBottom: 6 },
  fieldError: { fontFamily: Typography.font.regular, fontSize: 12, marginTop: 4 },
  input: {
    minHeight: 52,
    borderRadius: CONTROL_RADIUS,
    paddingHorizontal: 14,
    fontFamily: Typography.font.regular,
    fontSize: CONTROL_FONT,
    justifyContent: 'center',
  },
  rail: { flexDirection: 'row', padding: 4, borderRadius: CONTROL_RADIUS, gap: 4 },
  railChip: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  railText: { fontSize: CONTROL_FONT },
  infoBox: { borderRadius: 14, padding: 14, gap: 6 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, gap: 12 },
  kvKey: { fontFamily: Typography.font.regular, fontSize: 14 },
  kvValue: { fontFamily: Typography.font.medium, fontWeight: '700', fontSize: 14, flexShrink: 1, textAlign: 'right' },
});
