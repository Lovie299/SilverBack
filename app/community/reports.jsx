// app/community/reports.jsx — Historic reports list ("See all" / Reports).
// Live Firestore mirror of every report the signed-in user has submitted,
// newest first; tapping a row opens the detailed view.

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Bird } from 'lucide-react-native';

import { useAuth } from '../contexts/AuthContext';
import { colors, radius, fonts, alpha } from '../../components/ui/theme';
import { AppBar } from '../../components/ui/Primitives';
import { ReportRow, useMySightings } from './index';

export default function MyReports() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation();
  const sightings = useMySightings(user?.uid);

  return (
    <View style={styles.root}>
      <AppBar title={t('reports.title')} subtitle={t('reports.subtitle')} back="/community" />
      <ScrollView contentContainerStyle={styles.list}>
        {sightings.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Bird size={28} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>{t('reports.empty')}</Text>
            <Text style={styles.emptyBody}>{t('dashboard.noReports')}</Text>
          </View>
        ) : (
          sightings.map((sighting) => (
            <ReportRow
              key={sighting.id}
              sighting={sighting}
              onPress={() =>
                router.push({ pathname: '/community/report/[id]', params: { id: sighting.id } })
              }
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  list: { paddingHorizontal: 20, paddingBottom: 24, gap: 8 },
  empty: { alignItems: 'center', paddingVertical: 64, paddingHorizontal: 40 },
  emptyIcon: {
    height: 64,
    width: 64,
    borderRadius: radius.lg,
    backgroundColor: alpha(colors.primary, 0.1),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 16, fontFamily: fonts.displayBold, color: colors.foreground },
  emptyBody: {
    fontSize: 13,
    color: colors.mutedForeground,
    fontFamily: fonts.regular,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
  },
});
