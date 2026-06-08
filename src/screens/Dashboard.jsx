import {
  StyleSheet,
  Text,
  View,
  Animated,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Typography } from '../styles/typography.js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GlobalStyles } from '../styles/globalStyles';
import Header from '../components/Header';
import { useSelector } from 'react-redux';
import { themecolors } from '../styles/themecolors.js';
import DashBoardIcon from '../assets/svg/DashBoardIcon.jsx';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const Dashboard = () => {
  const { theme } = useSelector((store) => store.theme);
  const [cachTheme, setCachTheme] = useState(null);

  useEffect(() => {
    const fetchTheme = async () => {
      const storedTheme = await AsyncStorage.getItem('theme');
      setCachTheme(storedTheme);
      console.log('Dashboard Theme::', storedTheme);
    };
    fetchTheme();
  }, []);

  const chartData = [
    { month: 'Jan', value: 52000 },
    { month: 'Feb', value: 62000 },
    { month: 'Mar', value: 39000 },
    { month: 'Apr', value: 46000 },
    { month: 'May', value: 31000 },
    { month: 'Jun', value: 56000 },
    { month: 'Jul', value: 39000 },
    { month: 'Aug', value: 23000 },
    { month: 'Sep', value: 42000 },
    { month: 'Oct', value: 30000 },
    { month: 'Nov', value: 0 },
    { month: 'Dec', value: 0 },
  ];

  const maxValue = 70000;
  const yAxisLabels = ['70k', '65k', '60k', '55k', '50k', '45k', '40k', '35k', '30k', '25k', '20k', '15k', '10k', '5k', '0'];

  const barAnimations = useRef(
    chartData.map(() => new Animated.Value(0))
  ).current;

  useEffect(() => {
    const animations = barAnimations.map((anim, index) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 800,
        delay: index * 80,
        useNativeDriver: false,
      })
    );
    Animated.stagger(50, animations).start();
  }, []);

  const AnimatedBar = ({ item, index }) => {
    const barHeight = barAnimations[index].interpolate({
      inputRange: [0, 1],
      outputRange: ['0%', `${(item.value / maxValue) * 100}%`],
    });

    const isDark = theme === 'dark';

    return (
      <View style={styles.barColumn}>
        <View style={styles.barTrack}>
          <Animated.View
            style={[
              styles.barFill,
              {
                height: barHeight,
                backgroundColor: isDark ? '#1E6FDB' : '#0056B3',
              },
            ]}
          />
        </View>
        <Text
          style={[
            styles.barLabel,
            {
              color: isDark ? '#8A9BB0' : '#6B7B8D',
            },
          ]}
        >
          {item.month}
        </Text>
      </View>
    );
  };

  const YAxisLabel = ({ label }) => {
    const isDark = theme === 'dark';
    return (
      <View style={styles.yAxisRow}>
        <View
          style={[
            styles.gridLine,
            {
              backgroundColor: isDark ? '#2A3A4A' : '#E8ECF0',
            },
          ]}
        />
        <Text
          style={[
            styles.yAxisText,
            {
              color: isDark ? '#5A6B7D' : '#9AA5B1',
            },
          ]}
        >
          {label}
        </Text>
      </View>
    );
  };

  return (
    <View style={GlobalStyles.screen}>
      <View
        style={[
          GlobalStyles.BodyContainer,
          {
            backgroundColor:
              theme === 'dark' ? themecolors.blackBlue : themecolors.white,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <View style={styles.titleContainer}>
            <DashBoardIcon />
            <Text
              style={{
                color: theme === 'dark' ? themecolors.white : themecolors.darkBlue,
                fontSize: 18,
                fontFamily: Typography.font.regular,
              }}
            >
              Expense Dashboard
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.chartCard,
            {
              backgroundColor: theme === 'dark' ? '#162236' : '#FFFFFF',
              borderColor: theme === 'dark' ? '#1E2D42' : '#E2E8F0',
            },
          ]}
        >
          <View style={styles.chartHeader}>
            <Text
              style={[
                styles.chartTitle,
                {
                  color: theme === 'dark' ? '#FFFFFF' : '#1A202C',
                },
              ]}
            >
              Monthly Expenses
            </Text>
            <TouchableOpacity activeOpacity={0.7} style={styles.dropdownButton}>
              <Text style={styles.dropdownText}>Last 12 Months</Text>
              <Text style={styles.dropdownIcon}>⟳</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.chartBody}>
            {/* BARS on the LEFT */}
            <View style={styles.barsContainer}>
              {chartData.map((item, index) => (
                <AnimatedBar key={item.month} item={item} index={index} />
              ))}
            </View>

            {/* Y-AXIS on the RIGHT */}
            <View style={styles.yAxisContainer}>
              {yAxisLabels.map((label) => (
                <YAxisLabel key={label} label={label} />
              ))}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};

export default Dashboard;

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chartCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  chartTitle: {
    fontSize: 20,
    fontFamily: Typography.font.semiBold || Typography.font.regular,
    fontWeight: '600',
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dropdownText: {
    fontSize: 13,
    color: '#007AFF',
    fontFamily: Typography.font.medium || Typography.font.regular,
    fontWeight: '500',
  },
  dropdownIcon: {
    fontSize: 12,
    color: '#007AFF',
  },
  chartBody: {
    flexDirection: 'row',
    height: 320,
  },
  // BARS on the left
  barsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingBottom: 24,
    paddingRight: 8,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  barTrack: {
    width: '65%',
    height: '100%',
    justifyContent: 'flex-end',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  barLabel: {
    fontSize: 11,
    fontFamily: Typography.font.regular,
    marginTop: 8,
    textAlign: 'center',
  },
  // Y-AXIS on the right
  yAxisContainer: {
    width: 45,
    height: '100%',
    justifyContent: 'space-between',
    paddingBottom: 24,
  },
  yAxisRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 20,
  },
  gridLine: {
    flex: 1,
    height: 1,
  },
  yAxisText: {
    fontSize: 10,
    fontFamily: Typography.font.regular,
    width: 30,
    textAlign: 'left',
    paddingLeft: 6,
  },
});