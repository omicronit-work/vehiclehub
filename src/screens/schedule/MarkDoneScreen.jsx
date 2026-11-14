import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Text from '../../components/ui/AppText';
import { useDispatch } from 'react-redux';
import {
  ScreenShell,
  FieldLabel,
  FieldError,
  InfoBox,
  KeyValue,
  PrimaryAction,
  SectionLabel,
  inputStyle,
  useSchedulePalette,
} from '../../components/schedule/ScheduleParts';
import AppDatePicker from '../../components/ui/AppDatePicker';
import { MarkDoneSkeleton } from '../../components/schedule/ScheduleSkeletons';
import { useVehicleSchedules } from '../../util/schedule/useVehicleSchedules';
import { useDistanceUnit } from '../../util/schedule/scheduleSettings';
import { markScheduleDone } from '../../util/schedule/scheduleStore';
import {
  cancelRuleNotifications,
  syncVehicleSchedules,
} from '../../util/schedule/scheduleReminders';
import { bumpRecordsVersion, syncServiceReminders } from '../../store/userSlice';
import { useCurrency, parseAmount } from '../../util/methods/useCurrency';
import { sanitizeDecimal } from '../../util/numberInput';
import {
  dueValues,
  formatDistance,
  formatNumber,
  formatYmd,
  kmToUnit,
  restartRule,
  ruleText,
  todayYmd,
  toYmd,
  unitToKm,
  validateMarkDone,
  ymdToLocalDate,
} from '../../util/schedule/scheduleMath';
import { Typography } from '../../styles/typography';
import { scheduleUsesOdometer, ruleName } from '../../util/serviceFields';
import { t as tr } from '../../i18n';

const digits = v => String(v ?? '').replace(/[^0-9]/g, '');

