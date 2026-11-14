import { StyleSheet, View, Animated } from 'react-native';
import Text from './ui/AppText';
import React, { useEffect, useRef, useState } from 'react';

import GoogleIcon from '../assets/svg/GoogleIcon';
import { Colors } from '../styles/colors';
import { Typography } from '../styles/typography';
import {
  getAuth,
  createUserWithEmailAndPassword,
  deleteUser,
  signOut,
} from '@react-native-firebase/auth';
import { useDispatch } from 'react-redux';
import { setUserInfo, saveUserToFirestore } from '../store/userSlice';
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

import { Toast } from 'toastify-react-native';
import { EVENTS, track } from '../util/analytics';
import { t as tr } from '../i18n';

// How long the new account's profile save may take before sign-up gives up
// (the write only settles once the server has it).
const PROFILE_SAVE_TIMEOUT_MS = 20000;

// Saves the new account's profile. If that fails, the just-created account is
// removed again so the same email can simply be tried again (otherwise it'd
// be stuck as "already in use" with no profile). Should even that fail, the
// session is at least ended, so nobody is left signed in behind this screen.
const saveProfileOrUndoSignUp = async (created, user) => {
  try {
    await Promise.race([
      saveUserToFirestore(user),
      new Promise((_, reject) =>
        setTimeout(() => reject(Object.assign(new Error('Profile save timed out'), { code: 'signup/profile-timeout' })), PROFILE_SAVE_TIMEOUT_MS),
      ),
    ]);
  } catch (error) {
    console.log('Sign-up profile save failed, removing the new account:', error);
    try {
      await deleteUser(created);
    } catch (deleteError) {
      console.log('Removing the half-created account failed:', deleteError);
      await signOut(getAuth()).catch(() => {});
    }
    throw error;
  }
};

const SignUpForm = ({ setIsLoggedIn, setshowSignUpForm }) => {
  const c = useAppTheme();
  const reduceMotion = useReduceMotion();
  const [tickbox, setTickBox] = useState(false);

  // Form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const busy = loading || googleLoading;

  const dispatch = useDispatch();
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  // Validation errors state
  const [errors, setErrors] = useState({});

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Animation on mount
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

  const validateForm = () => {
    const newErrors = {};

    if (!fullName.trim()) {
      newErrors.fullName = tr('Please enter your full name');
    }

    if (!normalizeEmail(email)) {
      newErrors.email = tr('Please enter your email');
    } else if (!isValidEmail(email)) {
      newErrors.email = tr('Please enter a valid email address');
    }

    if (!password.trim()) {
      newErrors.password = tr('Please enter your password');
    } else if (password.length < 6) {
      newErrors.password = tr('Password must be at least 6 characters');
    }

    if (!tickbox) {
      newErrors.tickbox = tr('Please agree to the Terms and Conditions');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const clearError = (field) => {
    setErrors((prev) => {
      const updated = { ...prev };
      delete updated[field];
      delete updated.form;
      return updated;
    });
  };

  const signTest = async () => {
    if (busy || !validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const { user: created } = await createUserWithEmailAndPassword(
        getAuth(),
        normalizeEmail(email),
        password,
      );
      const user = {
        // Firebase's normalized address: the Firestore doc id and the
        // security rules both key on exactly this value.
        email: created.email,
        name: fullName.trim(),
        photo: '',
        termCondition: true,
      };

      // Save to Firestore (needs the new account's auth, so before sign-out).
      // On failure the new account is removed again, so a retry works.
      await saveProfileOrUndoSignUp(created, user);
      track(EVENTS.SIGN_UP, { method: 'password' });

      // Firebase signs the new account in automatically; end that session and
      // send the user to Sign in to log in with their new credentials.
      await signOut(getAuth());
      setshowSignUpForm(false);
    } catch (error) {
      console.log('SignUp Error Code::', error.code);
      setErrors(mapAuthError(error.code, 'signUp'));
    } finally {
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
        text1: tr('Google Sign-In Failed'),
        text2: mapAuthError(error.code, 'signUp').form || error.message,
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
      {/* Title */}
      <View style={{ marginTop: 30, gap: 8 }}>
        <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">
          {tr('Create an account')}
        </Text>
        <Text style={[styles.subtitle, { color: c.textMuted }]}>
          {tr('Let\'s get started. Fill in the details below to create your account.')}
        </Text>
      </View>

      {/* Google */}
      <PrimaryButton
        variant="outline"
        color={c.isDark ? c.link : Colors.primary}
        title={tr('Sign up with Google')}
        loadingTitle={tr('Opening Google…')}
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
          label={tr('Full Name')}
          error={errors.fullName}
          placeholder={tr('Enter your name')}
          value={fullName}
          onChangeText={(text) => {
            setFullName(text);
            clearError('fullName');
          }}
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
          onSubmitEditing={() => emailRef.current?.focus()}
          blurOnSubmit={false}
          editable={!busy}
        />

        <AuthField
          c={c}
          ref={emailRef}
          label={tr('Email')}
          error={errors.email}
          placeholder={tr('Enter your email')}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            clearError('email');
          }}
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          blurOnSubmit={false}
          editable={!busy}
        />

        <PasswordField
          c={c}
          ref={passwordRef}
          error={errors.password}
          placeholder={tr('Enter your password')}
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            clearError('password');
          }}
          autoComplete="password-new"
          textContentType="newPassword"
          returnKeyType="done"
          editable={!busy}
        />

        {/* Terms */}
        <View style={{ gap: 4 }}>
          <CheckboxRow
            c={c}
            checked={tickbox}
            onToggle={() => {
              setTickBox(v => !v);
              clearError('tickbox');
            }}
            label={tr('I agree to the Terms and Conditions')}
            error={!!errors.tickbox}
          />
          {errors.tickbox && (
            <Text style={[styles.errorText, { color: c.danger }]}>{errors.tickbox}</Text>
          )}
        </View>

        <FormError c={c} message={errors.form} />

        {/* Submit */}
        <PrimaryButton
          title={tr('Continue')}
          loadingTitle={tr('Creating account…')}
          loading={loading}
          disabled={googleLoading}
          onPress={signTest}
          color={Colors.primary}
        />

        {/* Sign in */}
        <View style={styles.signUPcontainer}>
          <Text style={[styles.dontHaveAccTxt, { color: c.text }]}>
            {tr('Already have an account?')}
          </Text>
          <TextLink c={c} title={tr('Sign In')} onPress={() => setshowSignUpForm(false)} />
        </View>
      </View>
    </Animated.View>
  );
};

export default SignUpForm;

const styles = StyleSheet.create({
  title: {
    fontSize: Typography.textsize.Extralarge,
    fontFamily: Typography.font.regular,
  },

  subtitle: {
    fontFamily: Typography.font.light,
    fontSize: Typography.textsize.small,
  },

  errorText: {
    fontFamily: Typography.font.regular,
    fontSize: Typography.textsize.Extrasmall,
    marginLeft: 4,
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
