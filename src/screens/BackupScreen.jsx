import React, { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Alert, AppState, BackHandler, StyleSheet, TouchableOpacity, View } from 'react-native';
import Text from '../components/ui/AppText';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import Svg, { Path, Rect } from 'react-native-svg';
import LinearGradient from 'react-native-linear-gradient';
import Arrow from '../assets/svg/Arrow.jsx';
import { ScreenShell, useSchedulePalette } from '../components/schedule/ScheduleParts';
import { accent, hexToRgb, rgbToHex } from '../theme/accent';
import { fetchVehicleByEmail } from '../store/fetchSlice';
import { bumpRecordsVersion } from '../store/userSlice';
import { isNotificationsEnabled, openNotificationSettings } from '../util/notifications';
import { askNotificationPermission } from '../util/reminderFeedback';
import {
  BackupProblem,
  CSV_MIME,
  createBackup,
  exportSpreadsheet,
  firstRecordAt,
  pickAndCheckBackup,
  restoreBackup,
  saveFileToDevice,
  shareFile,
} from '../util/backup/backupService';
import {
  BACKUP_AFTER_DAYS,
  getBackupReminderOn,
  getLastBackupAt,
  setBackupReminderOn,
  syncBackupReminder,
} from '../util/backup/backupReminder';
import { daysFromToday } from '../util/dateStatus';
import { EVENTS, track } from '../util/analytics';
import { t as tr } from '../i18n';
import { localDate, localTime } from '../i18n';

/*
 * Settings → Backup (spec screens 3–6): one screen that steps through
 *   home      last backup, Back up now / Export spreadsheet / Restore, reminder switch
 *   ready     the file just made: Save to phone or Drive / Share
 *   restore   the picked file, checked; one Restore button
 *   finished  what the restore did
 */

const DAY = 24 * 60 * 60 * 1000;

// Time of day in the app language, e.g. "1:57 PM" / "13:57".
const formatTime = ms => localTime(ms, { hour: 'numeric', minute: '2-digit' });
const formatWhen = ms => {
  const date = localDate(new Date(ms), { day: 'numeric', month: 'short', year: 'numeric' });
  return `${date}, ${formatTime(ms)}`;
};
const formatSize = bytes =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
const records = n => (n === 1 ? tr('1 record') : tr('{0} records', { 0: n }));
const formatDay = ms => localDate(new Date(ms), { day: 'numeric', month: 'short' });

// The accent darkened toward black, for the hero gradient's deep end.
const deepen = (hex, amount) => rgbToHex(...hexToRgb(hex).map(v => v * (1 - amount)));

const INCLUDED = ['Vehicles', 'Services', 'Schedules', 'Fuel logs', 'Documents', 'Photos'];

const useColors = () => {
  const p = useSchedulePalette();
  const dark = p.isDark;
  return {
    ...p,
    warnBg: dark ? 'rgba(245,165,36,0.14)' : '#FFF6DF',
    warnBorder: dark ? 'rgba(245,165,36,0.35)' : '#F2D68D',
    warnText: dark ? '#FFD180' : '#5C4100',
    okBg: dark ? 'rgba(52,168,83,0.14)' : '#E6F4EA',
    okBorder: dark ? 'rgba(52,168,83,0.35)' : '#B7DFC3',
    okText: dark ? '#8EE0A8' : '#17633A',
    infoBg: dark ? accent.lightAlpha(0.1) : accent.alpha(0.07),
    infoText: dark ? accent.light : accent.primary,
    neutralBorder: dark ? 'rgba(255,255,255,0.22)' : '#CBD3DD',
  };
};

// The last spreadsheet export's outcome, kept outside the component: if the
// screen is rebuilt while the export runs (it lives inside the Settings tab),
// the result still shows instead of silently landing back on the menu.
//   { ok: true, path, name, size, counts } | { ok: false, message } | null
let lastCsvOutcome = null;

/* ── Pieces ─────────────────────────────────────────────────────────────── */

const Button = ({ title, onPress, kind = 'primary', disabled, busy, c }) => {
  const primary = kind === 'primary';
  const borderColor = kind === 'neutral' ? c.neutralBorder : c.accent;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || busy}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || busy), busy: !!busy }}
      style={[
        styles.button,
        primary ? { backgroundColor: accent.primary, boxShadow: `0px 6px 12px ${accent.alpha(0.3)}` } : { borderWidth: 1.5, borderColor },
        (disabled || busy) && { opacity: 0.55 },
      ]}
    >
      <Text style={[styles.buttonText, { color: primary ? '#FFFFFF' : kind === 'neutral' ? c.text : c.accent }]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
};

const Banner = ({ tone, title, body, c }) => {
  const t = tone === 'ok'
    ? { bg: c.okBg, border: c.okBorder, text: c.okText }
    : { bg: c.warnBg, border: c.warnBorder, text: c.warnText };
  return (
    <View style={[styles.banner, { backgroundColor: t.bg }]} accessibilityRole="text">
      <Text style={[styles.bannerTitle, { color: tone === 'ok' ? t.text : c.text }]}>{title}</Text>
      {!!body && <Text style={[styles.bannerBody, { color: t.text }]}>{body}</Text>}
    </View>
  );
};

const Info = ({ children, c, tone = 'info' }) => (
  <View style={[styles.info, { backgroundColor: tone === 'warn' ? c.warnBg : c.infoBg }]}>
    <Text style={[styles.infoText, { color: tone === 'warn' ? c.warnText : c.infoText }]}>{children}</Text>
  </View>
);

const Card = ({ children, c, style }) => (
  <View style={[styles.card, c.shadow, { backgroundColor: c.card }, style]}>{children}</View>
);

const Row = ({ label, value, c, strong }) => (
  <View style={styles.row}>
    <Text style={[styles.rowLabel, { color: c.muted }]}>{label}</Text>
    <Text style={[styles.rowValue, { color: c.text }, strong && styles.rowStrong]}>{value}</Text>
  </View>
);

