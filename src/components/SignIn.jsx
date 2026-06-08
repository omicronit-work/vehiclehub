import {
  StyleSheet,
  View,
  ScrollView,
  Platform,
  StatusBar,
  Dimensions,
  Keyboard,
} from 'react-native';
import React, { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../styles/colors';
import { GlobalStyles } from '../styles/globalStyles';
import SignInForm from '../components/SignInForm';
import ResetPassWord from '../components/ResetPassword';
import SignUpForm from '../components/SignUpForm';
import VehicleHubColored from '../assets/svg/VehicleHubColored';
import { themecolors } from '../styles/themecolors.js';

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');

// Estimate form heights (adjust based on your actual content)
const FORM_HEIGHTS = {
  signIn: 580,
  signUp: 650,
  reset: 480,
};

const SignIn = ({ setIsLoggedIn }) => {
  const [showResetPass, setshowResetPass] = useState(false);
  const [showSignUpForm, setshowSignUpForm] = useState(false);
  const [theme, setTheme] = useState(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [scrollEnabled, setScrollEnabled] = useState(false);

  const currentForm = showSignUpForm ? 'signUp' : showResetPass ? 'reset' : 'signIn';

  // Check if scrolling is needed
  const checkIfScrollNeeded = useCallback((contentH, keyboardH) => {
    const availableHeight = screenHeight - keyboardH - 40; // 40 for padding
    const needsScroll = contentH > availableHeight;
    setScrollEnabled(needsScroll);
  }, []);

  // Fetch theme
  useEffect(() => {
    const fetchTheme = async () => {
      const theme = await AsyncStorage.getItem('theme');
      setTheme(theme);
    };
    fetchTheme();
  }, []);

  // Keyboard listeners
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    
    const keyboardWillShow = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      // Recalculate when keyboard opens
      if (contentHeight > 0) {
        checkIfScrollNeeded(contentHeight, e.endCoordinates.height);
      }
    });
    
    const keyboardWillHide = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
      // Recalculate when keyboard closes
      if (contentHeight > 0) {
        checkIfScrollNeeded(contentHeight, 0);
      }
    });

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, [contentHeight, checkIfScrollNeeded]);

  // Measure content height when form changes
  const onContentLayout = useCallback((event) => {
    const { height } = event.nativeEvent.layout;
    setContentHeight(height);
    checkIfScrollNeeded(height, keyboardHeight);
  }, [keyboardHeight, checkIfScrollNeeded]);

  const handleShowResetPass = () => setshowResetPass(true);
  const handleBackToSignIn = () => {
    setshowResetPass(false);
    setshowSignUpForm(false);
  };
  const handleShowSignUp = () => setshowSignUpForm(true);

  return (
    <>
      <StatusBar backgroundColor={Colors.whiteGray} barStyle="dark-content" />
      <View style={{ 
        flex: 1, 
        backgroundColor: theme === 'dark' ? themecolors.darkBlue : Colors.whiteGray 
      }}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContainer,
            !scrollEnabled && styles.centerContent // Center when no scroll needed
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={scrollEnabled} // Only show bar when scrolling
          scrollEnabled={scrollEnabled}
          bounces={scrollEnabled} // Only bounce when scrollable
          overScrollMode={scrollEnabled ? 'auto' : 'never'}
        >
          <View 
            style={[styles.container, GlobalStyles.center]}
            onLayout={onContentLayout}
          >
            <View style={styles.shadowWrapper}>
              <View style={[
                styles.card, 
                { backgroundColor: theme === 'dark' ? '#041933' : '#fff' }
              ]}>
                <View style={[GlobalStyles.center, styles.logoContainer]}>
                  <VehicleHubColored height={34} width={200} />
                </View>

                <View style={styles.formContainer}>
                  {currentForm === 'signUp' && (
                    <SignUpForm     setIsLoggedIn={setIsLoggedIn} setshowSignUpForm={setshowSignUpForm} />
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
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    paddingVertical: 20,
  },
  centerContent: {
    justifyContent: 'center', // Only center when content fits
  },
  container: {
    width: '100%',
    paddingHorizontal: 20,
  },
  shadowWrapper: {
    paddingTop: 2.9,
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    overflow: 'hidden',
  },
  logoContainer: {
    paddingTop: 20,
    paddingBottom: 10,
  },
  formContainer: {
    // Content sizes naturally
  },
});

export default SignIn;