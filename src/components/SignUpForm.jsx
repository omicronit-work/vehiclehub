import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Animated,
  Easing,
  StatusBar
} from 'react-native';
import React, { useEffect, useRef, useState } from 'react';
import GoogleIcon from '../assets/svg/GoogleIcon';
import CheckBox from '../assets/svg/CheckBox';
import { Colors } from '../styles/colors';
import { GlobalStyles } from '../styles/globalStyles';
import { Typography } from '../styles/typography';
import EyeSvg from '../assets/svg/EyeSvg';
import TickBox from '../assets/svg/TickBox'
const SignUpForm = ({ setshowResetPass, setshowSignUpForm }) => {
  // Single animation values for all elements (like ResetPassword)
  const slideAnim = useRef(new Animated.Value(100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const [tickbox, setTickBox] = useState(false)
  const [securedPass, setSecurePass] = useState(true)
  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const animatedStyle = {
    opacity: opacityAnim,
    transform: [{ translateX: slideAnim }],
  };

  return (
    <View>
        <StatusBar
                
                barStyle="light-content"
                translucent={false}
              />
        
      {/* All animated content wrapped together */}
      <Animated.View style={[{ marginTop: 30, gap: 8 }, animatedStyle]}>
        <Text style={styles.title}>Create an account</Text>
        <Text style={styles.subtitle}>
          Let's get started. Fill in the details below to create your account.
        </Text>
      </Animated.View>

      {/* Google sign-in button - ANIMATED */}
      <Animated.View style={[animatedStyle]}>
        <TouchableOpacity
          style={[GlobalStyles.button, styles.googleBtn, GlobalStyles.center]}
        >
          <GoogleIcon width={16} height={16} />
          <Text style={styles.googleBtnText}>Sign up with Google</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Divider - ANIMATED */}
      <Animated.View style={[styles.deviderContainer, animatedStyle]}>
        <View style={styles.line} />
        <Text style={styles.deviderText}>OR</Text>
        <View style={styles.line} />
      </Animated.View>

      {/* Email & Password form */}
      <View style={{ gap: 20 }}>
        {/* Full Name - ANIMATED */}
        <Animated.View style={[{ gap: 8 }, animatedStyle]}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your name"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </Animated.View>

        {/* Email Input - NO ANIMATION (static) */}
        <View style={{ gap: 8 }}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        {/* Password Input - NO ANIMATION (static) */}
        <View style={{ gap: 8, position: "relative", justifyContent: "center" }}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your password"
            secureTextEntry={securedPass}
          />
          <TouchableOpacity onPress={()=>{
            if(securedPass === false){
              setSecurePass(true)
            }else{
              setSecurePass(false)
            }
          }} style={{
            position: "absolute",
            right: 12,
            bottom: 15
          }}>
            <EyeSvg />
          </TouchableOpacity>
        </View>

        {/* Rest of animated content - ALL TOGETHER */}
        <Animated.View style={[{ gap: 20 }, animatedStyle]}>
          {/* Remember me row */}
          <View style={styles.row}>
            <View style={styles.checkboxRow}>
              <TouchableOpacity onPress={()=>{
                if(tickbox ==false){
                  setTickBox(true)
                }else{
                  setTickBox(false)
                }
              }}>
               {tickbox === false   ? <CheckBox height={20} width={18} /> : <TickBox height={20} width={18}/> } 
              
              </TouchableOpacity>
              <Text style={styles.dontHaveAccTxt}>I agree to the Terms and Conditions</Text>
            </View>
          </View>

          {/* Submit button */}
          <TouchableOpacity
            style={[
              GlobalStyles.button,
              GlobalStyles.center,
              { backgroundColor: Colors.primary },
            ]}
          >
            <Text style={styles.submitText}>Continue</Text>
          </TouchableOpacity>

          {/* Navigation to Sign In */}
          <View style={[styles.signUPcontainer, GlobalStyles.center]}>
            <Text style={styles.dontHaveAccTxt}>Already have an account?</Text>
            <TouchableOpacity onPress={() => {
              setshowSignUpForm(false);
            }}>
              <Text style={styles.forgotText}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </View>
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