import * as React from 'react';
import Svg, { Path } from 'react-native-svg';

const CloseX = ({ size = 16, color = '#041933', strokeWidth = 1.8, ...props }) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <Path
      d="M1 1L15 15M15 1L1 15"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
  </Svg>
);

export default CloseX;
