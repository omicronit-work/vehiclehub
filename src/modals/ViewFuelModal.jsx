import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native'
import PhotoPreview from '../components/PhotoPreview';
import React, { useMemo } from 'react'
import Modal from 'react-native-modal';
import { useSelector } from 'react-redux';

import CloseX from '../assets/svg/CloseX.jsx';
import FuelIcon from '../assets/svg/FuelIcon.jsx';
import { formatRecordMoney } from '../util/methods/useCurrency';
import { fuelUnit, efficiencyUnit, fuelEconomyNote } from '../util/fuelEfficiency.js';
import { shadow } from '../theme/tokens';
import { accent } from '../theme/accent';
import { useHideAdsWhile } from '../util/ads';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatKm, formatEff, costPerUnit } from '../util/distance';
import { useDistanceUnit } from '../util/schedule/scheduleSettings';


const ViewFuelModal = ({ forFuelView, setForFuelView, fuelData, setFuelData, setIsSelected }) => {
  useHideAdsWhile(forFuelView);
  const { theme } = useSelector(state => state.theme);
  const isDark = theme === 'dark';
  const distUnit = useDistanceUnit();
  // The sheet is drawn edge to edge, so keep the last row above the gesture bar.
  const insets = useSafeAreaInsets();

  const t = useMemo(
    () => ({
      sheetBg: isDark ? '#0A1E38' : '#fff',
      text: isDark ? '#fff' : 'rgba(4, 25, 51, 1)',
      muted: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(4,25,51,0.55)',
      infoRowBg: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(4,25,51,0.025)',
      handle: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(4,25,51,0.15)',
      divider: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(4,25,51,0.06)',
      imageBorder: isDark ? 'rgba(255,255,255,0.16)' : accent.lightAlpha(0.25),
      backdrop: 'rgba(4, 25, 51, 0.6)',
      iconWell: isDark ? accent.lightAlpha(0.14) : accent.alpha(0.08),
      accent: isDark ? accent.light : accent.primary,
      good: isDark ? '#9CE6B0' : '#1E8A4C',
    }),
    [isDark],
  );

  const formatFirestoreDate = (timestamp) => {
    if (!timestamp || typeof timestamp._seconds !== 'number') return '--';
    return new Date(timestamp._seconds * 1000).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const handleClose = () => {
    setForFuelView(false);
    setIsSelected(false);
  };

  if (!fuelData) return null;

  const InfoRow = ({ label, value }) => (
    <View style={[styles.infoRow, { backgroundColor: t.infoRowBg }]}>
      <Text style={[styles.infoLabel, { color: t.muted }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: t.text }]}>{value}</Text>
    </View>
  );

  const unit = fuelUnit(fuelData.fuelType);

  return (
    <View style={styles.container}>
      <Modal
        isVisible={forFuelView}
        statusBarTranslucent
        backdropOpacity={0.55}
        onBackdropPress={handleClose}
        onBackButtonPress={handleClose}
        style={styles.modal}
        coverScreen
      >
        <View style={[styles.sheet, shadow(4), { backgroundColor: t.sheetBg }]}>
          <View style={styles.handleWrapper}>
            <View style={[styles.handle, { backgroundColor: t.handle }]} />
          </View>

          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.iconWell, { backgroundColor: t.iconWell }]}>
                <FuelIcon color={t.accent} size={20} />
              </View>
              <Text style={[styles.title, { color: t.text }]} numberOfLines={1}>
                {fuelData.fuelName || fuelData.fuelType || 'Fuel log'}
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

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 + insets.bottom }]}>
            <PhotoPreview
              uri={fuelData?.imageUrl}
              borderColor={t.imageBorder}
              fileName="VehicleHub_Receipt"
            />

            <View style={[styles.efficiencyBanner, { backgroundColor: t.infoRowBg }]}>
              {fuelData.efficiency != null ? (
                <Text style={[styles.efficiencyValue, { color: t.good }]}>
                  {formatEff(fuelData.efficiency, efficiencyUnit(fuelData.fuelType), distUnit)}
                </Text>
              ) : (
                <Text style={[styles.efficiencyValue, { color: t.muted }]}>No economy yet</Text>
              )}
              <Text style={[styles.efficiencyHint, { color: t.muted }]}>{fuelEconomyNote(fuelData, distUnit)}</Text>
            </View>

            <View style={styles.row}>
              <View style={styles.flexHalf}>
                <InfoRow label="Date" value={formatFirestoreDate(fuelData.date)} />
              </View>
              <View style={styles.flexHalf}>
                <InfoRow
                  label="Since last fill-up"
                  value={
                    fuelData.distance != null
                      ? formatKm(fuelData.distance, distUnit)
                      : (fuelData.hasReading ?? Number(fuelData.odometer) > 0) ? 'First log' : '—'
                  }
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.flexHalf}>
                <InfoRow
                  label="Odometer"
                  value={(fuelData.hasReading ?? Number(fuelData.odometer) > 0) ? formatKm(fuelData.odometer, distUnit) : 'Not recorded'}
                />
              </View>
              <View style={styles.flexHalf}>
                <InfoRow label={fuelData.fuelType === 'EV Charge' ? 'Energy added' : 'Quantity'} value={`${fuelData.liters} ${unit}`} />
              </View>
            </View>

            <View style={styles.row}>
              {!!fuelData.pricePerLiter && (
                <View style={styles.flexHalf}>
                  <InfoRow
                    label={`Price / ${unit}`}
                    value={formatRecordMoney(fuelData, fuelData.pricePerLiter)}
                  />
                </View>
              )}
              {!!fuelData.totalCost && (
                <View style={styles.flexHalf}>
                  <InfoRow
                    label="Total Cost"
                    value={formatRecordMoney(fuelData, fuelData.totalCost)}
                  />
                </View>
              )}
            </View>

            {!!fuelData.stationName && (
              <InfoRow label={fuelData.fuelType === 'EV Charge' ? 'Charging station' : 'Station'} value={fuelData.stationName} />
            )}

            {fuelData.costPerKm != null && (
              <InfoRow
                label={`Cost per ${distUnit}`}
                value={formatRecordMoney(fuelData, costPerUnit(fuelData.costPerKm, distUnit))}
              />
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  )
}

export default ViewFuelModal

const styles = StyleSheet.create({
  container: { position: 'absolute' },
  modal: { margin: 0, justifyContent: 'flex-end' },
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
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
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
  efficiencyBanner: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 2,
  },
  efficiencyValue: { fontSize: 20, fontFamily: 'RobotoCondensed500', fontWeight: '700' },
  efficiencyHint: { fontSize: 12, fontFamily: 'RobotoCondensed400' },
})
