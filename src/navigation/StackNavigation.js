import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, Platform, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Import screen components
import Home from '../screens/Home';
import Dashboard from '../screens/Dashboard';
import Settings from '../screens/Settings';
import Vehicle from '../screens/Vehicle';
import HomeIcon from '../assets/svg/HomeIcon';
import DashBoardIcon from '../assets/svg/DashBoardIcon';
import VehicleIcon from '../assets/svg/VehicleIcon';
import SettingIcon from '../assets/svg/SettingIcon';
import BlankScreen from '../components/BlankScreen'
import BlueScreen from '../components/BlueScreen'
const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const getTabBarHeight = insets => {
  const baseHeight = Platform.OS === 'ios' ? 80 : 60;
  const bottomInset = insets.bottom || 0;
  const scaleFactor = SCREEN_HEIGHT < 700 ? 0.9 : 1;
  const minHeight = 70;
  const calculatedHeight = (baseHeight + bottomInset) * scaleFactor;
  return Math.max(calculatedHeight, minHeight);
};

const renderTabIcon = (IconComponent, focused) => (
  <View style={{ alignItems: 'center', justifyContent: 'center' }}>
    {/* Icon */}
    <IconComponent fill={focused ? '#004EAB' : '#04193399'} />

    {/* Rotated border */}
    <View
      style={{
        marginTop: 10,
        width: 60,
        height: 62,
        borderRightWidth: focused ? 1 : 0,
        borderRadius: 6,
        borderColor: '#004EAB66',
        transform: [{ rotate: '90deg' }],
        position: 'absolute', // ensure border stays behind icon,
      }}
    />
  </View>
);

const TabNavigation = () => {
  const insets = useSafeAreaInsets();
  const tabBarHeight = getTabBarHeight(insets);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          height: tabBarHeight,

          //paddingBottom: Platform.OS === 'ios' ? insets.bottom : 0,
          backgroundColor: '#fff',
          elevation: 20,
         
        },

        tabBarLabelPosition: 'below-icon',
      }}
    >
      <Tab.Screen
        name="Home"
        component={Home}
        options={{
          tabBarLabel: ({ focused }) => (
            <Text
              style={{
                color: focused ? '#004EAB' : '#04193399',
                fontSize: 12,
                fontFamily: 'RobotoCondensed500',
              }}
            >
              Home
            </Text>
          ),
          tabBarIcon: ({ focused }) => renderTabIcon(HomeIcon, focused),
        }}
      />

      <Tab.Screen
        name="Dashboard"
        component={Dashboard}
        options={{
          tabBarLabel: ({ focused }) => (
            <Text
              style={{
                color: focused ? '#004EAB' : '#04193399',
                fontSize: 12,
                fontFamily: 'RobotoCondensed500',
              }}
            >
              Dashboard
            </Text>
          ),
          tabBarIcon: ({ focused }) => renderTabIcon(DashBoardIcon, focused),
        }}
      />

      <Tab.Screen
        name="Vehicle"
        component={Vehicle}
        options={{
          tabBarLabel: ({ focused }) => (
            <Text
              style={{
                color: focused ? '#004EAB' : '#04193399',
                fontSize: 12,
                fontFamily: 'RobotoCondensed500',
              }}
            >
              Vehicle
            </Text>
          ),
          tabBarIcon: ({ focused }) => renderTabIcon(VehicleIcon, focused),
        }}
      />

      <Tab.Screen
        name="Settings"
        component={Settings}
        options={{
          tabBarLabel: ({ focused }) => (
            <Text
              style={{
                color: focused ? '#004EAB' : '#04193399',
                fontSize: 12,
                fontFamily: 'RobotoCondensed500',
              }}
            >
              Settings
            </Text>
          ),
          tabBarIcon: ({ focused }) => renderTabIcon(SettingIcon, focused),
        }}
      />






    </Tab.Navigator>
  );
};

const StackNavigation = () => (
  <Stack.Navigator>
    <Stack.Screen
      name="Tabbar"
      component={TabNavigation}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="DashboardDetail"
      
      component={Dashboard}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="VehicleDetail"
      component={Vehicle}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="SettingsDetail"
      component={Settings}
      options={{ headerShown: false }}
    />
  </Stack.Navigator>
);

export default StackNavigation;
