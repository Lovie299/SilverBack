// app/community/index.jsx — Community dashboard
// (matches silverbacksentry.lovable.app "/community")
// Forest header with greeting + overlapping impact card, alerts entry row,
// quick-report tiles, live recent reports (Firestore), and nearby-alert map card.

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  Bird,
  Camera,
  ChevronRight,
  MapPin,
  Megaphone,
  Receipt,
  TreePine,
  TriangleAlert,
} from 'lucide-react-native';

import { useAuth } from '../contexts/AuthContext';
import { db } from '../../firebaseConfig';
import { colors, gradients, radius, fonts, alpha, shadowCard } from '../../components/ui/theme';
import { Badge, Card } from '../../components/ui/Primitives';
import { useUserPrefs, initials } from '../../components/ui/userPrefs';

/** Firestore Timestamp | Date | millis → short display string. */
export function formatReportTime(timestamp) {
  const date = timestamp?.toDate ? timestamp.toDate() : timestamp ? new Date(timestamp) : null;
  if (!date) return '';
  const now = new Date();
  const time = date.toTimeString().slice(0, 5);
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);
  if (dayDiff === 0) return `Today · ${time}`;
  if (dayDiff === 1) return `Yesterday · ${time}`;
  return `${date.toLocaleDateString()} · ${time}`;
}

/** Shared status → badge tone mapping for report rows. */
export const REPORT_STATUS_TONES = {
  pending: { tone: 'warning', label: 'Pending' },
  confirmed: { tone: 'success', label: 'Confirmed' },
  investigating: { tone: 'warning', label: 'In Review' },
  resolved: { tone: 'success', label: 'Resolved' },
  escalated: { tone: 'danger', label: 'Escalated' },
};

/**
 * Live "my sightings" hook: mirrors the user's `sightings` documents in
 * real time, newest first. Ordering is done client-side so no composite
 * Firestore index deployment is required for the equality filter.
 */
export function useMySightings(uid) {
  const [sightings, setSightings] = useState([]);
  useEffect(() => {
    if (!uid) {
      setSightings([]);
      return undefined;
    }
    const q = query(collection(db, 'sightings'), where('reporterId', '==', uid));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        docs.sort((a, b) => {
          const ta = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
          const tb = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
          return tb - ta;
        });
        setSightings(docs);
      },
      (error) => console.warn('[dashboard] sightings listener error:', error.message),
    );
    return unsubscribe;
  }, [uid]);
  return sightings;
}

