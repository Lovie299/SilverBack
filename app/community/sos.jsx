// app/community/sos.jsx — SOS Emergency
// (matches silverbacksentry.lovable.app "/community/sos")
// Press-and-hold SOS button with pulsing halos, live location card,
// and UWA / 999 quick-dial tiles.

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Animated,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin, OctagonAlert, Phone, Shield } from 'lucide-react-native';

import { colors, gradients, radius, fonts, alpha, shadowCard } from '../../components/ui/theme';
import { AppBar, Card } from '../../components/ui/Primitives';
import { useUserPrefs } from '../../components/ui/userPrefs';

export default function SosEmergency() {
  const prefs = useUserPrefs();
  const [pressed, setPressed] = useState(false);

  // Slow pulse on the outer halo, echoing the web animate-pulse.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ]),
    ).start();
  }, [pulse]);

  return (
    <View style={styles.root}>
      <AppBar title="SOS Emergency" subtitle="One-tap ranger dispatch" back="/community" />
      <ScrollView contentContainerStyle={styles.list}>
        <Text style={styles.intro}>
          Press and hold to alert {prefs.park} rangers with your live location.
        </Text>

        {/* ---------- SOS button with halos ---------- */}
        <View style={styles.sosWrap}>
          <Animated.View
            style={[
              styles.halo,
              styles.haloOuter,
              { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) },
            ]}
          />
          <View style={[styles.halo, styles.haloInner]} />
          <Pressable
            onPressIn={() => setPressed(true)}
            onPressOut={() => setPressed(false)}
            style={{ transform: [{ scale: pressed ? 0.95 : 1 }] }}
          >
            <LinearGradient
              colors={gradients.sos}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.sosButton}
            >
              <OctagonAlert size={40} color={colors.white} />
              <Text style={styles.sosText}>SOS</Text>
            </LinearGradient>
          </Pressable>
        </View>

        {/* ---------- Live location card ---------- */}
        <Card style={styles.locationCard}>
          <View style={styles.locationHead}>
            <MapPin size={14} color={colors.primary} />
            <Text style={styles.locationLabel}>Your live location</Text>
          </View>
          <Text style={styles.locationPlace}>Pakwach, Buliisa District</Text>
          <Text style={styles.locationCoords}>Lat 2.0421°N · Lon 31.4612°E · ±8m</Text>
        </Card>

        {/* ---------- Quick-dial tiles ---------- */}
        <View style={styles.dialRow}>
          <TouchableOpacity style={styles.dialCard} onPress={() => Linking.openURL('tel:0800100199')}>
            <View style={[styles.dialIcon, { backgroundColor: alpha(colors.primary, 0.1) }]}>
              <Shield size={18} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.dialTitle}>UWA</Text>
              <Text style={styles.dialMeta}>Hotline</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dialCard} onPress={() => Linking.openURL('tel:999')}>
            <View style={[styles.dialIcon, { backgroundColor: alpha(colors.destructive, 0.1) }]}>
              <Phone size={18} color={colors.destructive} />
            </View>
            <View>
              <Text style={styles.dialTitle}>999</Text>
              <Text style={styles.dialMeta}>Emergency</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  list: { paddingHorizontal: 20, paddingBottom: 24, gap: 20 },
  intro: {
    textAlign: 'center',
    fontSize: 14,
    color: colors.mutedForeground,
    fontFamily: fonts.regular,
    lineHeight: 21,
  },
  sosWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  halo: { position: 'absolute', borderRadius: 999 },
  haloOuter: {
    height: 256,
    width: 256,
    backgroundColor: alpha(colors.destructive, 0.1),
  },
  haloInner: {
    height: 192,
    width: 192,
    backgroundColor: alpha(colors.destructive, 0.2),
  },
  sosButton: {
    height: 144,
    width: 144,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
  },
  sosText: {
    color: colors.white,
    fontSize: 18,
    fontFamily: fonts.display,
    marginTop: 4,
  },
  locationCard: { padding: 16 },
  locationHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  locationLabel: { fontSize: 12, fontFamily: fonts.semibold, color: colors.mutedForeground },
  locationPlace: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.foreground,
    marginTop: 8,
  },
  locationCoords: {
    fontSize: 11,
    color: colors.mutedForeground,
    fontFamily: fonts.regular,
    marginTop: 2,
  },
  dialRow: { flexDirection: 'row', gap: 12 },
  dialCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 16,
    ...shadowCard,
  },
  dialIcon: {
    height: 40,
    width: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialTitle: { fontSize: 14, fontFamily: fonts.semibold, color: colors.foreground },
  dialMeta: { fontSize: 11, color: colors.mutedForeground, fontFamily: fonts.regular },
});
