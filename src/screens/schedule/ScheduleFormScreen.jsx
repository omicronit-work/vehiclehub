import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch } from 'react-redux';
import Svg, { Path, Rect } from 'react-native-svg';
import {
  FieldError,
  PrimaryAction,
  Segmented,
  inputStyle,
  useSchedulePalette,
  CONTROL_RADIUS,
  CONTROL_FONT,
} from '../../components/schedule/ScheduleParts';
import AppDatePicker from '../../components/ui/AppDatePicker';
import { ScheduleFormSkeleton } from '../../components/schedule/ScheduleSkeletons';
import ServiceTypeIcon from '../../assets/svg/ServiceTypeIcon';
import CloseX from '../../assets/svg/CloseX';
import AddIcon from '../../assets/svg/AddIcon';
import Upload from '../../assets/svg/Upload';
import { FitImage } from '../../components/PhotoPreview';
import { pickImage } from '../../util/methods/useImagePicker';
import { uploadImage } from '../../util/imageStorage';
import { SERVICE_TYPES, getServiceType, scheduleModeForName, serviceLabel, serviceUsesOdometer } from '../../util/serviceFields';
import { useHideAdsWhile } from '../../util/ads';
import { useKeyboardBehavior } from '../../util/methods/useKeyboardBehavior';
import { useVehicleSchedules } from '../../util/schedule/useVehicleSchedules';
import { useAlertSettings, useDistanceUnit } from '../../util/schedule/scheduleSettings';
import {
  SCHEDULE_PRESETS,
  saveSchedule,
  odometerReadings,
} from '../../util/schedule/scheduleStore';
import { askPermissionForSchedules, syncVehicleSchedules } from '../../util/schedule/scheduleReminders';
import { bumpRecordsVersion } from '../../store/userSlice';
import {
  MODES,
  dueValues,
  formatDistance,
  formatNumber,
  formatYmd,
  estimateDateForKm,
  kmPerDayFrom,
  kmToUnit,
  ruleShort,
  todayYmd,
  toYmd,
  unitToKm,
  usesDistance,
  usesTime,
  validateRule,
  ymdToLocalDate,
} from '../../util/schedule/scheduleMath';
import { accent } from '../../theme/accent';
import { odometerLowMessage } from '../../util/distance';
import { Typography } from '../../styles/typography';

const MODE_OPTIONS = [
  { value: MODES.BOTH, label: 'Whichever first' },
  { value: MODES.DISTANCE, label: 'Distance' },
  { value: MODES.TIME, label: 'Time' },
];
const MODE_HINT = {
  [MODES.BOTH]: 'Due at the distance or the time limit, whichever you reach first.',
  [MODES.DISTANCE]: 'Due after a set distance, however long it takes.',
  [MODES.TIME]: 'Due after a set time, however far you drive.',
};

const digits = v => String(v ?? '').replace(/[^0-9]/g, '');
const toField = n => (n === null || n === undefined ? '' : String(n));

// Service types shown before "More": the popular ones (like Add service).
const POPULAR = SERVICE_TYPES.filter(t => t.popular);
const HIDDEN_COUNT = SERVICE_TYPES.length - POPULAR.length;

/**
 * Opt-in suggestion for a service type: the schedule preset if there is one,
 * else the type's own fixed next-due rule (util/serviceFields). Null when the
 * type's interval depends on details (e.g. oil type) and has no preset.
 */
const typicalFor = typeName => {
  if (!typeName) return null;
  const preset = SCHEDULE_PRESETS.find(x => x.serviceType === typeName);
  if (preset) return preset;
  const next = getServiceType(typeName)?.next;
  if (!next || next.requires?.length) return null;
  // Time-only types (no odometer) only ever suggest months.
  const km = next.km && serviceUsesOdometer(typeName) ? Number(next.km({})) || null : null;
  const months = next.months ? Number(next.months({})) || null : null;
  if (!km && !months) return null;
  return {
    intervalKm: km,
    intervalMonths: months,
    mode: km && months ? MODES.BOTH : km ? MODES.DISTANCE : MODES.TIME,
  };
};

// Nothing is filled in for a new schedule: every value comes from the user.
const EMPTY_FORM = {
  custom: false,
  name: '',
  serviceType: null,
  mode: MODES.BOTH,
  intervalKm: '',
  intervalMonths: '',
  baseDate: null,
  boughtDate: null,
  baseOdo: '',
  warnKm: '',
  warnDays: '',
  repeatOverdueDays: null,
  remindersOn: true,
  // Photo: `imageUrl` is the saved one, `localImage` a newly picked file
  // that uploads on save.
  imageUrl: null,
  localImage: null,
  // A custom name that repeats by time only (see scheduleModeForName).
  autoTime: false,
};

/* ── Icons ──────────────────────────────────────────────────────────────── */

