// app/community/index.jsx — Community dashboard
// (matches silverbacksentry.lovable.app "/community")
// Forest header with greeting + overlapping impact card, alerts entry row,
// quick-report tiles, recent reports, and nearby-alert map card.

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Bird,
  Camera,
  ChevronRight,
  Leaf,
  MapPin,
  Megaphone,
  Receipt,
  TreePine,
  TriangleAlert,
} from 'lucide-react-native';

import { useAuth } from '../contexts/AuthContext';
import { colors, gradients, radius, fonts, alpha, shadowCard } from '../../components/ui/theme';
import { Badge, Card } from '../../components/ui/Primitives';
import { useUserPrefs, initials } from '../../components/ui/userPrefs';

export default function CommunityDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const prefs = useUserPrefs();
  const { user } = useAuth();

  const fullName = user?.displayName || prefs.fullName;
  const firstName = fullName.split(/\s+/)[0] || 'Friend';

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 24 }}>
      <Stack.Screen options={{ statusBarStyle: 'light' }} />
      {/* ---------- Header ---------- */}
      <LinearGradient
        colors={gradients.forest}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={{ paddingTop: insets.top + 12 }}>
          <View style={styles.greetingRow}>
            <TouchableOpacity
              onPress={() => router.push('/community/profile')}
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>{initials(fullName)}</Text>
            </TouchableOpacity>
            <View style={{ flexShrink: 1 }}>
              <Text numberOfLines={1} style={styles.greeting}>
                Hi, {firstName}
              </Text>
              <Text numberOfLines={1} style={styles.greetingMeta}>
                {prefs.park} · {prefs.language}
              </Text>
            </View>
          </View>
        </View>

        {/* Impact card overlapping the header edge */}
        <View style={styles.impactWrap}>
          <Card style={styles.impactCard}>
            <View style={styles.impactIcon}>
              <TreePine size={22} color={colors.accentForeground} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.impactLabel}>Community impact this month</Text>
              <Text style={styles.impactValue}>12 reports · 4 resolved</Text>
            </View>
            <Badge tone="success">+18%</Badge>
          </Card>
        </View>
      </LinearGradient>

      <View style={styles.content}>
        {/* ---------- Community alerts row ---------- */}
        <TouchableOpacity activeOpacity={0.8} onPress={() => router.push('/community/alerts')}>
          <Card style={styles.alertsRow}>
            <LinearGradient
              colors={gradients.infoTile}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.alertsIcon}
            >
              <Megaphone size={22} color={colors.white} />
            </LinearGradient>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.alertsTitle}>Community Alerts</Text>
              <Text style={styles.alertsMeta}>3 new alerts in {prefs.park}</Text>
            </View>
            <Badge tone="danger">3</Badge>
            <ChevronRight size={16} color={colors.mutedForeground} />
          </Card>
        </TouchableOpacity>

        {/* ---------- Quick report tiles ---------- */}
        <View>
          <Text style={styles.sectionTitle}>Quick report</Text>
          <View style={styles.tileRow}>
            <QuickTile
              onPress={() => router.push('/community/sighting')}
              gradient={gradients.primaryTile}
              icon={Camera}
              label={'Wildlife\nSighting'}
            />
            <QuickTile
              onPress={() => router.push('/community/conflict')}
              gradient={gradients.dangerTile}
              icon={TriangleAlert}
              label={'Human–Wildlife\nConflict'}
            />
            <QuickTile
              onPress={() => router.push('/community/claim')}
              gradient={gradients.accentTile}
              icon={Receipt}
              label={'Compensation\nClaim'}
              darkText
            />
          </View>
        </View>

        {/* ---------- Recent reports ---------- */}
        <View>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>My recent reports</Text>
            <Text style={styles.seeAll}>See all</Text>
          </View>
          <View style={{ gap: 8 }}>
            <ReportRow
              icon={Bird}
              tone="success"
              title="Grey Crowned Crane sighting"
              meta="Today · 08:12 · Buliisa"
              status="Confirmed"
            />
            <ReportRow
              icon={TriangleAlert}
              tone="warning"
              title="Elephants near maize field"
              meta="Yesterday · Kichwamba"
              status="In Review"
            />
            <ReportRow
              icon={Leaf}
              tone="danger"
              title="Snare trap found"
              meta="2 days ago · Wairingo"
              status="Escalated"
            />
          </View>
        </View>

        {/* ---------- Nearby alert / live map card ---------- */}
        <Card style={{ padding: 16 }}>
          <View style={styles.nearbyRow}>
            <View style={styles.nearbyIcon}>
              <MapPin size={16} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.nearbyTitle}>Nearby alert</Text>
              <Text style={styles.nearbyMeta}>Elephant herd movement — 3.2km west</Text>
            </View>
            <ChevronRight size={16} color={colors.mutedForeground} />
          </View>
          <LinearGradient
            colors={gradients.sky}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.mapPreview}
          >
            <Text style={styles.mapPreviewText}>Live community map</Text>
          </LinearGradient>
        </Card>
      </View>
    </ScrollView>
  );
}

