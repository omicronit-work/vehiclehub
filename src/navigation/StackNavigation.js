import React, { useEffect, useRef, useState } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  View,
  Text,
  Pressable,
  Animated,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';

// Screens
import Home from '../screens/Home';
import Dashboard from '../screens/Dashboard';
import Settings from '../screens/Settings';
import Vehicle from '../screens/Vehicle';
import ScheduleListScreen from '../screens/schedule/ScheduleListScreen';
import ScheduleDetailScreen from '../screens/schedule/ScheduleDetailScreen';
import DocumentDetailScreen from '../screens/schedule/DocumentDetailScreen';
import ScheduleFormScreen from '../screens/schedule/ScheduleFormScreen';
import MarkDoneScreen from '../screens/schedule/MarkDoneScreen';
import ServiceAlertsScreen from '../screens/schedule/ServiceAlertsScreen';
import BackupScreen from '../screens/BackupScreen';
import { flushPendingScheduleLink } from '../util/schedule/scheduleNav';

// Header
import Header from '../components/Header';
import { useReduceMotion } from '../util/methods/useReduceMotion';

// Icons
import HomeIcon from '../assets/svg/HomeIcon';
import DashNav from '../assets/svg/DashNav.jsx';
import VehicleIcon from '../assets/svg/VehicleIcon';
import SettingIcon from '../assets/svg/SettingIcon';
import { accent } from '../theme/accent';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// ─── Design Tokens ────────────────────────────────────────────────────────────
// Single source of truth for both themes. Every color below derives from the
// user's accent colour so the bar reads as one family, not a mix of grays.
// Accent entries are getters so they follow Settings → App Color.


const THEMES = {
  light: {
    barBackground: '#FFFFFF',
    scene: '#F4F7FB',
    get active() { return accent.primary; },
    inactive: '#8A97AB',
    get pill() { return accent.tint; },
    get indicator() { return accent.primary; },
    shadow: '#041933',
  },
  dark: {
    barBackground: '#0A1E3C',
    scene: '#061530',
    get active() { return accent.light; },
    inactive: '#6E7F99',
    get pill() { return accent.lightAlpha(0.18); },
    get indicator() { return accent.light; },
    shadow: '#000000',
  },
};

// ─── Tab Config ───────────────────────────────────────────────────────────────

// remount: rebuilt fresh on every visit from the tab bar (see RemountOnTabPress)
const TAB_SCREENS = [
  { name: 'Home', component: Home, Icon: HomeIcon, remount: true },
  { name: 'Dashboard', component: Dashboard, Icon: DashNav, remount: true },
  { name: 'Vehicle', component: Vehicle, Icon: VehicleIcon, remount: true },
  { name: 'Settings', component: Settings, Icon: SettingIcon, remount: true },
];

// ─── Tab Button ───────────────────────────────────────────────────────────────
// On focus a soft brand-tinted squircle blooms behind the icon. The icon stays
// centered — only the pill scales/fades, driven by one value.

const TabButton = ({ route, Icon, focused, colors, onPress, onLongPress, index, count }) => {
  const progress = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(focused ? 1 : 0);
      return;
    }
    Animated.spring(progress, {
      toValue: focused ? 1 : 0,
      friction: 7,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [focused, progress, reduceMotion]);

  const pillScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={`${route}, tab ${index + 1} of ${count}`}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.tabButton}
      android_ripple={{ color: colors.pill, borderless: true, radius: 40 }}
    >
      {/* Icon with blooming squircle — icon stays centered */}
      <View style={styles.iconStack}>
        <Animated.View
          style={[
            styles.pill,
            {
              backgroundColor: colors.pill,
              opacity: progress,
              transform: [{ scale: pillScale }],
            },
          ]}
        />
        <Icon
          focused={focused}
          fill={focused ? colors.active : colors.inactive}
        />
      </View>

      <Text
        numberOfLines={1}
        style={[
          styles.tabLabel,
          {
            color: focused ? colors.active : colors.inactive,
            fontWeight: focused ? '700' : '500',
          },
        ]}
      >
        {route}
      </Text>
    </Pressable>
  );
};

// ─── Custom Tab Bar ───────────────────────────────────────────────────────────

