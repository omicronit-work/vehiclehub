import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Animated,
  Easing,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import React, { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../styles/colors';
import { GlobalStyles } from '../styles/globalStyles';
import { Typography } from '../styles/typography';
import auth from '@react-native-firebase/auth';

const ResetPassword = ({ setshowResetPass }) => {
  const [theme, setTheme] = useState(null);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  // ✅ Animation values
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    const fetchTheme = async () => {
      const t = await AsyncStorage.getItem('theme');
      setTheme(t);
    };
    fetchTheme();
  }, []);

  useEffect(() => {
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
  }, []);

  const animatedStyle = {
    opacity: opacityAnim,
    transform: [{ translateY: slideAnim }],
  };

  const handleSendResetLink = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }
  
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }
  
    setLoading(true);
  
    try {
      await auth().sendPasswordResetEmail(email.trim());
      Alert.alert(
        'Check your email',
        'A password reset link has been sent to your email address.',
        [{ text: 'OK', onPress: () => setshowResetPass(false) }]
      );
    } catch (error) {
      console.log(error);
      let errorMessage = 'Something went wrong. Please try again.';
  
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'This email is not registered.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'The email address is not valid.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many attempts. Please try again later.';
      }
  
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />

      <View style={styles.wrapper}>

        {/* TITLE + SUBTITLE (ANIMATED) */}
        <Animated.View style={[styles.header, animatedStyle]}>
          <Text
            style={[
              styles.title,
              { color: theme === 'dark' ? Colors.white : Colors.darkBlue },
            ]}
          >
            Forgot password
          </Text>

          <Text
            style={[
              styles.subtitle,
              {
                color: theme === 'dark' ? Colors.white : Colors.darkBlue,
                opacity: theme === 'dark' ? 0.8 : 1,
              },
            ]}
          >
            Enter your email and we'll send you a reset link.
          </Text>
        </Animated.View>

        {/* EMAIL FIELD (ANIMATED) */}
        <Animated.View style={[styles.formGroup, animatedStyle]}>
          <Text
            style={[
              styles.label,
              { color: theme === 'dark' ? Colors.white : Colors.darkBlue },
            ]}
          >
            Email
          </Text>

          <TextInput
            style={[
              styles.input,
              {
                borderColor:
                  theme === 'dark'
                    ? 'rgba(255,255,255,0.16)'
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
            value={email}
            onChangeText={setEmail}
            editable={!loading}
          />
        </Animated.View>

        {/* BUTTON + FOOTER (ANIMATED) */}
        <Animated.View style={[styles.bottom, animatedStyle]}>
          <TouchableOpacity
            onPress={handleSendResetLink}
            disabled={loading}
            style={[
              GlobalStyles.button,
              GlobalStyles.center,
              {
                backgroundColor: loading ? Colors.textinput : Colors.primary,
              },
            ]}
          >
            <Text style={styles.submitText}>
              {loading ? 'Sending...' : 'Send reset link'}
            </Text>
          </TouchableOpacity>

          <View style={styles.signUPcontainer}>
            <Text
              style={[
                styles.dontHaveAccTxt,
                { color: theme === 'dark' ? Colors.white : Colors.darkBlue },
              ]}
            >
              Remembered your password?
            </Text>

            <TouchableOpacity onPress={() => setshowResetPass(false)}>
              <Text style={[styles.forgotText, { color: Colors.primary }]}>
                Sign In
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

      </View>
    </KeyboardAvoidingView>
  );
};

export default ResetPassword;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
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

  formGroup: {
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