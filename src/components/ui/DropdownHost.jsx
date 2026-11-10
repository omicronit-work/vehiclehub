import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, View } from 'react-native';

// Floating dropdowns that overlap the fields below them and still scroll.
//
// Android only delivers a touch to a view if every ancestor's bounds contain
// it, so a dropdown positioned absolutely inside its field (hanging below the
// field's box) can't be scrolled or reliably tapped. Instead, DropdownHost
// wraps the whole form and draws the open dropdown in a layer that covers the
// form, positioned under its field — inside the host's bounds, so touches
// land. If the dropdown would run past the end of the form (e.g. the last
// field), it opens upward over the fields above instead; only when there's no
// room above either does the host grow to contain it.
//
// Pass the ScrollView's ref as `scrollRef` and an opening dropdown is scrolled
// into view — e.g. a field low on the form, with the keyboard up, would
// otherwise open its list behind the keyboard / footer.
//
//   <DropdownHost scrollRef={scrollRef}> ← direct child of the ScrollView
//     <DropdownAnchor open={…} dropdown={<SuggestionDropdown … />}>
//       <TextInput … />                  ← the field the list hangs under
//     </DropdownAnchor>
//   </DropdownHost>
//
// Without a host above it, DropdownAnchor falls back to rendering the
// dropdown in the layout flow under the field.

const GAP = 4;
const DropdownContext = createContext(null);

export const DropdownHost = ({ children, style, scrollRef }) => {
  const hostRef = useRef(null);
  const [active, setActive] = useState(null); // { id, top, anchorTop, left, width, node }
  const [contentHeight, setContentHeight] = useState(0);
  const [measured, setMeasured] = useState(null); // { id, height } of the open dropdown
  const dropdownHeight = measured && measured.id === active?.id ? measured.height : 0;

  // Below the field when it fits in the form; otherwise above it, overlapping
  // the fields there. Hidden until measured so it never flashes in the wrong spot.
  let top = active?.top ?? 0;
  let overflow = 0;
  if (active && dropdownHeight) {
    const above = active.anchorTop - GAP - dropdownHeight;
    if (active.top + dropdownHeight + 8 <= contentHeight) top = active.top;
    else if (above >= 0) top = above;
    else overflow = active.top + dropdownHeight + 8 - contentHeight;
  }
  const hostY = useRef(0); // host's offset inside the scroll content

  // Latest values for the async measurements below.
  const latest = useRef({});
  latest.current = { active, dropdownHeight, top };

  // Scroll just enough that the open dropdown is fully on screen.
  const ensureVisible = useCallback(() => {
    const { active: cur, dropdownHeight: h, top: dTop } = latest.current;
    const scroll = scrollRef?.current;
    if (!cur || !h || !scroll || !hostRef.current) return;
    const scrollNode = scroll.getNativeScrollRef?.() ?? scroll;
    scrollNode.measureInWindow((sx, sy, sw, sh) => {
      hostRef.current?.measureInWindow((hx, hy) => {
        // Current scroll offset = where the host sits in the content minus
        // where it sits in the viewport.
        const offset = hostY.current - (hy - sy);
        const hiddenAbove = sy - (hy + dTop - 8);
        const hiddenBelow = hy + dTop + h + 8 - (sy + sh);
        if (hiddenAbove > 0) scroll.scrollTo({ y: Math.max(0, offset - hiddenAbove), animated: true });
        else if (hiddenBelow > 0) scroll.scrollTo({ y: offset + hiddenBelow, animated: true });
      });
    });
  }, [scrollRef]);

  useEffect(() => {
    if (active && dropdownHeight) requestAnimationFrame(ensureVisible);
  }, [active?.id, dropdownHeight, top, ensureVisible]); // eslint-disable-line react-hooks/exhaustive-deps

  // The keyboard opens after the field focuses and shrinks the visible area,
  // so check again once it's up.
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => setTimeout(ensureVisible, 80));
    return () => sub.remove();
  }, [ensureVisible]);

  const show = useCallback(entry => setActive(entry), []);
  const hide = useCallback(id => setActive(cur => (cur?.id === id ? null : cur)), []);
  // Stable value: anchors re-register on every render, so a new context
  // object per render would loop.
  const ctx = useMemo(() => ({ hostRef, show, hide }), [show, hide]);

  return (
    <DropdownContext.Provider value={ctx}>
      <View ref={hostRef} collapsable={false} onLayout={e => { hostY.current = e.nativeEvent.layout.y; }}>
        {/* `style` (the form's own spacing) applies to the fields, not the layer. */}
        <View style={style} onLayout={e => setContentHeight(e.nativeEvent.layout.height)}>
          {children}
        </View>
        {overflow > 0 && <View style={{ height: overflow }} />}
        {active && (
          <View
            pointerEvents="box-none"
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, elevation: 1000 }}
          >
            <View
              style={{ position: 'absolute', top, left: active.left, width: active.width, opacity: dropdownHeight ? 1 : 0 }}
              onLayout={e => setMeasured({ id: active.id, height: e.nativeEvent.layout.height })}
            >
              {active.node}
            </View>
          </View>
        )}
      </View>
    </DropdownContext.Provider>
  );
};

let nextId = 0;

export const DropdownAnchor = ({ open, dropdown, children, style }) => {
  const host = useContext(DropdownContext);
  const anchorRef = useRef(null);
  const idRef = useRef(null);
  if (idRef.current === null) idRef.current = ++nextId;
  const [rect, setRect] = useState(null);

  const measure = useCallback(() => {
    if (!host?.hostRef.current || !anchorRef.current) return;
    anchorRef.current.measureLayout(host.hostRef.current, (x, y, width, height) => {
      setRect(prev =>
        prev && prev.x === x && prev.y === y && prev.width === width && prev.height === height
          ? prev
          : { x, y, width, height },
      );
    }, () => {});
  }, [host]);

  useEffect(() => {
    if (open) measure();
  }, [open, measure]);

  // Re-registered on every render so the floating list shows the latest items.
  useEffect(() => {
    if (!host) return;
    const id = idRef.current;
    if (open && rect) {
      host.show({
        id,
        top: rect.y + rect.height + GAP,
        anchorTop: rect.y,
        left: rect.x,
        width: rect.width,
        node: dropdown,
      });
    } else {
      host.hide(id);
    }
  });

  useEffect(() => {
    const id = idRef.current;
    return () => host?.hide(id);
  }, [host]);

  return (
    <View style={style}>
      <View ref={anchorRef} collapsable={false} onLayout={open ? measure : undefined}>
        {children}
      </View>
      {!host && open ? dropdown : null}
    </View>
  );
};
