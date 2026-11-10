import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native'
import PhotoPreview from '../components/PhotoPreview';
import React, { useMemo } from 'react'
import Modal from 'react-native-modal';
import CloseX from '../assets/svg/CloseX.jsx';
import ServiceTypeIcon from '../assets/svg/ServiceTypeIcon';
import { useDispatch, useSelector } from 'react-redux';
import { setReload } from '../store/userSlice.js';
import { formatRecordMoney } from '../util/methods/useCurrency';
import { shadow } from '../theme/tokens';
import { accent } from '../theme/accent';
import { SERVICE_DETAIL_LABELS, formatServiceDetail, serviceLabel } from '../util/serviceFields';
import { useHideAdsWhile } from '../util/ads';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatKm } from '../util/distance';
import { useDistanceUnit } from '../util/schedule/scheduleSettings';
import { PrimaryAction } from '../components/schedule/ScheduleParts';

// Premium shadow profile — matches Vehicle.jsx / VehicleInformations.jsx

const FIELD_LABELS = SERVICE_DETAIL_LABELS;

// `onEdit`, when given, adds an "Edit service" button under the details.
const ViewServiceModal = ({ forView, setForView, serviceData, setServiceData, setIsSelected, onEdit }) => {
  useHideAdsWhile(forView);

  const dispatch = useDispatch()

  const { theme } = useSelector(state => state.theme);
  const distUnit = useDistanceUnit();
  // The sheet is drawn edge to edge, so keep the last row above the gesture bar.
  const insets = useSafeAreaInsets();
  const isDark = theme === 'dark';

  // ─── Theme-aware palette (matches ServiceUpdate.jsx) ─────────────────────
  const t = useMemo(
    () => ({
      sheetBg: isDark ? '#0A1E38' : '#fff',
      text: isDark ? '#fff' : 'rgba(4, 25, 51, 1)',
      muted: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(4,25,51,0.55)',
      infoRowBg: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(4,25,51,0.025)',
      handle: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(4,25,51,0.15)',
      divider: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(4,25,51,0.06)',
      closeBg: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(4,25,51,0.05)',
      imageBorder: isDark ? 'rgba(255,255,255,0.16)' : accent.lightAlpha(0.25),
      backdrop: 'rgba(4, 25, 51, 0.6)',
      iconWell: isDark ? accent.lightAlpha(0.14) : accent.alpha(0.08),
      accent: isDark ? accent.light : accent.primary,
    }),
    [isDark],
  );

  const formatFirestoreDate = (timestamp) => {
    if (!timestamp || typeof timestamp._seconds !== 'number') {
      return '--';
    }
    return new Date(timestamp._seconds * 1000).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  // FIX: header ✕ and backdrop-tap previously behaved differently — only the
  // header button dispatched setReload(true). Both paths now close the same
  // way so a swipe-to-dismiss / backdrop tap doesn't leave stale data behind.
  const handleClose = () => {
    setForView(false);
    setIsSelected(false);
    dispatch(setReload(true));
  };

  if (!serviceData) return null;

  // ─── Shared read-only field row (replaces 13+ near-identical disabled
  // TextInput blocks). A disabled TextInput still carries input affordances
  // — cursor, tap target, sometimes a virtual keyboard flicker on Android —
  // for content that was never editable to begin with. Text reads as
  // read-only because it *is* read-only, and matches the InfoRow pattern
  // already used in ServiceUpdate.jsx's view mode. ─────────────────────────
  const InfoRow = ({ label, value, multiline }) => (
    <View style={[styles.infoRow, { backgroundColor: t.infoRowBg }]}>
      <Text style={[styles.infoLabel, { color: t.muted }]}>{label}</Text>
      <Text
        style={[styles.infoValue, { color: t.text }, multiline && styles.infoValueMultiline]}
      >
        {value}
      </Text>
    </View>
  );

  const mileageOrCost = serviceData?.currentMileage || serviceData?.totalCost;

  return (
    <View style={styles.container}>
      <Modal
        isVisible={forView}
        statusBarTranslucent
        backdropOpacity={0.55}
        onBackdropPress={handleClose}
        onBackButtonPress={handleClose}
        style={styles.modal}
        coverScreen
      >
        {/* FIX: this is a read-only detail sheet — there's no text input to
            avoid-keyboard for. KeyboardAvoidingView here was doing nothing
            useful and (per the fix already documented in ServiceUpdate.jsx)
            can steal touch events the ScrollView needs for momentum
            scrolling. Plain View is both correct and lighter. */}
        <View style={[styles.sheet, shadow(4), { backgroundColor: t.sheetBg }]}>
          {/* Drag handle */}
          <View style={styles.handleWrapper}>
            <View style={[styles.handle, { backgroundColor: t.handle }]} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.iconWell, { backgroundColor: t.iconWell }]}>
                <ServiceTypeIcon name={serviceData?.name} size={20} color={t.accent} />
              </View>
              <Text style={[styles.title, { color: t.text }]} numberOfLines={1}>
                {serviceLabel(serviceData?.name) || 'View service'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={[styles.closeButton, { backgroundColor: t.iconWell }]}
            >
              <CloseX size={12} color={t.accent} />
            </TouchableOpacity>
          </View>

          <View style={[styles.divider, { backgroundColor: t.divider }]} />

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 + insets.bottom }]}
          >
            <PhotoPreview
              uri={serviceData?.imageUrl}
              borderColor={t.imageBorder}
              fileName="VehicleHub_Service"
            />

            <InfoRow label="Service Date" value={formatFirestoreDate(serviceData?.serviceDate)} />

            {!!serviceData?.nextServiceDate && (
              <InfoRow
                label="Next Service Date"
                value={formatFirestoreDate(serviceData.nextServiceDate)}
              />
            )}

            {!!serviceData?.nextServiceMileage && (
              <InfoRow
                label="Next Service Mileage"
                value={formatKm(serviceData.nextServiceMileage, distUnit)}
              />
            )}

            {Object.entries(FIELD_LABELS).map(([key, label]) =>
              serviceData?.[key] ? (
                <InfoRow key={key} label={label} value={formatServiceDetail(key, serviceData[key])} />
              ) : null,
            )}

            {!!mileageOrCost && (
              <View style={styles.row}>
                {!!serviceData?.currentMileage && (
                  <View style={styles.flexHalf}>
                    <InfoRow
                      label="Current Mileage"
                      value={formatKm(serviceData.currentMileage, distUnit)}
                    />
                  </View>
                )}
                {!!serviceData?.totalCost && (
                  <View style={styles.flexHalf}>
                    <InfoRow
                      label="Total Cost"
                      value={formatRecordMoney(serviceData, serviceData.totalCost)}
                    />
                  </View>
                )}
              </View>
            )}

            {!!serviceData?.workshopName && (
              <InfoRow label="Workshop Name" value={serviceData.workshopName} />
            )}

            {!!serviceData?.description && (
              <InfoRow label="Description" value={serviceData.description} multiline />
            )}

            {!!onEdit && (
              <PrimaryAction title="Edit service" onPress={() => onEdit(serviceData)} style={styles.editButton} />
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  )
}

export default ViewServiceModal

const styles = StyleSheet.create({
  // Wrapper only hosts an out-of-flow Modal; flex: 1 here would steal layout space from the parent.
  container: { position: 'absolute' },
  modal: {
    margin: 0,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  handleWrapper: { alignItems: 'center', paddingTop: 10 },
  handle: { width: 40, height: 4, borderRadius: 2 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconWell: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 18, fontFamily: 'RobotoCondensed500', flex: 1, flexShrink: 1 },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: { height: 1, width: '100%' },
  scrollContent: { padding: 20, gap: 12 },
  row: { flexDirection: 'row', gap: 12 },
  flexHalf: { flex: 1 },
  infoRow: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  infoLabel: { fontSize: 12, fontFamily: 'RobotoCondensed500', letterSpacing: 0.4 },
  infoValue: { fontSize: 15, fontFamily: 'RobotoCondensed500' },
  infoValueMultiline: { fontSize: 14, fontFamily: 'RobotoCondensed400', lineHeight: 20 },
  editButton: { flex: 0, alignSelf: 'stretch', marginTop: 8 },
})
