// app/community/report/[id].jsx — Detailed view of a single report.
// Route parameter `id` addresses the Firestore `sightings` document, which is
// mirrored live so ranger status changes appear while the screen is open.

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { doc, onSnapshot } from 'firebase/firestore';
import { MapPin, Mic } from 'lucide-react-native';

import { db } from '../../../firebaseConfig';
import { colors, radius, fonts, alpha } from '../../../components/ui/theme';
import { AppBar, Badge, Card, FieldLabel } from '../../../components/ui/Primitives';
import { formatReportTime, REPORT_STATUS_TONES } from '../index';

export default function ReportDetail() {
  const { id } = useLocalSearchParams();
  const { t } = useTranslation();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return undefined;
    const unsubscribe = onSnapshot(
      doc(db, 'sightings', String(id)),
      (snapshot) => {
        setReport(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
        setLoading(false);
      },
      (error) => {
        console.warn('[report] detail listener error:', error.message);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [id]);

  const status = REPORT_STATUS_TONES[report?.status] ?? REPORT_STATUS_TONES.pending;
  const coordinate = report?.coordinate;

  return (
    <View style={styles.root}>
      <AppBar title={t('reports.detailTitle')} subtitle={report?.speciesLabel} back="/community/reports" />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !report ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>{t('reports.empty')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          <Card style={styles.card}>
            <View style={styles.headRow}>
              <Text style={styles.title}>
                {report.speciesLabel ? `${report.speciesLabel} sighting` : report.title || 'Wildlife report'}
              </Text>
              <Badge tone={status.tone}>{status.label}</Badge>
            </View>
            <Text style={styles.meta}>{formatReportTime(report.timestamp)}</Text>

            {report.count ? (
              <>
                <FieldLabel style={styles.label}>{t('sighting.numberObserved')}</FieldLabel>
                <Text style={styles.value}>{report.count}</Text>
              </>
            ) : null}
            {report.behavior ? (
              <>
                <FieldLabel style={styles.label}>{t('sighting.behavior')}</FieldLabel>
                <Text style={styles.value}>{report.behavior}</Text>
              </>
            ) : null}
            {report.notes ? (
              <>
                <FieldLabel style={styles.label}>{t('sighting.description')}</FieldLabel>
                <Text style={styles.value}>{report.notes}</Text>
              </>
            ) : null}

            {coordinate ? (
              <View style={styles.locationRow}>
                <MapPin size={14} color={colors.primary} />
                <Text style={styles.locationText}>
                  Lat {coordinate.latitude?.toFixed(4)}° · Lon {coordinate.longitude?.toFixed(4)}°
                </Text>
              </View>
            ) : null}
          </Card>

          {Array.isArray(report.images) && report.images.length > 0 ? (
            <Card style={styles.card}>
              <FieldLabel>{t('sighting.photoEvidence')}</FieldLabel>
              <View style={styles.photoGrid}>
                {report.images.map((uri) => (
                  <Image key={uri} source={{ uri }} style={styles.photo} contentFit="cover" />
                ))}
              </View>
            </Card>
          ) : null}

          {report.voiceNoteUrl ? (
            <Card style={styles.card}>
              <FieldLabel>{t('sighting.voiceNote')}</FieldLabel>
              <View style={styles.voiceRow}>
                <View style={styles.voiceIcon}>
                  <Mic size={16} color={colors.primary} />
                </View>
                <Text style={styles.meta}>Voice note attached</Text>
              </View>
            </Card>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 14, color: colors.mutedForeground, fontFamily: fonts.regular },
  list: { paddingHorizontal: 20, paddingBottom: 24, gap: 16 },
  card: { padding: 16, gap: 8 },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    flexShrink: 1,
    fontSize: 16,
    fontFamily: fonts.displayBold,
    color: colors.foreground,
  },
  meta: { fontSize: 12, color: colors.mutedForeground, fontFamily: fonts.regular },
  label: { marginTop: 8 },
  value: { fontSize: 14, color: colors.foreground, fontFamily: fonts.regular },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  locationText: { fontSize: 12, color: colors.mutedForeground, fontFamily: fonts.regular },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  photo: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: radius.md,
    backgroundColor: colors.secondary,
  },
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  voiceIcon: {
    height: 36,
    width: 36,
    borderRadius: radius.full,
    backgroundColor: alpha(colors.primary, 0.1),
    alignItems: 'center',
    justifyContent: 'center',
  },
});
