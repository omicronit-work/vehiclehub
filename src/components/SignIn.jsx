import {
  StyleSheet,
  View,
  ScrollView,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
  BackHandler,
  Keyboard,
} from 'react-native';
import React, { useState, useEffect } from 'react';
import { Colors } from '../styles/colors';
import { GlobalStyles } from '../styles/globalStyles';
import SignInForm from '../components/SignInForm';
import ResetPassWord from '../components/ResetPassword';
import SignUpForm from '../components/SignUpForm';
import VehicleHubColored from '../assets/svg/VehicleHubColored';
import { themecolors } from '../styles/themecolors.js';
import { useAppTheme } from '../theme/useAppTheme';
import AdBanner from './AdBanner';

// One keyboard mechanism for all three auth forms: this KeyboardAvoidingView
// + ScrollView. The forms themselves are plain views.
const SignIn = ({ setIsLoggedIn }) => {
  const c = useAppTheme();
  const [showResetPass, setshowResetPass] = useState(false);
  const [showSignUpForm, setshowSignUpForm] = useState(false);

  const currentForm = showSignUpForm ? 'signUp' : showResetPass ? 'reset' : 'signIn';

  const handleShowResetPass = () => setshowResetPass(true);
  const handleBackToSignIn = () => {
    setshowResetPass(false);
    setshowSignUpForm(false);
  };
  const handleShowSignUp = () => setshowSignUpForm(true);

  // The banner is pinned to the bottom; hide it while typing so the keyboard
  // doesn't push it up against the form buttons (accidental clicks).
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Sign up / Reset are sub-screens: Android back returns to Sign in rather
  // than exiting the app.
  useEffect(() => {
    if (currentForm === 'signIn') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBackToSignIn();
      return true;
    });
    return () => sub.remove();
  }, [currentForm]);

  const screenBg = c.isDark ? themecolors.darkBlue : Colors.whiteGray;

  return (
    <>
      <StatusBar backgroundColor={screenBg} barStyle={c.statusBar} />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: screenBg }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.container, GlobalStyles.center]}>
            <View style={styles.cardWrapper}>
              <View
                style={[
                  styles.card,
                  c.isDark ? styles.cardDark : styles.cardLight,
                ]}
              >
                <View style={[GlobalStyles.center, styles.logoContainer]}>
                  <VehicleHubColored height={34} width={200} />
                </View>

                <View>
                  {currentForm === 'signUp' && (
                    <SignUpForm setIsLoggedIn={setIsLoggedIn} setshowSignUpForm={setshowSignUpForm} />
                  )}
                  {currentForm === 'reset' && (
                    <ResetPassWord
                      setshowResetPass={handleBackToSignIn}
                      onBackPress={handleBackToSignIn}
                    />
                  )}
                  {currentForm === 'signIn' && (
                    <SignInForm
                      setIsLoggedIn={setIsLoggedIn}
                      setshowSignUpForm={handleShowSignUp}
                      setshowResetPass={handleShowResetPass}
                      onForgotPress={handleShowResetPass}
                    />
                  )}
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
        <AdBanner backgroundColor={screenBg} hidden={keyboardOpen} />
      </KeyboardAvoidingView>
    </>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 20,
  },
  container: {
    width: '100%',
    paddingHorizontal: 20,
  },
  cardWrapper: {
    width: '100%',
    maxWidth: 420,
  },
  card: {
    borderRadius: 24,
    padding: 16,
  },
  // Even on all sides. In dark mode the card is a step lighter than the
  // screen and the shadow is black — navy on navy would be invisible.
  cardLight: {
    backgroundColor: '#fff',
    boxShadow: '0px 0px 20px 2px rgba(10, 37, 64, 0.15)',
  },
  cardDark: {
    backgroundColor: '#0A1E38',
    boxShadow: '0px 0px 28px 4px rgba(0, 0, 0, 0.55)',
  },
  logoContainer: {
    paddingTop: 20,
    paddingBottom: 10,
  },
});

export default SignIn;
