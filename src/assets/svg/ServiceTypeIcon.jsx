import * as React from "react";
import Svg, { Path, Circle, Rect } from "react-native-svg";
import { accent } from '../../theme/accent';
import { getServiceIconKey } from '../../util/serviceFields';

// One line glyph per service type (24×24, stroke-only so `color` tints it).
// Keys match `icon` on each entry in serviceFields.js SERVICE_TYPES.
const p = d => ({ el: 'path', d });
const c = (cx, cy, r) => ({ el: 'circle', cx, cy, r });

const GLYPHS = {
  oil: [p('M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z')],
  oilFilter: [
    { el: 'rect', x: 6, y: 5, width: 12, height: 16, rx: 2 },
    p('M6 9.5h12M6 16.5h12M10 5V3h4v2'),
  ],
  airFilter: [p('M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2M9.6 4.6A2 2 0 1 1 11 8H2M12.6 19.4A2 2 0 1 0 14 16H2')],
  cabinFilter: [
    { el: 'rect', x: 3, y: 3, width: 18, height: 18, rx: 2 },
    p('M3 9h18M3 15h18M9 3v18M15 3v18'),
  ],
  fuelFilter: [p('M22 3H2l8 9.46V19l4 2v-8.54L22 3z')],
  gearOil: [
    c(12, 12, 3),
    c(12, 12, 7),
    p('M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1'),
  ],
  coolant: [p('M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0zM10 9h4')],
  brakeFluid: [p('M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3M7.5 15h9')],
  steering: [c(12, 12, 9), c(12, 12, 2), p('M3.3 10H10M14 10h6.7M12 14v7')],
  tire: [c(12, 12, 9), c(12, 12, 5), c(12, 12, 1.5)],
  rotation: [p('M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M8 16H3v5')],
  alignment: [c(12, 12, 9), c(12, 12, 2), p('M22 12h-4M6 12H2M12 6V2M12 22v-4')],
  puncture: [c(10, 14, 7), c(10, 14, 2.5), p('M16 3l5 5M18.5 5.5 13.5 10.5')],
  brakePads: [c(11, 13, 8), c(11, 13, 2.5), p('M14.5 2.8a11 11 0 0 1 6.7 6.7')],
  brakeDisc: [c(12, 12, 9), c(12, 12, 3), c(12, 6.5, 0.6), c(17.5, 12, 0.6), c(12, 17.5, 0.6), c(6.5, 12, 0.6)],
  battery: [
    { el: 'rect', x: 3, y: 7, width: 18, height: 13, rx: 2 },
    p('M6.5 7V4.5h3V7M14.5 7V4.5h3V7M6.5 13.5h4M8.5 11.5v4M13.5 13.5h4'),
  ],
  sparkPlug: [p('M13 2 3 14h9l-1 8 10-12h-9l1-8z')],
  bulb: [p('M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5M9 18h6M10 22h4')],
  wiper: [p('M4 19 6 6h12l2 13zM12 19 8.5 10M7.5 11.5l2-3')],
  timingBelt: [c(7, 12, 2.5), c(17, 12, 2.5), p('M7 6.5h10a5.5 5.5 0 0 1 0 11H7a5.5 5.5 0 0 1 0-11z')],
  clutch: [
    c(5, 5, 2), c(12, 5, 2), c(19, 5, 2), c(5, 19, 2), c(12, 19, 2),
    p('M5 7v10M12 7v10M5 12h14M19 7v5'),
  ],
  suspension: [p('M12 2v3M12 19v3M8 5h8M8 19h8M8 5l8 3.5-8 3.5 8 3.5-8 3.5')],
  ac: [p('M2 12h20M12 2v20M4.9 4.9l14.2 14.2M19.1 4.9 4.9 19.1M9 3l3 3 3-3M9 21l3-3 3 3M3 9l3 3-3 3M21 9l-3 3 3 3')],
  tuneUp: [p('M12 14l4-4M3.34 19a10 10 0 1 1 17.32 0'), c(12, 14, 1)],
  service: [p('M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z')],
  inspection: [
    { el: 'rect', x: 8, y: 2, width: 8, height: 4, rx: 1 },
    p('M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 14l2 2 4-4'),
  ],
  wash: [p('M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.13-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0L14.06 8.5A2 2 0 0 0 15.5 9.94l6.14 1.58a.5.5 0 0 1 0 .96L15.5 14.06a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0zM20 3v4M22 5h-4')],
  paint: [p('m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z')],
};

// Pass `icon` (a glyph key) or `name` (a service name — built-in, alias-matched
// custom name, or anything else, which falls back to the wrench).
const ServiceTypeIcon = ({ icon, name, color = accent.primary, size = 22, strokeWidth = 2, ...props }) => {
  const glyph = GLYPHS[icon || getServiceIconKey(name)] || GLYPHS.service;
  const stroke = { stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
      {glyph.map(({ el, ...attrs }, i) => {
        if (el === 'circle') return <Circle key={i} {...attrs} {...stroke} />;
        if (el === 'rect') return <Rect key={i} {...attrs} {...stroke} />;
        return <Path key={i} {...attrs} {...stroke} />;
      })}
    </Svg>
  );
};

export default ServiceTypeIcon;
