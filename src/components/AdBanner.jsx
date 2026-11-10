import React, { useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { useAppTheme } from '../theme/useAppTheme';
import { BANNER_AD_UNIT_ID, NATIVE_AD_UNIT_ID, useAdsState, useSheetOpen } from '../util/ads';
import NativeAdStrip from './NativeAdStrip';

// Clear space between the ad and what's around it: the screen's own buttons
// above (Mark as done, + Service…) and the tab bar below. Taps meant for
// those must never land on the ad (accidental clicks can get the AdMob
// account flagged).
const GAP_ABOVE = 12;
const GAP_BELOW = 10;
// The ad sits in a themed frame (border + surface colour) so whatever the ad
// network serves — a white banner in dark mode, a navy one in light — reads
// as a card that belongs to the app instead of a raw block.
const GUTTER = 12;
const FRAME_BORDER = 1;
const FRAME_RADIUS = 10;
// Height of the ad once one has loaded. Both formats fit inside: the native
// strip is 56 tall and the banner is a fixed 320×50.
const SLOT_HEIGHT = 56;
const FRAME_HEIGHT = SLOT_HEIGHT + 2 * FRAME_BORDER;

// Native ad (drawn in the app's colours) when a native unit is set, else a
// fixed-size banner. No space is reserved: the ad view is mounted (so it can
// load) but collapsed to zero height, and the slot only opens once an ad has
// actually arrived. While consent is pending, while loading, and after a
// no-fill, nothing takes up space. Without consent nothing is rendered.
// `hidden` (keyboard open) collapses it without unmounting, so the loaded ad
// isn't re-requested. While a sheet or dialog is open (see useHideAdsWhile)
// it is invisible and untappable but keeps its height, so the screen behind
// the sheet doesn't jump.
const AdBanner = ({ backgroundColor, hidden = false, style }) => {
  const adsState = useAdsState();
  const sheetOpen = useSheetOpen();
  const t = useAppTheme();
  // Becomes true on the first successful load and stays true: a later
  // refresh that fails leaves the previous ad on screen.
  const [loaded, setLoaded] = useState(false);
  const onLoaded = useCallback(() => setLoaded(true), []);
  if (adsState === false) return null;
  // VH-21: a banner is a finished picture (usually white) that AdMob doesn't
  // allow us to recolour or cover, so in dark mode it shows as a bright strip.
  // Until a native unit is set (NATIVE_AD_UNIT_ID, drawn in the app's own
  // colours), dark mode shows no ad at all — no slot, no empty frame.
  if (t.isDark && !NATIVE_AD_UNIT_ID) return null;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor },
        style,
        (hidden || !loaded) && styles.hidden,
        sheetOpen && styles.invisible,
      ]}
      pointerEvents={sheetOpen || !loaded ? 'none' : 'auto'}
      importantForAccessibility={sheetOpen || !loaded ? 'no-hide-descendants' : 'auto'}
      accessibilityElementsHidden={sheetOpen || !loaded}
    >
      <View
        style={[
          styles.frame,
          { borderColor: t.isDark ? t.divider : t.border, backgroundColor: t.surface },
        ]}
      >
        {adsState === true && NATIVE_AD_UNIT_ID ? (
          <NativeAdStrip unitId={NATIVE_AD_UNIT_ID} height={SLOT_HEIGHT} onLoaded={onLoaded} />
        ) : adsState === true && (
          <BannerAd
            unitId={BANNER_AD_UNIT_ID}
            size={BannerAdSize.BANNER}
            onAdLoaded={onLoaded}
            onAdFailedToLoad={err => console.log('Banner failed to load:', err)}
          />
        )}
      </View>
    </View>
  );
};

export default AdBanner;

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: GAP_ABOVE,
    paddingBottom: GAP_BELOW,
    paddingHorizontal: GUTTER,
  },
  frame: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    height: FRAME_HEIGHT,
    borderWidth: FRAME_BORDER,
    borderRadius: FRAME_RADIUS,
    // Clips the ad's square corners to the rounded frame.
    overflow: 'hidden',
  },
  hidden: {
    height: 0,
    minHeight: 0,
    paddingTop: 0,
    paddingBottom: 0,
    marginTop: 0,
    marginBottom: 0,
    overflow: 'hidden',
  },
  invisible: {
    opacity: 0,
  },
});
