import * as React from "react";
import Svg, { Path, Circle, Rect } from "react-native-svg";
import { accent } from '../../theme/accent';
import { getDocumentIconKey } from '../../util/documentFields';

// One line glyph per document type (24×24, stroke-only so `color` tints it).
// Keys match `icon` on each entry in documentFields.js DOCUMENT_TYPES.
const p = d => ({ el: 'path', d });
const c = (cx, cy, r) => ({ el: 'circle', cx, cy, r });
const r = (x, y, width, height, rx) => ({ el: 'rect', x, y, width, height, rx });

const PAGE = 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z';
const FOLD = 'M14 2v6h6';

const GLYPHS = {
  document: [p(PAGE), p(FOLD), p('M8 13h8M8 17h5')],
  taxToken: [r(2, 6, 20, 12, 2), c(12, 12, 2.5), p('M6 12h.01M18 12h.01')],
  fitness: [p(PAGE), p(FOLD), p('M9 15l2 2 4-4')],
  insurance: [p('M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'), p('M9 12l2 2 4-4')],
  registration: [r(2, 5, 20, 14, 2), c(8, 11, 2), p('M5 16c.5-1.5 1.7-2 3-2s2.5.5 3 2M14 10h4M14 14h4')],
  permit: [p('M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z'), p('M9 3v15M15 6v15')],
  licence: [r(2, 5, 20, 14, 2), c(8, 12, 2.5), p('M14 10h5M14 14h3')],
  emission: [p('M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2M9.6 4.6A2 2 0 1 1 11 8H2M12.6 19.4A2 2 0 1 0 14 16H2')],
  warranty: [c(12, 9, 6), p('M8.2 13.9 7 22l5-3 5 3-1.2-8.1')],
  loan: [p('M3 21h18M3 10h18M5 6l7-3 7 3M6 10v8M10 10v8M14 10v8M18 10v8')],
};

// Pass `icon` (a glyph key) or `name` (a document name — built-in, alias-matched
// custom name, or anything else, which falls back to a plain page).
const DocumentTypeIcon = ({ icon, name, color = accent.primary, size = 22, strokeWidth = 2, ...props }) => {
  const glyph = GLYPHS[icon || getDocumentIconKey(name)] || GLYPHS.document;
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

export default DocumentTypeIcon;