const Check = ({ c }) => (
  <View style={[styles.check, { backgroundColor: c.okBg }]}>
    <Svg width={48} height={48} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12.5l4.5 4.5L19 7.5" stroke={c.okText} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  </View>
);

const Switch = ({ on, onPress, c, label }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.8}
    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    accessibilityRole="switch"
    accessibilityLabel={label}
    accessibilityState={{ checked: on }}
    style={[styles.track, { backgroundColor: on ? accent.primary : c.track }]}
  >
    <View style={[styles.thumb, { transform: [{ translateX: on ? 18 : 0 }] }]} />
  </TouchableOpacity>
);

const ShieldIcon = ({ color, ok }) => (
  <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
    <Path d="M12 3l7 3v5.5c0 4.4-3 8.2-7 9.5-4-1.3-7-5.1-7-9.5V6l7-3z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    {ok
      ? <Path d="M8.8 12.2l2.2 2.2 4.2-4.4" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
      : <Path d="M12 8.2v4.6M12 15.8h.01" stroke={color} strokeWidth={2} strokeLinecap="round" />}
  </Svg>
);

const CloudUpIcon = ({ color }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 8.5a4 4 0 0 1-.5 9.5" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
    <Path d="M12 20v-8M9 14.5l3-3 3 3" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const SheetIcon = ({ color }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Rect x={4} y={3.5} width={16} height={17} rx={3} stroke={color} strokeWidth={1.7} />
    <Path d="M4 9.5h16M4 15h16M10 9.5v11" stroke={color} strokeWidth={1.7} />
  </Svg>
);

const RestoreIcon = ({ color }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Path d="M4 12a8 8 0 1 0 2.3-5.6L4 8.6" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M4 4v4.6h4.6M12 8v4.2l2.8 1.8" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const BellIcon = ({ color }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Path d="M6 9a6 6 0 1 1 12 0c0 4.5 1.5 6 2 6.5H4c.5-.5 2-2 2-6.5Z" stroke={color} strokeWidth={1.7} strokeLinejoin="round" />
    <Path d="M10 19a2 2 0 0 0 4 0" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
  </Svg>
);

const LockIcon = ({ color }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
    <Rect x={5} y={10.5} width={14} height={10} rx={2.5} stroke={color} strokeWidth={1.8} />
    <Path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
  </Svg>
);

const TickIcon = ({ color }) => (
  <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
    <Path d="M5 12.5l4.5 4.5L19 7.5" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// Under "Export spreadsheet": the file just made (name, size, Save / Share)
// or why it failed (Try again). Stays until dismissed or the next export.
const CsvOutcomeCard = ({ c, outcome, onSave, onShare, onRetry, onDismiss }) => {
  const ok = outcome.ok;
  return (
    <View
      style={[styles.outcome, { backgroundColor: ok ? c.okBg : c.warnBg, borderColor: ok ? c.okBorder : c.warnBorder }]}
      accessibilityLiveRegion="polite"
    >
      <View style={styles.outcomeHead}>
        <Text style={[styles.outcomeTitle, { color: ok ? c.okText : c.warnText }]}>
          {ok ? tr('Spreadsheet ready') : tr('Export didn\'t finish')}
        </Text>
        <TouchableOpacity onPress={onDismiss} accessibilityRole="button" accessibilityLabel={tr('Dismiss')} hitSlop={12}>
          <Text style={[styles.outcomeDismiss, { color: ok ? c.okText : c.warnText }]}>✕</Text>
        </TouchableOpacity>
      </View>
      {ok ? (
        <>
          <Text style={[styles.outcomeBody, { color: c.text }]} selectable numberOfLines={2}>{outcome.name}</Text>
          <Text style={[styles.outcomeMeta, { color: c.muted }]}>{formatSize(outcome.size)}{' '}{tr('· ZIP of CSV files')}</Text>
          <View style={styles.outcomeButtons}>
            <OutcomeButton c={c} title={tr('Save')} onPress={onSave} filled />
            <OutcomeButton c={c} title={tr('Share')} onPress={onShare} />
          </View>
        </>
      ) : (
        <>
          <Text style={[styles.outcomeBody, { color: c.warnText }]}>{outcome.message}</Text>
          <View style={styles.outcomeButtons}>
            <OutcomeButton c={c} title={tr('Try again')} onPress={onRetry} filled />
          </View>
        </>
      )}
    </View>
  );
};

const OutcomeButton = ({ c, title, onPress, filled }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.85}
    accessibilityRole="button"
    style={[
      styles.outcomeButton,
      filled ? { backgroundColor: accent.primary } : { borderWidth: 1, borderColor: c.accent },
    ]}
  >
    <Text style={[styles.outcomeButtonText, { color: filled ? '#FFFFFF' : c.accent }]}>{title}</Text>
  </TouchableOpacity>
);

// Icon tile in the accent gradient, with a soft glow: the option rows and
// the reminder row share it so the page reads as one set.
const GradientWell = ({ children, c }) => (
  <View style={[styles.wellGlow, { boxShadow: `0px 0px 10px ${accent.alpha(c.isDark ? 0.45 : 0.3)}` }]}>
    <LinearGradient
      colors={[accent.primary, deepen(accent.primary, 0.35)]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.well}
    >
      {children}
    </LinearGradient>
  </View>
);

const ActionRow = ({ c, icon, title, tag, sub, onPress, busy, disabled }) => {
  const [pressed, setPressed] = useState(false);
  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={disabled || busy}
      activeOpacity={1}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${sub}`}
      accessibilityState={{ disabled: !!(disabled || busy), busy: !!busy }}
      style={[styles.actionRow, pressed && { backgroundColor: c.accentTint }, disabled && styles.dim]}
    >
      <GradientWell c={c}>{icon}</GradientWell>
      <View style={styles.flex}>
        <View style={styles.titleLine}>
          <Text style={[styles.actionTitle, { color: c.text }]} numberOfLines={1}>{title}</Text>
          {!!tag && (
            <View style={[styles.tag, { borderColor: c.isDark ? accent.lightAlpha(0.35) : accent.alpha(0.22) }]}>
              <Text style={[styles.tagText, { color: c.accent }]}>{tag}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.actionSub, { color: c.muted }]}>{sub}</Text>
      </View>
      {busy ? (
        <ActivityIndicator color={c.accent} />
      ) : (
        <View style={[styles.chevron, { backgroundColor: c.accentTint }]}>
          <Arrow color={c.accent} />
        </View>
      )}
    </TouchableOpacity>
  );
};

/* ── "Ready" screens (backup file / spreadsheet) ───────────────────────── */

const ICON = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none' };
const stroke = color => ({ stroke: color, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' });

const CarIcon = ({ color }) => (
  <Svg {...ICON}>
    <Path d="M5 16.5V12l1.8-4.6A2 2 0 0 1 8.7 6h6.6a2 2 0 0 1 1.9 1.4L19 12v4.5" {...stroke(color)} />
    <Path d="M4 12h16v4.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V12zM7.5 14.8h.01M16.5 14.8h.01" {...stroke(color)} />
  </Svg>
);
const WrenchIcon = ({ color }) => (
  <Svg {...ICON}>
    <Path d="M14.7 6.3a4 4 0 0 0-5.2 5.2L4.5 16.5a1.8 1.8 0 0 0 2.5 2.5l5-5a4 4 0 0 0 5.2-5.2l-2.4 2.4-2.1-.4-.4-2.1 2.4-2.4z" {...stroke(color)} />
  </Svg>
);
const FuelIcon = ({ color }) => (
  <Svg {...ICON}>
    <Path d="M5 20V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v14M4 20h12M5 10h10" {...stroke(color)} />
    <Path d="M15 8l3 3v6a1.5 1.5 0 0 0 3 0V9l-2.5-2.5" {...stroke(color)} />
  </Svg>
);
const DocIcon = ({ color }) => (
  <Svg {...ICON}>
    <Path d="M14 3.5H7.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8L14 3.5z" {...stroke(color)} />
    <Path d="M14 3.5V8h4.5M9 13h6M9 16.5h4" {...stroke(color)} />
  </Svg>
);
const PhotoIcon = ({ color }) => (
  <Svg {...ICON}>
    <Rect x={3.5} y={5} width={17} height={14} rx={3} {...stroke(color)} />
    <Path d="M3.5 16l4.5-4.5 4 4 2.5-2.5 6 6M15.5 9.5h.01" {...stroke(color)} />
  </Svg>
);
const DownloadIcon = ({ color }) => (
  <Svg {...ICON}>
    <Path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14" {...stroke(color)} />
  </Svg>
);
const ShareIcon = ({ color }) => (
  <Svg {...ICON}>
    <Path d="M12 15V4M8 7.5L12 3.5l4 4M7 11H6a1.5 1.5 0 0 0-1.5 1.5v6A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5v-6A1.5 1.5 0 0 0 18 11h-1" {...stroke(color)} />
  </Svg>
);

// Gradient card: success badge, headline, and the file that was made.
const ReadyHero = ({ c, title, body, fileName, size, type, kindIcon }) => (
  <View style={[styles.heroShadow, { boxShadow: `0px 0px 24px ${accent.alpha(c.isDark ? 0.35 : 0.3)}` }]}>
    <LinearGradient
      colors={[accent.primary, deepen(accent.primary, 0.42)]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.hero, styles.readyHero]}
    >
      <View pointerEvents="none" style={[styles.ring, styles.ringLarge]} />
      <View pointerEvents="none" style={[styles.ring, styles.ringSmall]} />

      <View style={styles.badgeHalo}>
        <View style={styles.badgeHaloInner}>
          <View style={styles.badge}>
            <Svg width={34} height={34} viewBox="0 0 24 24" fill="none">
              <Path d="M5 12.5l4.5 4.5L19 7.5" stroke={accent.primary} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
        </View>
      </View>

      <Text style={[styles.heroTitle, styles.center]} accessibilityRole="header">{title}</Text>
      <Text style={[styles.heroBody, styles.center]}>{body}</Text>

      <View style={styles.fileChip}>
        <View style={styles.fileIcon}>{kindIcon}</View>
        <View style={styles.fileChipText}>
          {/* Not `selectable`: on Android that ignores numberOfLines and the
              name overflows the chip. Two lines fit the full name on phones. */}
          <Text style={styles.fileChipName} numberOfLines={2} accessibilityLabel={tr('File {0}', { 0: fileName })}>
            {fileName}
          </Text>
          <Text style={styles.fileChipMeta}>{size} · {type}</Text>
        </View>
      </View>
    </LinearGradient>
  </View>
);

// "What's inside": one tile per record type, two to a row.
const InsideGrid = ({ c, items }) => (
  <>
    <Text style={[styles.section, { color: c.muted }]}>{tr('WHAT\'S INSIDE')}</Text>
    <Card c={c} style={styles.includedCard}>
      <View style={styles.included}>
        {items.map(({ label, value, Icon }) => (
          <View
            key={label}
            style={[styles.insideTile, { backgroundColor: c.accentTint }]}
            accessible
            accessibilityLabel={`${label}: ${value}`}
          >
            <View style={[styles.insideIcon, { backgroundColor: c.card }]}>
              <Icon color={c.accent} />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.insideValue, { color: c.text }]}>{value}</Text>
              <Text style={[styles.insideLabel, { color: c.muted }]} numberOfLines={1}>{label}</Text>
            </View>
          </View>
        ))}
      </View>
    </Card>
  </>
);

// Save (filled) and Share (tinted), side by side.
const ReadyActions = ({ c, onSave, onShare }) => (
  <View style={styles.readyActions}>
    <TouchableOpacity
      onPress={onSave}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={tr('Save to phone or Drive')}
      style={[styles.readyBtn, styles.readyBtnWide, { backgroundColor: accent.primary, boxShadow: `0px 0px 14px ${accent.alpha(0.3)}` }]}
    >
      <DownloadIcon color="#FFFFFF" />
      <Text style={[styles.readyBtnText, { color: '#FFFFFF' }]} numberOfLines={1}>{tr('Save to phone or Drive')}</Text>
    </TouchableOpacity>
    <TouchableOpacity
      onPress={onShare}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={tr('Share')}
      style={[styles.readyBtn, { backgroundColor: c.accentTint }]}
    >
      <ShareIcon color={c.accent} />
      <Text style={[styles.readyBtnText, { color: c.accent }]}>{tr('Share')}</Text>
    </TouchableOpacity>
  </View>
);

const TipCard = ({ c, children }) => (
  <View style={[styles.tip, { backgroundColor: c.warnBg }]}>
    <View style={[styles.tipIcon, { backgroundColor: c.isDark ? 'rgba(245,165,36,0.2)' : '#FCE7B0' }]}>
      <Text style={[styles.tipIconText, { color: c.warnText }]}>!</Text>
    </View>
    <Text style={[styles.tipText, { color: c.warnText }]}>{children}</Text>
  </View>
);

/* ── Screen ─────────────────────────────────────────────────────────────── */

// `navigation` is Settings' in-tab page host (or the root stack when opened
// from the reminder notification); `nav` is the real navigator, for Home.
const BackupScreen = ({ navigation }) => {
  const nav = useNavigation();
  const goHome = useCallback(() => nav.navigate('Tabbar', { screen: 'Home' }), [nav]);
  const c = useColors();
  const dispatch = useDispatch();
  const userEmail = useSelector(s => s.user.userEmail);
  const storeVehicles = useSelector(s => s.vehicle.vehiclesInformation);

  const [step, setStep] = useState('home');
  const [lastBackupAt, setLastBackupAt] = useState(null);
  const [remindOn, setRemindOn] = useState(true);
  const [notifOn, setNotifOn] = useState(true);
  const [vehicles, setVehicles] = useState(storeVehicles || []);
  const [busy, setBusy] = useState(null); // 'backup' | 'csv' | 'pick' | 'restore'
  const [progress, setProgress] = useState('');
  const [made, setMade] = useState(null);
  const [checked, setChecked] = useState(null);
  const [result, setResult] = useState(null);
  const [csvOutcome, setCsvOutcomeState] = useState(() => lastCsvOutcome);
  const setCsvOutcome = useCallback(next => {
    lastCsvOutcome = next;
    setCsvOutcomeState(next);
  }, []);

  const refresh = useCallback(() => {
    getLastBackupAt().then(setLastBackupAt);
    getBackupReminderOn().then(setRemindOn);
    isNotificationsEnabled().then(setNotifOn).catch(() => setNotifOn(false));
    if (userEmail) fetchVehicleByEmail(userEmail).then(setVehicles).catch(() => {});
  }, [userEmail]);

  useFocusEffect(refresh);
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => s === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);

  // Android back steps back inside the flow instead of leaving it.
  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (busy) return true;
      if (step === 'finished') {
        goHome();
        return true;
      }
      if (step !== 'home') {
        setStep('home');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [step, busy, goHome]));

  const firstAt = firstRecordAt({ vehicles });
  const hasVehicles = vehicles.length > 0;

  /* Back up now */
  const backUp = async (withPhotos = true) => {
    setBusy('backup');
    try {
      const res = await createBackup(userEmail, { withPhotos, onStep: setProgress });
      setMade({ ...res, kind: 'backup' });
      track(EVENTS.BACKUP_CREATED, { with_photos: withPhotos });
      setLastBackupAt(Date.now());
      setStep('ready');
    } catch (e) {
      track(EVENTS.BACKUP_FAILED, { reason: e?.code || 'unknown' });
      if (e instanceof BackupProblem && e.code === 'photos-offline') {
        Alert.alert(tr('Some photos couldn\'t be downloaded'), tr('{0} You can make the backup without them, or try again when you\'re online.', { 0: e.message }), [
          { text: tr('Cancel'), style: 'cancel' },
          { text: tr('Create without photos'), onPress: () => backUp(false) },
          { text: tr('Try again'), onPress: () => backUp(true) },
        ]);
      } else {
        Alert.alert(tr('Backup didn\'t finish'), e instanceof BackupProblem ? e.message : tr('Something went wrong while making the file. Nothing was changed. Try again.'));
        if (!(e instanceof BackupProblem)) console.warn('Backup failed', e);
      }
    } finally {
      setBusy(null);
      setProgress('');
    }
  };

  // Always ends in something visible: the "Spreadsheet ready" page (and a
  // result card on this screen with the file name, Save and Share), or an
  // error card with Try again. No alert that can be missed.
  const exportCsv = async () => {
    setBusy('csv');
    setCsvOutcome(null);
    try {
      const res = await exportSpreadsheet(userEmail, { onStep: setProgress });
      setCsvOutcome({ ok: true, ...res });
      track(EVENTS.CSV_EXPORTED);
      setMade({ ...res, kind: 'csv' });
      setStep('ready');
      AccessibilityInfo.announceForAccessibility?.(tr('Spreadsheet ready: {0}', { 0: res.name }));
    } catch (e) {
      console.warn('CSV export failed', e);
      const message = e instanceof BackupProblem ? e.message : tr('The spreadsheet couldn\'t be made. Check your connection and try again.');
      setCsvOutcome({ ok: false, message });
      AccessibilityInfo.announceForAccessibility?.(tr('Export didn\'t finish. {0}', { 0: message }));
    } finally {
      setBusy(null);
      setProgress('');
    }
  };
  const saveCsv = file => saveFileToDevice(file).catch(e => Alert.alert(tr('Couldn\'t save the file'), e?.message || tr('Try again.')));
  const shareCsv = file => shareFile(file).catch(e => Alert.alert(tr('Couldn\'t share the file'), e?.message || tr('Try again.')));

  const chooseFile = async () => {
    setBusy('pick');
    try {
      const res = await pickAndCheckBackup();
      if (!res) return;
      setChecked(res);
      setStep('restore');
    } catch (e) {
      // R9: name the problem, change nothing.
      Alert.alert(tr('Can\'t restore this file'), e?.code ? e.message : tr('The file couldn\'t be opened. Nothing was changed.'));
      if (!e?.code) console.warn('Backup check failed', e);
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    setBusy('restore');
    try {
      const res = await restoreBackup(userEmail, checked.backup, { onStep: setProgress });
      setResult(res);
      track(EVENTS.BACKUP_RESTORED);
      dispatch(bumpRecordsVersion());
      setStep('finished');
    } catch (e) {
      console.warn('Restore failed', e);
      track(EVENTS.RESTORE_FAILED);
      Alert.alert(tr('Restore didn\'t finish'), tr('Nothing in your account was changed. Check your connection and try again.'));
    } finally {
      setBusy(null);
      setProgress('');
    }
  };

  const toggleReminder = async () => {
    const next = !remindOn;
    if (next && !notifOn) {
      const granted = await askNotificationPermission({ what: 'a backup' });
      setNotifOn(!!granted);
    }
    setRemindOn(next);
    await setBackupReminderOn(next);
    syncBackupReminder({ firstRecordAt: firstAt }).catch(() => {});
  };

  /* ── Screen 4b: Spreadsheet ready ── */
  if (step === 'ready' && made?.kind === 'csv') {
    const file = { path: made.path, name: made.name, mimeType: CSV_MIME };
    return (
      <ScreenShell title={tr('Spreadsheet ready')} right={{ label: tr('Done'), onPress: () => setStep('home') }}>
        <ReadyHero
          c={c}
          title={tr('Your spreadsheet is ready')}
          body={tr('One CSV file per record type, zipped. Open them in Excel or Google Sheets.')}
          fileName={made.name}
          size={formatSize(made.size)}
          type="ZIP"
          kindIcon={<SheetIcon color="#FFFFFF" />}
        />
        <InsideGrid
          c={c}
          items={[
            { label: tr('Vehicles'), value: made.counts.vehicles, Icon: CarIcon },
            { label: tr('Services & schedules'), value: made.counts.servicesAndSchedules, Icon: WrenchIcon },
            { label: tr('Fuel logs'), value: made.counts.fuelLogs, Icon: FuelIcon },
            { label: tr('Documents'), value: made.counts.documents, Icon: DocIcon },
          ]}
        />
        <ReadyActions c={c} onSave={() => saveCsv(file)} onShare={() => shareCsv(file)} />
      </ScreenShell>
    );
  }

  /* ── Screen 4: Backup ready ── */
  if (step === 'ready' && made) {
    const mime = { path: made.path, name: made.name };
    return (
      <ScreenShell title={tr('Backup ready')} right={{ label: tr('Done'), onPress: () => setStep('home') }}>
        <ReadyHero
          c={c}
          title={tr('Your backup is ready')}
          body={tr('It\'s on this phone only until you save or share it.')}
          fileName={made.name}
          size={formatSize(made.size)}
          type="VHBACKUP"
          kindIcon={<ShieldIcon color="#FFFFFF" ok />}
        />
        <InsideGrid
          c={c}
          items={[
            { label: tr('Vehicles'), value: made.counts.vehicles, Icon: CarIcon },
            { label: tr('Services & schedules'), value: made.counts.servicesAndSchedules, Icon: WrenchIcon },
            { label: tr('Fuel logs'), value: made.counts.fuelLogs, Icon: FuelIcon },
            { label: tr('Documents'), value: made.counts.documents, Icon: DocIcon },
            { label: tr('Photos & files'), value: made.photos, Icon: PhotoIcon },
          ]}
        />
        {made.missingPhotos > 0 && (
          <Info c={c} tone="warn">
            {made.missingPhotos === 1
              ? tr('1 photo is not in this file because it couldn\'t be downloaded.')
              : tr('{0} photos are not in this file because they couldn\'t be downloaded.', { 0: made.missingPhotos })}
          </Info>
        )}
        <ReadyActions
          c={c}
          onSave={() => saveFileToDevice(mime).catch(e => Alert.alert(tr('Couldn\'t save the file'), e?.message || tr('Try again.')))}
          onShare={() => shareFile(mime).catch(() => {})}
        />
        <TipCard c={c}>{tr('Keep one copy somewhere other than this phone, such as Google Drive or your computer.')}</TipCard>
      </ScreenShell>
    );
  }

  /* ── Screen 5: Restore ── */
  if (step === 'restore' && checked) {
    const m = checked.backup.manifest;
    const d = checked.backup.data;
    return (
      <ScreenShell
        title={tr('Restore')}
        left={busy ? undefined : { label: tr('Cancel'), onPress: () => setStep('home') }}
        footer={<Button c={c} title={busy ? progress || tr('Restoring…') : tr('Restore')} onPress={restore} busy={!!busy} />}
      >
        <Banner c={c} tone="ok" title={tr('File checked, nothing is damaged')} body={checked.fileName} />
        <Card c={c}>
          <Text style={[styles.cardLabel, { color: c.muted }]}>{tr('IN THIS FILE')}</Text>
          <Row c={c} label={tr('Made on')} value={formatWhen(Date.parse(m.createdAt))} />
          <Row c={c} label={tr('Vehicles')} value={d.vehicles.length} />
          <Row c={c} label={tr('Services and schedules')} value={d.services.length + d.schedules.length} />
          <Row c={c} label={tr('Fuel logs')} value={d.fuelLogs.length} />
          <Row c={c} label={tr('Documents')} value={d.documents.length} />
          <Row c={c} label={tr('Photos and attachments')} value={Object.keys(checked.backup.photos).length} />
        </Card>
        <Info c={c}>
          {tr('Nothing in your account is deleted. Records that are missing are added. If a record is in both places, the newer one is kept.')}
        </Info>
        <Text style={[styles.foot, styles.footSpaced, { color: c.muted }]}>
          {tr('A record you deleted after this backup was made comes back. Delete it again if you don\'t want it.')}
        </Text>
      </ScreenShell>
    );
  }

  /* ── Screen 6: Restore finished ── */
  if (step === 'finished' && result) {
    const r = result.counts;
    return (
      <ScreenShell
        title={tr('Restore finished')}
        footer={<Button c={c} title={tr('Go to Home')} onPress={goHome} />}
      >
        <Check c={c} />
        <Text style={[styles.heading, { color: c.text }]}>{tr('Your data is back')}</Text>
        <Card c={c}>
          <Row c={c} strong label={tr('Added')} value={records(r.added)} />
          <Row c={c} strong label={tr('Updated (newer in file)')} value={records(r.updated)} />
          <Row c={c} strong label={tr('Already up to date')} value={records(r.upToDate)} />
          <Row c={c} strong label={tr('Photos restored')} value={result.photosRestored} />
          <Row c={c} strong label={tr('Could not read')} value={r.couldNotRead} />
        </Card>
        {result.photosNotRestored > 0 && (
          <Info c={c} tone="warn">
            {result.photosNotRestored === 1
              ? tr('1 photo couldn\'t be uploaded. Restore the same file again when you\'re online to bring it back.')
              : tr('{0} photos couldn\'t be uploaded. Restore the same file again when you\'re online to bring them back.', { 0: result.photosNotRestored })}
          </Info>
        )}
        {result.pendingUpload && (
          <Info c={c} tone="warn">
            {tr('You seem to be offline. The records are on this phone now and upload by themselves when you\'re back online.')}
          </Info>
        )}
        <Info c={c}>{tr('Reminders for services and documents have been set again, so they will fire at 9:00 AM as before.')}</Info>
        <Card c={c}>
          <Text style={[styles.bannerTitle, { color: c.text }]}>{tr('Nothing was deleted')}</Text>
          <Text style={[styles.bannerBody, { color: c.muted }]}>
            {tr('Records already in your account were kept unless the file had a newer version.')}
          </Text>
        </Card>
      </ScreenShell>
    );
  }

  /* ── Screen 3: Backup ── */
  // Calendar days, so a backup from last night reads "1 day ago", not "today".
  const age = lastBackupAt ? Math.max(0, -daysFromToday(lastBackupAt)) : null;
  const status = !lastBackupAt ? 'none' : age >= BACKUP_AFTER_DAYS ? 'due' : 'ok';
  const tone = status === 'ok'
    ? { fg: c.okText, bg: c.okBg, pill: tr('Protected') }
    : { fg: c.warnText, bg: c.warnBg, pill: status === 'due' ? tr('Due now') : tr('Not backed up') };
  const heroTitle = status === 'none'
    ? tr('No backup yet')
    : status === 'due'
      ? tr('Last backup {0} days ago', { 0: age })
      : age === 0 ? tr('Backed up today') : (age === 1 ? tr('Backed up yesterday') : tr('Backed up {0} days ago', { 0: age }));
  const heroBody = status === 'none'
    ? tr('Keep your own copy of every record and photo, outside the app. One file has it all.')
    : status === 'due'
      ? tr('Make a new backup so your latest records are safe too.')
      : tr('{0}. Keep a copy somewhere other than this phone.', { 0: formatWhen(lastBackupAt) });
  const daysLeft = lastBackupAt ? Math.max(0, BACKUP_AFTER_DAYS - age) : 0;
  // How much of the backup interval is still left: full right after a backup.
  const freshness = lastBackupAt ? daysLeft / BACKUP_AFTER_DAYS : 0;
  const meterLabel = status === 'due'
    ? tr('Due now')
    : `${formatDay(lastBackupAt + BACKUP_AFTER_DAYS * DAY)} · in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`;

  return (
    <ScreenShell title={tr('Backup')} left={{ label: tr('Settings'), chevron: true, onPress: () => navigation.goBack() }}>
      {/* Status + main action */}
      <View style={[styles.heroShadow, { boxShadow: `0px 0px 24px ${accent.alpha(c.isDark ? 0.35 : 0.3)}` }]}>
        <LinearGradient
          colors={[accent.primary, deepen(accent.primary, 0.42)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          {/* Soft rings in the corner, for depth. */}
          <View pointerEvents="none" style={[styles.ring, styles.ringLarge]} />
          <View pointerEvents="none" style={[styles.ring, styles.ringSmall]} />

          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <ShieldIcon color="#FFFFFF" ok={status === 'ok'} />
            </View>
            <View style={styles.pill}>
              <View style={[styles.pillDot, { backgroundColor: status === 'ok' ? '#7CF0A6' : '#FFC861' }]} />
              <Text style={styles.pillText}>{tone.pill}</Text>
            </View>
          </View>

          <Text style={styles.heroTitle} accessibilityRole="header">{heroTitle}</Text>
          <Text style={styles.heroBody}>{heroBody}</Text>

          {lastBackupAt ? (
            <View style={styles.meter} accessibilityLabel={meterLabel}>
              <View style={styles.meterHead}>
                <Text style={styles.meterLabel}>{tr('NEXT BACKUP')}</Text>
                <Text style={styles.meterValue}>{meterLabel}</Text>
              </View>
              <View style={styles.meterTrack}>
                <View
                  style={[
                    styles.meterFill,
                    { width: `${Math.max(4, freshness * 100)}%`, backgroundColor: status === 'ok' ? '#FFFFFF' : '#FFC861' },
                  ]}
                />
              </View>
            </View>
          ) : null}

          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>{tr('LAST BACKUP')}</Text>
              <Text style={styles.statValue} numberOfLines={1}>
                {lastBackupAt ? (age === 0 ? tr('Today, {0}', { 0: formatTime(lastBackupAt) }) : formatDay(lastBackupAt)) : tr('Never')}
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statLabel}>{tr('REMINDER')}</Text>
              <Text style={styles.statValue} numberOfLines={1}>
                {remindOn ? tr('Every {0} days', { 0: BACKUP_AFTER_DAYS }) : tr('Off')}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => backUp(true)}
            disabled={!hasVehicles || !!busy}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ disabled: !hasVehicles || !!busy, busy: busy === 'backup' }}
            style={[styles.cta, (!hasVehicles || (busy && busy !== 'backup')) && styles.dim]}
          >
            {busy === 'backup' ? <ActivityIndicator color={accent.primary} /> : <CloudUpIcon color={accent.primary} />}
            <Text style={[styles.ctaText, { color: accent.primary }]} numberOfLines={1}>
              {!hasVehicles ? tr('Add a vehicle first') : busy === 'backup' ? progress || tr('Backing up…') : tr('Back up now')}
            </Text>
          </TouchableOpacity>

          {/* Restore sits with Back up now: the two things this screen is for. */}
          <TouchableOpacity
            onPress={chooseFile}
            disabled={!!busy && busy !== 'pick'}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={tr('Restore from a backup. Bring records back from a .vhbackup file')}
            accessibilityState={{ disabled: !!busy && busy !== 'pick', busy: busy === 'pick' }}
            style={[styles.ctaSecondary, busy && busy !== 'pick' && styles.dim]}
          >
            {busy === 'pick' ? <ActivityIndicator color="#FFFFFF" /> : <RestoreIcon color="#FFFFFF" />}
            <Text style={styles.ctaSecondaryText} numberOfLines={1}>
              {busy === 'pick' ? tr('Checking the file…') : tr('Restore from a backup')}
            </Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>

      {/* Other actions */}
      <Text style={[styles.section, { color: c.muted }]}>{tr('MORE OPTIONS')}</Text>
      <Card c={c} style={styles.listCard}>
        <ActionRow
          c={c}
          icon={<SheetIcon color="#FFFFFF" />}
          title={tr('Export spreadsheet')}
          tag="CSV"
          sub={busy === 'csv' ? progress || tr('Making the spreadsheet…') : tr('CSV files for Excel or Google Sheets')}
          onPress={exportCsv}
          busy={busy === 'csv'}
          disabled={!hasVehicles || (!!busy && busy !== 'csv')}
        />
        {csvOutcome && busy !== 'csv' && (
          <CsvOutcomeCard
            c={c}
            outcome={csvOutcome}
            onSave={() => saveCsv({ path: csvOutcome.path, name: csvOutcome.name, mimeType: CSV_MIME })}
            onShare={() => shareCsv({ path: csvOutcome.path, name: csvOutcome.name, mimeType: CSV_MIME })}
            onRetry={exportCsv}
            onDismiss={() => setCsvOutcome(null)}
          />
        )}
      </Card>

      {/* Reminder */}
      <Text style={[styles.section, { color: c.muted }]}>{tr('REMINDER')}</Text>
      <Card c={c} style={styles.listCard}>
        <View style={styles.actionRow}>
          <GradientWell c={c}>
            <BellIcon color="#FFFFFF" />
          </GradientWell>
          <View style={styles.flex}>
            <Text style={[styles.actionTitle, { color: c.text }]}>{tr('Remind me to back up')}</Text>
            <Text style={[styles.actionSub, { color: c.muted }]}>{tr('Every {0} days, at 9:00 AM', { 0: BACKUP_AFTER_DAYS })}</Text>
          </View>
          <Switch c={c} on={remindOn} onPress={toggleReminder} label={tr('Remind me to back up')} />
        </View>
        {remindOn && !notifOn && (
          <TouchableOpacity
            onPress={openNotificationSettings}
            accessibilityRole="button"
            style={[styles.inlineNotice, { backgroundColor: c.warnBg }]}
          >
            <Text style={[styles.inlineNoticeText, { color: c.warnText }]}>
              {tr('Notifications are off, so the reminder can\'t show. Tap to turn them on. Backups still work.')}
            </Text>
          </TouchableOpacity>
        )}
      </Card>

      {/* What's included */}
      <Text style={[styles.section, { color: c.muted }]}>{tr('EVERY BACKUP INCLUDES')}</Text>
      <Card c={c} style={styles.includedCard}>
        <View style={styles.included}>
          {INCLUDED.map(label => (
            <View key={label} style={[styles.includedItem, { backgroundColor: c.accentTint }]}>
              <View style={[styles.includedTick, { backgroundColor: c.isDark ? accent.light : accent.primary }]}>
                <TickIcon color={c.isDark ? '#0A1E38' : '#FFFFFF'} />
              </View>
              <Text style={[styles.includedText, { color: c.text }]} numberOfLines={1}>{tr(label)}</Text>
            </View>
          ))}
        </View>
      </Card>
      <View style={styles.footRow}>
        <View style={styles.footIcon}>
          <LockIcon color={c.muted} />
        </View>
        <Text style={[styles.foot, { color: c.muted }]}>
          {tr('Your records are stored in your account (Google Firebase) so they sync across your devices. The backup file is extra: it is made on this phone and goes only where you save or share it.')}
        </Text>
      </View>
    </ScreenShell>
  );
};

export default BackupScreen;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // Matches the Profile sheet's "Edit Profile" button.
  button: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginTop: 14,
  },
  buttonText: { fontFamily: 'RobotoCondensed500', fontSize: 16, textAlign: 'center' },
  banner: { borderRadius: 16, padding: 16 },
  bannerTitle: { fontSize: 17, fontWeight: '700' },
  bannerBody: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  info: { borderRadius: 14, padding: 14, marginTop: 14 },
  infoText: { fontSize: 14, lineHeight: 20 },
  card: { borderRadius: 16, padding: 16, marginTop: 14 },
  cardLabel: { fontSize: 12, letterSpacing: 1.2, fontWeight: '600', marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 32, gap: 12 },
  rowLabel: { fontSize: 15, flexShrink: 1 },
  rowValue: { fontSize: 15 },
  rowStrong: { fontWeight: '700' },
  fileName: { fontSize: 15, fontWeight: '700', marginBottom: 6 },
  check: { width: 96, height: 96, borderRadius: 48, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  heading: { fontSize: 22, fontWeight: '700', textAlign: 'center', marginTop: 14 },
  sub: { fontSize: 14, textAlign: 'center', marginTop: 6 },
  track: { width: 44, height: 26, borderRadius: 13, padding: 3, justifyContent: 'center' },
  thumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF' },
  foot: { flex: 1, fontSize: 13, lineHeight: 19 },
  footSpaced: { flex: 0, marginTop: 12, marginHorizontal: 4 },
  footRow: { flexDirection: 'row', gap: 10, marginTop: 16, marginHorizontal: 4, marginBottom: 8 },
  footIcon: { paddingTop: 2 },
  dim: { opacity: 0.5 },
  heroShadow: { borderRadius: 24, marginTop: 4 },
  hero: { borderRadius: 24, padding: 22, overflow: 'hidden' },
  ring: { position: 'absolute', borderRadius: 999, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(255,255,255,0.05)' },
  ringLarge: { width: 220, height: 220, top: -110, right: -70 },
  ringSmall: { width: 120, height: 120, top: -30, right: -40 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  pillDot: { width: 8, height: 8, borderRadius: 4 },
  pillText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.4, color: '#FFFFFF' },
  heroTitle: { fontSize: 26, fontWeight: '800', marginTop: 20, color: '#FFFFFF', letterSpacing: -0.3 },
  heroBody: { fontSize: 14, lineHeight: 21, marginTop: 6, color: 'rgba(255,255,255,0.82)' },
  meter: { marginTop: 20 },
  meterHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 12 },
  meterLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, color: 'rgba(255,255,255,0.65)' },
  meterValue: { fontSize: 13, fontWeight: '600', color: '#FFFFFF', flexShrink: 1, textAlign: 'right' },
  meterTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  meterFill: { height: 6, borderRadius: 3 },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  stat: { flex: 1 },
  statDivider: { width: 1, alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.18)', marginHorizontal: 14 },
  statLabel: { fontSize: 10.5, fontWeight: '700', letterSpacing: 1.1, color: 'rgba(255,255,255,0.6)' },
  statValue: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', marginTop: 3 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    borderRadius: 14,
    marginTop: 18,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    boxShadow: '0px 0px 14px rgba(0,0,0,0.16)',
  },
  ctaText: { fontFamily: 'RobotoCondensed500', fontSize: 17, flexShrink: 1 },
  ctaSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 50,
    borderRadius: 14,
    marginTop: 10,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  ctaSecondaryText: { color: '#FFFFFF', fontFamily: 'RobotoCondensed500', fontSize: 16, flexShrink: 1 },
  includedCard: { marginTop: 0, padding: 12 },
  center: { textAlign: 'center' },
  readyHero: { alignItems: 'stretch', paddingTop: 28 },
  badgeHalo: { alignSelf: 'center', width: 104, height: 104, borderRadius: 52, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' },
  badgeHaloInner: { width: 84, height: 84, borderRadius: 42, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  badge: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', boxShadow: '0px 0px 16px rgba(0,0,0,0.18)' },
  fileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 22,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  fileChipText: { flex: 1, minWidth: 0 },
  fileIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  fileChipName: { fontSize: 14, lineHeight: 19, fontWeight: '700', color: '#FFFFFF', flexShrink: 1 },
  fileChipMeta: { fontSize: 12, fontWeight: '600', letterSpacing: 0.4, color: 'rgba(255,255,255,0.7)', marginTop: 3 },
  insideTile: { width: '48.8%', flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14 },
  insideIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  insideValue: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  insideLabel: { fontSize: 12, fontWeight: '500', marginTop: 1 },
  readyActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  readyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52, borderRadius: 14, paddingHorizontal: 18 },
  readyBtnWide: { flex: 1 },
  readyBtnText: { fontFamily: 'RobotoCondensed500', fontSize: 16, flexShrink: 1 },
  tip: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, padding: 14, marginTop: 14 },
  tipIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tipIconText: { fontSize: 15, fontWeight: '800' },
  tipText: { flex: 1, fontSize: 13.5, lineHeight: 19 },
  included: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  includedItem: { width: '48.8%', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12 },
  includedTick: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  includedText: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
  section: { fontSize: 12, fontWeight: '600', letterSpacing: 1.2, marginTop: 24, marginBottom: 8, marginLeft: 4 },
  listCard: { padding: 0, marginTop: 0, overflow: 'hidden' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 76, paddingHorizontal: 16, paddingVertical: 14 },
  wellGlow: { borderRadius: 14 },
  well: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tag: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  tagText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  chevron: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  actionTitle: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  actionSub: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  outcome: { marginHorizontal: 12, marginBottom: 12, borderRadius: 12, borderWidth: 1, padding: 12, gap: 4 },
  outcomeHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  outcomeTitle: { fontSize: 14, fontWeight: '700' },
  outcomeDismiss: { fontSize: 14, fontWeight: '700' },
  outcomeBody: { fontSize: 14, lineHeight: 20 },
  outcomeMeta: { fontSize: 12 },
  outcomeButtons: { flexDirection: 'row', gap: 10, marginTop: 8 },
  outcomeButton: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  outcomeButtonText: { fontFamily: 'RobotoCondensed500', fontSize: 15 },
  inlineNotice: { marginHorizontal: 12, marginBottom: 12, borderRadius: 12, padding: 12 },
  inlineNoticeText: { fontSize: 13, lineHeight: 18 },
});
