import React from 'react';
import { StyleSheet, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import Text from '../components/ui/AppText';
import Modal from 'react-native-modal';
import { useSelector } from 'react-redux';

import { Typography } from '../styles/typography.js';
import { themecolors } from '../styles/themecolors.js';
import TrashIcon from '../assets/svg/TrashIcon.jsx';
import { useHideAdsWhile } from '../util/ads';
import { accent } from '../theme/accent';
import { t as tr } from '../i18n';

const ConfirmDeleteModal = ({
  visible,
  title = tr('Delete item'),
  itemName,
  description,
  confirmLabel = tr('Delete'),
  cancelLabel = tr('Cancel'),
  Icon = TrashIcon,
  loading = false,
  onCancel,
  onConfirm,
  children, // optional extra content (e.g. a password field) above the buttons
  tone = 'danger', // 'primary' for confirmations that aren't destructive
}) => {
  useHideAdsWhile(visible);
  const { theme } = useSelector((store) => store.theme);
  const isDark = theme === 'dark';

  const cardBg = isDark ? themecolors.darkBlue : themecolors.white;
  const titleColor = isDark ? themecolors.white : '#0F1F3D';
  const bodyColor = isDark ? 'rgba(255,255,255,0.65)' : '#5A6B82';
  const itemColor = isDark ? themecolors.white : '#0F1F3D';
  const cancelBg = isDark ? 'rgba(255,255,255,0.08)' : '#EEF1F5';
  const cancelText = isDark ? themecolors.white : '#0F1F3D';
  const isPrimary = tone === 'primary';
  const iconWell = isPrimary
    ? (isDark ? accent.lightAlpha(0.16) : accent.alpha(0.1))
    : (isDark ? 'rgba(255,156,144,0.16)' : '#FDECEA');
  const danger = isPrimary ? (isDark ? accent.light : accent.primary) : '#DC3545';
  const confirmBg = isPrimary ? accent.primary : danger;

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
          <Icon width={26} height={26} color={danger} />
        </View>

        <Text style={[styles.title, { color: titleColor }]}>{title}</Text>

        <Text style={[styles.message, { color: bodyColor }]}>
          {description ? (
            description
          ) : (
            // One sentence so word order follows the language; the name keeps its own style.
            tr('Are you sure you want to delete {0}? This can\'t be undone.').split('{0}').map((part, i) => (
              <React.Fragment key={i}>
                {i > 0 && (
                  <Text style={[styles.itemName, { color: itemColor }]}>
                    "{itemName || tr('this item')}"
                  </Text>
                )}
                {part}
              </React.Fragment>
            ))
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
            <Text style={[styles.buttonText, { color: cancelText }]}>{cancelLabel}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.deleteButton, { backgroundColor: confirmBg }]}
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
    boxShadow: '0px 8px 20px rgba(0, 0, 0, 0.25)',
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
    // Stretch, not width: '100%': inside the centred card the percentage left
    // a TextInput sized to its placeholder.
    alignSelf: 'stretch',
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
    boxShadow: '0px 4px 8px rgba(220, 53, 69, 0.3)',
  },
  buttonText: {
    fontFamily: Typography.font.medium,
    fontSize: Typography.textsize.small,
    fontWeight: '700',
  },
});
