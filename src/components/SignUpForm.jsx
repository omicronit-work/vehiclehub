import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Animated,
  Image,
} from 'react-native';
import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
 
import GoogleIcon from '../assets/svg/GoogleIcon';
import CheckBox from '../assets/svg/CheckBox';
import { Colors } from '../styles/colors';
import { GlobalStyles } from '../styles/globalStyles';
import { Typography } from '../styles/typography';
import EyeSvg from '../assets/svg/EyeSvg';
import CloseEye from '../assets/svg/CloseEye';
import TickBox from '../assets/svg/TickBox';
import auth from '@react-native-firebase/auth';
import { useDispatch } from 'react-redux';
import { setUserInfo,saveUserToFirestore} from '../store/userSlice';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
 
import ToastManager, { Toast } from 'toastify-react-native'
 
const SignUpForm = ({ setIsLoggedIn, setshowSignUpForm }) => {
  const [tickbox, setTickBox] = useState(false);
  const [securedPass, setSecurePass] = useState(true);
  const [theme, setTheme] = useState(null);

  // Form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const dispatch = useDispatch()
  // Validation errors state
  const [errors, setErrors] = useState({});

  // Animation values
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(30))[0];

  useEffect(() => {
    const fetchTheme = async () => {
      const storedTheme = await AsyncStorage.getItem('theme');
      setTheme(storedTheme);
    };
    fetchTheme();
  }, []);

  // Animation on mount
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


  const validateForm = () => {
    const newErrors = {};

    if (!fullName.trim()) {
      newErrors.fullName = 'Please enter your full name';
    }

    if (!email.trim()) {
      newErrors.email = 'Please enter your email';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!password.trim()) {
      newErrors.password = 'Please enter your password';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!tickbox) {
      newErrors.tickbox = 'Please agree to the Terms and Conditions';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const clearError = (field) => {
    setErrors((prev) => {
      const updated = { ...prev };
      delete updated[field];
      return updated;
    });
  };

  const signTest = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await auth().createUserWithEmailAndPassword(email, password);
      const user = {
        email: email,
        name: fullName,
        pass: password || '',
        photo: '',
        termCondition:true
      };

       // Redux update
         dispatch(setUserInfo(user));
       
         // Save to Firestore
         await saveUserToFirestore(user);
         setshowSignUpForm(false);

    } catch (error) {
      console.log(error);
   
      
    } finally {

    
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
  
      // CRITICAL: Create Firebase credential and sign in
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
  
      //  Only now set logged in - Firebase session is established
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

  const getInputBorderColor = (fieldName) => {
    if (errors[fieldName]) {
      return '#C13D0C'; // Error red
    }
    return theme === 'dark' ? 'rgba(255,255,255,0.16)' : '#EEF1F5';
  };

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      }}
    >
      <StatusBar barStyle="light-content" translucent={false} />

      {/* Title */}
      <View style={{ marginTop: 30, gap: 8 }}>
        <Text
          style={[
            styles.title,
            { color: theme == 'dark' ? Colors.white : Colors.darkBlue },
          ]}
        >
          Create an account
        </Text>

        <Text
          style={[
            styles.subtitle,
            { color: theme == 'dark' ? Colors.white : Colors.darkBlue },
            { opacity: theme === 'dark' ? 0.8 : null },
          ]}
        >
          Let's get started. Fill in the details below to create your account.
        </Text>
      </View>

      {/* Google */}
      <TouchableOpacity
      onPress={()=>{  
       onGoogleButtonPress()
      }}
        style={[GlobalStyles.button, styles.googleBtn, GlobalStyles.center]}
      >
        <GoogleIcon width={16} height={16} />
        <Text style={styles.googleBtnText}>Sign up with Google</Text>
      </TouchableOpacity>

      {/* Divider */}
      <View style={styles.deviderContainer}>
        <View style={styles.line} />
        <Text style={styles.deviderText}>OR</Text>
        <View style={styles.line} />
      </View>

      {/* Form */}
      <View style={{ gap: 20 }}>
        {/* Full Name */}
        <View style={{ gap: 8 }}>
          <Text style={[styles.label, { color: theme == 'dark' ? Colors.white : Colors.darkBlue }]}>
            Full Name
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                borderColor: getInputBorderColor('fullName'),
              },
            ]}
            placeholder="Enter your name"
            placeholderTextColor={
              theme === 'dark'
                ? 'rgba(255,255,255,0.5)'
                : Colors.textinput
            }
            value={fullName}
            onChangeText={(text) => {
              setFullName(text);
              clearError('fullName');
            }}
          />
          {errors.fullName && (
            <Text style={styles.errorText}>{errors.fullName}</Text>
          )}
        </View>

        {/* Email */}
        <View style={{ gap: 8 }}>
          <Text style={[styles.label, { color: theme == 'dark' ? Colors.white : Colors.darkBlue }]}>
            Email
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                borderColor: getInputBorderColor('email'),
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
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              clearError('email');
            }}
          />
          {errors.email && (
            <Text style={styles.errorText}>{errors.email}</Text>
          )}
        </View>

        {/* Password */}
        <View style={{ gap: 8, position: 'relative' }}>
  <Text style={[styles.label, { color: theme == 'dark' ? Colors.white : Colors.darkBlue }]}>
    Password
  </Text>

  {/* Wrap input + icon in a container */}
  <View style={{ position: 'relative', justifyContent: 'center' }}>
    <TextInput
      style={[
        styles.input,
        {
          borderColor: getInputBorderColor('password'),
          paddingRight: 44, // Add right padding so text doesn't overlap icon
        },
      ]}
      placeholder="Enter your password"
      secureTextEntry={securedPass}
      placeholderTextColor={
        theme === 'dark'
          ? 'rgba(255,255,255,0.5)'
          : Colors.textinput
      }
      value={password}
      onChangeText={(text) => {
        setPassword(text);
        clearError('password');
      }}
    />

    <TouchableOpacity
      onPress={() => setSecurePass(!securedPass)}
      style={{ position: 'absolute', right: 12 }} // Removed bottom: 15
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
  </View>

  {errors.password && (
    <Text style={styles.errorText}>{errors.password}</Text>
  )}
