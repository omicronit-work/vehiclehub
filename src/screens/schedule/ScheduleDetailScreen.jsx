import React, { useMemo, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Text from '../../components/ui/AppText';
import { useDispatch } from 'react-redux';
import Svg, { Circle, Path } from 'react-native-svg';
import {
  ScreenShell,
  SectionLabel,
  StatusChip,
  PrimaryAction,
  ProgressBar,
  useSchedulePalette,
  CONTROL_RADIUS,
  CARD_RADIUS,
} from '../../components/schedule/ScheduleParts';
import ConfirmDeleteModal from '../../modals/ConfirmDeleteModal';
import ErrorState from '../../components/ui/ErrorState';
import { ScheduleDetailSkeleton, ScheduleEditSkeleton } from '../../components/schedule/ScheduleSkeletons';

// Shortest time the after-edit skeleton stays up.
const EDIT_SKELETON_MIN_MS = 600;
import ServiceTypeIcon from '../../assets/svg/ServiceTypeIcon';
import TrashIcon from '../../assets/svg/TrashIcon';
import PhotoPreview from '../../components/PhotoPreview';
import { useVehicleSchedules } from '../../util/schedule/useVehicleSchedules';
import { useDistanceUnit } from '../../util/schedule/scheduleSettings';
import { deleteSchedule, ruleHistory } from '../../util/schedule/scheduleStore';
import { cancelRuleNotifications } from '../../util/schedule/scheduleReminders';
import { bumpRecordsVersion } from '../../store/userSlice';
import {
  STATUS,
  chipLabel,
  formatDistance,
  formatYmd,
  formatDays,
  ruleShort,
  ruleText,
  toYmd,
} from '../../util/schedule/scheduleMath';
import { serviceLabel, scheduleUsesOdometer, ruleName } from '../../util/serviceFields';
import { Typography } from '../../styles/typography';
import { t as tr } from '../../i18n';

/* ── Pieces ─────────────────────────────────────────────────────────────── */

const RING = 116;
const STROKE = 10;

/** Circular progress: how much of the interval is used, with the % inside. */
export const ProgressRing = ({ progress, color, track, text, sub, subLabel = 'used' }) => {
  const r = (RING - STROKE) / 2;
  const c = 2 * Math.PI * r;
  const fill = Math.max(0, Math.min(1, progress));
  return (
    <View style={styles.ring}>
      <Svg width={RING} height={RING}>
        <Circle cx={RING / 2} cy={RING / 2} r={r} stroke={track} strokeWidth={STROKE} fill="none" />
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          r={r}
          stroke={color}
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - fill)}
          transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
        />
      </Svg>
      <View style={styles.ringCenter}>
        <Text style={[styles.ringValue, { color }]}>{text}</Text>
        <Text style={[styles.ringSub, { color: sub }]}>{subLabel}</Text>
      </View>
    </View>
  );
};

/** One limit (distance or time) as a tile with its own bar. */
export const LimitTile = ({ p, label, value, caption, limit }) => (
  <View style={[styles.tile, p.shadow, { backgroundColor: p.card }]}>
    <Text style={[styles.tileLabel, { color: p.muted }]}>{label}</Text>
    <Text style={[styles.tileValue, { color: limit ? p.status[limit.status].text : p.muted }]} numberOfLines={1}>
      {value}
    </Text>
    {limit && <ProgressBar fill={limit.fill} status={limit.status} />}
    <Text style={[styles.tileCaption, { color: p.muted }]} numberOfLines={2}>
      {caption}
    </Text>
  </View>
);

export const InfoRow = ({ p, label, value, last }) => (
  <View style={[styles.infoRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: p.cardBorder }]}>
    <Text style={[styles.infoLabel, { color: p.muted }]}>{label}</Text>
    <Text style={[styles.infoValue, { color: p.text }]}>{value}</Text>
  </View>
);

