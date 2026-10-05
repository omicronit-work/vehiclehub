import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import Modal from 'react-native-modal';
import { useSelector } from 'react-redux';

import { Typography } from '../styles/typography.js';
import { themecolors } from '../styles/themecolors.js';
import TrashIcon from '../assets/svg/TrashIcon.jsx';

const ConfirmDeleteModal = ({
  visible,
  title = 'Delete item',
  itemName,
  description,
  confirmLabel = 'Delete',
  loading = false,
  onCancel,
  onConfirm,
  children, // optional extra content (e.g. a password field) above the buttons
}) => {
  const { theme } = useSelector((store) => store.theme);
  const isDark = theme === 'dark';

  const cardBg = isDark ? themecolors.darkBlue : themecolors.white;
  const titleColor = isDark ? themecolors.white : '#0F1F3D';
  const bodyColor = isDark ? 'rgba(255,255,255,0.65)' : '#5A6B82';
  const itemColor = isDark ? themecolors.white : '#0F1F3D';
  const cancelBg = isDark ? 'rgba(255,255,255,0.08)' : '#EEF1F5';
  const cancelText = isDark ? themecolors.white : '#0F1F3D';
  const iconWell = isDark ? 'rgba(255,156,144,0.16)' : '#FDECEA';
  const danger = '#DC3545';

  return (
    <Modal
      statusBarTranslucent
      isVisible={visible}
      onBackdropPress={loading ? undefined : onCancel}
      onBackButtonPress={loading ? undefined : onCancel}
      avoidKeyboard
      backdropOpacity={0.55}
      
      useNativeDriverForBackdrop
      animationIn="zoomIn"
      animationOut="zoomOut"
      animationInTiming={220}
      animationOutTiming={180}
      style={styles.modal}
    >
      <View style={[styles.card, { backgroundColor: cardBg }]}>
        <View style={[styles.iconWell, { backgroundColor: iconWell }]}>
          <TrashIcon width={26} height={26} color={danger} />
        </View>

        <Text style={[styles.title, { color: titleColor }]}>{title}</Text>

        <Text style={[styles.message, { color: bodyColor }]}>
          {description ? (
            description
          ) : (
            <>
              Are you sure you want to delete{' '}
              <Text style={[styles.itemName, { color: itemColor }]}>
                "{itemName || 'this item'}"
              </Text>
              ? This can't be undone.
            </>
          )}
        </Text>

        {children ? <View style={styles.extra}>{children}</View> : null}

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: cancelBg }]}
            activeOpacity={0.8}
            onPress={onCancel}
            disabled={loading}
            accessibilityRole="button"
            accessibilityState={{ disabled: loading }}
          >
            <Text style={[styles.buttonText, { color: cancelText }]}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.deleteButton, { backgroundColor: danger }]}
            activeOpacity={0.85}
            onPress={onConfirm}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={confirmLabel}
            accessibilityState={{ disabled: loading, busy: loading }}
          >
            {loading ? (
              <ActivityIndicator size="small" color={themecolors.white} />
            ) : (
              <Text style={[styles.buttonText, { color: themecolors.white }]}>
                {confirmLabel}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default ConfirmDeleteModal;

const styles = StyleSheet.create({
  modal: {
    justifyContent: 'center',
    alignItems: 'center',
    margin: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
    alignItems: 'center',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
  },
  iconWell: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: Typography.font.medium,
    fontSize: Typography.textsize.large,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontFamily: Typography.font.regular,
    fontSize: Typography.textsize.small,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  itemName: {
    fontFamily: Typography.font.medium,
    fontWeight: '700',
  },
  extra: {
    width: '100%',
    marginTop: -8,
    marginBottom: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  button: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    shadowColor: '#DC3545',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonText: {
    fontFamily: Typography.font.medium,
    fontSize: Typography.textsize.small,
    fontWeight: '700',
  },
});