</View>
        {/* Terms */}
        <View style={{ gap: 20 }}>
          <View style={styles.row}>
            <View style={styles.checkboxRow}>
              <TouchableOpacity onPress={() => {
                setTickBox(!tickbox);
                clearError('tickbox');
              }}>
                {tickbox ? (
                  <TickBox height={20} width={18} />
                ) : (
                  <CheckBox color={
                    theme === 'dark'
                      ? 'rgba(255,255,255,0.16)'
                      : '#EEF1F5'
                  } />
                )}
              </TouchableOpacity>

              <Text
                style={[
                  styles.dontHaveAccTxt,
                  {
                    color:
                      errors.tickbox
                        ? '#C13D0C'
                        : theme == 'dark'
                        ? Colors.white
                        : Colors.darkBlue,
                  },
                ]}
              >
                I agree to the Terms and Conditions
              </Text>
            </View>
          </View>
          {errors.tickbox && (
            <Text style={[styles.errorText, { marginTop: -12 }]}>
              {errors.tickbox}
            </Text>
          )}

          {/* Submit */}
          <TouchableOpacity
          onPress={() => {
         
            signTest();
          }}
            disabled={loading}
            style={[
               {
                backgroundColor: '#004EAB',
    height: 38,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
                
               },
              GlobalStyles.center,
              { backgroundColor:   Colors.primary },
            ]}
          >
            <Text style={styles.submitText}>
              {loading ? 'Creating Account...' : 'Continue'}
            </Text>
          </TouchableOpacity>

          {/* Sign in */}
          <View style={[styles.signUPcontainer, GlobalStyles.center]}>
            <Text
              style={[
                styles.dontHaveAccTxt,
                {
                  color:
                    theme == 'dark'
                      ? Colors.white
                      : Colors.darkBlue,
                },
              ]}
            >
              Already have an account?
            </Text>

            <TouchableOpacity onPress={() => setshowSignUpForm(false)}>
              <Text
                style={[
                  styles.forgotText,
                  {
                    color:
                      theme == 'dark'
                        ? Colors.primary
                        : Colors.darkBlue,
                  },
                ]}
              >
                Sign In
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Animated.View>
  );
};

export default SignUpForm;

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
  },

  title: {
    fontSize: Typography.textsize.Extralarge,
    fontFamily: Typography.font.regular,
  },

  subtitle: {
    fontFamily: Typography.font.light,
    FontSize: Typography.textsize.small,
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
    color: Colors.darkBlue,
  },

  errorText: {
    fontFamily: Typography.font.regular,
    fontSize: Typography.textsize.Extrasmall,
    color: '#C13D0C',
    marginTop: 4,
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
});
