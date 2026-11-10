import React from 'react';
import { StyleSheet, View } from 'react-native';
import SkeletonBlock from '../ui/SkeletonBlock';
import { useSchedulePalette } from './ScheduleParts';

// Loading placeholders for the service schedule screens. Each mirrors the
// real layout (same cards, shadows and spacing) so nothing jumps when the
// data arrives.

const Card = ({ children, style, radius = 20 }) => {
  const p = useSchedulePalette();
  return <View style={[styles.card, { borderRadius: radius, backgroundColor: p.card }, p.shadow, style]}>{children}</View>;
};

const Line = ({ w, h = 12, r = 6, style }) => <SkeletonBlock width={w} height={h} borderRadius={r} style={style} />;
const Dot = ({ size }) => <SkeletonBlock width={size} height={size} borderRadius={size / 2} />;
const Row = ({ children, style }) => <View style={[styles.row, style]}>{children}</View>;

/** Screen 2 card: icon + title + chip, two limit tiles, next due footer. */
const ScheduleCardSkeleton = () => {
  const p = useSchedulePalette();
  return (
    <Card radius={18} style={styles.premium}>
      <Row>
        <Line w={44} h={44} r={14} />
        <View style={[styles.flex, styles.gap6]}>
          <Line w={140} h={14} />
          <Line w={190} h={10} />
        </View>
        <Line w={52} h={24} r={10} />
      </Row>
      <Row>
        {[0, 1].map(i => (
          <View key={i} style={[styles.flex, styles.tileSk, { backgroundColor: p.field }]}>
            <Line w={56} h={9} />
            <Line w={90} h={16} />
            <Line w="100%" h={6} r={3} />
          </View>
        ))}
      </Row>
      <Row style={[styles.footerSk, { borderTopColor: p.cardBorder }]}>
        <View style={[styles.flex, styles.gap6]}>
          <Line w={60} h={9} />
          <Line w={100} h={14} />
        </View>
        <Line w={120} h={24} r={14} />
      </Row>
    </Card>
  );
};

export const ScheduleListSkeleton = () => (
  <View style={styles.list}>
    <ScheduleCardSkeleton />
    <ScheduleCardSkeleton />
  </View>
);

/** Screen 3: hero with ring, two limit tiles, info card, history. */
export const ScheduleDetailSkeleton = () => (
  <View style={styles.stack}>
    <ScheduleEditSkeleton />
    <Line w={70} h={10} style={styles.label} />
    <Card>
      <Row>
        <Dot size={36} />
        <View style={[styles.flex, styles.gap6]}>
          <Line w="70%" h={12} />
          <Line w="45%" h={10} />
        </View>
      </Row>
    </Card>
  </View>
);

/**
 * Schedule page after an edit: only the parts the edit can change (hero,
 * limit tiles, "How it's worked out"). The Completed history stays.
 */
export const ScheduleEditSkeleton = ({ tiles = 2, photo = false }) => (
  <View style={styles.stack} accessible accessibilityLabel="Updating schedule">
    <Card radius={22} style={styles.hero}>
      <Row>
        <Dot size={44} />
        <Line w="45%" h={12} style={styles.flex} />
        <Line w={52} h={24} r={10} />
      </Row>
      <Row style={styles.heroBody}>
        <Dot size={116} />
        <View style={[styles.flex, styles.gap8]}>
          <Line w={70} h={10} />
          <Line w="85%" h={26} r={8} />
          <Line w="55%" h={12} />
          <Line w={120} h={22} r={10} />
        </View>
      </Row>
    </Card>
    <Row style={styles.tiles}>
      {Array.from({ length: Math.max(1, tiles) }).map((_, i) => (
        <Card key={i} radius={18} style={[styles.flex, styles.gap8]}>
          <Line w={60} h={10} />
          <Line w="80%" h={16} />
          <Line w="100%" h={6} r={3} />
          <Line w="90%" h={10} />
        </Card>
      ))}
    </Row>
    {photo && <Line w="100%" h={180} r={16} />}
    <Card>
      <Line w={150} h={14} style={styles.mb8} />
      {[0, 1, 2].map(i => (
        <Row key={i} style={[styles.between, styles.infoRow]}>
          <Line w={80} h={12} />
          <Line w={130} h={12} />
        </Row>
      ))}
    </Card>
  </View>
);

