// app/community/alerts.jsx — Community Alerts
// (matches silverbacksentry.lovable.app "/community/alerts")
// Filter chips + tone-coded alert cards with zone and time metadata.

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Bell, MapPin, Megaphone, OctagonAlert } from 'lucide-react-native';

import { colors, radius, fonts, alpha } from '../../components/ui/theme';
import { AppBar, Badge, Card } from '../../components/ui/Primitives';
import { useUserPrefs } from '../../components/ui/userPrefs';

const FILTERS = ['All', 'Wildlife', 'Safety', 'Patrols', 'Trapping'];

const ALERTS = [
  {
    icon: OctagonAlert,
    title: 'Elephant herd movement',
    body: 'Herd of ~12 elephants heading toward Kichwamba village. Keep distance.',
    time: '10 min ago',
    zone: 'Kichwamba',
    tone: 'danger',
  },
  {
    icon: Megaphone,
    title: 'Buffalo sighting',
    body: 'Single buffalo seen near the river crossing.',
    time: '2 hr ago',
    zone: 'Buliisa',
    tone: 'warning',
  },
  {
    icon: Bell,
    title: 'Ranger patrol scheduled',
    body: 'Patrol team in your area today from 14:00 to 18:00.',
    time: 'Today',
    zone: 'Pakwach',
    tone: 'info',
  },
  {
    icon: OctagonAlert,
    title: 'Snare trap warning',
    body: 'Multiple snares discovered. Report any you find.',
    time: 'Yesterday',
    zone: 'Wairingo',
    tone: 'danger',
  },
];

const toneStyles = {
  danger: { bg: alpha(colors.destructive, 0.15), fg: colors.destructive, badge: 'Urgent' },
  warning: { bg: alpha(colors.warning, 0.25), fg: colors.foreground, badge: 'Caution' },
  info: { bg: alpha(colors.info, 0.15), fg: colors.info, badge: 'Info' },
};

export default function CommunityAlerts() {
  const prefs = useUserPrefs();
  const [filter, setFilter] = useState('All');

  return (
    <View style={styles.root}>
      <AppBar title="Community Alerts" subtitle={`Alerts in ${prefs.park}`} back="/community" />
      <ScrollView contentContainerStyle={styles.list}>
        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {FILTERS.map((f) => {
            const active = filter === f;
            return (
              <TouchableOpacity
                key={f}
                onPress={() => setFilter(f)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{f}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {ALERTS.map((alert, index) => {
          const t = toneStyles[alert.tone];
          const Icon = alert.icon;
          return (
            <Card key={index} style={styles.alertCard}>
              <View style={styles.alertRow}>
                <View style={[styles.alertIcon, { backgroundColor: t.bg }]}>
                  <Icon size={18} color={t.fg} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.alertHead}>
                    <Text numberOfLines={1} style={styles.alertTitle}>
                      {alert.title}
                    </Text>
                    <Badge tone={alert.tone}>{t.badge}</Badge>
                  </View>
                  <Text style={styles.alertBody}>{alert.body}</Text>
                  <View style={styles.alertMetaRow}>
                    <MapPin size={11} color={colors.mutedForeground} />
                    <Text style={styles.alertMeta}>{alert.zone}</Text>
                    <Text style={styles.alertMeta}>·</Text>
                    <Text style={styles.alertMeta}>{alert.time}</Text>
                  </View>
                </View>
              </View>
            </Card>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  list: { paddingHorizontal: 20, paddingBottom: 24, gap: 12 },
  chips: { gap: 8, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.secondary,
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 12, fontFamily: fonts.semibold, color: colors.mutedForeground },
  chipTextActive: { color: colors.primaryForeground },
  alertCard: { padding: 16 },
  alertRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  alertIcon: {
    height: 40,
    width: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  alertTitle: {
    flexShrink: 1,
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.foreground,
  },
  alertBody: {
    fontSize: 12,
    color: colors.mutedForeground,
    fontFamily: fonts.regular,
    marginTop: 4,
    lineHeight: 17,
  },
  alertMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  alertMeta: { fontSize: 11, color: colors.mutedForeground, fontFamily: fonts.regular },
});
