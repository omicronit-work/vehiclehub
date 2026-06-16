import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Animated,
  Alert,
  Image,
} from 'react-native';
import React, { useState, useEffect } from 'react';
import GoogleIcon from '../assets/svg/GoogleIcon';
import CheckBox from '../assets/svg/CheckBox';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../styles/colors';
import { GlobalStyles } from '../styles/globalStyles';
import { Typography } from '../styles/typography';
import EyeSvg from '../assets/svg/EyeSvg';
import TickBox from '../assets/svg/TickBox';
import CloseEye from '../assets/svg/CloseEye';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import auth from '@react-native-firebase/auth';
import ToastManager, { Toast } from 'toastify-react-native'

import { useDispatch } from 'react-redux';
import {setUserInfo, saveUserToFirestore} from '../store/userSlice'

const SignInForm = ({
  setIsLoggedIn,
  setshowResetPass,
  setshowSignUpForm,
}) => {
  const [securedPass, setSecurePass] = useState(true);
  const [tickbox, setTickBox] = useState(false);
  const [theme, setTheme] = useState(null);
  const [loading, setLoading] = useState(false)
  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const dispatch = useDispatch()



  // Animation values
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(30))[0];

  useEffect(() => {
    const fetchTheme = async () => {
      const savedTheme = await AsyncStorage.getItem('theme');
      setTheme(savedTheme);
    };

    fetchTheme();
  }, []);

    useEffect(()=>{
      GoogleSignin.configure({
        webClientId: '277905798436-ocl93blcfve1ch1likgs13icikq39ocr.apps.googleusercontent.com',
      });
    },[])

  // Run animation on mount
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Validation
  const validateForm = () => {
    let valid = true;
    let tempErrors = {};

    // Email validation
    if (!email.trim()) {
      tempErrors.email = 'Email is required';
      valid = false;
    } else if (
      !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email)
    ) {
      tempErrors.email = 'Enter a valid email';
      valid = false;
    }

    // Password validation
    if (!password.trim()) {
      tempErrors.password = 'Password is required';
      valid = false;
    } else if (password.length < 6) {
      tempErrors.password = 'Password must be at least 6 characters';
      valid = false;
    }

    setErrors(tempErrors);
    return valid;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;
  
    try {
      setLoading(true)
      const data = await auth().signInWithEmailAndPassword(email, password);
      await AsyncStorage.setItem('keepSignedIn', JSON.stringify(tickbox));

      console.log('Data::', data)
      setLoading(false)
      setIsLoggedIn(true);
    } catch (error) {
      let message = 'Login failed';
      console.log('Error Code::', error)
  
       

      Toast.show({
        type: 'error',
        text1: 'Wrong Email or Password',
        
        position: 'Top',
        visibilityTime: 4000,
        autoHide: true,
        icon: () => null,  // ← Hides the icon
      });
      setLoading(false);
    }
  };

  async function onGoogleButtonPress() {
    try {
      //setLoading(true);
  
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      
      const signInResult = await GoogleSignin.signIn();
      const userInfo = signInResult.data.user;
  
      // Get ID token
      let idToken = signInResult.data?.idToken || signInResult.idToken;
      
      if (!idToken) {
        const tokens = await GoogleSignin.getTokens();
        idToken = tokens.idToken;
      }
  
      if (!idToken) {
        throw new Error('No ID token found');
      }
  
      // 🔥 CRITICAL: Create Firebase credential and sign in
      const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      const userCredential = await auth().signInWithCredential(googleCredential);
      
      const firebaseUser = userCredential.user;
      
      const user = {
        email: firebaseUser.email,
        name: firebaseUser.displayName || userInfo.name,
        photo: firebaseUser.photoURL || userInfo.photo,
        uid: firebaseUser.uid,
        termCondition: false,
      };

    
      
      

      
  
      // Redux + Firestore
      dispatch(setUserInfo(user));
      await saveUserToFirestore(user);
  
      // Only now set logged in - Firebase session is established
      setIsLoggedIn(true);
  
    } catch (error) {
      console.log('Google Sign-In Error:', error);
      Toast.show({
        type: 'error',
        text1: 'Google Sign-In Failed',
        text2: error.message,
        position: 'top',
        visibilityTime: 4000,
        autoHide: true,
        icon: () => null,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      }}
    >
      <StatusBar
        barStyle={theme === 'dark' ? 'light-content' : 'dark-content'}
      />

      {/* Title & subtitle */}
      <View style={{ marginTop: 30, gap: 8 }}>
        <Text
          style={[
            styles.title,
            { color: theme === 'dark' ? Colors.white : Colors.darkBlue },
          ]}
        >
          Sign in
        </Text>

        <Text
          style={[
            styles.subtitle,
            { color: theme === 'dark' ? Colors.white : Colors.darkBlue },
            { opacity: theme === 'dark' ? 0.8 : 1 },
          ]}
        >
          Sign in to track maintenance logs and manage your vehicle
        </Text>
      </View>

      {/* Google sign-in */}
      <TouchableOpacity
      onPress={()=>{
        onGoogleButtonPress()
      }}
        style={[GlobalStyles.button, styles.googleBtn, GlobalStyles.center]}
      >
        <GoogleIcon width={16} height={16} />
        <Text style={styles.googleBtnText}>Sign in with Google</Text>
      </TouchableOpacity>

      {/* Divider */}
      <View style={styles.deviderContainer}>
        <View style={styles.line} />
        <Text style={styles.deviderText}>OR</Text>
        <View style={styles.line} />
      </View>

      {/* Form */}
      <View style={{ gap: 20 }}>
        {/* Email */}
        <View style={{ gap: 8 }}>
          <Text
            style={[
              styles.label,
              { color: theme === 'dark' ? Colors.white : Colors.darkBlue },
            ]}
          >
            Email
          </Text>

          <TextInput
            value={email}
            onChangeText={text => {
              setEmail(text);
              setErrors(prev => ({ ...prev, email: '' }));
            }}
            style={[
              styles.input,
              {
                borderColor: errors.email
                  ? 'red'
                  : theme === 'dark'
                  ? 'rgba(255, 255, 255, 0.16)'
                  : '#EEF1F5',
                color: theme === 'dark' ? Colors.white : Colors.darkBlue,
              },
            ]}
            placeholder="Enter your email"
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor={
              theme === 'dark'
                ? 'rgba(255,255,255,0.5)'
                : Colors.textinput
            }
          />

          {errors.email ? (
            <Text style={styles.errorText}>{errors.email}</Text>
          ) : null}
        </View>

        {/* Password */}
        <View style={{ gap: 8 }}>
          <Text
            style={[
              styles.label,
              { color: theme === 'dark' ? Colors.white : Colors.darkBlue },
            ]}
          >
            Password
          </Text>

          <TextInput
            value={password}
            onChangeText={text => {
              setPassword(text);
              setErrors(prev => ({ ...prev, password: '' }));
            }}
            style={[
              styles.input,
              {
                borderColor: errors.password
                  ? 'red'
                  : theme === 'dark'
                  ? 'rgba(255, 255, 255, 0.16)'
                  : '#EEF1F5',
                color: theme === 'dark' ? Colors.white : Colors.darkBlue,
              },
            ]}
            placeholder="Enter your password"
            placeholderTextColor={
              theme === 'dark'
                ? 'rgba(255,255,255,0.5)'
                : Colors.textinput
            }
            secureTextEntry={securedPass}
          />

          <TouchableOpacity
            onPress={() => setSecurePass(!securedPass)}
            style={{ position: 'absolute', right: 12, top: 45 }}
          >
            {securedPass ? (
              <CloseEye
                color={
                  theme === 'dark'
                    ? 'rgba(255,255,255,0.5)'
                    : '#041933'
                }
              />
            ) : (
              <EyeSvg
                color={
                  theme === 'dark'
                    ? 'rgba(255,255,255,0.5)'
                    : '#041933'
                }
              />
            )}
          </TouchableOpacity>

          {errors.password ? (
            <Text style={styles.errorText}>{errors.password}</Text>
          ) : null}
        </View>

        {/* Remember + Forgot */}
        <View style={styles.row}>
          <View style={styles.checkboxRow}>
            <TouchableOpacity onPress={() => setTickBox(!tickbox)}>
              {tickbox ? (
                <TickBox height={20} width={18} />
              ) : (
                <CheckBox
                  color={
                    theme === 'dark'
                      ? 'rgba(255,255,255,0.16)'
                      : '#EEF1F5'
                  }
                  height={20}
                  width={18}
                />
              )}
            </TouchableOpacity>

            <Text
              style={[
                styles.dontHaveAccTxt,
                { color: theme === 'dark' ? Colors.white : '#041933' },
              ]}
            >
              Keep me signed in
            </Text>
          </View>

          <TouchableOpacity onPress={() => setshowResetPass(true)}>
            <Text
              style={[
                styles.forgotText,
                {
                  color:
                    theme === 'dark'
                      ? '#004EAB'
                      : Colors.darkBlue,
                },
              ]}
            >
              Forgot password?
            </Text>
          </TouchableOpacity>
        </View>

        {/* Sign in */}
        <TouchableOpacity
          onPress={handleLogin}
          style={[
             {backgroundColor: '#004EAB',
              height: 38,
              justifyContent: 'center',
              paddingHorizontal: 16,
              borderRadius: 12,
              alignItems: 'center',},
            GlobalStyles.center,
            { backgroundColor: Colors.primary },
          ]}
        >
          <Text style={styles.submitText}> {loading ?'Sign in....' : 'Sign in' }</Text>
        </TouchableOpacity>

        {/* Sign up */}
        <View style={[styles.signUPcontainer, GlobalStyles.center]}>
          <Text
            style={[
              styles.dontHaveAccTxt,
              { color: theme === 'dark' ? Colors.white : Colors.darkBlue },
            ]}
          >
            Don't have an account?
          </Text>

          <TouchableOpacity  onPress={() => setshowSignUpForm(true)}>
            <Text
              style={[
                styles.forgotText,
                {
                  color:
                    theme === 'dark'
                      ? Colors.primary
                      : Colors.darkBlue,
                },
              ]}
            >
              Sign up
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
};

export default SignInForm;

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    paddingVertical: 35,
  },

  SingUpContainer: {
    flex: 1,
    backgroundColor: Colors.whiteGray,
  },

  childCOntainer: {
    width: '90%',
    maxWidth: 420,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
  },

  title: {
    fontSize: Typography.textsize.Extralarge,
    fontFamily: Typography.font.regular,
  },

  subtitle: {
    fontFamily: Typography.font.light,
    fontSize: Typography.textsize.small,
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
  },

  input: {
    width: '100%',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 12,
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
  },

  errorText: {
    color: 'red',
    fontSize: 12,
    marginTop: 4,
    fontFamily: Typography.font.light,
  },
});