import * as React from "react";
import Svg, { Path } from "react-native-svg";

const PlusStroke = ({ color = "#fff", size = 20, strokeWidth = 2.2, ...rest }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...rest}>
    <Path
      d="M12 5v14M5 12h14"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
  </Svg>
);

export default PlusStroke;
