import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, Platform, Dimensions, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

// Screens
import Home from '../screens/Home';
import Dashboard from '../screens/Dashboard';
import Settings from '../screens/Settings';
import Vehicle from '../screens/Vehicle';

// Header
import Header from '../components/Header';

// Icons
import HomeIcon from '../assets/svg/HomeIcon';
import DashNav from '../assets/svg/DashNav.jsx'
import VehicleIcon from '../assets/svg/VehicleIcon';
import SettingIcon from '../assets/svg/SettingIcon';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const SCREEN_HEIGHT = Dimensions.get('window').height;
const IS_SMALL_SCREEN = SCREEN_HEIGHT < 700;

const COLORS = {
  active: '#004EAB',
  activeBorder: '#004EAB66',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getTabBarHeight = (insets) => {
  const base = Platform.OS === 'ios' ? 80 : 60;
  const scale = IS_SMALL_SCREEN ? 0.9 : 1;

  return Math.max((base + (insets.bottom || 0)) * scale, 70);
};

// ─── Tab Icon ─────────────────────────────────────────────────────────────────

const TabIcon = ({ IconComponent, focused, isDark }) => (
  <View style={styles.iconWrapper}>
    <IconComponent
      fill={
        focused
          ? COLORS.active
          : isDark
          ? 'rgba(255,255,255,0.6)'
          : 'rgba(4, 25, 51, 0.6)'
      }
    />

    <View
      style={[
        styles.iconBorder,
        {
          borderRightWidth: focused ? 1 : 0,
        },
      ]}
    />
  </View>
);

// ─── Tab Config ───────────────────────────────────────────────────────────────

const TAB_SCREENS = [
  {
    name: 'Home',
    component: Home,
    Icon: HomeIcon,
  },
  {
    name: 'Dashboard',
    component: Dashboard,
    Icon: DashNav,
  },
  {
    name: 'Vehicle',
    component: Vehicle,
    Icon: VehicleIcon,
  },
  {
    name: 'Settings',
    component: Settings,
    Icon: SettingIcon,
  },
];

// ─── Tab Navigator ────────────────────────────────────────────────────────────

const TabNavigation = ({ setIsLoggedIn }) => {
  const insets = useSafeAreaInsets();

  const { theme } = useSelector((store) => store.theme);

  const isDark = theme === 'dark';

  const activeColor = COLORS.active;

  const inactiveColor = isDark
    ? 'rgba(255,255,255,0.5)'
    : '#04193399';

  return (
    <View style={styles.flex}>
      <Header />

      <View style={styles.flex}>
        <Tab.Navigator
          screenOptions={{
            headerShown: false,

            tabBarStyle: {
              height: getTabBarHeight(insets),
              backgroundColor: isDark ? '#072245' : '#fff',
              elevation: 20,
              borderTopWidth: 0,
            },

            sceneContainerStyle: {
              backgroundColor: isDark ? '#072245' : '#fff',
            },
          }}
        >
          {TAB_SCREENS.map(
            ({ name, component: Component, Icon }) => (
              <Tab.Screen
                key={name}
                name={name}
                options={{
                  tabBarLabel: ({ focused }) => (
                    <Text
                      style={[
                        styles.tabLabel,
                        {
                          color: focused
                            ? activeColor
                            : inactiveColor,
                        },
                      ]}
                    >
                      {name}
                    </Text>
                  ),

                  tabBarIcon: ({ focused }) => (
                    <TabIcon
                      IconComponent={Icon}
                      focused={focused}
                      isDark={isDark}
                    />
                  ),
                }}
              >
                {(props) =>
                  name === 'Settings' ? (
                    <Component
                      {...props}
                      setIsLoggedIn={setIsLoggedIn}
                    />
                  ) : (
                    <Component {...props} />
                  )
                }
              </Tab.Screen>
            )
          )}
        </Tab.Navigator>
      </View>
    </View>
  );
};

// ─── Stack Navigator ──────────────────────────────────────────────────────────

const StackNavigation = ({ setIsLoggedIn }) => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabbar">
        {(props) => (
          <TabNavigation
            {...props}
            setIsLoggedIn={setIsLoggedIn}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
};

export default StackNavigation;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconBorder: {
    marginTop: 10,
    width: 60,
    height: 62,
    borderRadius: 6,
    borderColor: COLORS.activeBorder,
    transform: [{ rotate: '90deg' }],
    position: 'absolute',
  },

  tabLabel: {
    fontSize: 12,
  },
});