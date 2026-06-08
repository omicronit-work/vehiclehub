import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { GlobalStyles } from '../styles/globalStyles';
import { Typography } from '../styles/typography.js';
import { Colors } from '../styles/colors.js';
import { themecolors } from '../styles/themecolors.js';
import { setTheme } from '../store/themeSlice.js';
import auth from '@react-native-firebase/auth';
import SettingsSVG from '../assets/svg/SettingSVG.jsx';
import UserIcon from '../assets/svg/UserIcon.jsx';
import Crown from '../assets/svg/Crown.jsx';
import Currency from '../assets/svg/Currency.jsx';
import Ring from '../assets/svg/Ring.jsx';
import Arrow from '../assets/svg/Arrow.jsx';
import Moon from '../assets/svg/Moon.jsx';
import HelpIcon from '../assets/svg/HelpIcon.jsx';
import PrivacyIcon from '../assets/svg/PrivacyIcon.jsx';
import Logout from '../assets/svg/Logout.jsx';
import { useNavigation } from '@react-navigation/native';

const Settings = ({ setIsLoggedIn }) => {
  const { theme } = useSelector((store) => store.theme);
  const dispatch = useDispatch();
   const navigation = useNavigation()
  const [isDarkMode, setIsDarkMode] = useState(theme === 'dark');

  useEffect(() => {
    const fetchTheme = async () => {
      const storedTheme = await AsyncStorage.getItem('theme');
      if (storedTheme) {
        dispatch(setTheme(storedTheme));
      }
    };
    fetchTheme();
  }, [dispatch]);

  // 🔥 keep local state synced with redux theme
  useEffect(() => {
    setIsDarkMode(theme === 'dark');
  }, [theme]);

  const handleToggle = async (value) => {
    setIsDarkMode(value);

    const newTheme = value ? 'dark' : 'light';

    dispatch(setTheme(newTheme));
    await AsyncStorage.setItem('theme', newTheme);
  };

  const currentBg =
    theme === 'dark' ? themecolors.darkBlue : themecolors.white;

  const currentText =
    theme === 'dark' ? themecolors.white : Colors.darkBlue;

  const arrowColor =
    theme === 'dark' ? themecolors.white : themecolors.deepBlue;


    const handleLogout = async () => {
      try {
        await auth().signOut();
        setIsLoggedIn(false)
        await AsyncStorage.removeItem('keepSignedIn');
        //navigation.navigate('Home')
      } catch (error) {
        console.log(error);
        setIsLoggedIn(false)
        //navigation.navigate('Home')
        
      }
    };
  return (
    <View style={GlobalStyles.screen}>
      <View
        style={[
          GlobalStyles.BodyContainer,
          { backgroundColor: currentBg },
        ]}
      >
        {/* Title */}
        <View style={styles.titleContainer}>
          <SettingsSVG color={currentText} />
          <Text style={[styles.titleText, { color: currentText }]}>
            Settings
          </Text>
        </View>

        {/* List */}
        <View style={styles.listContainer}>
          <TouchableOpacity style={styles.item}>
            <View style={styles.itemLeft}>
              <Crown />
              <Text style={[styles.itemTitle, { color: '#0057C8' }]}>
                ServiceLog Pro
              </Text>
            </View>
            <Arrow color={arrowColor} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.itemRow}>
            <View style={styles.itemLeft}>
              <UserIcon color={currentText} />
              <Text style={[styles.itemTitle, { color: currentText }]}>
                Profile Settings
              </Text>
            </View>
            <Arrow color={arrowColor} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.itemRow}>
            <View style={styles.itemLeft}>
              <Currency color={currentText} />
              <Text style={[styles.itemTitle, { color: currentText }]}>
                Currency
              </Text>
            </View>
            <Arrow color={arrowColor} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.itemRow}>
            <View style={styles.itemLeft}>
              <Ring color={currentText} />
              <Text style={[styles.itemTitle, { color: currentText }]}>
                Notifications
              </Text>
            </View>
            <Arrow color={arrowColor} />
          </TouchableOpacity>

          {/* Dark Mode Toggle (UNCHANGED UI) */}
          <View style={styles.itemRow}>
            <View style={styles.itemLeft}>
              <Moon color={currentText} />
              <Text style={[styles.itemTitle, { color: currentText }]}>
                Dark Mode
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handleToggle(!isDarkMode)}
              style={[
                styles.customTrack,
                {
                  backgroundColor: isDarkMode
                    ? '#004EAB'
                    : 'rgba(0, 78, 171, 0.2)',
                },
              ]}
            >
              <View
                style={[
                  styles.customThumb,
                  {
                    transform: [
                      {
                        translateX: isDarkMode ? 6 : 0,
                      },
                    ],
                  },
                ]}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.itemRow}>
            <View style={styles.itemLeft}>
              <HelpIcon color={currentText} />
              <Text style={[styles.itemTitle, { color: currentText }]}>
                Help & Support
              </Text>
            </View>
            <Arrow color={arrowColor} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.itemRow}>
            <View style={styles.itemLeft}>
              <PrivacyIcon color={currentText} />
              <Text style={[styles.itemTitle, { color: currentText }]}>
                Privacy & Policy
              </Text>
            </View>
            <Arrow color={arrowColor} />
          </TouchableOpacity>

          <TouchableOpacity onPress={()=>{
            handleLogout()
          }} style={styles.item}>
            <View style={styles.itemLeft}>
              <Logout />
              <Text style={[styles.itemTitle, styles.logoutText]}>
                Log Out
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default Settings;

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },

  titleText: {
    fontFamily: Typography.font.regular,
    fontSize: 18,
  },

  listContainer: {
    marginTop: 16,
  },

  item: {
    height: 42,
    borderBottomWidth: 0.9,
    borderColor: '#EEF1F5',
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  itemRow: {
    height: 42,
    borderBottomWidth: 0.9,
    borderColor: '#EEF1F5',
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  itemLeft: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },

  itemTitle: {
    fontFamily: Typography.font.regular,
    fontSize: Typography.textsize.small,
  },

  logoutText: {
    color: '#C13D0C',
  },

  customTrack: {
    width: 18,
    height: 12,
    borderRadius: 11,
    padding: 1,
    justifyContent: 'center',
  },

  customThumb: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#fff',
  },
});