import * as React from 'react';
import Svg, { Path } from 'react-native-svg';
import { accent } from '../../theme/accent';

// Tray with a downward arrow — the "save to device" glyph.
const DownloadIcon = ({ size = 18, color = accent.primary, strokeWidth = 1.8, ...props }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
    <Path
      d="M12 3v12M12 15l-4.5-4.5M12 15l4.5-4.5"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M4 13v5a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-5"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export default DownloadIcon;
