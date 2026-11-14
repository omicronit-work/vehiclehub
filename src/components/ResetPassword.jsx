import { StyleSheet, View, Animated, Easing, Alert } from 'react-native';
import Text from './ui/AppText';
import React, { useEffect, useRef, useState } from 'react';
import { Typography } from '../styles/typography';
import { Colors } from '../styles/colors';
import {
  getAuth,
  sendPasswordResetEmail,
} from '@react-native-firebase/auth';
import { useAppTheme } from '../theme/useAppTheme';
import { useReduceMotion } from '../util/methods/useReduceMotion';
import { normalizeEmail, isValidEmail } from '../util/authErrors';
import PrimaryButton from './ui/PrimaryButton';
import { AuthField, TextLink, FormError } from './auth/AuthParts';
import { EVENTS, track } from '../util/analytics';
import { t as tr } from '../i18n';

const ResetPassword = ({ setshowResetPass }) => {
  const c = useAppTheme();
  const reduceMotion = useReduceMotion();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const opacityAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    if (reduceMotion) {
      opacityAnim.setValue(1);
      slideAnim.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacityAnim, slideAnim, reduceMotion]);

  const animatedStyle = {
    opacity: opacityAnim,
    transform: [{ translateY: slideAnim }],
  };

  const handleSendResetLink = async () => {
    if (loading) return;
    const trimmed = normalizeEmail(email);
    if (!trimmed) {
      setErrors({ email: tr('Please enter your email address') });
      return;
    }
    if (!isValidEmail(trimmed)) {
      setErrors({ email: tr('Please enter a valid email address') });
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      await sendPasswordResetEmail(getAuth(), trimmed);
      track(EVENTS.PASSWORD_RESET_REQUESTED);
      Alert.alert(
        tr('Check your email'),
        tr('A password reset link has been sent to your email address.'),
        [{ text: 'OK', onPress: () => setshowResetPass(false) }]
      );
    } catch (error) {
      console.log(error);
      if (error.code === 'auth/user-not-found') {
        setErrors({ email: tr('This email is not registered.') });
      } else if (error.code === 'auth/invalid-email') {
        setErrors({ email: tr('The email address is not valid.') });
      } else if (error.code === 'auth/too-many-requests') {
        setErrors({ form: tr('Too many attempts. Please try again later.') });
      } else if (error.code === 'auth/network-request-failed') {
        setErrors({ form: tr('No connection. Check your internet and try again.') });
      } else {
        setErrors({ form: tr('Something went wrong. Please try again.') });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.wrapper}>
        <Animated.View style={[styles.header, animatedStyle]}>
          <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">
            {tr('Forgot password')}
          </Text>
          <Text style={[styles.subtitle, { color: c.textMuted }]}>
            {tr('Enter your email and we\'ll send you a reset link.')}
          </Text>
        </Animated.View>

        <Animated.View style={animatedStyle}>
          <AuthField
            c={c}
            label={tr('Email')}
            error={errors.email}
            placeholder={tr('Enter your email')}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={handleSendResetLink}
            value={email}
            onChangeText={text => {
              setEmail(text);
              setErrors({});
            }}
            editable={!loading}
          />
        </Animated.View>

        <Animated.View style={[styles.bottom, animatedStyle]}>
          <FormError c={c} message={errors.form} />
          <PrimaryButton
            title={tr('Send reset link')}
            loadingTitle={tr('Sending…')}
            loading={loading}
            onPress={handleSendResetLink}
            color={Colors.primary}
          />

          <View style={styles.signUPcontainer}>
            <Text style={[styles.dontHaveAccTxt, { color: c.text }]}>
              {tr('Remembered your password?')}
            </Text>
            <TextLink c={c} title={tr('Sign In')} onPress={() => setshowResetPass(false)} />
          </View>
        </Animated.View>
      </View>
    </View>
  );
};

export default ResetPassword;

const styles = StyleSheet.create({
  container: {
    paddingTop: 30,
    paddingBottom: 10,
  },

  wrapper: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    gap: 20,
  },

  header: {
    gap: 8,
  },

  bottom: {
    gap: 20,
  },

  title: {
    fontSize: Typography.textsize.Extralarge,
    fontFamily: Typography.font.regular,
  },

  subtitle: {
    fontSize: Typography.textsize.small,
    fontFamily: Typography.font.light,
  },

  label: {
    fontSize: Typography.textsize.small,
    fontFamily: Typography.font.regular,
  },

  input: {
    width: '100%',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 12,
  },

  submitText: {
    fontFamily: Typography.font.regular,
    color: Colors.white,
    fontSize: Typography.textsize.medium,
  },

  signUPcontainer: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },

  dontHaveAccTxt: {
    fontFamily: Typography.font.light,
    fontSize: Typography.textsize.small,
  },

  forgotText: {
    textDecorationLine: 'underline',
    fontFamily: Typography.font.regular,
    fontSize: Typography.textsize.small,
  },
});