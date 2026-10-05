import * as React from "react";
import Svg, { Path } from "react-native-svg";
import { accent } from '../../theme/accent';

const FuelIcon = ({ color = accent.primary, size = 22, ...props }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
    <Path d="M3 22V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M3 22h10" stroke={color} strokeWidth={2} strokeLinecap="round" />
    <Path d="M5 9h6" stroke={color} strokeWidth={2} strokeLinecap="round" />
    <Path d="M13 8l3.5 2v7a1.5 1.5 0 0 0 3 0v-6.5L17 8" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export default FuelIcon;
