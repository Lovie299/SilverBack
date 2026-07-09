// app/community/map.jsx — Live community map (restored).
// react-native-maps view framed on Bwindi Impenetrable National Park:
// park boundary polygon, the user's GPS position, and interactive markers
// for every live sighting document streamed from Firestore.

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView, { Marker, Polygon } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Location from 'expo-location';
import { collection, onSnapshot } from 'firebase/firestore';

import { db } from '../../firebaseConfig';
import { BWINDI_PARK_POLYGON, toLatLng } from '../../lib/geo';
import { colors, fonts, alpha } from '../../components/ui/theme';
import { AppBar } from '../../components/ui/Primitives';

// Centroid-ish region framing the whole park outline.
const INITIAL_REGION = {
  latitude: -0.985,
  longitude: 29.675,
  latitudeDelta: 0.45,
  longitudeDelta: 0.45,
};

export default function LiveMap() {
  const router = useRouter();
  const { t } = useTranslation();
  const [sightings, setSightings] = useState([]);
  const [showUser, setShowUser] = useState(false);

  // Live mirror of every geotagged entry in the sightings collection.
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'sightings'),
      (snapshot) => {
        const docs = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((s) => s.coordinate?.latitude != null);
        setSightings(docs);
      },
      (error) => console.warn('[map] sightings listener error:', error.message),
    );
    return unsubscribe;
  }, []);

  // Blue-dot user position (permission was requested on the /gps screen,
  // but re-request here so deep links straight to the map still work).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (!cancelled && status === 'granted') setShowUser(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const boundary = useMemo(() => BWINDI_PARK_POLYGON.map(toLatLng), []);

  return (
    <View style={styles.root}>
      <AppBar title={t('map.title')} subtitle={t('map.subtitle')} back="/community" />
      <View style={styles.mapWrap}>
        <MapView
          style={StyleSheet.absoluteFill}
          initialRegion={INITIAL_REGION}
          showsUserLocation={showUser}
          showsMyLocationButton
        >
          <Polygon
            coordinates={boundary}
            strokeColor={colors.primary}
            strokeWidth={2}
            fillColor={alpha(colors.primary, 0.12)}
          />
          {sightings.map((sighting) => (
            <Marker
              key={sighting.id}
              coordinate={toLatLng(sighting.coordinate)}
              title={
                sighting.speciesLabel
                  ? `${sighting.speciesLabel} sighting`
                  : sighting.title || 'Wildlife report'
              }
              description={sighting.notes || sighting.behavior || ''}
              pinColor={sighting.type === 'sos' ? colors.destructive : colors.primary}
              onCalloutPress={() =>
                router.push({ pathname: '/community/report/[id]', params: { id: sighting.id } })
              }
            />
          ))}
        </MapView>
        <View style={styles.legend}>
          <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
          <Text style={styles.legendText}>
            {sightings.length} live report{sightings.length === 1 ? '' : 's'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  mapWrap: { flex: 1, marginHorizontal: 20, marginBottom: 16, borderRadius: 16, overflow: 'hidden' },
  legend: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  legendDot: { height: 8, width: 8, borderRadius: 999 },
  legendText: { fontSize: 11, fontFamily: fonts.semibold, color: colors.foreground },
});
