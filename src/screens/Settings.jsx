import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import React, { useState } from 'react'
import ToggleSwitch from 'toggle-switch-react-native'

// Global styles & theme
import { GlobalStyles } from '../styles/globalStyles'
import { Typography } from '../styles/typography.js'
import { Colors } from '../styles/colors.js'

// Components
import Header from '../components/Header.jsx'

// SVG Icons
import SettingsSVG from '../assets/svg/SettingSVG.jsx'
import UserIcon from '../assets/svg/UserIcon.jsx'
import Crown from '../assets/svg/Crown.jsx'
import Currency from '../assets/svg/Currency.jsx'
import Ring from '../assets/svg/Ring.jsx'
import Arrow from '../assets/svg/Arrow.jsx'
import Moon from '../assets/svg/Moon.jsx'
import HelpIcon from '../assets/svg/HelpIcon.jsx'
import PrivacyIcon from '../assets/svg/PrivacyIcon.jsx'
import Logout from '../assets/svg/Logout.jsx'

const Settings = () => {

  // State for Dark Mode toggle
  const [isDarkMode, setIsDarkMode] = useState(false)

  return (
    <View style={GlobalStyles.screen}>

      {/* Top Header */}
      <Header />

      <View style={GlobalStyles.BodyContainer}>

        {/* Screen Title */}
        <View style={styles.titleContainer}>
          <SettingsSVG />
          <Text style={styles.titleText}>Settings</Text>
        </View>

        {/* Settings List */}
        <View style={styles.listContainer}>

          {/* Service Log Pro */}
          <TouchableOpacity style={styles.item}>
            <View style={styles.itemLeft}>
              <Crown />
              <Text style={[styles.itemTitle, {color:'#0057C8'}]}>ServiceLog Pro</Text>
            </View>
            <Arrow/>
          </TouchableOpacity>

          {/* Profile Settings */}
          <TouchableOpacity style={styles.itemRow}>
            <View style={styles.itemLeft}>
              <UserIcon />
              <Text style={styles.itemTitle}>Profile Settings</Text>
            </View>
            <Arrow />
          </TouchableOpacity>

          {/* Currency */}
          <TouchableOpacity style={styles.itemRow}>
            <View style={styles.itemLeft}>
              <Currency />
              <Text style={styles.itemTitle}>Currency</Text>
            </View>
            <Arrow />
          </TouchableOpacity>

          {/* Notifications */}
          <TouchableOpacity style={styles.itemRow}>
            <View style={styles.itemLeft}>
              <Ring />
              <Text style={styles.itemTitle}>Notifications</Text>
            </View>
            <Arrow />
          </TouchableOpacity>

          {/* Dark Mode Toggle */}
          <View style={styles.itemRow}>
            <View style={styles.itemLeft}>
              <Moon />
              <Text style={styles.itemTitle}>Dark Mode</Text>
            </View>

            <ToggleSwitch
              isOn={isDarkMode}
              onColor="#004EAB"
              offColor="#004EAB"
              size="small"
              onToggle={isOn => setIsDarkMode(isOn)}
              style={styles.toggle}
            />
          </View>

          {/* Help & Support */}
          <TouchableOpacity style={styles.itemRow}>
            <View style={styles.itemLeft}>
              <HelpIcon />
              <Text style={styles.itemTitle}>Help & Support</Text>
            </View>
            <Arrow />
          </TouchableOpacity>

          {/* Privacy Policy */}
          <TouchableOpacity style={styles.itemRow}>
            <View style={styles.itemLeft}>
              <PrivacyIcon />
              <Text style={styles.itemTitle}>Privacy & Policy</Text>
            </View>
            <Arrow />
          </TouchableOpacity>

          {/* Logout */}
          <TouchableOpacity style={styles.item}>
            <View style={styles.itemLeft}>
              <Logout />
              <Text style={[styles.itemTitle, styles.logoutText]}>Log Out</Text>
            </View>
          </TouchableOpacity>

        </View>
      </View>
    </View>
  )
}

export default Settings


const styles = StyleSheet.create({

  /* Title Row (Icon + Settings text) */
  titleContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center'
  },

  titleText: {
    fontFamily: Typography.font.regular,
    fontSize: 18,
    color: Colors.darkBlue
  },

  /* Container for all settings items */
  listContainer: {
    marginTop: 16
  },

  /* Basic Item Style */
  item: {
    height: 42,
    borderBottomWidth: 0.9,
    borderColor: '#EEF1F5',
    paddingVertical: 10,
    flexDirection:'row',
    justifyContent:'space-between',
    alignItems:'center'
  },

  /* Row item with arrow or toggle */
  itemRow: {
    height: 42,
    borderBottomWidth: 0.9,
    borderColor: '#EEF1F5',
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },

  /* Left side icon + text */
  itemLeft: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center'
  },

  /* Item text */
  itemTitle: {
    fontFamily: Typography.font.regular,
    fontSize: Typography.textsize.small,
  
    
  },

  /* Logout text color */
  logoutText: {
    color: '#C13D0C'
  },

  /* Toggle size adjustment */
  toggle: {
    left: 10,
    transform: [{ scaleX: 0.56 }, { scaleY: 0.9 }]
  }

})