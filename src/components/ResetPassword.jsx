import { StyleSheet, Text, View, TouchableOpacity, TextInput } from 'react-native'
import React from 'react'
import { Colors } from '../styles/colors';
import { GlobalStyles } from '../styles/globalStyles';
import { Typography } from '../styles/typography';

const ResetPassword = () => {
  return (
    <View style={{ marginTop: 30, gap: 8 }}>
    <Text style={styles.title}>Forgot password</Text>
    <Text style={styles.subtitle}>
      Enter your email and we’ll send you a reset link.
    </Text>

    <View style={{ gap: 20, marginTop: 24 }}>
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

      <TouchableOpacity
        style={[
          GlobalStyles.button,
          GlobalStyles.center,
          { backgroundColor: Colors.primary },
        ]}
      >
        <Text style={styles.submitText}>Send reset link</Text>
      </TouchableOpacity>

      <View style={[styles.signUPcontainer, GlobalStyles.center]}>
        <Text style={styles.dontHaveAccTxt}>
          Remembered your password?
        </Text>
        <TouchableOpacity>
          <Text style={styles.forgotText}>Sign up</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
  )
}

export default ResetPassword

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