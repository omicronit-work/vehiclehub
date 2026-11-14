import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import Text from '../components/ui/AppText';
import React from 'react';
import Modal from 'react-native-modal';
import { useSelector } from 'react-redux';

import { Typography } from '../styles/typography.js';
import { Colors } from '../styles/colors.js';
import { themecolors } from '../styles/themecolors.js';
import CloseX from '../assets/svg/CloseX.jsx'
import { accent } from '../theme/accent';
import { useHideAdsWhile } from '../util/ads';
import { t as tr } from '../i18n';
const APP_NAME = 'vehiclehub';
const PROVIDER = 'zecodeek IT Ltd';
const EFFECTIVE_DATE = '2026-11-09';
const CONTACT_EMAIL = 'contact@zecodeek-it.com';

const SECTIONS = [
  {
    title: 'Information You Provide',
    body:
      'Account: your email address, name and profile photo (from Google when you sign in with Google). Content you add: vehicles, service and fuel logs, documents, reminders, notes and the photos you attach to them. Photos you pick are uploaded to the Service Provider\'s media server; everything else is stored in Google Firebase so it syncs to your account across devices. When you type a brand, model or service option that is not in the built-in list, the value is logged with your device platform only (not your email or any other account detail) so the list can be improved.',
  },
  {
    title: 'Information Collected Automatically',
    body:
      "The Application uses Google Firebase Analytics to understand how features are used: it records app interactions (screens opened and actions such as adding a vehicle or a fuel log), an app-instance ID, your Firebase account ID, and device, OS and approximate location information derived from your IP address. It never receives your email, names, notes or amounts. The Application does not use your device's location (GPS); the country used for currency and fuel names comes from your phone's time zone. Third-party SDKs also collect some data automatically: Google AdMob (ads) collects your device's advertising ID, IP address, approximate location derived from it, device and OS information, and ad interactions; Google Firebase and Google Sign-In collect your IP address and device information to authenticate you and to operate and secure the service.",
  },
  {
    title: 'Advertising and Consent',
    body:
      'The Application shows ads served by Google AdMob. Where required by law (for example in the EEA and UK), a consent form is shown before any ad is requested and ads are not loaded without your choice. You can reset or delete your advertising ID, or opt out of personalized ads, at any time in your device\'s Settings > Privacy > Ads.',
  },
  {
    title: 'Your Rights',
    body:
      `You may request access to, correction of, or deletion of your personal data, or withdraw consent where processing is based on consent. You can delete your account and all of its data at any time from Settings > Delete Account. To exercise your other rights, contact the Service Provider at ${CONTACT_EMAIL}.`,
  },
  {
    title: 'California Privacy Rights (CCPA/CPRA)',
    body:
      'If you are a California resident, you have the right to know what personal information is collected, the right to delete it, the right to opt out of its sale or sharing, and the right to non-discrimination for exercising these rights.',
  },
  {
    title: 'Third Party Access',
    body:
      'The Application uses these third-party services, each with its own privacy policy: Google AdMob (advertising; receives the device and advertising data described above, which Google may use for ads and measurement), Google Firebase Authentication and Cloud Firestore (account and data storage), Google Sign-In, and Google Play Services (including in-app updates). Your data is not sold. Information may also be disclosed as required by law, to protect rights or safety, investigate fraud, or respond to a government request.',
  },
  {
    title: 'International Data Transfers',
    body:
      'Personal data may be transferred to countries outside your country of residence, including outside the EEA. Where required, safeguards such as Standard Contractual Clauses, adequacy decisions, or your consent are applied. Data protection laws elsewhere may differ from those in your jurisdiction.',
  },
  {
    title: 'Opt-Out Rights',
    body:
      'You can stop further collection of information by uninstalling the Application. Uninstalling does not automatically delete data already transmitted. To delete it, use Settings > Delete Account (also on the Profile screen) before uninstalling, or email the Service Provider from the address you signed up with.',
  },
  {
    title: 'Data Retention Policy',
    body:
      'User-provided data is retained for the duration of use plus 12 months; automatically collected data for up to 24 months; aggregated/anonymized data indefinitely; and data needed for legal compliance for as long as the law requires. You may request deletion, subject to any legal obligation to retain it.',
  },
  {
    title: 'Children',
    body:
      'The Application is a general-audience app and is not directed at children under 13 (or the minimum age of digital consent in your country, such as 16 in parts of the EEA). The Service Provider does not knowingly collect data from children under that age, and will delete any such data if discovered. Parents or guardians who believe their child has provided personal information should make contact so action can be taken.',
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
  useHideAdsWhile(privacyModal);
  const { theme } = useSelector((store) => store.theme);
  const isDark = theme === 'dark';

  const bg = isDark ? themecolors.darkBlue : themecolors.white;
  const titleColor = isDark ? themecolors.white : Colors.darkBlue;
  const bodyColor = isDark ? 'rgba(255,255,255,0.7)' : '#5A6B82';
  const borderCol = isDark ? 'rgba(255,255,255,0.1)' : '#EEF1F5';
  const accentColor = accent.primary;

  const close = () => setPrivacyModal(false);

  return (
    <Modal
      statusBarTranslucent
      backdropOpacity={0.55}
      isVisible={privacyModal}
      onBackdropPress={close}
      onBackButtonPress={close}
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
            {tr('Privacy Policy')}
          </Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={tr('Close')}
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
            "Service Provider"). Effective {EFFECTIVE_DATE}.
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