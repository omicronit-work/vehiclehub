
import { createStackNavigator } from '@react-navigation/stack';


import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

// Import screen components
import Home from '../screens/Home';
import Dashboard from '../screens/Dashboard';
import Settings from '../screens/Settings';
import Vehicle from '../screens/Vehicle';

// Create navigator instances
const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();


const TabNavigation = () => {
  return (
    <Tab.Navigator>
      {/* Home Tab */}
      <Tab.Screen name="Home" component={Home} />

      {/* Dashboard Tab */}
      <Tab.Screen name="Dashboard" component={Dashboard} />

      {/* Vehicle Tab */}
      <Tab.Screen name="Vehicle" component={Vehicle} />

      {/* Settings Tab */}
      <Tab.Screen name="Settings" component={Settings} />
    </Tab.Navigator>
  );
};


const StackNavigation = () => {
  return (
    <Stack.Navigator>
      {/* Main Tab Navigator (Header hidden because tabs manage their own UI) */}
      <Stack.Screen
        name="Tabbar"
        component={TabNavigation}
        options={{ headerShown: false }}
      />

      {/* Dashboard Detail Screen */}
      <Stack.Screen
        name="DashboardDetail"
        component={Dashboard}
        options={{ headerShown: false }}
      />

      {/* Vehicle Detail Screen */}
      <Stack.Screen
        name="VehicleDetail"
        component={Vehicle}
        options={{ headerShown: false }}
      />

      {/* Settings Detail Screen */}
      <Stack.Screen
        name="SettingsDetail"
        component={Settings}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};


export default StackNavigation;