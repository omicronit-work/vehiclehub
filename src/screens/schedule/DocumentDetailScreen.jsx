import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Text from '../../components/ui/AppText';
import { useDispatch, useSelector } from 'react-redux';
import Svg, { Path } from 'react-native-svg';
import {
  ScreenShell,
  SectionLabel,
  StatusChip,
  PrimaryAction,
  useSchedulePalette,
  CONTROL_RADIUS,
  CARD_RADIUS,
} from '../../components/schedule/ScheduleParts';
import { ProgressRing, LimitTile, InfoRow } from './ScheduleDetailScreen';
import ConfirmDeleteModal from '../../modals/ConfirmDeleteModal';
import DocumentUpdate from '../../modals/DocumentUpdate';
import AddDocument from '../../modals/AddDocument';
import { DocumentEditSkeleton } from '../../components/schedule/ScheduleSkeletons';
import PhotoPreview from '../../components/PhotoPreview';
import ErrorState from '../../components/ui/ErrorState';
import DocumentTypeIcon from '../../assets/svg/DocumentTypeIcon';
import TrashIcon from '../../assets/svg/TrashIcon';
import { fetchDocumentssByid } from '../../store/fetchSlice';
import { deleteUserDocument, bumpRecordsVersion } from '../../store/userSlice';
import { cancelReminder, reminderId, reminderSlot, DEFAULT_REMINDER_DAYS } from '../../util/notifications';
import { toMillis, daysFromToday, getDocumentStatus } from '../../util/dateStatus';
import { recordLabel } from '../../util/recordSummary';
import { STATUS, formatDays } from '../../util/schedule/scheduleMath';
import {
  DOCUMENT_DETAIL_KEYS,
  DOCUMENT_DETAIL_LABELS,
  getDocumentCopy,
  getDocumentFields,
  formatDocumentDetail,
  resolveDocumentType,
} from '../../util/documentFields';
import { Typography } from '../../styles/typography';
import { t as tr } from '../../i18n';
import { localDate } from '../../i18n';

const DAY = 24 * 60 * 60 * 1000;

const fmt = ms =>
  ms == null ? null : localDate(new Date(ms), { day: 'numeric', month: 'short', year: 'numeric' });

// Document status tone → schedule palette status.
const TONE_STATUS = { danger: STATUS.OVERDUE, warning: STATUS.SOON, success: STATUS.OK, neutral: STATUS.OK };

