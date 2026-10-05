import { StyleSheet, Text, View, TouchableOpacity, Image, ScrollView } from 'react-native'
import React, { useMemo } from 'react'
import Modal from 'react-native-modal';
import { useSelector } from 'react-redux';
import CloseX from '../assets/svg/CloseX.jsx';
import { shadow } from '../theme/tokens';
import { accent } from '../theme/accent';

// Premium shadow profile — matches Vehicle.jsx / VehicleInformations.jsx

const ViewDocumentModal = ({ forDocumentView, setForDocumentView, documentData, setDocumentData }) => {

  const { theme } = useSelector(state => state.theme);
  const isDark = theme === 'dark';

  // ─── Theme-aware palette (matches ServiceUpdate.jsx / ViewServiceModal.jsx) ─
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

  const handleClose = () => {
    setForDocumentView(false);
  };

  if (!documentData) return null;

  // ─── Shared read-only field row (matches ServiceUpdate.jsx / ViewServiceModal.jsx) ─
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

  return (
    <View style={styles.container}>
      <Modal
        isVisible={forDocumentView}
        statusBarTranslucent
        backdropOpacity={0.55}
        onBackdropPress={handleClose}
        onBackButtonPress={handleClose}
        style={styles.modal}
        coverScreen
      >
        {/* FIX: read-only detail sheet, no text input on screen — dropped
            KeyboardAvoidingView (nothing to avoid-keyboard for, and it can
            steal ScrollView's touch events for momentum scrolling, per the
            fix already documented in ServiceUpdate.jsx). Also dropped the
            unrelated debug console.log left in the original. */}
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
                  source={isDark ? require('../assets/icons/documentWhite.png') : require('../assets/icons/document.png')}
                  style={styles.headerIcon}
                />
              </View>
              <Text style={[styles.title, { color: t.text }]} numberOfLines={1}>
                {documentData?.documentName || 'View document'}
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
            {documentData?.imageUrl && (
              <Image
                source={{ uri: documentData.imageUrl }}
                style={[styles.documentImage, shadow(2), { borderColor: t.imageBorder }]}
                resizeMode="cover"
              />
            )}

            <InfoRow label="Document Name" value={documentData?.documentName || '--'} />

            <View style={styles.row}>
              <View style={styles.flexHalf}>
                <InfoRow label="Issue Date" value={formatFirestoreDate(documentData?.issueDate)} />
              </View>
              <View style={styles.flexHalf}>
                <InfoRow label="Expiry Date" value={formatFirestoreDate(documentData?.expiryDate)} />
              </View>
            </View>

            {documentData?.description && (
              <InfoRow label="Description" value={documentData.description} multiline />
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  )
}

export default ViewDocumentModal

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
  documentImage: {
    width: '100%',
    height: 180,
    borderRadius: 14,
    borderWidth: 1,
  },
})
