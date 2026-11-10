import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { NativeAd, NativeAdView, NativeAsset, NativeAssetType } from 'react-native-google-mobile-ads';
import { useAppTheme } from '../theme/useAppTheme';

// Native ads aren't refreshed by the SDK the way banners are.
const REFRESH_MS = 90 * 1000;
const ICON = 40;

/**
 * A one-row native ad drawn in the app's own colours (Google's "small
 * template" layout): icon, "Ad" label, headline, one line of text and the
 * call-to-action button. The SDK adds the AdChoices icon itself.
 * `onLoaded` fires when an ad arrives, so the parent can open its slot.
 */
const NativeAdStrip = ({ unitId, height, onLoaded }) => {
  const t = useAppTheme();
  const [ad, setAd] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let current = null;
    const load = () => {
      NativeAd.createForAdRequest(unitId)
        .then(next => {
          if (cancelled) { next.destroy(); return; }
          const old = current;
          current = next;
          setAd(next);
          onLoaded?.();
          // The old ad is released after the new one is on screen.
          setTimeout(() => old?.destroy(), 0);
        })
        .catch(err => {
          console.log('Native ad failed to load:', err);
          // A previous ad, if any, stays on screen; with none, the slot stays closed.
        });
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
      current?.destroy();
    };
  }, [unitId, onLoaded]);

  if (!ad) return null;

  const line = ad.body || ad.advertiser || ad.store || '';

  return (
    <NativeAdView nativeAd={ad} style={[styles.row, { height }]}>
      {ad.icon?.url ? (
        <NativeAsset assetType={NativeAssetType.ICON}>
          <Image source={{ uri: ad.icon.url }} style={[styles.icon, { backgroundColor: t.screenBg }]} />
        </NativeAsset>
      ) : null}
      <View style={styles.texts}>
        <View style={styles.titleRow}>
          <View style={[styles.badge, { borderColor: t.link }]}>
            <Text style={[styles.badgeText, { color: t.link }]}>Ad</Text>
          </View>
          <NativeAsset assetType={NativeAssetType.HEADLINE}>
            <Text numberOfLines={1} style={[styles.headline, { color: t.text }]}>{ad.headline}</Text>
          </NativeAsset>
        </View>
        {line ? (
          <NativeAsset assetType={ad.body ? NativeAssetType.BODY : ad.advertiser ? NativeAssetType.ADVERTISER : NativeAssetType.STORE}>
            <Text numberOfLines={1} style={[styles.body, { color: t.textMuted }]}>{line}</Text>
          </NativeAsset>
        ) : null}
      </View>
      {ad.callToAction ? (
        <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
          <Text
            numberOfLines={1}
            style={[styles.cta, { backgroundColor: t.primary, color: t.onPrimary }]}
          >
            {ad.callToAction.toUpperCase()}
          </Text>
        </NativeAsset>
      ) : null}
    </NativeAdView>
  );
};

export default NativeAdStrip;

const styles = StyleSheet.create({
  row: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
    // Room on the right for the AdChoices icon the SDK places in the corner.
    paddingRight: 24,
    gap: 10,
  },
  icon: { width: ICON, height: ICON, borderRadius: 8 },
  texts: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  headline: { flexShrink: 1, fontSize: 14, fontWeight: '600' },
  body: { fontSize: 12, marginTop: 2 },
  cta: {
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    overflow: 'hidden',
  },
});
