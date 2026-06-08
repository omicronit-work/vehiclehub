import * as React from "react";
import Svg, { Path } from "react-native-svg";
const Arrow = (props) => (
  <Svg
    width={7}
    height={14}
    viewBox="0 0 6 10"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <Path
      d="M4.83984 5.25L0.902344 9.625C0.701823 9.80729 0.492188 9.81641 0.273438 9.65234C0.0911458 9.45182 0.0820312 9.24219 0.246094 9.02344L3.9375 4.94922L0.246094 0.875C0.0820312 0.65625 0.0911458 0.446615 0.273438 0.246094C0.492188 0.0820312 0.701823 0.0911458 0.902344 0.273438L4.83984 4.62109C4.98568 4.83984 4.98568 5.04948 4.83984 5.25Z"
      fill={props.color}
    />
  </Svg>
);
export default Arrow;