const CustomTabBar = ({ state, descriptors, navigation, colors, insets }) => (
  <View
    accessibilityRole="tablist"
    style={[
      styles.tabBar,
      {
        backgroundColor: colors.barBackground,
        paddingBottom: Math.max(insets.bottom, 10),
      },
    ]}
  >
    {state.routes.map((route, index) => {
      const focused = state.index === index;
      const { Icon } = TAB_SCREENS.find((t) => t.name === route.name) || {};

      const onPress = () => {
        const event = navigation.emit({
          type: 'tabPress',
          target: route.key,
          canPreventDefault: true,
        });
        if (!focused && !event.defaultPrevented) {
          navigation.navigate(route.name);
        }
      };

      const onLongPress = () => {
        navigation.emit({ type: 'tabLongPress', target: route.key });
      };

      return (
        <TabButton
          key={route.key}
          route={route.name}
          Icon={Icon}
          focused={focused}
          colors={colors}
          onPress={onPress}
          onLongPress={onLongPress}
          index={index}
          count={state.routes.length}
        />
      );
    })}
  </View>
);

// ─── Remount On Visit ─────────────────────────────────────────────────────────
// These tabs are rebuilt from scratch every time the user switches to them
// from the tab bar, so they never show stale state from an earlier visit.
// The key bump and the navigate happen in the same press handler, so React
// batches them: the fresh instance mounts already focused and its
// useFocusEffect hooks run once. Returning from a stack screen (schedule,
// backup) doesn't press a tab, so that keeps the screen as it was.

const RemountOnTabPress = ({ Component, navigation, ...rest }) => {
  const [visit, setVisit] = useState(0);

  useEffect(
    () =>
      navigation.addListener('tabPress', () => {
        if (!navigation.isFocused()) setVisit((v) => v + 1);
      }),
    [navigation]
  );

  return <Component key={visit} navigation={navigation} {...rest} />;
};

// ─── Tab Navigator ────────────────────────────────────────────────────────────

const TabNavigation = ({ setIsLoggedIn }) => {
  const insets = useSafeAreaInsets();
  const { theme } = useSelector((store) => store.theme);
  const colors = THEMES[theme === 'dark' ? 'dark' : 'light'];

  return (
    <View style={[styles.flex, { backgroundColor: colors.scene }]}>
      <Header />

      <Tab.Navigator
        // Back gesture returns to the previously visited tab, not always Home
        backBehavior="history"
        tabBar={(props) => (
          <CustomTabBar {...props} colors={colors} insets={insets} />
        )}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: colors.scene },
        }}
      >
        {TAB_SCREENS.map(({ name, component: Component, remount }) => (
          <Tab.Screen key={name} name={name}>
            {(props) => {
              const extra = name === 'Settings' ? { setIsLoggedIn } : {};
              return remount ? (
                <RemountOnTabPress Component={Component} {...props} {...extra} />
              ) : (
                <Component {...props} {...extra} />
              );
            }}
          </Tab.Screen>
        ))}
      </Tab.Navigator>
    </View>
  );
};

// ─── Stack Navigator ──────────────────────────────────────────────────────────

// Service schedule screens sit above the tabs (full screen, own header).
const StackNavigation = ({ setIsLoggedIn }) => {
  // A notification tapped before sign-in finished opens its schedule now.
  useEffect(() => {
    const timer = setTimeout(() => flushPendingScheduleLink(), 0);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabbar">
        {(props) => <TabNavigation {...props} setIsLoggedIn={setIsLoggedIn} />}
      </Stack.Screen>
      <Stack.Screen name="ScheduleList" component={ScheduleListScreen} />
      <Stack.Screen name="ScheduleDetail" component={ScheduleDetailScreen} />
      <Stack.Screen name="DocumentDetail" component={DocumentDetailScreen} />
      <Stack.Screen name="ScheduleForm" component={ScheduleFormScreen} />
      <Stack.Screen name="ScheduleMarkDone" component={MarkDoneScreen} />
      <Stack.Screen name="ServiceAlerts" component={ServiceAlertsScreen} />
      <Stack.Screen name="Backup" component={BackupScreen} />
    </Stack.Navigator>
  );
};

export default StackNavigation;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 8,
    // Soft upward shadow so the bar floats off the scene
    boxShadow: '0px -4px 12px rgba(4, 25, 51, 0.08)',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center', // vertically center icon + label
    paddingVertical: 8,
  },
  iconStack: {
    width: 64,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
  },
  tabLabel: {
    fontSize: 12,
    letterSpacing: 0.2,
    marginTop: 5,
  },
});