// Screen 5 — Mark as done: logs the service and restarts the schedule (R8–R11).
const MarkDoneScreen = ({ navigation, route }) => {
  const { vehicleId, ruleId } = route.params || {};
  const dispatch = useDispatch();
  const p = useSchedulePalette();
  const unit = useDistanceUnit();
  const { code: currencyCode, symbol, ready: currencyReady } = useCurrency(undefined, { lock: true });
  const { userEmail, data, evaluations, loading } =
    useVehicleSchedules(vehicleId);
  const e = evaluations.find(x => x.rule.id === ruleId);

  const today = todayYmd();
  const [dateDone, setDateDone] = useState(today);
  const [odo, setOdo] = useState('');
  const [cost, setCost] = useState('');
  const [shop, setShop] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [focused, setFocused] = useState(null);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  // Start from the vehicle's current reading.
  useEffect(() => {
    if (prefilled || !data) return;
    if (data.odometer) setOdo(String(kmToUnit(data.odometer, unit)));
    setPrefilled(true);
  }, [data, prefilled, unit]);

  // Typed in the user's unit; exact current km when left as prefilled.
  const odoKm = useMemo(() => {
    if (odo === '') return null;
    if (data?.odometer && odo === String(kmToUnit(data.odometer, unit)))
      return data.odometer;
    return unitToKm(odo, unit);
  }, [odo, unit, data]);

  if (!e) {
    return (
      <ScreenShell
        title={tr('Mark as done')}
        left={{ label: tr('Cancel'), onPress: () => navigation.goBack() }}
      >
        {loading || !data ? (
          <MarkDoneSkeleton />
        ) : (
          <Text style={[styles.small, { color: p.muted }]}>
            {tr('This schedule has been deleted.')}
          </Text>
        )}
      </ScreenShell>
    );
  }

  // Body / paint, wash… schedules repeat by time only: no reading asked for.
  const askOdo = scheduleUsesOdometer(e.rule);
  const check = validateMarkDone({
    dateDone,
    odo: askOdo ? odoKm : null,
    today,
    rule: e.rule,
    vehicleOdo: data?.odometer,
    requireOdo: askOdo,
  });
  const errors = tried ? check.errors : {};
  const next = check.ok
    ? dueValues(restartRule(e.rule, { dateDone, odo: askOdo ? odoKm : null }))
    : null;

  const handleSave = async () => {
    setTried(true);
    if (!check.ok || saving || !currencyReady) return;
    setSaving(true);
    try {
      await markScheduleDone(userEmail, vehicleId, e.rule, {
        dateDone,
        odo: askOdo ? odoKm : null,
        cost: cost === '' ? 0 : parseAmount(cost),
        currency: currencyCode,
        shop: shop.trim(),
      });
      // Done: clear its alerts, including any overdue one still on screen.
      await cancelRuleNotifications(vehicleId, ruleId, { all: true });
      await syncVehicleSchedules(userEmail, vehicleId, { seed: true });
      // The service just logged replaces an older one of the same type:
      // that one's reminder is cancelled.
      syncServiceReminders(userEmail, vehicleId);
      dispatch(bumpRecordsVersion());
      navigation.goBack();
    } catch (err) {
      console.log('Mark as done failed:', err);
      Alert.alert(tr('Couldn\'t save'), tr('Check your connection and try again.'));
      setSaving(false);
    }
  };

  return (
    <ScreenShell
      title={tr('Mark as done')}
      left={{ label: tr('Cancel'), onPress: () => navigation.goBack() }}
      footer={
        <PrimaryAction
          title={tr('Save and restart schedule')}
          onPress={handleSave}
          loading={saving}
        />
      }
    >
      <InfoBox style={{ backgroundColor: p.railBg }}>
        <Text style={[styles.ruleName, { color: p.text }]}>{ruleName(e.rule)}</Text>
        <Text style={[styles.small, { color: p.muted }]}>
          {ruleText(e.rule, unit)}
        </Text>
      </InfoBox>

      <View style={styles.pair}>
        <View style={styles.flex}>
          <FieldLabel>{tr('Date done')}</FieldLabel>
          <TouchableOpacity
            onPress={() => setShowPicker(true)}
            accessibilityRole="button"
            accessibilityLabel={tr('Date done, {0}', { 0: formatYmd(dateDone) })}
            style={inputStyle(p, { error: errors.date })}
          >
            <Text style={[styles.value, { color: p.text }]}>
              {formatYmd(dateDone)}
            </Text>
          </TouchableOpacity>
        </View>
        {askOdo ? (
          <View style={styles.flex}>
            <FieldLabel>{tr('Odometer ({0})', { 0: unit })}</FieldLabel>
            <TextInput
              value={odo === '' ? '' : formatNumber(odo)}
              onChangeText={v => setOdo(digits(v))}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={p.faint}
              accessibilityLabel={tr('Odometer, {0}', { 0: unit })}
              onFocus={() => setFocused('odo')}
              onBlur={() => setFocused(null)}
              style={inputStyle(p, {
                active: focused === 'odo',
                error: errors.odo,
              })}
            />
          </View>
        ) : (
          <View style={styles.flex} />
        )}
      </View>
      <FieldError>{errors.date}</FieldError>
      <FieldError>{errors.odo}</FieldError>
      {!!check.warning && !errors.odo && (
        <Text style={[styles.small, { color: p.status.soon.text }]}>
          {check.warning}
        </Text>
      )}

      <View style={styles.pair}>
        <View style={styles.flex}>
          <FieldLabel>{tr('Cost ({0})', { 0: symbol })}</FieldLabel>
          <TextInput
            value={cost}
            onChangeText={v => setCost(sanitizeDecimal(v))}
            keyboardType="decimal-pad"
            placeholder={tr('Optional')}
            placeholderTextColor={p.faint}
            accessibilityLabel={tr('Cost, optional')}
            onFocus={() => setFocused('cost')}
            onBlur={() => setFocused(null)}
            style={inputStyle(p, { active: focused === 'cost' })}
          />
        </View>
        <View style={styles.flex}>
          <FieldLabel>{tr('Shop (optional)')}</FieldLabel>
          <TextInput
            value={shop}
            onChangeText={setShop}
            placeholder={tr('e.g. Honda dealer')}
            placeholderTextColor={p.faint}
            maxLength={60}
            accessibilityLabel={tr('Shop, optional')}
            onFocus={() => setFocused('shop')}
            onBlur={() => setFocused(null)}
            style={inputStyle(p, { active: focused === 'shop' })}
          />
        </View>
      </View>

      {next && (
        <InfoBox>
          <SectionLabel style={styles.noTop}>
            {tr('WHAT HAPPENS WHEN YOU SAVE')}
          </SectionLabel>
          <Text style={[styles.small, { color: p.text }]}>
            {tr('A completed service is added to History.')}
          </Text>
          <Text style={[styles.small, { color: p.text }]}>
            {askOdo
              ? tr(dateDone === today ? 'The schedule restarts from today: {0} and {1}.' : 'The schedule restarts from {0} and {1}.', { 0: formatYmd(dateDone), 1: formatDistance(odoKm, unit) })
              : tr(dateDone === today ? 'The schedule restarts from today: {0}.' : 'The schedule restarts from {0}.', { 0: formatYmd(dateDone) })}
          </Text>
          {next.dueDate && (
            <KeyValue
              k={tr('New due date')}
              v={formatYmd(next.dueDate)}
              last={next.dueKm === null}
            />
          )}
          {next.dueKm !== null && (
            <KeyValue
              k={tr('New due distance')}
              v={formatDistance(next.dueKm, unit)}
              last
            />
          )}
        </InfoBox>
      )}

      <Text style={[styles.small, { color: p.muted }]}>
        {askOdo
          ? tr('Done early or late? The next service is always counted from the day and odometer you enter here.')
          : tr('Done early or late? The next service is always counted from the day you enter here.')}
      </Text>

      {showPicker && (
        <AppDatePicker
          value={ymdToLocalDate(dateDone)}
          maximumDate={ymdToLocalDate(today)}
          onChange={(event, date) => {
            setShowPicker(false);
            if (event.type === 'set' && date) setDateDone(toYmd(date));
          }}
        />
      )}
    </ScreenShell>
  );
};

export default MarkDoneScreen;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pair: { flexDirection: 'row', gap: 12 },
  ruleName: {
    fontFamily: Typography.font.medium,
    fontWeight: '700',
    fontSize: 16,
  },
  small: { fontFamily: Typography.font.regular, fontSize: 13, lineHeight: 19 },
  value: { fontFamily: Typography.font.regular, fontSize: 16 },
  noTop: { marginTop: 0 },
});