/**
 * Document page after an edit: only the parts the edit can change (hero,
 * validity tile, details card). Photo and history stay on screen.
 */
export const DocumentEditSkeleton = ({ rows = 4 }) => (
  <View style={styles.stack} accessible accessibilityLabel="Updating document">
    <Card radius={22} style={styles.hero}>
      <Row>
        <Dot size={44} />
        <Line w="45%" h={12} style={styles.flex} />
        <Line w={110} h={28} r={14} />
      </Row>
      <Row style={styles.heroBody}>
        <Dot size={116} />
        <View style={[styles.flex, styles.gap8]}>
          <Line w={70} h={10} />
          <Line w="85%" h={26} r={8} />
          <Line w="55%" h={12} />
          <Line w={120} h={22} r={10} />
        </View>
      </Row>
    </Card>
    <Card radius={18} style={styles.gap8}>
      <Line w={60} h={10} />
      <Line w="40%" h={18} />
      <Line w="55%" h={10} />
    </Card>
    <Card>
      <Line w={80} h={14} style={styles.mb8} />
      {Array.from({ length: rows }).map((_, i) => (
        <Row key={i} style={[styles.between, styles.infoRow]}>
          <Line w={100} h={12} />
          <Line w={90} h={12} />
        </Row>
      ))}
    </Card>
  </View>
);

/** Screen 4: numbered section cards with fields. */
export const ScheduleFormSkeleton = () => (
  <View style={styles.stack}>
    <Card>
      <SectionHead />
      <Row style={styles.wrap}>
        {[0, 1, 2, 3].map(i => (
          <Line key={i} w="48%" h={64} r={16} />
        ))}
      </Row>
    </Card>
    <Card>
      <SectionHead />
      <Line w="100%" h={44} r={14} />
      <Row style={styles.tiles}>
        <Line w="48%" h={52} r={12} />
        <Line w="48%" h={52} r={12} />
      </Row>
    </Card>
    <Card>
      <SectionHead />
      <Row style={styles.tiles}>
        <Line w="48%" h={52} r={12} />
        <Line w="48%" h={52} r={12} />
      </Row>
    </Card>
  </View>
);

const SectionHead = () => (
  <Row style={styles.mb8}>
    <Dot size={30} />
    <View style={styles.gap6}>
      <Line w={110} h={14} />
      <Line w={180} h={10} />
    </View>
  </Row>
);

/** Screen 5: rule summary + date / odometer / cost / shop fields. */
export const MarkDoneSkeleton = () => (
  <View style={styles.stack}>
    <Line w="100%" h={64} r={14} />
    {[0, 1].map(i => (
      <Row key={i} style={styles.tiles}>
        {[0, 1].map(j => (
          <View key={j} style={[styles.flex, styles.gap8]}>
            <Line w={80} h={10} />
            <Line w="100%" h={52} r={12} />
          </View>
        ))}
      </Row>
    ))}
    <Line w="100%" h={120} r={14} />
  </View>
);

/** Screen 6: one notification preview card. */
export const NotificationSkeleton = () => (
  <Card radius={18} style={styles.gap8}>
    <Row>
      <SkeletonBlock width={20} height={20} borderRadius={6} />
      <Line w={160} h={10} />
    </Row>
    <Line w="75%" h={14} />
    <Line w="90%" h={10} />
  </Card>
);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { padding: 16, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  between: { justifyContent: 'space-between' },
  wrap: { flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  list: { gap: 12, paddingTop: 12 },
  stack: { gap: 12 },
  hero: { padding: 18, gap: 18 },
  heroBody: { gap: 18 },
  tiles: { gap: 12, justifyContent: 'space-between' },
  limit: { gap: 8, marginTop: 6 },
  infoRow: { paddingVertical: 10 },
  gap6: { gap: 6 },
  premium: { gap: 14 },
  tileSk: { borderRadius: 14, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12, gap: 8 },
  footerSk: { paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  gap8: { gap: 8 },
  mb8: { marginBottom: 8 },
  label: { marginTop: 8 },
});