// "1 year", "6 months", "10 years" — the span between issue and expiry.
const spanText = (fromMs, toMs) => {
  const a = new Date(fromMs);
  const b = new Date(toMs);
  const months = Math.round((b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + (b.getDate() - a.getDate()) / 30);
  if (months <= 0) return `${formatDays(Math.max(1, Math.round((toMs - fromMs) / DAY)))}`;
  if (months % 12 === 0) return `${months / 12} year${months === 12 ? '' : 's'}`;
  return `${months} month${months === 1 ? '' : 's'}`;
};

const CheckIcon = ({ color, size = 16 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M5 12.5l4.5 4.5L19 7.5" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const noop = () => {};

// Shortest time the after-edit skeleton stays up.
const EDIT_SKELETON_MIN_MS = 600;

// Document page — the documents counterpart of the schedule detail page:
// status, validity ring, time left, details, earlier papers of the same type,
// and Renew / Edit / Delete. Opens inside Home's ScheduleHost.
// params: { vehicleId, documentId, document (shown until the fresh copy
// loads), onChanged (called after an edit, renewal or delete) }
const DocumentDetailScreen = ({ navigation, route }) => {
  const { vehicleId, documentId, document: initialDoc, onChanged } = route.params || {};
  const dispatch = useDispatch();
  const p = useSchedulePalette();
  const userEmail = useSelector(state => state.user.userEmail);

  const [docs, setDocs] = useState(null);
  const [error, setError] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);
  // Prefill for Renew, fixed when it's tapped so the open form isn't reset.
  const [renewInitial, setRenewInitial] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    if (!userEmail || !vehicleId) return Promise.resolve();
    setError(false);
    return fetchDocumentssByid(userEmail, vehicleId)
      .then(setDocs)
      .catch(err => {
        console.log('Load documents failed:', err);
        setError(true);
      });
  }, [userEmail, vehicleId]);

  useEffect(() => { load(); }, [load]);

  const changed = () => {
    load();
    onChanged?.();
  };

  // After an edit, the parts the edit can change (hero, validity, details)
  // show a skeleton until the saved copy is back. Held for a moment so it
  // doesn't just flicker when the reload is quick.
  const [updating, setUpdating] = useState(false);
  const edited = () => {
    setUpdating(true);
    onChanged?.();
    Promise.all([load(), new Promise(r => setTimeout(r, EDIT_SKELETON_MIN_MS))])
      .finally(() => setUpdating(false));
  };

  const doc = docs ? docs.find(d => d.id === documentId) : initialDoc;

  // Earlier (and later) papers of the same type, newest first.
  const history = useMemo(() => {
    if (!doc || !docs) return [];
    const type = resolveDocumentType(doc.documentName);
    const key = (doc.documentName || '').trim().toLowerCase();
    return docs
      .filter(d => d.id !== doc.id)
      .filter(d => (type ? resolveDocumentType(d.documentName) === type : (d.documentName || '').trim().toLowerCase() === key))
      .sort((a, b) => (toMillis(b.expiryDate) ?? toMillis(b.issueDate) ?? 0) - (toMillis(a.expiryDate) ?? toMillis(a.issueDate) ?? 0));
  }, [doc, docs]);

  const back = { label: tr('Back'), chevron: true, onPress: () => navigation.goBack() };

  if (!doc) {
    return (
      <ScreenShell title={tr('Document')} left={back}>
        {error ? (
          <ErrorState title={tr('Couldn\'t load this document')} onRetry={load} />
        ) : (
          <Text style={[styles.muted, { color: p.muted }]}>
            {docs ? tr('This document has been deleted.') : tr('Loading…')}
          </Text>
        )}
      </ScreenShell>
    );
  }

  const copy = getDocumentCopy(doc.documentName);
  const docStatus = getDocumentStatus(doc);
  const status = TONE_STATUS[docStatus.tone] || STATUS.OK;
  const s = p.status[status];

  const issueMs = toMillis(doc.issueDate);
  const expiryMs = toMillis(doc.expiryDate);
  const daysLeft = expiryMs != null ? daysFromToday(expiryMs) : null;
  const expired = daysLeft != null && daysLeft < 0;

  // Share of the validity period already used.
  const progress =
    issueMs != null && expiryMs != null && expiryMs > issueMs
      ? Math.max(0, Math.min(1, (Date.now() - issueMs) / (expiryMs - issueMs)))
      : null;

  const validity = issueMs != null && expiryMs != null && expiryMs > issueMs ? spanText(issueMs, expiryMs) : null;
  const typeName = resolveDocumentType(doc.documentName)?.name;
  const heroLine = [
    validity ? tr('Valid for {0}', { 0: validity }) : expiryMs != null ? `${copy.expiryLabel} ${fmt(expiryMs)}` : tr('No expiry date set'),
    typeName && typeName !== doc.documentName ? typeName : null,
  ].filter(Boolean).join(' · ');

  const reminderDays = Number(doc.reminderDays) || DEFAULT_REMINDER_DAYS;
  const slot = expiryMs != null ? reminderSlot(new Date(expiryMs), Date.now(), reminderDays) : null;
  const reminderOn = !!doc.remindMe && !!slot;

  const relText =
    daysLeft == null ? null : daysLeft < 0 ? `${formatDays(-daysLeft)} ago` : daysLeft === 0 ? 'today' : `in ${formatDays(daysLeft)}`;

  const fields = getDocumentFields(doc.documentName);
  const detailRows = DOCUMENT_DETAIL_KEYS.filter(k => String(doc[k] || '').trim()).map(k => ({
    label: fields.find(f => f.key === k)?.label || DOCUMENT_DETAIL_LABELS[k],
    value: formatDocumentDetail(k, doc[k]),
  }));
  const infoRows = [
    issueMs != null && { label: copy.issueLabel, value: fmt(issueMs) },
    expiryMs != null && { label: copy.expiryLabel, value: fmt(expiryMs) },
    ...detailRows,
    { label: tr('Reminder'), value: reminderOn ? `${formatDays(reminderDays)} before` : tr('Off') },
  ].filter(Boolean);

  // Renewal starts a new paper of the same type with the same details; an
  // expired one is renewed from today.
  const startRenewal = () => {
    setRenewInitial(renewFrom);
    setRenewOpen(true);
  };
  const renewFrom = {
    documentName: doc.documentName,
    details: Object.fromEntries(fields.map(f => [f.key, doc[f.key] || '']).filter(([, v]) => v)),
    issueDate: expired ? new Date() : null,
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteUserDocument(userEmail, vehicleId, doc.id);
      cancelReminder(reminderId('document', doc.id));
      dispatch(bumpRecordsVersion());
      setConfirmDelete(false);
      onChanged?.();
      navigation.goBack();
    } catch (err) {
      console.log('Delete document failed:', err);
      setDeleting(false);
    }
  };

  return (
    <ScreenShell
      title={doc.documentName || tr('Document')}
      left={back}
      right={{ label: tr('Edit'), onPress: () => setEditOpen(true) }}
      footer={
        <>
          <TouchableOpacity
            onPress={() => setConfirmDelete(true)}
            accessibilityRole="button"
            accessibilityLabel={tr('Delete document')}
            style={[styles.deleteBtn, { backgroundColor: p.status[STATUS.OVERDUE].bg }]}
          >
            <TrashIcon color={p.danger} width={18} height={18} />
          </TouchableOpacity>
          <PrimaryAction title={tr('Renew')} onPress={startRenewal} />
        </>
      }
    >
      {updating ? (
        <DocumentEditSkeleton rows={infoRows.length} />
      ) : (
      <>
      {/* Hero: what, status, validity ring and expiry */}
      <View style={[styles.hero, p.shadow, { backgroundColor: p.card }]}>
        <View style={styles.heroTop}>
          <View style={[styles.heroIcon, { backgroundColor: s.bg }]}>
            <DocumentTypeIcon name={doc.documentName} color={s.text} size={22} />
          </View>
          <View style={styles.flex}>
            <Text style={[styles.heroRule, { color: p.muted }]} numberOfLines={2}>
              {heroLine}
            </Text>
          </View>
          <StatusChip status={status} label={docStatus.tone === 'success' ? tr('Valid') : docStatus.label} />
        </View>

        <View style={styles.heroBody}>
          {/* Days left inside; the arc is the share of the validity still remaining. */}
          <ProgressRing
            progress={expired ? 1 : progress != null ? 1 - progress : daysLeft != null ? 1 : 0}
            color={s.bar}
            track={p.track}
            text={daysLeft == null ? '—' : String(Math.abs(daysLeft))}
            subLabel={
              daysLeft == null
                ? tr('no expiry')
                : expired
                ? `day${daysLeft === -1 ? '' : 's'} over`
                : `day${daysLeft === 1 ? '' : 's'} left`
            }
            sub={p.muted}
          />
          <View style={styles.flex}>
            <Text style={[styles.nextLabel, { color: p.muted }]}>
              {expiryMs == null ? 'EXPIRY' : expired ? 'EXPIRED' : 'EXPIRES'}
            </Text>
            <Text style={[styles.bigValue, { color: p.text }]} numberOfLines={1} adjustsFontSizeToFit>
              {expiryMs != null ? fmt(expiryMs) : tr('Not set')}
            </Text>
            {!!relText && <Text style={[styles.orValue, { color: p.muted }]}>{relText}</Text>}
            <View style={[styles.firstPill, { backgroundColor: p.accentTint }]}>
              <Text style={[styles.firstText, { color: p.accent }]}>
                {reminderOn ? tr('Reminder on') : tr('Reminder off')}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Validity (days left is in the ring above) */}
      <View style={styles.tiles}>
        <LimitTile
          p={p}
          label={tr('VALIDITY')}
          limit={null}
          value={validity || '—'}
          caption={issueMs != null ? `${copy.issueLabel} ${fmt(issueMs)}` : tr('Add the issue date to see it.')}
        />
      </View>

      {/* Details */}
      <View style={[styles.card, p.shadow, { backgroundColor: p.card }]}>
        <Text style={[styles.cardTitle, { color: p.text }]}>{tr('Details')}</Text>
        {infoRows.map((row, i) => (
          <InfoRow key={row.label} p={p} label={row.label} value={row.value} last={i === infoRows.length - 1 && !doc.description} />
        ))}
        {!!doc.description?.trim() && (
          <View style={styles.notes}>
            <Text style={[styles.notesLabel, { color: p.muted }]}>{tr('Notes')}</Text>
            <Text style={[styles.notesText, { color: p.text }]}>{doc.description}</Text>
          </View>
        )}
      </View>
      </>
      )}

      {!!doc.imageUrl && (
        <>
          <SectionLabel>{tr('PHOTO')}</SectionLabel>
          <PhotoPreview uri={doc.imageUrl} borderColor={p.cardBorder} fileName="VehicleHub_Document" />
        </>
      )}

      {/* Earlier papers of the same type */}
      <SectionLabel>{tr('HISTORY')}</SectionLabel>
      <View style={[styles.card, p.shadow, { backgroundColor: p.card }]}>
        {history.length === 0 ? (
          <View style={styles.emptyHistory}>
            <View style={[styles.emptyIcon, { backgroundColor: p.accentTint }]}>
              <CheckIcon color={p.accent} size={18} />
            </View>
            <Text style={[styles.muted, { color: p.muted }]}>
              {tr('No earlier copies. Tap Renew when this one runs out.')}
            </Text>
          </View>
        ) : (
          history.map((h, i) => {
            const hExpiry = toMillis(h.expiryDate);
            const hIssue = toMillis(h.issueDate);
            const hStatus = TONE_STATUS[getDocumentStatus(h).tone] || STATUS.OK;
            return (
              <TouchableOpacity
                key={h.id}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('DocumentDetail', { vehicleId, documentId: h.id, document: h, onChanged })}
                style={styles.timelineRow}
              >
                <View style={styles.timelineRail}>
                  <View style={[styles.dot, { backgroundColor: p.status[hStatus].bar }]}>
                    <CheckIcon color="#fff" size={10} />
                  </View>
                  {i < history.length - 1 && <View style={[styles.line, { backgroundColor: p.track }]} />}
                </View>
                <View style={[styles.flex, styles.timelineBody]}>
                  <Text style={[styles.historyTitle, { color: p.text }]} numberOfLines={1}>
                    {h.documentName}
                  </Text>
                  <Text style={[styles.historyMeta, { color: p.muted }]} numberOfLines={1}>
                    {[
                      hIssue != null ? tr('Issued {0}', { 0: fmt(hIssue) }) : null,
                      hExpiry != null ? `${daysFromToday(hExpiry) < 0 ? 'expired' : 'expires'} ${fmt(hExpiry)}` : null,
                    ].filter(Boolean).join(' · ') || tr('No dates')}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      <DocumentUpdate
        updateData={doc}
        DocumentUpdateModal={editOpen}
        setDocumentUpdateModal={setEditOpen}
        onDocumentUpdated={edited}
        forView={false}
        setForView={noop}
        setSelectedCard={noop}
      />

      <AddDocument
        AddDocumentModal={renewOpen}
        setAddDocumentModal={setRenewOpen}
        onDocumentAdded={changed}
        initial={renewInitial}
      />

      <ConfirmDeleteModal
        visible={confirmDelete}
        title={tr('Delete document')}
        itemName={recordLabel(doc, 'document')}
        description={tr('Delete "{0}"? Its reminder stops.', { 0: doc.documentName })}
        loading={deleting}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
      />
    </ScreenShell>
  );
};

export default DocumentDetailScreen;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  muted: { flex: 1, fontFamily: Typography.font.regular, fontSize: 14, lineHeight: 20 },

  hero: { borderRadius: CARD_RADIUS, padding: 18, gap: 18 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  heroRule: { fontFamily: Typography.font.regular, fontSize: 13, lineHeight: 18 },
  heroBody: { flexDirection: 'row', alignItems: 'center', gap: 18 },

  nextLabel: { fontFamily: Typography.font.medium, fontWeight: '700', fontSize: 11, letterSpacing: 1.2 },
  bigValue: { fontFamily: Typography.font.medium, fontWeight: '700', fontSize: 26, letterSpacing: -0.5, marginTop: 2 },
  orValue: { fontFamily: Typography.font.regular, fontSize: 14, marginTop: 2 },
  firstPill: { alignSelf: 'flex-start', borderRadius: CONTROL_RADIUS, paddingHorizontal: 10, paddingVertical: 4, marginTop: 8 },
  firstText: { fontFamily: Typography.font.medium, fontSize: 12, fontWeight: '700' },

  tiles: { flexDirection: 'row', gap: 12 },

  card: { borderRadius: CARD_RADIUS, paddingHorizontal: 16, paddingVertical: 14 },
  cardTitle: { fontFamily: Typography.font.medium, fontWeight: '700', fontSize: 16, marginBottom: 4 },
  notes: { paddingTop: 12, gap: 4 },
  notesLabel: { fontFamily: Typography.font.regular, fontSize: 14 },
  notesText: { fontFamily: Typography.font.regular, fontSize: 14, lineHeight: 20 },

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
