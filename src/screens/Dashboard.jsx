import React, { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions, Animated, Easing, TouchableOpacity } from 'react-native';
import { useSelector } from 'react-redux';
import { useIsFocused } from '@react-navigation/native'; // Ensures trigger on screen entry
import Svg, { Line, Path, Text as SvgText, TSpan } from 'react-native-svg';

import { GlobalStyles } from '../styles/globalStyles';
import { Typography } from '../styles/typography';
import { themecolors } from '../styles/themecolors';
import DashBoardIcon from '../assets/svg/DashBoardIcon';
import PrevCheck from '../assets/svg/PrevCheck.jsx'
const AnimatedView = Animated.createAnimatedComponent(View);

const Dashboard = () => {
  const { theme } = useSelector((store) => store.theme);
  const { width: windowWidth } = useWindowDimensions();
  const isFocused = useIsFocused(); // Tracks if screen is visible

  // Unified animation tracks
  const barAnim = useRef(new Animated.Value(0)).current;
  const pieAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isFocused) {
      // Reset values before triggering
      barAnim.setValue(0);
      pieAnim.setValue(0);

      // Staggered execution for a smooth cascading appearance
      Animated.stagger(150, [
        Animated.timing(barAnim, {
          toValue: 1,
          duration: 750,
          easing: Easing.out(Easing.cubic), // Clean fluid movement
          useNativeDriver: false, // height/margin requires false, but handled efficiently by layout engine
        }),
        Animated.timing(pieAnim, {
          toValue: 1,
          duration: 850,
          easing: Easing.out(Easing.back(1)), // Subtle elegant snap back effect
          useNativeDriver: true, // Native driver enabled for pure transforms!
        }),
      ]).start();
    }
  }, [isFocused]);

  const chartHeight = 272;
  const rightLabelWidth = 70;
  const cardPadding = 12;
  
  const totalChartAreaWidth = windowWidth - (cardPadding * 2);
  const chartWidth = totalChartAreaWidth - rightLabelWidth;
  
  const monthlyCost = [
    50000, 60000, 38000, 46000,
    30000, 56000, 35000, 20000,
    42000, 25000, 1000, 1000 
  ];

  const catCostData = [
    { label: 'Documents', value: 50000, color: '#F27540', display: '50k' },
    { label: 'Oil & Fluids', value: 45000, color: '#0057C8', display: '45k' },
    { label: 'Tires & Parts', value: 25000, color: '#84C34C', display: '25k' },
  ];

  const totalCost = catCostData.reduce((sum, item) => sum + item.value, 0);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const step = 5000;
  const maxAxisValue = 70000;
  const totalYLines = maxAxisValue / step; 
  
  const totalSlots = months.length + 2; 
  const slotWidth = chartWidth / totalSlots; 
  const barWidth = 14; 

  // --- PIE CHART GEOMETRY ---
  const radius = 90;
  const centerX = 110;
  const centerY = 110;

  let accumulatedAngle = -90; 

  return (
    <ScrollView>
      <View style={GlobalStyles.screen}>
        <View
          style={[
            GlobalStyles.BodyContainer,
            {
              backgroundColor: theme === 'dark' ? themecolors.blackBlue : themecolors.white,
            },
          ]}
        >
          {/* HEADER */}
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

          {/* CARD 1: MONTHLY EXPENSES (NATIVE LAYOUT ANIMATED BARS) */}
          <View style={[styles.card]}>
            <View style={{
              flexDirection:'row',
              justifyContent:'space-between'
            }}>
            <Text style={styles.cardTitle}>Monthly Expenses</Text>

            <TouchableOpacity style={{
              flexDirection:'row',
               paddingTop:5,
               gap:5
            }}>
              <Text style={{
                fontFamily: 'RobotoCondensed400',
                fontSize:10,
                color:'#004EAC',
                 textDecorationLine: 'underline'
              }}>Last 12 Months</Text>
              <View style={{
                paddingTop:3
              }}>
              <PrevCheck/>
              </View>
              
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', height: chartHeight, width: totalChartAreaWidth }}>
              
              {/* Overlay Container containing Absolute Grid and Native Bars */}
              <View style={{ width: chartWidth, height: chartHeight, position: 'relative' }}>
                
                {/* SVG ONLY DRAWS BACKGROUND LINES */}
                <Svg width={chartWidth} height={chartHeight} style={StyleSheet.absoluteFill}>
                  {/* HORIZONTAL GRID LINES */}
                  {Array.from({ length: totalYLines + 1 }).map((_, i) => {
                    if (i === 0 || i === totalYLines) return null; 
                    const y = (chartHeight / totalYLines) * i;
                    return (
                      <Line
                        key={`h-${i}`}
                        x1="0" y1={y} x2={chartWidth} y2={y}
                        stroke="#04193315" strokeWidth="1" strokeDasharray="4,4"
                      />
                    );
                  })}

                  {/* VERTICAL GRID LINES */}
                  {Array.from({ length: totalSlots + 1 }).map((_, i) => {
                    if (i === 0 || i === totalSlots) return null; 
                    const x = i * slotWidth;
                    return (
                      <Line
                        key={`v-${i}`}
                        x1={x} y1="0" x2={x} y2={chartHeight}
                        stroke="#04193315" strokeWidth="1.2" strokeDasharray="8,4"
                      />
                    );
                  })}
                </Svg>

                {/* HIGH FRAME-RATE NATIVE VIEW BARS */}
                <View style={{ flexDirection: 'row', width: chartWidth, height: chartHeight, position: 'absolute' }}>
                  <View style={{ width: slotWidth }} />
                  {monthlyCost.map((value, i) => {
                    const barHeight = (value / maxAxisValue) * chartHeight;
                    const isEmptyPlaceholder = value <= 2000; 
                    const finalBarHeight = isEmptyPlaceholder ? 6 : barHeight;

                    // Compute clean spacing alignments matching the slot setup
                    const marginHorizontal = (slotWidth - barWidth) / 2;

                    const animatedHeight = barAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, finalBarHeight],
                    });

                    const animatedMarginTop = barAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [chartHeight, chartHeight - finalBarHeight],
                    });

                    return (
                      <AnimatedView
                        key={i}
                        style={{
                          width: barWidth,
                          height: animatedHeight,
                          marginTop: animatedMarginTop,
                          marginHorizontal: marginHorizontal,
                          backgroundColor: isEmptyPlaceholder ? "#E9F0F8" : "#004EAB",
                          borderTopLeftRadius: 2,
                          borderTopRightRadius: 2,
                        }}
                      />
                    );
                  })}
                  <View style={{ width: slotWidth }} />
                </View>
              </View>

              {/* RIGHT LABELS */}
              <View style={{ bottom: 8 }}>
                {Array.from({ length: totalYLines + 1 }).map((_, i) => {
                  const value = maxAxisValue - step * i;
                  const formattedValue = value === 0 ? '00' : `${value / 1000}k`;
                  return (
                    <Text
                      key={i}
                      style={{
                        fontSize: 10,
                        color: '#041933',
                        fontFamily: 'RobotoCondensed400',
                        height: chartHeight / totalYLines,
                        textAlignVertical: 'top',
                      }}
                    >
                      <Text style={{ opacity: 0.68 }}>৳ </Text>
                      {formattedValue}
                    </Text>
                  );
                })}
              </View>
            </View>

            {/* MONTH LABELS */}
            <View style={{ flexDirection: 'row', marginTop: 8, width: chartWidth }}>
              <View style={{ width: slotWidth }} /> 
              {months.map((m, i) => (
                <Text
                  key={i}
                  style={{
                    width: slotWidth,
                    fontSize: 10,
                    textAlign: 'center',
                    color: '#041933',
                    fontFamily: 'RobotoCondensed400',
                  }}
                >
                  {m}
                </Text>
              ))}
              <View style={{ width: slotWidth }} /> 
            </View>
          </View>

          {/* CARD 2: EXPENSES BY CATEGORY (PIE CHART) */}
          <View style={styles.card}>
          <View style={{
              flexDirection:'row',
              justifyContent:'space-between'
            }}>
            <Text style={styles.cardTitle}>Expenses by Category</Text>
            <TouchableOpacity style={{
              flexDirection:'row',
               paddingTop:5,
               gap:5
            }}>
              <Text style={{
                fontFamily: 'RobotoCondensed400',
                fontSize:10,
                color:'#004EAC',
                 textDecorationLine: 'underline'
              }}>This Year</Text>
              <View style={{
                paddingTop:3
              }}>
              <PrevCheck/>
              </View>
              
              </TouchableOpacity>

              </View>
            <View style={{ marginTop: 12 }}>

              {/* TOTAL COMPONENT HEADER */}
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 5, marginBottom: 16 }}>
                <Text style={{ fontFamily: 'RobotoCondensed400', fontSize: 14, color: '#041933' }}>
                  <Text style={{ opacity: 0.68 }}>৳ </Text>Total
                </Text>
                <Text style={{ fontFamily: 'RobotoCondensed300', fontWeight: '700', fontSize: 14, color: '#041933' }}>
                  1,20,000
                </Text>
              </View>

              {/* PIE CHART RENDERING */}
              <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: -12 }}>
                
                {/* 100% Native OS thread scale and fade animations */}
                <AnimatedView style={{
                  width: centerX * 2,
                  height: centerY * 2,
                  opacity: pieAnim,
                  transform: [{
                    scale: pieAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 1] // Grows smoothly from 30% scale to full size
                    })
                  }]
                }}>
                  <Svg width={centerX * 2} height={centerY * 2}>
                    {catCostData.map((slice, index) => {
                      const percentage = slice.value / totalCost;
                      const angle = percentage * 360;
                      
                      const startAngleRad = (accumulatedAngle * Math.PI) / 180;
                      const endAngleRad = ((accumulatedAngle + angle) * Math.PI) / 180;

                      const x1 = centerX + radius * Math.cos(startAngleRad);
                      const y1 = centerY + radius * Math.sin(startAngleRad);
                      const x2 = centerX + radius * Math.cos(endAngleRad);
                      const y2 = centerY + radius * Math.sin(endAngleRad);

                      const largeArcFlag = angle > 180 ? 1 : 0;

                      const d = `
                        M ${centerX} ${centerY}
                        L ${x1} ${y1}
                        A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}
                        Z
                      `;

                      const textAngleRad = ((accumulatedAngle + angle / 2) * Math.PI) / 180;
                      const textX = centerX + (radius * 0.6) * Math.cos(textAngleRad);
                      const textY = centerY + (radius * 0.6) * Math.sin(textAngleRad) + 5;

                      accumulatedAngle += angle;

                      return (
                        <React.Fragment key={index}>
                          <Path 
                            d={d} 
                            fill={slice.color} 
                            stroke="#FFF"          
                            strokeWidth={2}        
                            strokeLinejoin="round"
                          />
                          <SvgText
                            x={textX}
                            y={textY}
                            fill="#FFF"
                            fontSize="13"
                            fontWeight="bold"
                            textAnchor="middle" 
                            fontFamily="RobotoCondensed500"
                          >
                            <TSpan opacity="0.85">৳</TSpan>
                            <TSpan dx="2">{slice.display}</TSpan>
                          </SvgText>
                        </React.Fragment>
                      );
                    })}
                  </Svg>
                </AnimatedView>
              </View>

              {/* HORIZONTAL CUSTOM LEGEND */}
              <View style={styles.legendContainer}>
                {catCostData.map((slice, index) => (
                  <View key={index} style={styles.legendItem}>
                    <View style={[styles.legendIndicator, { backgroundColor: slice.color }]} />
                    <Text style={styles.legendText}>{slice.label}</Text>
                  </View>
                ))}
              </View>

            </View>
          </View>

        </View>
      </View>
    </ScrollView>
  );
};

export default Dashboard;

const styles = StyleSheet.create({
  titleContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  card: {
    width: '100%',
    borderColor: '#004EAB33',
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
    marginTop: 20,
    backgroundColor: '#FFF'
  },
  cardTitle: { color: '#041933', fontFamily: 'RobotoCondensed400', fontSize: 16, marginBottom: 16 },
  legendContainer: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 16, marginVertical: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendIndicator: { width: 20, height: 10, borderRadius: 3 },
  legendText: { fontSize: 12, color: '#041933', fontFamily: 'RobotoCondensed400' }
});