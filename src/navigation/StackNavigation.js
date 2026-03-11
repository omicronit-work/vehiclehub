import React, { useRef } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, Platform, Dimensions, Animated, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

// Screens
import Home from '../screens/Home';
import Dashboard from '../screens/Dashboard';
import Settings from '../screens/Settings';
import Vehicle from '../screens/Vehicle';

// Icons
import HomeIcon from '../assets/svg/HomeIcon';
import DashBoardIcon from '../assets/svg/DashBoardIcon';
import VehicleIcon from '../assets/svg/VehicleIcon';
import SettingIcon from '../assets/svg/SettingIcon';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();
const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// ================= Utility: Tab Bar Height =================
const getTabBarHeight = insets => {
  const baseHeight = Platform.OS === 'ios' ? 80 : 60;
  const bottomInset = insets.bottom || 0;
  const scaleFactor = SCREEN_HEIGHT < 700 ? 0.9 : 1;
  const minHeight = 70;
  const calculatedHeight = (baseHeight + bottomInset) * scaleFactor;
  return Math.max(calculatedHeight, minHeight);
};

// ================= Tab Icon Renderer =================
const renderTabIcon = (IconComponent, focused) => (
  <View style={{ alignItems: 'center', justifyContent: 'center' }}>
    <IconComponent fill={focused ? '#004EAB' : '#04193399'} />
    <View
      style={{
        marginTop: 10,
        width: 60,
        height: 62,
        borderRightWidth: focused ? 1 : 0,
        borderRadius: 6,
        borderColor: '#004EAB66',
        transform: [{ rotate: '90deg' }],
        position: 'absolute',
      }}
    />
  </View>
);

// ================= Reusable Slide-In Animation =================
const SlideIn = ({ children, direction = 'left' }) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  // Trigger animation on screen focus
  useFocusEffect(
    React.useCallback(() => {
      // Reset initial position based on direction
      translateX.setValue(direction === 'left' ? -SCREEN_WIDTH : direction === 'right' ? SCREEN_WIDTH : 0);
      translateY.setValue(direction === 'top' ? -SCREEN_HEIGHT : direction === 'bottom' ? SCREEN_HEIGHT : 0);
      opacity.setValue(0);

      Animated.parallel([
        Animated.timing(translateX, {
          toValue: 0,
          duration: 700, // slower
          easing: Easing.out(Easing.exp),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 700,
          easing: Easing.out(Easing.exp),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.exp),
          useNativeDriver: true,
        }),
      ]).start();
    }, [direction])
  );

  return <Animated.View style={{ flex: 1, transform: [{ translateX }, { translateY }], opacity }}>{children}</Animated.View>;
};

// ================= Tab Navigation =================
const TabNavigation = () => {
  const insets = useSafeAreaInsets();
  const tabBarHeight = getTabBarHeight(insets);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          height: tabBarHeight,
          backgroundColor: '#fff',
          elevation: 20,
        },
        tabBarLabelPosition: 'below-icon',
      }}
    >
      {/* Home: Left to Right */}
      <Tab.Screen
        name="Home"
        component={() => (
          <SlideIn direction="left">
            <Home />
          </SlideIn>
        )}
        options={{
          tabBarLabel: ({ focused }) => (
            <Text style={{ color: focused ? '#004EAB' : '#04193399', fontSize: 12, fontFamily: 'RobotoCondensed500' }}>
              Home
            </Text>
          ),
          tabBarIcon: ({ focused }) => renderTabIcon(HomeIcon, focused),
        }}
      />

      {/* Dashboard: Right to Left */}
      <Tab.Screen
        name="Dashboard"
        component={() => (
          <SlideIn direction="right">
            <Dashboard />
          </SlideIn>
        )}
        options={{
          tabBarLabel: ({ focused }) => (
            <Text style={{ color: focused ? '#004EAB' : '#04193399', fontSize: 12, fontFamily: 'RobotoCondensed500' }}>
              Dashboard
            </Text>
          ),
          tabBarIcon: ({ focused }) => renderTabIcon(DashBoardIcon, focused),
        }}
      />

      {/* Vehicle: Right to Left */}
      <Tab.Screen
        name="Vehicle"
        component={() => (
          <SlideIn direction="right">
            <Vehicle />
          </SlideIn>
        )}
        options={{
          tabBarLabel: ({ focused }) => (
            <Text style={{ color: focused ? '#004EAB' : '#04193399', fontSize: 12, fontFamily: 'RobotoCondensed500' }}>
              Vehicle
            </Text>
          ),
          tabBarIcon: ({ focused }) => renderTabIcon(VehicleIcon, focused),
        }}
      />

      {/* Settings: Left to Right */}
      <Tab.Screen
        name="Settings"
        component={() => (
          <SlideIn direction="left">
            <Settings />
          </SlideIn>
        )}
        options={{
          tabBarLabel: ({ focused }) => (
            <Text style={{ color: focused ? '#004EAB' : '#04193399', fontSize: 12, fontFamily: 'RobotoCondensed500' }}>
              Settings
            </Text>
          ),
          tabBarIcon: ({ focused }) => renderTabIcon(SettingIcon, focused),
        }}
      />
    </Tab.Navigator>
  );
};

// ================= Stack Navigation =================
const StackNavigation = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Tabbar" component={TabNavigation} />
    <Stack.Screen
      name="DashboardDetail"
      component={() => (
        <SlideIn direction="right">
          <Dashboard />
        </SlideIn>
      )}
    />
    <Stack.Screen
      name="VehicleDetail"
      component={() => (
        <SlideIn direction="right">
          <Vehicle />
        </SlideIn>
      )}
    />
    <Stack.Screen
      name="SettingsDetail"
      component={() => (
        <SlideIn direction="left">
          <Settings />
        </SlideIn>
      )}
    />
  </Stack.Navigator>
);

export default StackNavigation;