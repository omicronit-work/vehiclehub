import { StyleSheet, Text, View, Animated } from 'react-native';
import React, { useState, useEffect, useRef } from 'react';
import GoogleIcon from '../assets/svg/GoogleIcon';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../styles/colors';
import { Typography } from '../styles/typography';
import {
  getAuth,
  signInWithEmailAndPassword,
} from '@react-native-firebase/auth';
import { Toast } from 'toastify-react-native';

import { useDispatch } from 'react-redux';
import { setUserInfo } from '../store/userSlice';
import { signInWithGoogle } from '../util/googleAuth';
import { mapAuthError, normalizeEmail, isValidEmail } from '../util/authErrors';
import { useAppTheme } from '../theme/useAppTheme';
import { useReduceMotion } from '../util/methods/useReduceMotion';
import PrimaryButton from './ui/PrimaryButton';
import {
  AuthField,
  PasswordField,
  CheckboxRow,
  TextLink,
  OrDivider,
  FormError,
} from './auth/AuthParts';

const SignInForm = ({
  setIsLoggedIn,
  setshowResetPass,
  setshowSignUpForm,
  initialEmail = '',
}) => {
  const c = useAppTheme();
  const reduceMotion = useReduceMotion();
  const [tickbox, setTickBox] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const busy = loading || googleLoading;

  // Form states
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const dispatch = useDispatch();
  const passwordRef = useRef(null);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Run animation on mount
  useEffect(() => {
    if (reduceMotion) {
      fadeAnim.setValue(1);
      slideAnim.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim, reduceMotion]);

  // Validation
  const validateForm = () => {
    const tempErrors = {};
    if (!normalizeEmail(email)) {
      tempErrors.email = 'Email is required';
    } else if (!isValidEmail(email)) {
      tempErrors.email = 'Enter a valid email';
    }

    if (!password.trim()) {
      tempErrors.password = 'Password is required';
    } else if (password.length < 6) {
      tempErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleLogin = async () => {
    if (busy || !validateForm()) return;

    try {
      setLoading(true);
      setErrors({});
      await signInWithEmailAndPassword(getAuth(), normalizeEmail(email), password);
      await AsyncStorage.setItem('keepSignedIn', JSON.stringify(tickbox));

      setLoading(false);
      setIsLoggedIn(true);
    } catch (error) {
      console.log('Error Code::', error.code);
      setErrors(mapAuthError(error.code, 'signIn'));
      setLoading(false);
    }
  };

  async function onGoogleButtonPress() {
    if (busy) return;
    setGoogleLoading(true);
    try {
      const user = await signInWithGoogle();
      dispatch(setUserInfo(user));
      setIsLoggedIn(true);
    } catch (error) {
      if (error.code === 'cancelled') return;
      console.log('Google Sign-In Error:', error);
      Toast.show({
        type: 'error',
        text1: 'Google Sign-In Failed',
        text2: mapAuthError(error.code).form || error.message,
        position: 'top',
        visibilityTime: 4000,
        autoHide: true,
        icon: () => null,
      });
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      }}
    >
      {/* Title & subtitle */}
      <View style={{ marginTop: 30, gap: 8 }}>
        <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">
          Sign in
        </Text>
        <Text style={[styles.subtitle, { color: c.textMuted }]}>
          Sign in to track maintenance logs and manage your vehicle
        </Text>
      </View>

      {/* Google sign-in */}
      <PrimaryButton
        variant="outline"
        color={c.isDark ? c.link : Colors.primary}
        title="Sign in with Google"
        loadingTitle="Opening Google…"
        loading={googleLoading}
        disabled={loading}
        onPress={onGoogleButtonPress}
        icon={<GoogleIcon width={16} height={16} />}
        style={{ marginTop: 24 }}
      />

      <OrDivider c={c} />

      {/* Form */}
      <View style={{ gap: 20 }}>
        <AuthField
          c={c}
          label="Email"
          error={errors.email}
          value={email}
          onChangeText={text => {
            setEmail(text);
            setErrors(prev => ({ ...prev, email: '', form: '' }));
          }}
          placeholder="Enter your email"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          blurOnSubmit={false}
          editable={!busy}
        />

        <PasswordField
          c={c}
          ref={passwordRef}
          error={errors.password}
          value={password}
          onChangeText={text => {
            setPassword(text);
            setErrors(prev => ({ ...prev, password: '', form: '' }));
          }}
          placeholder="Enter your password"
          autoComplete="password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={handleLogin}
          editable={!busy}
        />

        {/* Remember + Forgot */}
        <View style={styles.row}>
          <CheckboxRow
            c={c}
            checked={tickbox}
            onToggle={() => setTickBox(v => !v)}
            label="Keep me signed in"
          />
          <TextLink c={c} title="Forgot password?" onPress={() => setshowResetPass(true)} />
        </View>

        <FormError c={c} message={errors.form} />

        {/* Sign in */}
        <PrimaryButton
          title="Sign in"
          loadingTitle="Signing in…"
          loading={loading}
          disabled={googleLoading}
          onPress={handleLogin}
          color={Colors.primary}
        />

        {/* Sign up */}
        <View style={styles.signUPcontainer}>
          <Text style={[styles.dontHaveAccTxt, { color: c.text }]}>
            Don't have an account?
          </Text>
          <TextLink c={c} title="Sign up" onPress={() => setshowSignUpForm(true)} />
        </View>
      </View>
    </Animated.View>
  );
};

export default SignInForm;

const styles = StyleSheet.create({
  title: {
    fontSize: Typography.textsize.Extralarge,
    fontFamily: Typography.font.regular,
  },
  subtitle: {
    fontFamily: Typography.font.light,
    fontSize: Typography.textsize.small,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  signUPcontainer: {
    flexDirection: 'row',
    gap: 6,
    paddingBottom: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dontHaveAccTxt: {
    fontFamily: Typography.font.light,
    fontSize: Typography.textsize.small,
  },
});
