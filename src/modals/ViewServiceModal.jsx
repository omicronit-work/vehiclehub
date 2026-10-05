import { StyleSheet, Text, View, TouchableOpacity, Image, ScrollView } from 'react-native'
import React, { useMemo } from 'react'
import Modal from 'react-native-modal';
import CloseX from '../assets/svg/CloseX.jsx';
import { useDispatch, useSelector } from 'react-redux';
import { setReload } from '../store/userSlice.js';
import { useCurrency, toDisplayAmount } from '../util/methods/useCurrency';
import { shadow } from '../theme/tokens';
import { accent } from '../theme/accent';

// Premium shadow profile — matches Vehicle.jsx / VehicleInformations.jsx

const FIELD_LABELS = {
  oilType: 'Oil Type',
  oilQuantity: 'Oil Quantity',
  filterBrand: 'Filter Brand',
  tireBrand: 'Tire Brand',
  tireSize: 'Tire Size',
  quantity: 'Quantity',
  padBrand: 'Brake Pad Brand',
  frontOrRear: 'Position',
  servicePackage: 'Service Package',
};

const ViewServiceModal = ({ forView, setForView, serviceData, setServiceData, setIsSelected }) => {

  const dispatch = useDispatch()

  const { theme } = useSelector(state => state.theme);
  const { symbol: currencySymbol, fxRate } = useCurrency(forView);
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
                <Image
                  source={isDark ? require('../assets/icons/whiteService.png') : require('../assets/icons/service.png')}
                  style={styles.headerIcon}
                />
              </View>
              <Text style={[styles.title, { color: t.text }]} numberOfLines={1}>
                {serviceData?.name || 'View service'}
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
            contentContainerStyle={styles.scrollContent}
          >
            {serviceData?.imageUrl && (
              <Image
                source={{ uri: serviceData.imageUrl }}
                style={[styles.serviceImage, shadow(2), { borderColor: t.imageBorder }]}
              />
            )}

            <InfoRow label="Service Date" value={formatFirestoreDate(serviceData?.serviceDate)} />

            {serviceData?.nextServiceDate && (
              <InfoRow
                label="Next Service Date"
                value={formatFirestoreDate(serviceData.nextServiceDate)}
              />
            )}

            {!!serviceData?.nextServiceMileage && (
              <InfoRow
                label="Next Service Mileage"
                value={`${serviceData.nextServiceMileage} km`}
              />
            )}

            {Object.entries(FIELD_LABELS).map(([key, label]) =>
              serviceData?.[key] ? (
                <InfoRow key={key} label={label} value={serviceData[key]?.toString()} />
              ) : null,
            )}

            {mileageOrCost && (
              <View style={styles.row}>
                {serviceData?.currentMileage && (
                  <View style={styles.flexHalf}>
                    <InfoRow
                      label="Current Mileage"
                      value={`${serviceData.currentMileage} km`}
                    />
                  </View>
                )}
                {!!serviceData?.totalCost && (
                  <View style={styles.flexHalf}>
                    <InfoRow
                      label="Total Cost"
                      value={`${currencySymbol} ${Number(toDisplayAmount(serviceData.totalCost, fxRate)).toLocaleString()}`}
                    />
                  </View>
                )}
              </View>
            )}

            {serviceData?.workshopName && (
              <InfoRow label="Workshop Name" value={serviceData.workshopName} />
            )}

            {serviceData?.description && (
              <InfoRow label="Description" value={serviceData.description} multiline />
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
  headerIcon: { width: 20, height: 20, resizeMode: 'contain' },
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
  serviceImage: {
    width: '100%',
    height: 180,
    borderRadius: 14,
    borderWidth: 1,
    resizeMode: 'cover',
  },
})
