import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import ServiceTypeIcon from '../../assets/svg/ServiceTypeIcon';
import { formatDate, getServiceStatus, toMillis } from '../../util/dateStatus';
import { formatServiceDetail, getServiceFields, serviceLabel } from '../../util/serviceFields';
import { getMileageStatus } from '../../util/mileageStatus';
import { formatKm } from '../../util/distance';
import { STATUS } from '../../util/schedule/scheduleMath';
import { ChevronRight, StatusChip, styles, useSchedulePalette } from './ScheduleParts';

const TONE_TO_STATUS = { danger: STATUS.OVERDUE, warning: STATUS.SOON, success: STATUS.OK, neutral: STATUS.OK };

// Up to two of the type's details ("BMW Genuine · 10W-40"), skipping yes/no
// answers, which don't read well on their own.
const isShown = v => v != null && v !== '' && typeof v !== 'boolean' && !/^(yes|no)$/i.test(String(v));

const detailsLine = item =>
  getServiceFields(item.name)
    .filter(f => isShown(item[f.key]))
    .slice(0, 2)
    .map(f => formatServiceDetail(f.key, item[f.key]))
    .join(' · ');

/**
 * A logged service seen like a schedule card: status, the figures that
 * matter (cost, odometer) and what's next. Pure, for tests.
 */
export const evaluateServiceRecord = (item, { money, unit = 'km', currentOdometer } = {}) => {
  const status = getServiceStatus(item);
  const nextMs = item.superseded ? null : toMillis(item.nextServiceDate);
  const nextKm = item.superseded ? null : Number(item.nextServiceMileage) || null;
  const hasNext = nextMs !== null || nextKm !== null;
  const mileage = nextKm ? getMileageStatus(nextKm, currentOdometer, unit) : null;

  // Distance can make it due before the date does; take the more urgent.
  const rank = { [STATUS.OVERDUE]: 2, [STATUS.SOON]: 1, [STATUS.OK]: 0 };
  let s = TONE_TO_STATUS[status.tone];
  const mileageStatus = mileage ? TONE_TO_STATUS[mileage.tone] : null;
  if (mileageStatus && rank[mileageStatus] > rank[s]) s = mileageStatus;

  const chip = !hasNext
    ? 'Completed'
    : s === STATUS.OVERDUE ? 'Overdue' : s === STATUS.SOON ? 'Due soon' : 'Upcoming';

  const nextValue = [nextMs !== null ? formatDate(nextMs) : null, nextKm ? formatKm(nextKm, unit) : null]
    .filter(Boolean)
    .join(' or ');
  // "Completed yesterday" → "Yesterday"; a plain "Completed" needs no pill.
  const doneAgo = status.label.replace(/^Completed\s*/, '');

  return {
    status: s,
    chip,
    sub: detailsLine(item) || item.workshopName?.trim() || `Done ${formatDate(item.serviceDate)}`,
    cost: Number(item.totalCost) > 0 && money ? money(item.totalCost) : '—',
    odometer: Number(item.currentMileage) > 0 ? formatKm(item.currentMileage, unit) : '—',
    footer: hasNext
      ? { label: 'NEXT DUE', value: nextValue }
      : { label: 'SERVICED', value: formatDate(item.serviceDate) },
    pill: hasNext
      ? (mileage && rank[TONE_TO_STATUS[mileage.tone]] >= rank[TONE_TO_STATUS[status.tone]] ? mileage.label : status.label)
      : doneAgo ? doneAgo.charAt(0).toUpperCase() + doneAgo.slice(1) : null,
  };
};

const Tile = ({ p, label, value }) => (
  <View style={[styles.tile, { backgroundColor: p.field }]}>
    <Text style={[styles.tileLabel, { color: p.muted }]}>{label}</Text>
    <Text style={[styles.tileValueRow, styles.tileValue, { color: p.text }]} numberOfLines={1}>
      {value}
    </Text>
  </View>
);

/**
 * Services tab → History: one completed service as a card. `actions` (edit /
 * delete buttons) sit at the end of the footer; without them it ends in a
 * chevron, like DocumentCard.
 */
const ServiceRecordCard = ({ item, money, unit, currentOdometer, onPress, onLongPress, actions, selected }) => {
  const p = useSchedulePalette();
  const e = evaluateServiceRecord(item, { money, unit, currentOdometer });
  const s = p.status[e.status];
  const name = serviceLabel(item.name) || 'Service';

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${e.chip}, ${e.footer.label.toLowerCase()} ${e.footer.value}`}
      accessibilityHint="Opens details. Long press to delete."
      style={[
        styles.card,
        styles.cardPremium,
        p.shadow,
        { backgroundColor: p.card, borderWidth: 1, borderColor: selected ? p.accent : 'transparent' },
      ]}
    >
      <View style={styles.cardTop}>
        <View style={[styles.cardIcon, { backgroundColor: s.bg }]}>
          <ServiceTypeIcon name={item.name} color={s.text} size={22} />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.cardTitle, { color: p.text }]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[styles.cardSub, { color: p.muted }]} numberOfLines={2}>
            {e.sub}
          </Text>
        </View>
        <StatusChip status={e.status} label={e.chip} dot />
      </View>

      <View style={styles.tiles}>
        <Tile p={p} label="COST" value={e.cost} />
        <Tile p={p} label="ODOMETER" value={e.odometer} />
      </View>

      <View style={[styles.cardFooter, { borderTopColor: p.cardBorder }]}>
        <View style={styles.flex}>
          <Text style={[styles.tileLabel, { color: p.muted }]}>{e.footer.label}</Text>
          <Text style={[styles.nextDueValue, { color: p.text }]} numberOfLines={1}>
            {e.footer.value}
          </Text>
        </View>
        {!!e.pill && (
          <View style={[styles.firstPill, { backgroundColor: s.bg }]}>
            <Text style={[styles.firstText, { color: s.text }]} numberOfLines={1}>
              {e.pill}
            </Text>
          </View>
        )}
        {actions ?? <ChevronRight color={p.faint} />}
      </View>
    </TouchableOpacity>
  );
};

export default ServiceRecordCard;
