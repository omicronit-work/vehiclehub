import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  Animated,
  Image,
} from 'react-native';
import React, { useEffect, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

import { Colors } from '../styles/colors.js';
import Wheels from '../assets/svg/Wheels.jsx';
import { fetchUserByEmail } from '../store/fetchSlice.js';

const Header = () => {
  const { userEmail } = useSelector((state) => state.user);
  
  const [userData, setUserData] = useState(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(30)).current;
  const hasAnimated = useRef(false);

  useEffect(() => {
    let isMounted = true;
    
    const loadUser = async () => {
      if (!userEmail) return;
      try {
        const data = await fetchUserByEmail(userEmail);
        if (isMounted) {
          setUserData(data);
          console.log('Data::', data);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Failed to fetch user:', err);
        }
      }
    };

    loadUser();
    return () => { isMounted = false; };
  }, [userEmail]);

  useEffect(() => {
    if (hasAnimated.current) return;
    hasAnimated.current = true;

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const avatarUri = userData?.photo;
  const name = userData?.name
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="dark-content"
      />

      <Animated.View
        style={[
          styles.container,
          {
            opacity: fadeAnim,
            transform: [{ translateY }],
          },
        ]}
      >
        <Wheels />

        <View style={styles.avatar}>
          {avatarUri ? (
            <Image
              source={{ uri: avatarUri }}
              style={styles.avatarImage}
            />
          ) : (
      
            <Text style={styles.avatarText}>{name?.slice(0, 2).toUpperCase()}</Text>
          )}
        </View>
      </Animated.View>
    </SafeAreaView>
  );
};

export default Header;

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: Colors.primary,
  },
  container: {
    justifyContent: 'space-between',
    marginHorizontal: 22,
    paddingBottom: 15,
    flexDirection: 'row',
  },
  avatar: {
    height: 24,
    width: 24,
    backgroundColor: '#fff',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 24,
    height: 24,
    borderRadius: 30,
  },
  avatarText: {
    fontFamily: 'RobotoCondensed500',
    fontWeight: '700',
    fontSize: 10,
    color: 'rgba(0, 78, 171, 1)',
    textAlign: 'center',
  },
});