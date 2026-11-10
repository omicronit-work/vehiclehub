import React, { useCallback, useMemo, useState } from 'react';
import { AppState, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import {
  ScreenShell,
  SectionLabel,
  useSchedulePalette,
} from '../../components/schedule/ScheduleParts';
import { NotificationSkeleton } from '../../components/schedule/ScheduleSkeletons';
import { useVehicleSchedules } from '../../util/schedule/useVehicleSchedules';
import { setAlertSettings, useAlertSettings, useDistanceUnit } from '../../util/schedule/scheduleSettings';
import { applyAlertValuesToAll } from '../../util/schedule/scheduleStore';
import { ALERT_HOUR, planRuleNotifications, distanceTransition } from '../../util/schedule/scheduleReminders';
import { resyncScheduleReminders } from '../../util/reminderSync';
import { fetchVehicleByEmail } from '../../store/fetchSlice';
import {
  isNotificationsEnabled,
  openNotificationSettings,
  requestNotificationPermission,
} from '../../util/notifications';
import { formatDistance, formatDays, formatYmd, todayYmd, toYmd } from '../../util/schedule/scheduleMath';
import { accent } from '../../theme/accent';
import { Typography } from '../../styles/typography';

const OPTIONS = {
  warnKm: [250, 500, 1000, 1500],
  warnDays: [7, 14, 30],
  repeatOverdueDays: [0, 3, 7, 14],
};

const pad = n => String(n).padStart(2, '0');
const ALERT_TIME = `${pad(ALERT_HOUR)}:00`;

/* ── Icons ──────────────────────────────────────────────────────────────── */

const BellIcon = ({ color, size = 22 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M6 9a6 6 0 1 1 12 0c0 4.5 1.5 6 2 6.5H4c.5-.5 2-2 2-6.5Z"
      stroke={color}
      strokeWidth={1.8}
      strokeLinejoin="round"
    />
    <Path d="M10 19a2 2 0 0 0 4 0" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
  </Svg>
);

const RoadIcon = ({ color }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Path d="M8 3 5 21M16 3l3 18M12 4v3M12 11v3M12 18v2" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
  </Svg>
);

const CalendarIcon = ({ color }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Rect x={3.5} y={5} width={17} height={15} rx={3} stroke={color} strokeWidth={1.8} />
    <Path d="M3.5 10h17M8 3v4M16 3v4" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
  </Svg>
);

const RepeatIcon = ({ color }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Path
      d="M4 12a8 8 0 0 1 13.7-5.6L20 9M20 4v5h-5M20 12a8 8 0 0 1-13.7 5.6L4 15M4 20v-5h5"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const InfoIcon = ({ color }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.8} />
    <Path d="M12 11v5M12 8h.01" stroke={color} strokeWidth={2} strokeLinecap="round" />
  </Svg>
);

const Chevron = ({ color, open }) => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
    <Path d="M6 9l6 6 6-6" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

/* ── Pieces ─────────────────────────────────────────────────────────────── */

const Toggle = ({ on, p }) => (
  <View style={[styles.track, { backgroundColor: on ? accent.primary : p.track }]}>
    <View style={[styles.thumb, { transform: [{ translateX: on ? 20 : 0 }] }]} />
  </View>
);

/** Phone-notification look-alike for the preview list. */
const NotificationPreview = ({ p, item }) => {
  const now = item.fireAt <= Date.now() + 5000;
  const when = now ? 'now' : `${formatYmd(toYmd(new Date(item.fireAt)))} · ${ALERT_TIME}`;
  return (
    <View style={[styles.note, p.shadow, { backgroundColor: p.card }]}>
      <View style={styles.noteHead}>
        <View style={[styles.appIcon, { backgroundColor: accent.primary }]}>
          <BellIcon color="#fff" size={12} />
        </View>
        <Text style={[styles.noteApp, { color: p.muted }]} numberOfLines={1}>
          VehicleHub · {when}
        </Text>
      </View>
      <Text style={[styles.noteTitle, { color: p.text }]}>{item.title}</Text>
      <Text style={[styles.noteBody, { color: p.muted }]}>{item.body}</Text>
    </View>
  );
};

// Screen 6 — Service alerts.
const ServiceAlertsScreen = ({ navigation, route }) => {
  const selectedCar = useSelector(state => state.user.selectedCar);
  const vehicleId = route.params?.vehicleId || selectedCar;
  const p = useSchedulePalette();
  const unit = useDistanceUnit();
  const settings = useAlertSettings();
  const { userEmail, data, evaluations, loading } = useVehicleSchedules(vehicleId);
  const [allowed, setAllowed] = useState(true);
  const [open, setOpen] = useState(null);

  const refreshPermission = useCallback(() => {
    isNotificationsEnabled().then(setAllowed).catch(() => setAllowed(false));
  }, []);

  // Re-check when returning from the system notification settings.
  useFocusEffect(
    useCallback(() => {
      refreshPermission();
      const sub = AppState.addEventListener('change', s => s === 'active' && refreshPermission());
      return () => sub.remove();
    }, [refreshPermission]),
  );

  const vehicleName = [data?.vehicle?.brand, data?.vehicle?.model].filter(Boolean).join(' ') || 'Your vehicle';

  // What this vehicle's alerts will actually say, soonest first.
  const examples = useMemo(() => {
    const today = todayYmd();
    const items = [];
    evaluations.forEach(e => {
      const now = distanceTransition({ ...e, rule: { ...e.rule, distanceAlert: null } }, { today, vehicleName, unit }).alert;
      if (now && e.distance && e.distance.status !== 'ok') items.push({ ...now, fireAt: Date.now(), key: `${e.rule.id}-now` });
      const next = planRuleNotifications(e, { vehicleName, unit })[0];
      if (next) items.push({ ...next, key: `${e.rule.id}-${next.suffix}` });
    });
    return items.sort((a, b) => a.fireAt - b.fireAt).slice(0, 3);
  }, [evaluations, vehicleName, unit]);

  const allVehicleIds = async () => (await fetchVehicleByEmail(userEmail)).map(v => v.id);

  const update = async patch => {
    setOpen(null);
    await setAlertSettings(patch);
    try {
      if (userEmail) {
        await applyAlertValuesToAll(userEmail, await allVehicleIds(), patch);
        await resyncScheduleReminders(userEmail);
      }
    } catch (e) {
      console.log('Applying alert settings failed:', e);
    }
  };

  const turnOn = async () => {
    const ok = await requestNotificationPermission().catch(() => false);
    if (ok) {
      setAllowed(true);
      // Rebuild everything after the permission is granted (spec 5).
      resyncScheduleReminders(userEmail).catch(() => {});
    } else {
      openNotificationSettings().catch(() => {});
    }
  };

  const optionText = (key, v) =>
    key === 'warnKm' ? formatDistance(v, unit) : key === 'repeatOverdueDays' && v === 0 ? 'Never' : formatDays(v);
  const valueText = (key, v) =>
    key === 'repeatOverdueDays' ? (v === 0 ? 'Never' : `Every ${formatDays(v)}`) : `${optionText(key, v)} before`;

  const rows = [
    { key: 'warnKm', label: 'Distance warning', hint: 'How close to the due distance', Icon: RoadIcon },
    { key: 'warnDays', label: 'Time warning', hint: 'How long before the due date', Icon: CalendarIcon },
    { key: 'repeatOverdueDays', label: 'Repeat while overdue', hint: 'Until you mark it done', Icon: RepeatIcon },
  ];
  const on = settings.enabled;

  return (
    <ScreenShell title="Service alerts" left={{ label: 'Back', chevron: true, onPress: () => navigation.goBack() }}>
      {/* Permission off: explain, offer to fix */}
      {!allowed && (
        <TouchableOpacity
          onPress={turnOn}
          accessibilityRole="button"
          activeOpacity={0.85}
          style={[styles.banner, { backgroundColor: p.status.soon.soft }]}
        >
          <View style={[styles.bannerIcon, { backgroundColor: p.status.soon.bg }]}>
            <BellIcon color={p.status.soon.text} size={18} />
          </View>
          <Text style={[styles.bannerText, { color: p.text }]}>
            Notifications are off for VehicleHub. Due dates still show in the app.
          </Text>
          <Text style={[styles.bannerAction, { color: p.accent }]}>Turn on</Text>
        </TouchableOpacity>
      )}

      {/* Master switch */}
      <TouchableOpacity
        onPress={() => update({ enabled: !on })}
        accessibilityRole="switch"
        accessibilityLabel="Service reminders"
        accessibilityState={{ checked: on }}
        activeOpacity={0.85}
        style={[styles.hero, p.shadow, { backgroundColor: p.card }]}
      >
        <View style={[styles.heroIcon, { backgroundColor: on ? accent.primary : p.field }]}>
          <BellIcon color={on ? '#fff' : p.muted} />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.heroTitle, { color: p.text }]}>Service reminders</Text>
          <Text style={[styles.heroSub, { color: p.muted }]}>
            {on ? `On · timed alerts arrive at ${ALERT_TIME}` : 'Off · no service notifications'}
          </Text>
        </View>
        <Toggle on={on} p={p} />
      </TouchableOpacity>

      {/* Preview */}
      <SectionLabel>{data ? `COMING UP FOR ${vehicleName.toUpperCase()}` : 'COMING UP'}</SectionLabel>
      {loading && !data ? (
        <NotificationSkeleton />
      ) : examples.length === 0 ? (
        <View style={[styles.emptyCard, p.shadow, { backgroundColor: p.card }]}>
          <View style={[styles.rowIcon, { backgroundColor: p.accentTint }]}>
            <BellIcon color={p.accent} size={18} />
          </View>
          <Text style={[styles.emptyText, { color: p.muted }]}>
            No alerts queued yet. Add a schedule to see what they will look like.
          </Text>
        </View>
      ) : (
        <View style={[styles.previewList, !on && styles.dim]}>
          {examples.map(x => (
            <NotificationPreview key={x.key} p={p} item={x} />
          ))}
        </View>
      )}

      {/* When to alert */}
      <SectionLabel>WHEN TO ALERT</SectionLabel>
      <View style={[styles.card, p.shadow, { backgroundColor: p.card }, !on && styles.dim]}>
        {rows.map((r, i) => {
          const expanded = open === r.key;
          return (
            <View
              key={r.key}
              style={i < rows.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: p.cardBorder }}
            >
              <TouchableOpacity
                onPress={() => setOpen(o => (o === r.key ? null : r.key))}
                disabled={!on}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                accessibilityLabel={`${r.label}, ${valueText(r.key, settings[r.key])}`}
                style={styles.row}
              >
                <View style={[styles.rowIcon, { backgroundColor: p.accentTint }]}>
                  <r.Icon color={p.accent} />
                </View>
                <View style={styles.flex}>
                  <Text style={[styles.rowLabel, { color: p.text }]}>{r.label}</Text>
                  <Text style={[styles.rowHint, { color: p.muted }]}>{r.hint}</Text>
                </View>
                <View style={[styles.valuePill, { backgroundColor: p.accentTint }]}>
                  <Text style={[styles.valueText, { color: p.accent }]}>{valueText(r.key, settings[r.key])}</Text>
                  <Chevron color={p.accent} open={expanded} />
                </View>
              </TouchableOpacity>
              {expanded && (
                <View style={[styles.options, { backgroundColor: p.field }]}>
                  {OPTIONS[r.key].map(v => {
                    const active = v === settings[r.key];
                    return (
                      <TouchableOpacity
                        key={v}
                        onPress={() => update({ [r.key]: v })}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                        style={[styles.option, active && [{ backgroundColor: p.card }, p.shadow]]}
                      >
                        <Text
                          style={[
                            styles.optionText,
                            { color: active ? p.accent : p.muted },
                            active && styles.optionActive,
                          ]}
                        >
                          {optionText(r.key, v)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* How alerts work */}
      <View style={[styles.info, { backgroundColor: p.accentTint }]}>
        <InfoIcon color={p.accent} />
        <Text style={[styles.infoText, { color: p.text }]}>
          Date alerts are set in advance and arrive at {ALERT_TIME}, even with the app closed. Distance is checked when
          you save an odometer reading or open the app, so log fuel regularly. Changes here apply to all schedules;
          each one can still be changed in Edit.
        </Text>
      </View>
    </ScreenShell>
  );
};

export default ServiceAlertsScreen;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dim: { opacity: 0.45 },

  banner: { borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  bannerIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  bannerText: { flex: 1, fontFamily: Typography.font.regular, fontSize: 13, lineHeight: 18 },
  bannerAction: { fontFamily: Typography.font.medium, fontWeight: '700', fontSize: 14 },

  hero: { borderRadius: 18, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontFamily: Typography.font.medium, fontWeight: '700', fontSize: 17 },
  heroSub: { fontFamily: Typography.font.regular, fontSize: 13, marginTop: 2 },
  track: { width: 48, height: 28, borderRadius: 14, padding: 3 },
  thumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },

  previewList: { gap: 10 },
  note: { borderRadius: 18, padding: 14, gap: 3 },
  noteHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  appIcon: { width: 20, height: 20, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  noteApp: { flex: 1, fontFamily: Typography.font.regular, fontSize: 12 },
  noteTitle: { fontFamily: Typography.font.medium, fontWeight: '700', fontSize: 15 },
  noteBody: { fontFamily: Typography.font.regular, fontSize: 13, lineHeight: 18 },
  emptyCard: { borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  emptyText: { flex: 1, fontFamily: Typography.font.regular, fontSize: 13, lineHeight: 18 },

  card: { borderRadius: 18, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  rowIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontFamily: Typography.font.medium, fontSize: 15 },
  rowHint: { fontFamily: Typography.font.regular, fontSize: 12, marginTop: 1 },
  valuePill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  valueText: { fontFamily: Typography.font.medium, fontWeight: '700', fontSize: 13 },
  options: { flexDirection: 'row', borderRadius: 14, padding: 4, gap: 4, marginBottom: 14 },
  option: { flex: 1, borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  optionText: { fontFamily: Typography.font.medium, fontSize: 13 },
  optionActive: { fontWeight: '700' },

  info: { borderRadius: 18, padding: 14, flexDirection: 'row', gap: 10 },
  infoText: { flex: 1, fontFamily: Typography.font.regular, fontSize: 13, lineHeight: 19 },
});
