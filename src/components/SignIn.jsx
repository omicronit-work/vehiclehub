// Core React Native components
import {
  StyleSheet,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  StatusBar
} from 'react-native';
import React, { useState, useEffect, useRef } from 'react';

// App-wide styles and components
import { Colors } from '../styles/colors';
import { GlobalStyles } from '../styles/globalStyles';
import SignInForm from '../components/SignInForm';
import ResetPassWord from '../components/ResetPassword';
import SignUpForm from '../components/SignUpForm';
import VehicleHubColored from '../assets/svg/VehicleHubColored';

const SignIn = ( {setIsLoggedIn} ) => {
  // State to control which form is active
  const [showResetPass, setshowResetPass] = useState(false);
  const [showSignUpForm, setshowSignUpForm] = useState(false);

  // Track which form is currently rendered
  const [currentForm, setCurrentForm] = useState('signIn'); // 'signIn' | 'reset' | 'signUp'

  // Animation value for container height
  const animatedHeight = useRef(new Animated.Value(500)).current; // Start with SignIn default height

  // Form heights (dynamic)
  const [signInHeight, setSignInHeight] = useState(500);
  const [resetHeight, setResetHeight] = useState(400);
  const [signUpHeight, setSignUpHeight] = useState(550);

  const isFirstRender = useRef(true);

  /**
   * Animate container height whenever form changes
   * Only height changes, no fade or slide
   */
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
  
    let targetHeight = signInHeight;
    let targetForm = 'signIn';
    if (showResetPass) {
      targetHeight = resetHeight;
      targetForm = 'reset';
    } else if (showSignUpForm) {
      targetHeight = signUpHeight;
      targetForm = 'signUp';
    }
  
    // Animate with spring for smoothness
    Animated.spring(animatedHeight, {
      toValue: targetHeight,
      speed: 20,           // higher speed = faster animation
      bounciness: 10,      // adjust for smoother feel
      useNativeDriver: false,
    }).start();
  
    // Switch content immediately
    setCurrentForm(targetForm);
  }, [showResetPass, showSignUpForm, signInHeight, resetHeight, signUpHeight]);

  // Animated style for container height
  const animatedContainerStyle = { height: animatedHeight };

  /**
   * Measure dynamic height of each form container
   * This ensures the card grows/shrinks correctly
   */
  const onSignInLayout = (event) => {
    const { height } = event.nativeEvent.layout;
    setSignInHeight(height + 120); // Add padding/logo space
  };
  const onResetLayout = (event) => {
    const { height } = event.nativeEvent.layout;
    setResetHeight(height + 120);
  };
  const onSignUpLayout = (event) => {
    const { height } = event.nativeEvent.layout;
    setSignUpHeight(height + 120);
  };

  // Handlers to show forms
  const handleShowResetPass = () => setshowResetPass(true);
  const handleBackToSignIn = () => {
    setshowResetPass(false);
    setshowSignUpForm(false);
  };
  const handleShowSignUp = () => setshowSignUpForm(true);

  return (
    <>
      <StatusBar backgroundColor={Colors.whiteGray} barStyle="dark-content" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'android' ? 'height' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.SingUpContainer, GlobalStyles.center]}>
            {/* Shadow wrapper - handles elevation without overflow hidden */}
            <Animated.View style={[styles.shadowWrapper, animatedContainerStyle]}>
              {/* Inner container - handles background, radius, and content clipping */}
              <View style={styles.childContainer}>
                {/* App Logo */}
                <View style={[GlobalStyles.center, styles.logoContainer]}>
                  <VehicleHubColored height={34} width={200} />
                </View>

                {/* Form content */}
                <View style={styles.contentContainer}>
                  {currentForm === 'signUp' && (
                    <View onLayout={onSignUpLayout}>
                      <SignUpForm setshowSignUpForm={setshowSignUpForm} />
                    </View>
                  )}
                  {currentForm === 'reset' && (
                    <View onLayout={onResetLayout}>
                      <ResetPassWord
                        setshowResetPass={handleBackToSignIn}
                        onBackPress={handleBackToSignIn}
                      />
                    </View>
                  )}
                  {currentForm === 'signIn' && (
                    <View onLayout={onSignInLayout}>
                      <SignInForm
                        setIsLoggedIn={setIsLoggedIn}
                        setshowSignUpForm={handleShowSignUp}
                        setshowResetPass={handleShowResetPass}
                        onForgotPress={handleShowResetPass}
                      />
                    </View>
                  )}
                </View>
              </View>
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
};

export default SignIn;

// -----------------------------
// Styles
// -----------------------------
const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
  paddingVertical: 35,
  backgroundColor: Colors.whiteGray,
  },
  SingUpContainer: {
    backgroundColor: Colors.whiteGray,
    flex: 1,
     
  },
  // Wrapper with elevation - no overflow hidden here so shadow shows
  shadowWrapper: {
    paddingTop:2.9,
    width: '90%',
    maxWidth: 420,
    borderRadius: 16,
    elevation: 3,              // Android shadow - increased for visibility
   
  },
  // Inner container with background and overflow hidden
  childContainer: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 16,          // Match parent radius
    padding: 16,
    overflow: 'hidden',        // Clips content but not shadow (shadow is on parent)
  },
  logoContainer: {
    paddingTop: 20,
    paddingBottom: 10,
  },
  contentContainer: {
    flex: 1,
  },
});