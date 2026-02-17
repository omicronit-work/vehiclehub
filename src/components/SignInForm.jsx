import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import React from 'react';
import GoogleIcon from '../assets/svg/GoogleIcon';
import CheckBox from '../assets/svg/CheckBox';
import { TouchableWithoutFeedback } from 'react-native/types_generated/index';
import { Colors } from '../styles/colors';
import { GlobalStyles } from '../styles/globalStyles';
import { Typography } from '../styles/typography';

const SignInForm = ({setshowResetPass}) => {
  return (
    <>
      {/* Title & subtitle */}
      <View style={{ marginTop: 30, gap: 8 }}>
        <Text style={styles.title}>Sign in</Text>
        <Text style={styles.subtitle}>
          Sign in to track maintenance logs and manage your vehicle
        </Text>
      </View>

      {/* Google sign-in button */}
      <TouchableOpacity
        style={[GlobalStyles.button, styles.googleBtn, GlobalStyles.center]}
      >
        <GoogleIcon width={16} height={16} />
        <Text style={styles.googleBtnText}>Sign in with Google</Text>
      </TouchableOpacity>

      {/* Divider between Google and Email login */}
      <View style={styles.deviderContainer}>
        <View style={styles.line} />
        <Text style={styles.deviderText}>OR</Text>
        <View style={styles.line} />
      </View>

      {/* Email & Password form */}
      <View style={{ gap: 20 }}>
        {/* Email Input */}
        <View style={{ gap: 8 }}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        {/* Password Input */}
        <View style={{ gap: 8 }}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your password"
            secureTextEntry
          />
        </View>

        {/* Remember me & Forgot password row */}
        <View style={styles.row}>
          <View style={styles.checkboxRow}>
            <CheckBox height={20} width={18} />
            <Text style={styles.dontHaveAccTxt}>Keep me signed in</Text>
          </View>

          <TouchableOpacity onPress={()=>{
            setshowResetPass(true)
          }}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>
        </View>

        {/* Submit / Sign In button */}
        <TouchableOpacity
          style={[
            GlobalStyles.button,
            GlobalStyles.center,
            { backgroundColor: Colors.primary },
          ]}
        >
          <Text style={styles.submitText}>Sign in</Text>
        </TouchableOpacity>

        {/* Navigation to Sign Up screen */}
        <View style={[styles.signUPcontainer, GlobalStyles.center]}>
          <Text style={styles.dontHaveAccTxt}>Don't have an account?</Text>
          <TouchableOpacity>
            <Text style={styles.forgotText}>Sign up</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
};

export default SignInForm;

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