const CalendarIcon = ({ color }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Rect x={3.5} y={5} width={17} height={15} rx={3} stroke={color} strokeWidth={1.8} />
    <Path d="M3.5 10h17M8 3v4M16 3v4" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
  </Svg>
);

/* ── Layout pieces ──────────────────────────────────────────────────────── */

const Section = ({ step, title, subtitle, children, p, first, onLayout }) => (
  <View onLayout={onLayout} style={[styles.section, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.cardBorder }]}>
    <View style={styles.sectionHead}>
      <View style={styles.flex}>
        <Text style={[styles.sectionTitle, { color: p.text }]}>{title}</Text>
        {!!subtitle && <Text style={[styles.sectionSub, { color: p.muted }]}>{subtitle}</Text>}
      </View>
    </View>
    {children}
  </View>
);

/** Label above, filled input with a unit inside on the right. */
const Label = ({ children, required, p }) => (
  <Text style={[styles.label, { color: p.muted }]}>
    {children}
    {required && <Text style={{ color: p.danger }}> *</Text>}
  </Text>
);

const Field = ({ label, required, suffix, error, focused, children, p }) => (
  <View style={styles.flex}>
    <Label p={p} required={required}>{label}</Label>
    <View>
      {children}
      {!!suffix && (
        <Text pointerEvents="none" style={[styles.suffix, { color: focused ? p.accent : p.faint }]}>
          {suffix}
        </Text>
      )}
    </View>
    <FieldError>{error}</FieldError>
  </View>
);

// Screen 4 — add or edit a schedule rule.
/**
 * The add / edit schedule bottom sheet. Rendered inside ScheduleFormModal
 * (Home opens it over itself) or by the ScheduleForm stack route.
 */
