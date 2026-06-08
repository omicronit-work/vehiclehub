import * as React from "react";
import Svg, { Path } from "react-native-svg";
const SelectIcon = (props) => (
  <Svg
    width={10}
    height={6}
    viewBox="0 0 10 6"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <Path
      d="M9.625 0.902344L5.27734 4.83984C5.07682 4.98568 4.8763 4.98568 4.67578 4.83984L0.273438 0.902344C0.0911458 0.683594 0.0820312 0.473958 0.246094 0.273438C0.446615 0.0911458 0.65625 0.0820312 0.875 0.246094L4.94922 3.9375L9.02344 0.246094C9.24219 0.0820312 9.45182 0.0911458 9.65234 0.273438C9.81641 0.473958 9.80729 0.683594 9.625 0.902344Z"
      fill={props.color}
      fillOpacity={0.5}
    />
  </Svg>
);
export default SelectIcon;
