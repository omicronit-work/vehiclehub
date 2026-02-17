// Core React Native components used to build the UI
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import React, { useState } from 'react';

// App-wide color, typography, and reusable styles
import { Colors } from '../styles/colors';
import { GlobalStyles } from '../styles/globalStyles';
import { Typography } from '../styles/typography';
import SignInForm from '../components/SignInForm';
import ResetPassWord from '../components/ResetPassword'
// SVG assets
import VehicleHubColored from '../assets/svg/VehicleHubColored';
import GoogleIcon from '../assets/svg/GoogleIcon';
import CheckBox from '../assets/svg/CheckBox';
import { TouchableWithoutFeedback } from 'react-native/types_generated/index';

/**
 * SignUp / SignIn Screen Component
 * Handles UI for user authentication
 */
const SignIn = () => {
  const [showResetPass, setshowResetPass] = useState(false);

  return (
    // Adjusts UI when keyboard opens (important for forms)
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'android' ? null : 'height'}
    >
      {/* ScrollView allows content to scroll on smaller screens */}
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Main screen container */}
        <View style={[styles.SingUpContainer, GlobalStyles.center]}>
          {/* Card-like container */}
          <View style={styles.childCOntainer}>
            {/* App Logo */}
            <View style={[GlobalStyles.center, { paddingTop: 30 }]}>
              <VehicleHubColored height={34} width={200} />
            </View>

            {showResetPass ? (
            <ResetPassWord/>
            ) : (
              <SignInForm setshowResetPass={setshowResetPass} />
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default SignIn;

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    paddingVertical: 35,
  },

  SingUpContainer: {
    backgroundColor: Colors.whiteGray,
    flex: 1,
  },

  childCOntainer: {
    width: '90%',
    maxWidth: 420,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    elevation: 8,
  },

  title: {
    fontSize: Typography.textsize.Extralarge,
    fontFamily: Typography.font.regular,
  },

  subtitle: {
    fontFamily: Typography.font.light,
    fontSize: Typography.textsize.small,
    color: Colors.darkBlue,
  },

  googleBtn: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: Colors.primary,
    flexDirection: 'row',
    gap: 10,
  },

  googleBtnText: {
    fontFamily: Typography.font.regular,
    fontSize: Typography.textsize.medium,
    color: Colors.primary,
  },

  deviderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },

  line: {
    flex: 1,
    height: 1,
    backgroundColor: '#04193333',
  },

  deviderText: {
    marginHorizontal: 10,
    fontFamily: Typography.font.regular,
    fontSize: Typography.textsize.Extrasmall,
    color: '#04193380',
  },

  label: {
    fontFamily: Typography.font.regular,
    fontSize: Typography.textsize.small,
    color: Colors.darkBlue,
  },

  input: {
    width: '100%',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 12,
    borderColor: '#EEF1F5',
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },

  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  forgotText: {
    textDecorationLine: 'underline',
    color: Colors.darkBlue,
    fontFamily: Typography.font.regular,
    fontSize: Typography.textsize.small,
  },

  submitText: {
    fontFamily: Typography.font.regular,
    color: Colors.white,
    fontSize: Typography.textsize.medium,
  },

  signUPcontainer: {
    flexDirection: 'row',
    gap: 6,
    paddingBottom: 10,
  },

  dontHaveAccTxt: {
    fontFamily: Typography.font.light,
    fontSize: Typography.textsize.small,
    color: Colors.darkBlue,
  },
});