const CheckIcon = ({ color, size = 16 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M5 12.5l4.5 4.5L19 7.5" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const leftDistance = (n, unit) => (n < 0 ? `${formatDistance(-n, unit)} over` : n === 0 ? tr('Due now') : `${formatDistance(n, unit)} left`);
const leftDays = n => (n < 0 ? `${formatDays(-n)} over` : n === 0 ? tr('Due today') : `${formatDays(n)} left`);

// Screen 3 — schedule detail.
const ScheduleDetailScreen = ({ navigation, route }) => {
  const { vehicleId, ruleId } = route.params || {};
  const dispatch = useDispatch();
  const p = useSchedulePalette();
  const unit = useDistanceUnit();
  const { userEmail, data, evaluations, loading, error, reload } = useVehicleSchedules(vehicleId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // After an edit, the parts the edit can change (hero, limits, photo, "How
  // it's worked out") show a skeleton until the saved rule is back. Held for
  // a moment so it doesn't just flicker when the reload is quick.
  const [updating, setUpdating] = useState(false);
  const edited = () => {
    setUpdating(true);
    Promise.all([reload(), new Promise(r => setTimeout(r, EDIT_SKELETON_MIN_MS))])
      .finally(() => setUpdating(false));
  };

  const e = evaluations.find(x => x.rule.id === ruleId);
  const history = useMemo(() => (e && data ? ruleHistory(e.rule, data.services) : []), [e, data]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteSchedule(userEmail, vehicleId, ruleId);
      await cancelRuleNotifications(vehicleId, ruleId, { all: true });
      dispatch(bumpRecordsVersion());
      setConfirmDelete(false);
      navigation.goBack();
    } catch (err) {
      console.log('Delete schedule failed:', err);
      setDeleting(false);
    }
  };

  const back = { label: tr('Back'), chevron: true, onPress: () => navigation.goBack() };

  if (!e) {
    return (
      <ScreenShell title={tr('Schedule')} left={back}>
        {loading ? (
          <ScheduleDetailSkeleton />
        ) : error ? (
          <ErrorState title={tr('Couldn\'t load this schedule')} onRetry={reload} />
        ) : (
          <Text style={[styles.muted, { color: p.muted }]}>{tr('This schedule has been deleted.')}</Text>
        )}
      </ScreenShell>
    );
  }

  const rule = e.rule;
  const s = p.status[e.status];
  const head = e.headline === 'distance' ? e.distance : e.headline === 'time' ? e.time : null;
  const pct = head ? Math.round(head.progress * 100) : 0;
  const chip = e.status === STATUS.SOON ? tr('Due soon · {0}', { 0: chipLabel(e.chip, unit) }) : chipLabel(e.chip, unit);

  // Headline: the limit that comes first, with the other one as "or …".
  const bigValue =
    e.headline === 'time' ? formatYmd(e.dueDate) : e.dueKm !== null ? formatDistance(e.dueKm, unit) : formatYmd(e.dueDate);
  const otherValue =
    e.headline === 'time'
      ? e.dueKm !== null ? formatDistance(e.dueKm, unit) : null
      : e.dueDate ? formatYmd(e.dueDate) : null;
  const firstText =
    e.distance && e.time ? (e.headline === 'time' ? tr('Time comes first') : tr('Distance comes first')) : null;

  const reminder = !rule.remindersOn
    ? tr('Off')
    : [e.dueKm !== null && formatDistance(rule.warnKm, unit), e.dueDate && formatDays(rule.warnDays)]
        .filter(Boolean)
        .join(' or ') + ' before';

  return (
    <ScreenShell
      title={ruleName(rule)}
      left={back}
      right={{ label: tr('Edit'), onPress: () => navigation.navigate('ScheduleForm', { vehicleId, ruleId, onSaved: edited }) }}
      footer={
        <>
          <TouchableOpacity
            onPress={() => setConfirmDelete(true)}
            accessibilityRole="button"
            accessibilityLabel={tr('Delete schedule')}
            style={[styles.deleteBtn, { backgroundColor: p.status[STATUS.OVERDUE].bg }]}
          >
            <TrashIcon color={p.danger} width={18} height={18} />
          </TouchableOpacity>
          <PrimaryAction
            title={tr('Mark as done')}
            onPress={() => navigation.navigate('ScheduleMarkDone', { vehicleId, ruleId })}
          />
        </>
      }
    >
      {updating ? (
        <ScheduleEditSkeleton
          tiles={(e.dueKm !== null ? 1 : 0) + (e.time ? 1 : 0)}
          photo={!!rule.imageUrl}
        />
      ) : (
      <>
      {/* Hero: what, status, progress ring and next due */}
      <View style={[styles.hero, p.shadow, { backgroundColor: p.card }]}>
        <View style={styles.heroTop}>
          <View style={[styles.heroIcon, { backgroundColor: s.bg }]}>
            <ServiceTypeIcon name={rule.serviceType || rule.name} color={s.text} size={22} />
          </View>
          <View style={styles.flex}>
            <Text style={[styles.heroRule, { color: p.muted }]} numberOfLines={2}>
              {ruleText(rule, unit)}
            </Text>
          </View>
          <StatusChip status={e.status} label={chip} />
        </View>

        <View style={styles.heroBody}>
          <ProgressRing
            progress={head ? head.progress : 0}
            color={s.bar}
            track={p.track}
            text={head ? `${pct}%` : '—'}
            sub={p.muted}
          />
          <View style={styles.flex}>
            <Text style={[styles.nextLabel, { color: p.muted }]}>
              {e.status === STATUS.OVERDUE ? tr('WAS DUE') : tr('NEXT DUE')}
            </Text>
            <Text style={[styles.bigValue, { color: p.text }]} numberOfLines={1} adjustsFontSizeToFit>
              {bigValue}
            </Text>
            {!!otherValue && <Text style={[styles.orValue, { color: p.muted }]}>{tr('or')}{' '}{otherValue}</Text>}
            {!!firstText && (
              <View style={[styles.firstPill, { backgroundColor: p.accentTint }]}>
                <Text style={[styles.firstText, { color: p.accent }]}>{firstText}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Each limit on its own tile */}
      <View style={styles.tiles}>
        {e.dueKm !== null && (
          <LimitTile
            p={p}
            label={tr('DISTANCE')}
            limit={e.distance}
            value={e.distance ? leftDistance(e.distance.left, unit) : tr('No reading')}
            caption={
              e.distance
                ? tr('Due at {0} · now {1}', { 0: formatDistance(e.dueKm, unit), 1: formatDistance(data.odometer, unit) })
                : tr('Log fuel or a service with the odometer to track distance.')
            }
          />
        )}
        {e.time && (
          <LimitTile
            p={p}
            label={tr('TIME')}
            limit={e.time}
            value={leftDays(e.time.left)}
            caption={tr('Due {0}', { 0: formatYmd(e.dueDate) })}
          />
        )}
      </View>

      {/* Photo added in the form (tap to view full screen). */}
      {!!rule.imageUrl && <PhotoPreview uri={rule.imageUrl} fileName="VehicleHub_Schedule" height={180} />}

      {/* How it's worked out */}
      <View style={[styles.card, p.shadow, { backgroundColor: p.card }]}>
        <Text style={[styles.cardTitle, { color: p.text }]}>{tr('How it\'s worked out')}</Text>
        <InfoRow p={p} label={tr('Last done')} value={
            scheduleUsesOdometer(rule)
              ? `${formatYmd(rule.baseDate)} · ${formatDistance(rule.baseOdo, unit)}`
              : formatYmd(rule.baseDate)
          } />
        <InfoRow p={p} label={tr('Repeats every')} value={ruleShort(rule, unit)} />
        <InfoRow p={p} label={tr('Reminder')} value={reminder} last />
      </View>
      </>
      )}

      {/* History as a timeline */}
      <SectionLabel>{tr('COMPLETED')}</SectionLabel>
      <View style={[styles.card, p.shadow, { backgroundColor: p.card }]}>
        {history.length === 0 ? (
          <View style={styles.emptyHistory}>
            <View style={[styles.emptyIcon, { backgroundColor: p.accentTint }]}>
              <CheckIcon color={p.accent} size={18} />
            </View>
            <Text style={[styles.muted, { color: p.muted }]}>
              {tr('Nothing logged yet. Tap Mark as done after the next service.')}
            </Text>
          </View>
        ) : (
          history.map((h, i) => (
            <View key={h.id} style={styles.timelineRow}>
              <View style={styles.timelineRail}>
                <View style={[styles.dot, { backgroundColor: p.status[STATUS.OK].bar }]}>
                  <CheckIcon color="#fff" size={10} />
                </View>
                {i < history.length - 1 && <View style={[styles.line, { backgroundColor: p.track }]} />}
              </View>
              <View style={[styles.flex, styles.timelineBody]}>
                <Text style={[styles.historyTitle, { color: p.text }]} numberOfLines={1}>
                  {serviceLabel(h.name) || ruleName(rule)}
                </Text>
                <Text style={[styles.historyMeta, { color: p.muted }]} numberOfLines={1}>
                  {[
                    formatYmd(toYmd(h.serviceDate)),
                    h.currentMileage ? formatDistance(h.currentMileage, unit) : null,
                    h.workshopName,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      <ConfirmDeleteModal
        visible={confirmDelete}
        title={tr('Delete schedule')}
        description={tr('Delete the "{0}" schedule? Its reminders stop. Completed services are kept.', { 0: ruleName(rule) })}
        loading={deleting}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
      />
    </ScreenShell>
  );
};

export default ScheduleDetailScreen;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  muted: { flex: 1, fontFamily: Typography.font.regular, fontSize: 14, lineHeight: 20 },

  hero: { borderRadius: CARD_RADIUS, padding: 18, gap: 18 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  heroRule: { fontFamily: Typography.font.regular, fontSize: 13, lineHeight: 18 },
  heroBody: { flexDirection: 'row', alignItems: 'center', gap: 18 },

  ring: { width: RING, height: RING },
  ringCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  ringValue: { fontFamily: Typography.font.medium, fontWeight: '700', fontSize: 26, letterSpacing: -0.5 },
  ringSub: { fontFamily: Typography.font.regular, fontSize: 12, marginTop: -2 },

  nextLabel: { fontFamily: Typography.font.medium, fontWeight: '700', fontSize: 11, letterSpacing: 1.2 },
  bigValue: { fontFamily: Typography.font.medium, fontWeight: '700', fontSize: 28, letterSpacing: -0.5, marginTop: 2 },
  orValue: { fontFamily: Typography.font.regular, fontSize: 14, marginTop: 2 },
  firstPill: { alignSelf: 'flex-start', borderRadius: CONTROL_RADIUS, paddingHorizontal: 10, paddingVertical: 4, marginTop: 8 },
  firstText: { fontFamily: Typography.font.medium, fontSize: 12, fontWeight: '700' },

  tiles: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1, borderRadius: CARD_RADIUS, padding: 14, gap: 4 },
  tileLabel: { fontFamily: Typography.font.medium, fontWeight: '700', fontSize: 11, letterSpacing: 1.2 },
  tileValue: { fontFamily: Typography.font.medium, fontWeight: '700', fontSize: 18, marginTop: 2 },
  tileCaption: { fontFamily: Typography.font.regular, fontSize: 12, lineHeight: 16, marginTop: 6 },

  card: { borderRadius: CARD_RADIUS, paddingHorizontal: 16, paddingVertical: 14 },
  cardTitle: { fontFamily: Typography.font.medium, fontWeight: '700', fontSize: 16, marginBottom: 4 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, gap: 12 },
  infoLabel: { fontFamily: Typography.font.regular, fontSize: 14 },
  infoValue: { fontFamily: Typography.font.medium, fontWeight: '700', fontSize: 14, flexShrink: 1, textAlign: 'right' },

  emptyHistory: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  emptyIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  timelineRow: { flexDirection: 'row', gap: 12 },
  timelineRail: { width: 22, alignItems: 'center' },
  dot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  line: { width: 2, flex: 1, marginVertical: 4, borderRadius: 1 },
  timelineBody: { paddingBottom: 16 },
  historyTitle: { fontFamily: Typography.font.medium, fontWeight: '700', fontSize: 15 },
  historyMeta: { fontFamily: Typography.font.regular, fontSize: 13, marginTop: 2 },

  deleteBtn: { width: 48, height: 48, borderRadius: CONTROL_RADIUS, alignItems: 'center', justifyContent: 'center' },
});