export const ScheduleFormSheet = ({ vehicleId, ruleId, onClose, onSaved }) => {
  const dispatch = useDispatch();
  const p = useSchedulePalette();
  const unit = useDistanceUnit();
  const alertDefaults = useAlertSettings();
  const { userEmail, data } = useVehicleSchedules(vehicleId);
  const editing = !!ruleId;
  const insets = useSafeAreaInsets();
  const keyboardBehaviour = useKeyboardBehavior();
  useHideAdsWhile(true);

  // Values are kept in the user's unit while typing; converted on save.
  const [form, setForm] = useState(editing ? null : EMPTY_FORM);
  // Which date is being picked: 'baseDate' or 'boughtDate'.
  const [picker, setPicker] = useState(null);
  const [focused, setFocused] = useState(null);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAllTypes, setShowAllTypes] = useState(false);
  const stored = useRef({});
  // Once the user picks how often themselves, a typed name stops changing it.
  const modeTouched = useRef(editing);
  // Scrolling to the next field once a type is picked.
  const scrollRef = useRef(null);
  const nameRef = useRef(null);
  const focusName = useRef(false);
  const layoutY = useRef({});
  const scrollTo = y => scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });

  // Editing: show the rule's own saved values.
  useEffect(() => {
    if (!editing || form || !data) return;
    const r = data.schedules.find(x => x.id === ruleId);
    if (!r) return;
    setForm({
      custom: !(r.serviceType && getServiceType(r.serviceType)),
      name: r.name,
      serviceType: r.serviceType || null,
      mode: r.mode || MODES.BOTH,
      intervalKm: toField(r.intervalKm != null ? kmToUnit(r.intervalKm, unit) : null),
      intervalMonths: toField(r.intervalMonths),
      baseDate: r.baseDate,
      boughtDate: r.boughtDate || null,
      baseOdo: toField(kmToUnit(r.baseOdo || 0, unit)),
      warnKm: toField(r.warnKm != null ? kmToUnit(r.warnKm, unit) : null),
      warnDays: toField(r.warnDays),
      repeatOverdueDays: r.repeatOverdueDays ?? null,
      remindersOn: r.remindersOn !== false,
      imageUrl: r.imageUrl || null,
      localImage: null,
      autoTime: !(r.serviceType && getServiceType(r.serviceType)) && r.mode === MODES.TIME,
    });
    // Exact stored km behind each prefilled field (see kmFor).
    stored.current = { intervalKm: r.intervalKm, baseOdo: r.baseOdo || 0, warnKm: r.warnKm };
  }, [editing, form, data, ruleId, unit]);

  const set = patch => setForm(f => ({ ...f, ...patch }));

  // Body / paint, wash, bulbs… repeat by time only: no distance, no odometer.
  // A custom name like "Carpet change" works the same way (autoTime).
  const timeOnly =
    !!form &&
    (form.custom ? form.autoTime : !!form.serviceType && !serviceUsesOdometer(form.serviceType));
  // Repeating by time alone (a time-only type, or "Time" picked) never needs the odometer.
  const noDistance = timeOnly || (!!form && !usesDistance(form.mode));

  // A distance left as prefilled saves back the exact stored km, so editing
  // a rule in miles never drifts it through the rounded display value.
  const kmFor = key => {
    const km = stored.current[key];
    if (km != null && form[key] === toField(kmToUnit(km, unit))) return km;
    return unitToKm(form[key], unit);
  };

  // The rule as it would be stored (km, whole numbers).
  const draft = useMemo(() => {
    if (!form) return null;
    const rule = {
      name: form.name,
      serviceType: form.serviceType,
      mode: timeOnly ? MODES.TIME : form.mode,
      intervalKm: !timeOnly && usesDistance(form.mode) && form.intervalKm !== '' ? kmFor('intervalKm') : null,
      intervalMonths: (timeOnly || usesTime(form.mode)) && form.intervalMonths !== '' ? Number(form.intervalMonths) : null,
      baseDate: form.baseDate,
      boughtDate: noDistance ? form.boughtDate : null,
      baseOdo: noDistance || form.baseOdo === '' ? null : kmFor('baseOdo'),
      // Reminders left empty use the Service alerts values.
      warnKm: form.warnKm === '' ? alertDefaults.warnKm : kmFor('warnKm'),
      warnDays: form.warnDays === '' ? alertDefaults.warnDays : Number(form.warnDays),
      repeatOverdueDays: form.repeatOverdueDays ?? alertDefaults.repeatOverdueDays,
      remindersOn: form.remindersOn,
      imageUrl: form.imageUrl,
    };
    return rule;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, timeOnly, noDistance, unit, alertDefaults]);

  const validation = draft ? validateRule(draft, { requireOdo: !noDistance }) : { ok: false, errors: {} };
  // The app's one odometer rule (util/distance.js): a reading lower than one
  // logged on or before the date last done is flagged, never blocked, since
  // a backdated service legitimately has a lower reading.
  const odoFloor = useMemo(() => {
    // `form` is null while an edited rule is still being filled in.
    const baseDate = form?.baseDate;
    if (!data || noDistance || !baseDate) return null;
    let floor = null;
    odometerReadings(data).forEach(r => {
      if (r.date && r.date <= baseDate && r.km > 0 && (!floor || r.km > floor.km)) floor = r;
    });
    return floor;
  }, [data, noDistance, form?.baseDate]);
  const odoLowWarning =
    odoFloor && draft && Number.isFinite(draft.baseOdo) && draft.baseOdo > 0 && draft.baseOdo < odoFloor.km
      ? odometerLowMessage({ km: odoFloor.km, ms: ymdToLocalDate(odoFloor.date, 12).getTime() }, unit)
      : '';
  const boughtError =
    draft?.boughtDate && draft.baseDate && draft.boughtDate > draft.baseDate
      ? "Can't be after the date last done."
      : null;
  const errors = tried ? { ...validation.errors, ...(boughtError ? { boughtDate: boughtError } : {}) } : {};
  const due = draft && validation.ok ? dueValues(draft) : null;

  // Distance-only rules have no fixed date: estimate one from how much the
  // owner drives (needs readings spanning two weeks or more).
  const kmPerDay = useMemo(() => (data ? kmPerDayFrom(odometerReadings(data)) : null), [data]);
  const estimate =
    due && !due.dueDate && due.dueKm !== null
      ? estimateDateForKm({
          dueKm: due.dueKm,
          odometer: Math.max(data?.odometer || 0, draft.baseOdo || 0),
          kmPerDay,
          today: todayYmd(),
        })
      : null;

  // Picking a type names the schedule after it; "Other" lets the user type one.
  const pickType = type => {
    Keyboard.dismiss();
    set({
      custom: false,
      name: serviceLabel(type.name),
      serviceType: type.name,
      // A time-only type drops any distance typed for the previous one.
      ...(serviceUsesOdometer(type.name) ? {} : { mode: MODES.TIME, intervalKm: '', baseOdo: '', warnKm: '' }),
    });
    // Next step: how often. Waits a frame for the name field to unmount.
    setTimeout(() => scrollTo(layoutY.current.often ?? 0), 50);
  };
  const pickOther = () => {
    // The name field focuses and scrolls into view once it's laid out.
    focusName.current = true;
    if (form.custom) nameRef.current?.focus();
    set({ custom: true, name: form.custom ? form.name : '', serviceType: null });
  };

  // A typed name sets how it repeats: "Carpet change" by time only, "Drive
  // chain" by distance or time. Only fields that are still empty get dropped.
  const changeCustomName = value => {
    const name = value.slice(0, 40);
    const mode = modeTouched.current ? null : scheduleModeForName(name);
    if (!mode) {
      set({ name, ...(modeTouched.current ? {} : { autoTime: false }) });
      return;
    }
    const kmFilled = form.intervalKm !== '' || form.baseOdo !== '' || form.warnKm !== '';
    if (mode === MODES.TIME && kmFilled) {
      set({ name });
      return;
    }
    set(
      mode === MODES.TIME
        ? { name, mode, autoTime: true, intervalKm: '', baseOdo: '', warnKm: '' }
        : { name, mode, autoTime: false, boughtDate: null },
    );
  };

  // A wrong guess isn't final: the user can still repeat it by distance.
  const trackDistance = () => {
    modeTouched.current = true;
    set({ mode: MODES.BOTH, autoTime: false, boughtDate: null });
  };

  // Opt-in only: the typical interval for the chosen service, applied when tapped.
  const preset = form && !form.custom ? typicalFor(form.serviceType) : null;
  const suggestionApplied =
    !!preset &&
    form.mode === preset.mode &&
    form.intervalKm === toField(preset.intervalKm != null ? kmToUnit(preset.intervalKm, unit) : null) &&
    form.intervalMonths === toField(preset.intervalMonths);
  const applySuggestion = () =>
    set({
      mode: preset.mode,
      intervalKm: toField(preset.intervalKm != null ? kmToUnit(preset.intervalKm, unit) : null),
      intervalMonths: toField(preset.intervalMonths),
    });

  // Switching to one limit clears the other, after confirmation (spec 8).
  const changeMode = mode => {
    if (mode === form.mode) return;
    modeTouched.current = true;
    if (mode !== MODES.TIME && form.boughtDate) set({ boughtDate: null });
    const clearsKm = !usesDistance(mode) && form.intervalKm !== '';
    const clearsMonths = !usesTime(mode) && form.intervalMonths !== '';
    const apply = () =>
      set({ mode, ...(clearsKm ? { intervalKm: '' } : {}), ...(clearsMonths ? { intervalMonths: '' } : {}) });
    if (!clearsKm && !clearsMonths) {
      apply();
      return;
    }
    Alert.alert(
      'Change repeat?',
      clearsKm
        ? `The distance (${formatNumber(form.intervalKm)} ${unit}) will be cleared.`
        : `The time (${form.intervalMonths} months) will be cleared.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Change', onPress: apply },
      ],
    );
  };

  // System photo picker (no media permission), as in Add Document.
  const choosePhoto = async () => {
    const res = await pickImage();
    const uri = res?.assets?.[0]?.uri;
    if (uri) set({ localImage: uri });
  };

  const handleSave = async () => {
    setTried(true);
    if (!validation.ok || boughtError || saving) return;
    setSaving(true);
    try {
      // Spec 5: ask for notification permission at the first rule save.
      if (draft.remindersOn) await askPermissionForSchedules();
      let imageUrl = draft.imageUrl;
      if (form.localImage) {
        const upload = await uploadImage(form.localImage);
        if (!upload?.success) {
          Alert.alert("Couldn't upload the photo", upload?.message || 'Check your connection and try again.');
          setSaving(false);
          return;
        }
        imageUrl = upload.url;
      }
      await saveSchedule(userEmail, vehicleId, { ...draft, imageUrl }, ruleId);
      // Reminder alarms are set in the background; the save doesn't wait for them.
      syncVehicleSchedules(userEmail, vehicleId, { seed: true }).catch(e => console.log('Schedule sync failed:', e));
      dispatch(bumpRecordsVersion());
      onSaved?.();
      onClose();
    } catch (e) {
      console.log('Save schedule failed:', e);
      Alert.alert("Couldn't save", 'Check your connection and try again.');
      setSaving(false);
    }
  };

  const title = editing ? 'Edit schedule' : 'Add service';
  const close = () => onClose();
  const vehicleName = [data?.vehicle?.brand, data?.vehicle?.model].filter(Boolean).join(' ');

  // Bottom sheet over the screen it was opened from (the stack dims behind).
  const sheet = (body, footer) => (
    <View style={styles.modalRoot}>
      <Pressable style={styles.flex} onPress={close} accessibilityLabel="Close" />
      <KeyboardAvoidingView
        behavior={keyboardBehaviour}
        style={[styles.sheet, p.shadow, { backgroundColor: p.card }]}
      >
        <View style={styles.handleWrap}>
          <View style={[styles.handle, { backgroundColor: p.track }]} />
        </View>
        <View style={styles.sheetHeader}>
          <View style={[styles.headerIcon, { backgroundColor: p.accentTint }]}>
            <ServiceTypeIcon icon="service" size={20} color={p.accent} />
          </View>
          <View style={styles.flex}>
            <Text style={[styles.sheetTitle, { color: p.text }]}>{title}</Text>
            {!!vehicleName && (
              <Text style={[styles.sheetSub, { color: p.muted }]} numberOfLines={1}>
                {vehicleName}
                {data?.odometer ? ` · ${formatDistance(data.odometer, unit)}` : ''}
              </Text>
            )}
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={close}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[styles.closeButton, { backgroundColor: p.accentTint }]}
          >
            <CloseX size={12} color={p.accent} />
          </TouchableOpacity>
        </View>
        <View style={[styles.divider, { backgroundColor: p.cardBorder }]} />
        <ScrollView
          ref={scrollRef}
          style={styles.sheetScroll}
          contentContainerStyle={styles.sheetContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {body}
        </ScrollView>
        {footer && (
          <View style={[styles.sheetFooter, { paddingBottom: Math.max(insets.bottom, 12) + 4, borderTopColor: p.cardBorder }]}>
            {footer}
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );

  if (!form) return sheet(<ScheduleFormSkeleton />);

  const showKm = !timeOnly && usesDistance(form.mode);
  const showMonths = timeOnly || usesTime(form.mode);

  const numberInput = (key, { placeholder, error, label, grouped = true }) => (
    <TextInput
      value={grouped && form[key] !== '' ? formatNumber(form[key]) : form[key]}
      onChangeText={v => set({ [key]: digits(v) })}
      keyboardType="number-pad"
      placeholder={placeholder}
      placeholderTextColor={p.faint}
      accessibilityLabel={label}
      onFocus={() => setFocused(key)}
      onBlur={() => setFocused(null)}
      style={[inputStyle(p, { active: focused === key, error }), styles.withSuffix]}
    />
  );

  // Sticky footer: the live result, then Save.
  const footer = (
    <View style={styles.footer}>
      <View style={[styles.result, { backgroundColor: due ? p.accentTint : p.field }]}>
        <Text style={[styles.resultLabel, { color: due ? p.accent : p.faint }]}>NEXT DUE</Text>
        {due ? (
          <View style={styles.resultRow}>
            {due.dueDate && (
              <View style={styles.flex}>
                <Text style={[styles.resultValue, { color: p.text }]}>{formatYmd(due.dueDate)}</Text>
                <Text style={[styles.resultSub, { color: p.muted }]}>by time</Text>
              </View>
            )}
            {due.dueDate && due.dueKm !== null && (
              <Text style={[styles.resultOr, { color: p.muted }]}>or</Text>
            )}
            {due.dueKm !== null && (
              <View style={styles.flex}>
                <Text style={[styles.resultValue, { color: p.text }]}>{formatDistance(due.dueKm, unit)}</Text>
                <Text style={[styles.resultSub, { color: p.muted }]}>by distance</Text>
              </View>
            )}
            {!due.dueDate && estimate && (
              <>
                <Text style={[styles.resultOr, { color: p.muted }]}>≈</Text>
                <View style={styles.flex}>
                  <Text style={[styles.resultValue, { color: p.text }]}>{formatYmd(estimate)}</Text>
                  <Text style={[styles.resultSub, { color: p.muted }]}>
                    estimated · ~{formatDistance(kmPerDay, unit)}/day
                  </Text>
                </View>
              </>
            )}
          </View>
        ) : (
          <Text style={[styles.resultEmpty, { color: p.muted }]}>
            Fill in how often and when it was last done to see the next due date.
          </Text>
        )}
        {due && !due.dueDate && !estimate && (
          <Text style={[styles.resultEmpty, { color: p.muted }]}>
            Distance only has no fixed date. Log fuel or services for two weeks to see an estimate, or choose
            Whichever first.
          </Text>
        )}
      </View>
      <PrimaryAction title={editing ? 'Save changes' : 'Save Service'} onPress={handleSave} loading={saving} style={styles.save} />
    </View>
  );

  const visibleTypes = showAllTypes
    ? SERVICE_TYPES
    : SERVICE_TYPES.filter(t => t.popular || (!form.custom && t.name === form.serviceType));

  const chip = ({ key, selected, onPress, icon, label }) => (
    <TouchableOpacity
      key={key}
      activeOpacity={0.8}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={[
        styles.chip,
        selected && p.shadow,
        { backgroundColor: selected ? accent.primary : p.card, borderColor: selected ? accent.primary : p.inputBorder },
      ]}
    >
      {icon}
      <Text numberOfLines={1} style={[styles.chipText, { color: selected ? '#fff' : p.text }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return sheet(
    <>
      {/* 1 — Service */}
      <Section
        p={p}
        first
        step="1"
        title="Service"
        subtitle="What needs doing regularly?"
        onLayout={e => {
          layoutY.current.service = e.nativeEvent.layout.y;
        }}
      >
        <Label p={p} required>Service type</Label>
        <View style={styles.chipGrid}>
          {visibleTypes.map(type => {
            const selected = !form.custom && form.serviceType === type.name;
            return chip({
              key: type.id,
              selected,
              onPress: () => pickType(type),
              icon: <ServiceTypeIcon icon={type.icon} size={15} color={selected ? '#fff' : p.muted} />,
              label: serviceLabel(type.name),
            });
          })}
          {(showAllTypes || form.custom) &&
            chip({
              key: 'other',
              selected: form.custom,
              onPress: pickOther,
              icon: <AddIcon color={form.custom ? '#fff' : p.accent} />,
              label: 'Other',
            })}
          {HIDDEN_COUNT > 0 && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setShowAllTypes(v => !v)}
              accessibilityRole="button"
              style={[styles.chip, styles.moreChip, { borderColor: p.accent }]}
            >
              <Text style={[styles.chipText, { color: p.accent }]}>
                {showAllTypes ? 'Show less' : `More (${HIDDEN_COUNT})`}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {form.custom && (
          <TextInput
            ref={nameRef}
            value={form.name}
            onChangeText={changeCustomName}
            onLayout={e => {
              if (!focusName.current) return;
              focusName.current = false;
              nameRef.current?.focus();
              // The chips above stay in view so the picked "Other" is still visible.
              scrollTo((layoutY.current.service ?? 0) + e.nativeEvent.layout.y - 120);
            }}
            returnKeyType="next"
            onSubmitEditing={() => scrollTo(layoutY.current.often ?? 0)}
            placeholder="Name the service, e.g. Coolant flush"
            placeholderTextColor={p.faint}
            maxLength={40}
            accessibilityLabel="Service name"
            onFocus={() => setFocused('name')}
            onBlur={() => setFocused(null)}
            style={[inputStyle(p, { active: focused === 'name', error: errors.name }), styles.gapTop]}
          />
        )}
        <FieldError>{errors.name}</FieldError>
      </Section>

      {/* 2 — How often */}
      <Section
        p={p}
        step="2"
        title="How often"
        subtitle="From your owner's manual or service booklet."
        onLayout={e => {
          layoutY.current.often = e.nativeEvent.layout.y;
        }}
      >
        {timeOnly ? (
          <Text style={[styles.hint, { color: p.muted }]}>
            {`${form.name.trim()} repeats by time, not distance.`}
            {form.custom && (
              <Text onPress={trackDistance} accessibilityRole="button" style={{ color: p.accent }}>
                {'  Track distance too'}
              </Text>
            )}
          </Text>
        ) : (
          <>
            <Segmented options={MODE_OPTIONS} value={form.mode} onChange={changeMode} />
            <Text style={[styles.hint, { color: p.muted }]}>{MODE_HINT[form.mode]}</Text>
          </>
        )}

        <View style={styles.pair}>
          {showKm && (
            <Field p={p} label={`Repeat every (${unit})`} required suffix={unit} focused={focused === 'intervalKm'} error={errors.intervalKm}>
              {numberInput('intervalKm', {
                placeholder: unit === 'mi' ? 'e.g. 6,000' : 'e.g. 10,000',
                error: errors.intervalKm,
                label: `Repeat every, in ${unit}`,
              })}
            </Field>
          )}
          {showMonths && (
            <Field p={p} label="Repeat every (months)" required suffix="months" focused={focused === 'intervalMonths'} error={errors.intervalMonths}>
              {numberInput('intervalMonths', {
                placeholder: 'e.g. 6',
                error: errors.intervalMonths,
                label: 'Repeat every, in months',
                grouped: false,
              })}
            </Field>
          )}
        </View>

        {preset && !suggestionApplied && (
          <TouchableOpacity
            onPress={applySuggestion}
            accessibilityRole="button"
            accessibilityLabel={`Use typical interval, ${ruleShort(preset, unit)}`}
            style={[styles.suggest, { backgroundColor: p.field }]}
          >
            <Text style={[styles.suggestText, { color: p.muted }]} numberOfLines={2}>
              Typical for {form.name.toLowerCase()}:{' '}
              <Text style={{ color: p.text }}>{ruleShort(preset, unit)}</Text>
            </Text>
            <Text style={[styles.suggestAction, { color: p.accent }]}>Use</Text>
          </TouchableOpacity>
        )}
      </Section>

      {/* 3 — Last done */}
      <Section p={p} step="3" title="Last done" subtitle="The next service is counted from here.">
        <View style={styles.pair}>
          <View style={styles.flex}>
            <Label p={p} required>Date last done</Label>
            <TouchableOpacity
              onPress={() => setPicker('baseDate')}
              accessibilityRole="button"
              accessibilityLabel={form.baseDate ? `Last done on ${formatYmd(form.baseDate)}` : 'Pick the date it was last done'}
              style={[inputStyle(p, { active: picker === 'baseDate', error: errors.baseDate }), styles.dateField]}
            >
              <Text style={[styles.value, { color: form.baseDate ? p.text : p.faint }]} numberOfLines={1}>
                {form.baseDate ? formatYmd(form.baseDate) : 'Select date'}
              </Text>
              <CalendarIcon color={form.baseDate ? p.accent : p.faint} />
            </TouchableOpacity>
            <FieldError>{errors.baseDate}</FieldError>
          </View>
          {noDistance ? (
            <View style={styles.flex}>
              <Label p={p}>Buying date</Label>
              <TouchableOpacity
                onPress={() => setPicker('boughtDate')}
                onLongPress={() => set({ boughtDate: null })}
                accessibilityRole="button"
                accessibilityLabel={form.boughtDate ? `Bought on ${formatYmd(form.boughtDate)}` : 'Pick the date it was bought'}
                accessibilityHint={form.boughtDate ? 'Long press to clear' : undefined}
                style={[inputStyle(p, { active: picker === 'boughtDate', error: errors.boughtDate }), styles.dateField]}
              >
                <Text style={[styles.value, { color: form.boughtDate ? p.text : p.faint }]} numberOfLines={1}>
                  {form.boughtDate ? formatYmd(form.boughtDate) : 'Optional'}
                </Text>
                <CalendarIcon color={form.boughtDate ? p.accent : p.faint} />
              </TouchableOpacity>
              <FieldError>{errors.boughtDate}</FieldError>
            </View>
          ) : (
            <Field p={p} label={`Odometer then (${unit})`} required suffix={unit} focused={focused === 'baseOdo'} error={errors.baseOdo}>
              {numberInput('baseOdo', {
                placeholder: 'e.g. 8,900',
                error: errors.baseOdo,
                label: `Odometer when last done, in ${unit}`,
              })}
            </Field>
          )}
        </View>
        <Text style={[styles.hint, { color: p.muted }]}>
          {noDistance
            ? 'Never done it? Use the day you got the vehicle. Buying date is when you bought the part.'
            : 'Never done it? Use the day you got the vehicle and its odometer then.'}
        </Text>
        {!!odoLowWarning && (
          <Text style={[styles.hint, { color: p.status.soon.text }]} accessibilityLiveRegion="polite">
            {odoLowWarning}
          </Text>
        )}
      </Section>

      {/* 4 — Reminders */}
      <Section p={p} step="4" title="Reminders">
        <TouchableOpacity
          onPress={() => set({ remindersOn: !form.remindersOn })}
          accessibilityRole="switch"
          accessibilityLabel="Notify me before it's due"
          accessibilityState={{ checked: form.remindersOn }}
          style={styles.toggleRow}
        >
          <View style={styles.flex}>
            <Text style={[styles.value, { color: p.text }]}>Notify me before it's due</Text>
            <Text style={[styles.sectionSub, { color: p.muted }]}>
              {form.remindersOn ? 'And again while it is overdue.' : 'No notifications for this schedule.'}
            </Text>
          </View>
          <View style={[styles.track, { backgroundColor: form.remindersOn ? accent.primary : p.track }]}>
            <View style={[styles.thumb, { transform: [{ translateX: form.remindersOn ? 18 : 0 }] }]} />
          </View>
        </TouchableOpacity>

        {form.remindersOn && (showKm || showMonths) && (
          <>
            <View style={styles.pair}>
              {showKm && (
                <Field p={p} label={`Alert before (${unit})`} suffix={unit} focused={focused === 'warnKm'}>
                  {numberInput('warnKm', {
                    placeholder: formatNumber(kmToUnit(alertDefaults.warnKm, unit)),
                    label: `Warn me, ${unit} before`,
                  })}
                </Field>
              )}
              {showMonths && (
                <Field p={p} label="Alert before (days)" suffix="days" focused={focused === 'warnDays'}>
                  {numberInput('warnDays', {
                    placeholder: String(alertDefaults.warnDays),
                    label: 'Warn me, days before',
                    grouped: false,
                  })}
                </Field>
              )}
            </View>
            <Text style={[styles.hint, { color: p.muted }]}>Leave empty to use your Service alerts settings.</Text>
          </>
        )}
      </Section>

      {/* 5 — Photo (optional), like Add Document */}
      <Section p={p} step="5" title="Photo" subtitle="Optional: a receipt, the part or the job card.">
        {form.localImage || form.imageUrl ? (
          <View>
            <FitImage uri={form.localImage || form.imageUrl} style={styles.photoPreview} />
            <TouchableOpacity
              onPress={() => set({ localImage: null, imageUrl: null })}
              accessibilityRole="button"
              accessibilityLabel="Remove photo"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[styles.photoAction, styles.photoRemove]}
            >
              <Text style={styles.photoActionText}>Remove</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={choosePhoto}
              accessibilityRole="button"
              accessibilityLabel="Change photo"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[styles.photoAction, styles.photoChange]}
            >
              <Text style={styles.photoActionText}>Change</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            onPress={choosePhoto}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Add a photo"
            style={[styles.uploadZone, { borderColor: p.inputBorder }]}
          >
            <Upload color={p.muted} />
            <Text style={[styles.hint, { color: p.muted }]}>Add a photo</Text>
          </TouchableOpacity>
        )}
      </Section>

      {!!picker && (
        <AppDatePicker
          value={ymdToLocalDate(form[picker] || form.baseDate || todayYmd())}
          maximumDate={ymdToLocalDate(todayYmd())}
          onChange={(event, date) => {
            const key = picker;
            setPicker(null);
            if (event.type === 'set' && date) set({ [key]: toYmd(date) });
          }}
        />
      )}
    </>,
    footer,
  );
};

// Stack route (Edit from a schedule's detail, + Schedule on the Vehicle tab).
const ScheduleFormScreen = ({ navigation, route }) => {
  const { vehicleId, ruleId, onSaved } = route.params || {};
  return <ScheduleFormSheet vehicleId={vehicleId} ruleId={ruleId} onSaved={onSaved} onClose={() => navigation.goBack()} />;
};

export default ScheduleFormScreen;

const styles = StyleSheet.create({
  uploadZone: {
    height: 96,
    borderRadius: CONTROL_RADIUS,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  photoPreview: { width: '100%', height: 160, borderRadius: CONTROL_RADIUS },
  photoAction: {
    position: 'absolute',
    top: 8,
    backgroundColor: 'rgba(4,25,51,0.65)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  photoRemove: { right: 8 },
  photoChange: { left: 8 },
  photoActionText: { color: '#fff', fontFamily: Typography.font.medium, fontSize: 12 },
  flex: { flex: 1 },
  // Bottom sheet (same shape as the Add service sheet)
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%' },
  handleWrap: { alignItems: 'center', paddingTop: 10 },
  handle: { width: 40, height: 4, borderRadius: 2 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14, gap: 12 },
  headerIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sheetTitle: { fontSize: 18, fontFamily: Typography.font.medium },
  sheetSub: { fontSize: 13, fontFamily: Typography.font.regular, marginTop: 2 },
  closeButton: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  divider: { height: StyleSheet.hairlineWidth, width: '100%' },
  sheetScroll: { flexGrow: 0 },
  sheetContent: { paddingHorizontal: 20, paddingBottom: 12 },
  sheetFooter: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },

  // Service type chips (same as Add service)
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: CONTROL_RADIUS,
    borderWidth: 1,
    maxWidth: '100%',
  },
  chipText: { fontSize: CONTROL_FONT, fontFamily: Typography.font.medium },
  moreChip: { backgroundColor: 'transparent', borderStyle: 'dashed' },

  section: { paddingVertical: 18, gap: 12 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionTitle: { fontFamily: Typography.font.medium, fontWeight: '700', fontSize: 17, letterSpacing: -0.2 },
  sectionSub: { fontFamily: Typography.font.regular, fontSize: 13, marginTop: 1 },

  label: { fontFamily: Typography.font.medium, fontSize: 13, marginBottom: 6, letterSpacing: 0.2 },
  pair: { flexDirection: 'row', gap: 12 },
  gapTop: { marginTop: 2 },
  withSuffix: { paddingRight: 70 },
  suffix: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    textAlignVertical: 'center',
    lineHeight: 52,
    fontFamily: Typography.font.regular,
    fontSize: CONTROL_FONT,
  },
  dateField: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  value: { fontFamily: Typography.font.regular, fontSize: CONTROL_FONT },
  hint: { fontFamily: Typography.font.regular, fontSize: 13, lineHeight: 18 },

  suggest: { borderRadius: CONTROL_RADIUS, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  suggestText: { flex: 1, fontFamily: Typography.font.regular, fontSize: 13, lineHeight: 18 },
  suggestAction: { fontFamily: Typography.font.medium, fontWeight: '700', fontSize: CONTROL_FONT },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  track: { width: 44, height: 26, borderRadius: 13, padding: 3 },
  thumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },

  footer: { gap: 12 },
  result: { borderRadius: CONTROL_RADIUS, paddingHorizontal: 16, paddingVertical: 12, gap: 4 },
  resultLabel: { fontFamily: Typography.font.medium, fontWeight: '700', fontSize: 11, letterSpacing: 1.2 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  resultValue: { fontFamily: Typography.font.medium, fontWeight: '700', fontSize: 18 },
  resultSub: { fontFamily: Typography.font.regular, fontSize: 12, marginTop: 1 },
  resultOr: { fontFamily: Typography.font.regular, fontSize: 13 },
  resultEmpty: { fontFamily: Typography.font.regular, fontSize: 13, lineHeight: 18 },
  save: { flex: 0 },
});
