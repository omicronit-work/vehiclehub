import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Typography } from '../styles/typography.js';
import { themecolors } from '../styles/themecolors.js';
import { brand } from '../theme/tokens';
import CloseX from '../assets/svg/CloseX.jsx';
import ExportIcon from '../assets/svg/ExportIcon.jsx';
import { exportVehicleReport } from '../util/exportReport.js';
import { accent } from '../theme/accent';

const SECTION_OPTIONS = [
  { key: 'services', label: 'Services' },
  { key: 'fuel', label: 'Fuel logs' },
  { key: 'documents', label: 'Documents' },
];

const ExportReportModal = ({ visible, onClose, vehicle }) => {
  const { theme } = useSelector(store => store.theme);
  const { userEmail } = useSelector(store => store.user);
  const isDark = theme === 'dark';
  const insets = useSafeAreaInsets();

  const [sections, setSections] = useState(SECTION_OPTIONS.map(s => s.key));
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) setError('');
  }, [visible]);

  const c = useMemo(
    () => ({
      sheet: isDark ? themecolors.darkBlue : '#FFFFFF',
      text: isDark ? themecolors.white : '#0F172A',
      muted: isDark ? accent.softAlpha(0.6) : '#64748B',
      accent: isDark ? accent.light : accent.primary,
      closeBg: isDark ? accent.lightAlpha(0.14) : accent.alpha(0.08),
      closeIcon: isDark ? accent.light : accent.primary,
      optionBg: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
      border: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
      danger: '#E5484D',
    }),
    [isDark],
  );

  const toggleSection = key =>
    setSections(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]));

  const handleExport = async () => {
    setError('');
    setExporting(true);
    try {
      await exportVehicleReport({ email: userEmail, vehicle, sections });
      onClose();
    } catch (e) {
      console.warn('Export failed', e);
      setError('Could not create the export. Please check your connection and try again.');
    } finally {
      setExporting(false);
    }
  };

  const canExport = sections.length > 0 && !exporting;

  return (
    <Modal
      visible={visible}
      backdropOpacity={0.55}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={exporting ? undefined : onClose}
    >
      <TouchableWithoutFeedback onPress={exporting ? undefined : onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <View style={[styles.sheet, { backgroundColor: c.sheet, paddingBottom: 24 + insets.bottom }]}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: c.text }]}>Export History</Text>
            <Text style={[styles.subtitle, { color: c.muted }]} numberOfLines={1}>
              {[vehicle?.brand, vehicle?.model, vehicle?.year].filter(Boolean).join(' ')}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            disabled={exporting}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={[styles.closeButton, { backgroundColor: c.closeBg }]}
          >
            <CloseX size={12} color={c.closeIcon} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionLabel, { color: c.muted }]}>INCLUDE</Text>
        <View style={styles.chipRow}>
          {SECTION_OPTIONS.map(opt => {
            const active = sections.includes(opt.key);
            return (
              <TouchableOpacity
                key={opt.key}
                activeOpacity={0.8}
                onPress={() => toggleSection(opt.key)}
                disabled={exporting}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: active }}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? brand.primary : c.optionBg,
                    borderColor: active ? brand.primary : c.border,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: active ? '#FFFFFF' : c.text }]}>
                  {active ? '✓  ' : ''}{opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {!!error && <Text style={[styles.error, { color: c.danger }]}>{error}</Text>}
        {sections.length === 0 && (
          <Text style={[styles.error, { color: c.muted }]}>Select at least one section to export.</Text>
        )}

        <TouchableOpacity
          onPress={handleExport}
          disabled={!canExport}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Open PDF report"
          style={[styles.exportButton, { backgroundColor: brand.primary, opacity: canExport ? 1 : 0.5 }]}
        >
          {exporting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <ExportIcon size={18} color="#FFFFFF" />
              <Text style={styles.exportText}>Open PDF</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

export default ExportReportModal;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(4, 25, 51, 0.5)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 22,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  headerText: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontFamily: Typography.font.medium,
    fontSize: Typography.textsize.large,
  },
  subtitle: {
    fontFamily: Typography.font.regular,
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontFamily: Typography.font.medium,
    fontSize: 12,
    letterSpacing: 0.8,
    marginTop: 18,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
  },
  chipText: {
    fontFamily: Typography.font.medium,
    fontSize: 13,
  },
  error: {
    fontFamily: Typography.font.regular,
    fontSize: 12,
    marginTop: 12,
  },
  exportButton: {
    height: 50,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 20,
  },
  exportText: {
    color: '#FFFFFF',
    fontFamily: Typography.font.medium,
    fontSize: Typography.textsize.medium,
  },
});