/* ---------- Quick-report gradient tile ---------- */

function QuickTile({ onPress, gradient, icon: Icon, label, darkText = false }) {
  const fg = darkText ? colors.foreground : colors.white;
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.tileTouch}>
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.tile}
      >
        <Icon size={20} color={fg} />
        <Text style={[styles.tileLabel, { color: fg }]}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

/* ---------- Recent report row ---------- */

const reportTones = {
  success: { bg: alpha(colors.success, 0.15), fg: colors.success },
  warning: { bg: alpha(colors.warning, 0.25), fg: colors.foreground },
  danger: { bg: alpha(colors.destructive, 0.15), fg: colors.destructive },
};

function ReportRow({ icon: Icon, tone, title, meta, status }) {
  const t = reportTones[tone];
  return (
    <Card style={styles.reportRow}>
      <View style={[styles.reportIcon, { backgroundColor: t.bg }]}>
        <Icon size={18} color={t.fg} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={styles.reportTitle}>
          {title}
        </Text>
        <Text style={styles.reportMeta}>{meta}</Text>
      </View>
      <Badge tone={tone}>{status}</Badge>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    paddingBottom: 64,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  avatar: {
    height: 44,
    width: 44,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.white, fontSize: 14, fontFamily: fonts.bold },
  greeting: { color: colors.white, fontSize: 20, fontFamily: fonts.displayBold },
  greetingMeta: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: fonts.regular },
  impactWrap: { paddingHorizontal: 20, marginBottom: -40 },
  impactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  impactIcon: {
    height: 48,
    width: 48,
    borderRadius: radius.lg,
    backgroundColor: alpha(colors.accent, 0.2),
    alignItems: 'center',
    justifyContent: 'center',
  },
  impactLabel: { fontSize: 12, color: colors.mutedForeground, fontFamily: fonts.regular },
  impactValue: { fontSize: 17, color: colors.foreground, fontFamily: fonts.bold, marginTop: 2 },
  content: { paddingHorizontal: 20, paddingTop: 64, gap: 20 },
  alertsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  alertsIcon: {
    height: 48,
    width: 48,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertsTitle: { fontSize: 14, fontFamily: fonts.bold, color: colors.foreground },
  alertsMeta: { fontSize: 11, color: colors.mutedForeground, fontFamily: fonts.regular, marginTop: 2 },
  sectionTitle: { fontSize: 14, fontFamily: fonts.bold, color: colors.foreground, marginBottom: 12 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  seeAll: { fontSize: 12, fontFamily: fonts.semibold, color: colors.primary },
  tileRow: { flexDirection: 'row', gap: 12 },
  tileTouch: { flex: 1 },
  tile: {
    borderRadius: radius.lg,
    padding: 12,
    minHeight: 120,
    justifyContent: 'space-between',
    ...shadowCard,
  },
  tileLabel: { fontSize: 12, fontFamily: fonts.bold, lineHeight: 16 },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
  },
  reportIcon: {
    height: 40,
    width: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportTitle: { fontSize: 14, fontFamily: fonts.semibold, color: colors.foreground },
  reportMeta: { fontSize: 11, color: colors.mutedForeground, fontFamily: fonts.regular, marginTop: 2 },
  nearbyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  nearbyIcon: {
    height: 36,
    width: 36,
    borderRadius: radius.md,
    backgroundColor: alpha(colors.primary, 0.1),
    alignItems: 'center',
    justifyContent: 'center',
  },
  nearbyTitle: { fontSize: 14, fontFamily: fonts.semibold, color: colors.foreground },
  nearbyMeta: { fontSize: 12, color: colors.mutedForeground, fontFamily: fonts.regular, marginTop: 2 },
  mapPreview: {
    height: 96,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPreviewText: { fontSize: 12, fontFamily: fonts.semibold, color: 'rgba(255,255,255,0.9)' },
});