export default function CommunityDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const prefs = useUserPrefs();
  const { user } = useAuth();
  const { t } = useTranslation();

  const fullName = user?.displayName || prefs.fullName;
  const firstName = fullName.split(/\s+/)[0] || 'Friend';

  const sightings = useMySightings(user?.uid);
  const recent = sightings.slice(0, 3);
  const resolvedCount = sightings.filter((s) => s.status === 'resolved').length;

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
                {t('dashboard.greeting', { name: firstName })}
              </Text>
              <Text numberOfLines={1} style={styles.greetingMeta}>
                {prefs.park} · {prefs.language}
              </Text>
            </View>
          </View>
        </View>

        {/* Impact card overlapping the header edge — doubles as the Reports button */}
        <View style={styles.impactWrap}>
          <TouchableOpacity activeOpacity={0.8} onPress={() => router.push('/community/reports')}>
            <Card style={styles.impactCard}>
              <View style={styles.impactIcon}>
                <TreePine size={22} color={colors.accentForeground} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.impactLabel}>{t('dashboard.impactLabel')}</Text>
                <Text style={styles.impactValue}>
                  {sightings.length} reports · {resolvedCount} resolved
                </Text>
              </View>
              <ChevronRight size={16} color={colors.mutedForeground} />
            </Card>
          </TouchableOpacity>
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
              <Text style={styles.alertsTitle}>{t('dashboard.communityAlerts')}</Text>
              <Text style={styles.alertsMeta}>
                {t('dashboard.newAlerts', { count: 3, park: prefs.park })}
              </Text>
            </View>
            <Badge tone="danger">3</Badge>
            <ChevronRight size={16} color={colors.mutedForeground} />
          </Card>
        </TouchableOpacity>

        {/* ---------- Quick report tiles ---------- */}
        <View>
          <Text style={styles.sectionTitle}>{t('dashboard.quickReport')}</Text>
          <View style={styles.tileRow}>
            <QuickTile
              onPress={() => router.push('/community/sighting')}
              gradient={gradients.primaryTile}
              icon={Camera}
              label={t('dashboard.tileSighting')}
            />
            <QuickTile
              onPress={() => router.push('/community/conflict')}
              gradient={gradients.dangerTile}
              icon={TriangleAlert}
              label={t('dashboard.tileConflict')}
            />
            <QuickTile
              onPress={() => router.push('/community/claim')}
              gradient={gradients.accentTile}
              icon={Receipt}
              label={t('dashboard.tileClaim')}
              darkText
            />
          </View>
        </View>

        {/* ---------- Recent reports (live) ---------- */}
        <View>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>{t('dashboard.myRecentReports')}</Text>
            <TouchableOpacity onPress={() => router.push('/community/reports')} hitSlop={8}>
              <Text style={styles.seeAll}>{t('dashboard.seeAll')}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ gap: 8 }}>
            {recent.length === 0 ? (
              <Card style={styles.reportRow}>
                <View style={[styles.reportIcon, { backgroundColor: alpha(colors.primary, 0.1) }]}>
                  <Bird size={18} color={colors.primary} />
                </View>
                <Text style={[styles.reportMeta, { flex: 1 }]}>{t('dashboard.noReports')}</Text>
              </Card>
            ) : (
              recent.map((sighting) => (
                <ReportRow
                  key={sighting.id}
                  sighting={sighting}
                  onPress={() =>
                    router.push({
                      pathname: '/community/report/[id]',
                      params: { id: sighting.id },
                    })
                  }
                />
              ))
            )}
          </View>
        </View>

        {/* ---------- Nearby alert / live map card ---------- */}
        <Card style={{ padding: 16 }}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.nearbyRow}
            onPress={() => router.push('/community/alerts')}
          >
            <View style={styles.nearbyIcon}>
              <MapPin size={16} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.nearbyTitle}>{t('dashboard.nearbyAlert')}</Text>
              <Text style={styles.nearbyMeta}>{t('dashboard.nearbyMeta')}</Text>
            </View>
            <ChevronRight size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.85} onPress={() => router.push('/community/map')}>
            <LinearGradient
              colors={gradients.sky}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.mapPreview}
            >
              <Text style={styles.mapPreviewText}>{t('dashboard.liveMap')}</Text>
            </LinearGradient>
          </TouchableOpacity>
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

/* ---------- Recent report row (live Firestore document) ---------- */

const reportTones = {
  success: { bg: alpha(colors.success, 0.15), fg: colors.success },
  warning: { bg: alpha(colors.warning, 0.25), fg: colors.foreground },
  danger: { bg: alpha(colors.destructive, 0.15), fg: colors.destructive },
};

export function ReportRow({ sighting, onPress }) {
  const status = REPORT_STATUS_TONES[sighting.status] ?? REPORT_STATUS_TONES.pending;
  const t = reportTones[status.tone] ?? reportTones.warning;
  const Icon = sighting.type === 'sos' ? TriangleAlert : Bird;
  const title = sighting.speciesLabel
    ? `${sighting.speciesLabel} sighting`
    : sighting.title || 'Wildlife report';
  const metaParts = [formatReportTime(sighting.timestamp), sighting.park].filter(Boolean);

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress}>
      <Card style={styles.reportRow}>
        <View style={[styles.reportIcon, { backgroundColor: t.bg }]}>
          <Icon size={18} color={t.fg} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={styles.reportTitle}>
            {title}
          </Text>
          <Text numberOfLines={1} style={styles.reportMeta}>
            {metaParts.join(' · ')}
          </Text>
        </View>
        <Badge tone={status.tone}>{status.label}</Badge>
      </Card>
    </TouchableOpacity>
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
