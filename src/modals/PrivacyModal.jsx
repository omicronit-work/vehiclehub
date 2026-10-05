import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import React from 'react';
import Modal from 'react-native-modal';
import { useSelector } from 'react-redux';

import { Typography } from '../styles/typography.js';
import { Colors } from '../styles/colors.js';
import { themecolors } from '../styles/themecolors.js';
import CloseX from '../assets/svg/CloseX.jsx'
import { accent } from '../theme/accent';
const APP_NAME = 'vehiclehub';
const PROVIDER = 'zecodeek IT Ltd';
const EFFECTIVE_DATE = '2026-06-29';
const CONTACT_EMAIL = 'contact@zecodeek-it.com';

const SECTIONS = [
  {
    title: 'Information Collection and Use',
    body:
      "The Application collects information when you download and use it. This may include your device's IP address; the pages you visit, with the time, date and duration of each visit; the total time spent in the Application; and the mobile operating system you use.",
  },
  {
    title: 'Cookies and Tracking Technologies',
    body:
      'The Application or its third-party SDKs may use cookies, SDKs, pixels and similar technologies to support functionality, analytics or service delivery. Where required by law, consent is obtained before using non-essential tracking technologies.',
  },
  {
    title: 'Your Rights',
    body:
      `You may request access to, correction of, or deletion of your personal data, or withdraw consent where processing is based on consent. To exercise these rights, contact the Service Provider at ${CONTACT_EMAIL}.`,
  },
  {
    title: 'California Privacy Rights (CCPA/CPRA)',
    body:
      'If you are a California resident, you have the right to know what personal information is collected, the right to delete it, the right to opt out of its sale or sharing, and the right to non-discrimination for exercising these rights.',
  },
  {
    title: 'Third Party Access',
    body:
      'Only aggregated, anonymized data is periodically transmitted to external services to help improve the Application. Information may be disclosed as required by law, to protect rights or safety, investigate fraud, respond to a government request, or to trusted service providers bound by this policy. The Application uses Google Play Services, which has its own privacy policy.',
  },
  {
    title: 'International Data Transfers',
    body:
      'Personal data may be transferred to countries outside your country of residence, including outside the EEA. Where required, safeguards such as Standard Contractual Clauses, adequacy decisions, or your consent are applied. Data protection laws elsewhere may differ from those in your jurisdiction.',
  },
  {
    title: 'Opt-Out Rights',
    body:
      'You can stop further collection of information by uninstalling the Application. Uninstalling does not automatically delete data already transmitted; request deletion by contacting the Service Provider.',
  },
  {
    title: 'Data Retention Policy',
    body:
      'User-provided data is retained for the duration of use plus 12 months; automatically collected data for up to 24 months; aggregated/anonymized data indefinitely; and data needed for legal compliance for as long as the law requires. You may request deletion, subject to any legal obligation to retain it.',
  },
  {
    title: 'Children',
    body:
      'The Application is not intended for children under 18 (or a higher age where required by law). The Service Provider does not knowingly collect data from children, and will delete any such data if discovered. Parents or guardians who believe their child has provided personal information should make contact so action can be taken.',
  },
  {
    title: 'Security',
    body:
      'The Service Provider uses physical, electronic and procedural safeguards to protect the information it processes and maintains.',
  },
  {
    title: 'Data Breach Notification',
    body:
      'If a breach affects your personal data, the Service Provider will notify you in accordance with applicable legal requirements, including the nature of the breach and the steps taken to address it.',
  },
  {
    title: 'Changes',
    body:
      'This policy may be updated from time to time. Material changes will be posted with a new effective date, and consent will be sought where required by law. Previous versions are kept and available on request.',
  },
  {
    title: 'Your Consent',
    body:
      'Where processing is based on consent, you provide it by affirmatively opting in to the relevant feature or action. You may withdraw consent at any time without affecting processing carried out before withdrawal.',
  },
];

const PrivacyModal = ({ privacyModal, setPrivacyModal }) => {
  const { theme } = useSelector((store) => store.theme);
  const isDark = theme === 'dark';

  const bg = isDark ? themecolors.darkBlue : themecolors.white;
  const titleColor = isDark ? themecolors.white : Colors.darkBlue;
  const bodyColor = isDark ? 'rgba(255,255,255,0.7)' : '#5A6B82';
  const handleColor = isDark ? 'rgba(255,255,255,0.25)' : '#D5DCE6';
  const borderCol = isDark ? 'rgba(255,255,255,0.1)' : '#EEF1F5';
  const accentColor = accent.primary;

  const close = () => setPrivacyModal(false);

  return (
    <Modal
      statusBarTranslucent
      backdropOpacity={0.55}
      isVisible={privacyModal}
      onBackdropPress={close}
      onSwipeComplete={close}
      swipeDirection="down"
      propagateSwipe
      useNativeDriverForBackdrop
   
      style={styles.modal}
    >
      <View style={[styles.sheet, { backgroundColor: bg }]}>
        

        {/* Header */}
        <View style={[styles.header, { borderColor: borderCol }]}>
          <Text style={[styles.headerTitle, { color: titleColor }]}>
            Privacy Policy
          </Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close"
            onPress={close}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={[
              styles.closeButton,
              { backgroundColor: isDark ? accent.lightAlpha(0.14) : accent.alpha(0.08) },
            ]}
          >
            <CloseX size={12} color={isDark ? accent.light : accent.primary} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Text style={[styles.intro, { color: bodyColor }]}>
            This privacy policy applies to the {APP_NAME} app for mobile devices,
            together with any related services operated by {PROVIDER} (the
            "Service Provider").
          </Text>

          {SECTIONS.map((s) => (
            <View key={s.title} style={styles.section}>
              <Text style={[styles.sectionTitle, { color: accentColor }]}>
                {s.title}
              </Text>
              <Text style={[styles.sectionBody, { color: bodyColor }]}>
                {s.body}
              </Text>
            </View>
          ))}

          {/* Contact */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: accentColor }]}>
              Contact Us
            </Text>
            <Text style={[styles.sectionBody, { color: bodyColor }]}>
              If you have any questions about this policy or our practices, email
              the Service Provider at {CONTACT_EMAIL}.
            </Text>
          </View>

          
        </ScrollView>
      </View>
    </Modal>
  );
};

export default PrivacyModal;

const styles = StyleSheet.create({
  modal: {
    margin: 0,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 24,
    maxHeight: '85%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  header: {
   paddingTop:15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 0.9,
  },
  headerTitle: {
    fontFamily: Typography.font.regular,
    fontSize: 18,
    fontWeight: '700',
  },
  close: {
    fontFamily: Typography.font.regular,
    fontSize: Typography.textsize.small,
    fontWeight: '600',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    marginTop: 16,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  intro: {
    fontFamily: Typography.font.regular,
    fontSize: Typography.textsize.small,
    lineHeight: 20,
    marginBottom: 20,
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontFamily: Typography.font.regular,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  sectionBody: {
    fontFamily: Typography.font.regular,
    fontSize: Typography.textsize.small,
    lineHeight: 20,
  },
  footer: {
    fontFamily: Typography.font.regular,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
});