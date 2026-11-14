import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import Text from '../ui/AppText';
import DocumentTypeIcon from '../../assets/svg/DocumentTypeIcon';
import { DUE_SOON_DAYS, daysFromToday, formatDate, toMillis } from '../../util/dateStatus';
import { DEFAULT_REMINDER_DAYS } from '../../util/notifications';
import { STATUS, formatDays } from '../../util/schedule/scheduleMath';
import { ChevronRight, LimitTile, StatusChip, styles, useSchedulePalette } from './ScheduleParts';
import { t as tr } from '../../i18n';

const DAY_MS = 24 * 60 * 60 * 1000;
// With no issue date the bar fills over the last year before expiry.
const FALLBACK_SPAN_DAYS = 365;

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "1 year", "6 months", "45 days": how long the document is valid for. */
// Only rounds to months/years when the span is close to a whole one.
const spanText = days => {
  const years = Math.round(days / 365.25);
  if (years >= 1 && Math.abs(days - years * 365.25) <= 7) return plural(years, 'year');
  const months = Math.round(days / 30.44);
  if (months >= 2 && Math.abs(days - months * 30.44) <= 4) return plural(months, 'month');
  return plural(days, 'day');
};

/**
 * A document seen the way ScheduleCard sees a schedule: a status, a "time
 * left" limit for the tile, and the date for the footer. Pure, for tests.
 */
export const evaluateDocument = item => {
  const expiryMs = toMillis(item.expiryDate);
  const issueMs = toMillis(item.issueDate);

  if (expiryMs === null) {
    return {
      status: STATUS.OK,
      chip: tr('No expiry'),
      time: null,
      sub: issueMs !== null ? `Issued ${formatDate(issueMs)} · doesn't expire` : tr('No dates added'),
      footer: issueMs !== null ? { label: 'ISSUED', value: formatDate(issueMs) } : null,
      pill: null,
    };
  }

  const left = daysFromToday(expiryMs);
  const status = left < 0 ? STATUS.OVERDUE : left <= DUE_SOON_DAYS ? STATUS.SOON : STATUS.OK;
  const span = issueMs !== null && expiryMs > issueMs
    ? Math.round((expiryMs - issueMs) / DAY_MS)
    : FALLBACK_SPAN_DAYS;
  const fill = left <= 0 ? 1 : Math.min(Math.max(1 - left / span, 0), 1);

  return {
    status,
    chip: status === STATUS.OVERDUE ? tr('Expired') : status === STATUS.SOON ? tr('Expires soon') : tr('Valid'),
    time: { left, status, fill },
    sub: issueMs !== null && expiryMs > issueMs
      ? `Issued ${formatDate(issueMs)} · valid ${spanText(span)}`
      : `Expires ${formatDate(expiryMs)}`,
    footer: { label: left < 0 ? 'EXPIRED' : 'EXPIRES', value: formatDate(expiryMs) },
    pill: status === STATUS.OVERDUE ? tr('Renew now') : status === STATUS.SOON ? tr('Renew soon') : null,
  };
};

/** Documents tab: one document as a card, styled like a service schedule. */
export { spanText };

const DocumentCard = ({ item, onPress, onLongPress }) => {
  const p = useSchedulePalette();
  const e = evaluateDocument(item);
  const s = p.status[e.status];
  const reminder = item.remindMe
    ? { value: plural(Number(item.reminderDays) || DEFAULT_REMINDER_DAYS, 'day'), caption: 'before' }
    : { value: tr('Off'), caption: '' };
  const name = item.documentName || tr('Unnamed document');

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${e.chip}${e.footer ? `, ${e.footer.label.toLowerCase()} ${e.footer.value}` : ''}`}
      accessibilityHint={tr('Opens details. Long press to delete.')}
      style={[styles.card, styles.cardPremium, p.shadow, { backgroundColor: p.card }]}
    >
      <View style={styles.cardTop}>
        <View style={[styles.cardIcon, { backgroundColor: s.bg }]}>
          <DocumentTypeIcon name={item.documentName} color={s.text} size={22} />
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

      {e.time && (
        <View style={styles.tiles}>
          <LimitTile
            p={p}
            label={tr('VALIDITY')}
            lim={e.time}
            fmt={formatDays}
            words={{ now: tr('Expires today'), over: 'ago' }}
          />
          {/* Same shape as a limit tile; the empty track keeps both heights equal. */}
          <View style={[styles.tile, { backgroundColor: p.field }]}>
            <Text style={[styles.tileLabel, { color: p.muted }]}>{tr('REMINDER')}</Text>
            <Text style={styles.tileValueRow} numberOfLines={1}>
              <Text style={[styles.tileValue, { color: p.text }]}>{reminder.value}</Text>
              {!!reminder.caption && (
                <Text style={[styles.tileCaption, { color: p.muted }]}>{` ${reminder.caption}`}</Text>
              )}
            </Text>
            <View style={[styles.track, { backgroundColor: 'transparent' }]} />
          </View>
        </View>
      )}

      {!!e.footer && (
        <View style={[styles.cardFooter, { borderTopColor: p.cardBorder }]}>
          <View style={styles.flex}>
            <Text style={[styles.tileLabel, { color: p.muted }]}>{e.footer.label}</Text>
            <Text style={[styles.nextDueValue, { color: p.text }]} numberOfLines={1}>
              {e.footer.value}
            </Text>
          </View>
          {!!e.pill && (
            <View style={[styles.firstPill, { backgroundColor: s.bg }]}>
              <Text style={[styles.firstText, { color: s.text }]}>{e.pill}</Text>
            </View>
          )}
          <ChevronRight color={p.faint} />
        </View>
      )}
    </TouchableOpacity>
  );
};

export default DocumentCard;
