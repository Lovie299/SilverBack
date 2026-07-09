// app/gps.jsx — Location permission screen (matches "/gps" on lovable.app)
// Pulsing map-pin hero, benefit cards, and real expo-location permission
// request behind "Allow While Using App".

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { MapPin, Navigation, Shield } from 'lucide-react-native';

import { colors, gradients, radius, fonts, alpha, shadowFloat, shadowCard } from '../components/ui/theme';

export default function GpsPermission() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [requesting, setRequesting] = useState(false);

  // Ping animation for the outer halo, mirroring the web `animate-ping`.
  const ping = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(ping, {
        toValue: 1,
        duration: 1600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ).start();
  }, [ping]);

  const handleAllow = async () => {
    setRequesting(true);
    try {
      await Location.requestForegroundPermissionsAsync();
    } finally {
      setRequesting(false);
      router.replace('/community');
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.center}>
        <View style={styles.heroWrap}>
          <Animated.View
            style={[
              styles.halo,
              {
                backgroundColor: alpha(colors.primary, 0.15),
                transform: [
                  { scale: ping.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }) },
                ],
                opacity: ping.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }),
              },
            ]}
          />
          <View style={[styles.halo, styles.haloInner]} />
          <LinearGradient
            colors={gradients.forest}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.pinCircle}
          >
            <MapPin size={56} color={colors.white} />
          </LinearGradient>
        </View>

        <Text style={styles.title}>Enable Location Access</Text>
        <Text style={styles.body}>
          Wildwatch uses your GPS to accurately tag wildlife sightings and
          incident reports — helping rangers respond faster.
        </Text>

        <View style={styles.benefits}>
          <Benefit icon={Navigation} title="Precise reporting" desc="Tag sightings to exact coordinates" />
          <Benefit icon={Shield} title="Faster response" desc="Rangers see incidents in real time" />
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 40 }]}>
        <TouchableOpacity
          onPress={handleAllow}
          disabled={requesting}
          activeOpacity={0.85}
          style={[styles.allowBtn, requesting && { opacity: 0.7 }]}
        >
          <Text style={styles.allowText}>Allow While Using App</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace('/community')} style={styles.skipBtn}>
          <Text style={styles.skipText}>Not now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Benefit({ icon: Icon, title, desc }) {
  return (
    <View style={styles.benefitCard}>
      <View style={styles.benefitIcon}>
        <Icon size={18} color={colors.primary} />
      </View>
      <View style={{ flexShrink: 1 }}>
        <Text style={styles.benefitTitle}>{title}</Text>
        <Text style={styles.benefitDesc}>{desc}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  heroWrap: {
    height: 176,
    width: 176,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  halo: {
    position: 'absolute',
    height: 176,
    width: 176,
    borderRadius: 999,
  },
  haloInner: {
    height: 152,
    width: 152,
    backgroundColor: alpha(colors.primary, 0.2),
  },
  pinCircle: {
    height: 128,
    width: 128,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadowFloat,
  },
  title: {
    fontSize: 24,
    fontFamily: fonts.display,
    color: colors.foreground,
    textAlign: 'center',
  },
  body: {
    color: colors.mutedForeground,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 12,
    fontFamily: fonts.regular,
  },
  benefits: { marginTop: 32, width: '100%', gap: 12 },
  benefitCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 12,
    ...shadowCard,
  },
  benefitIcon: {
    height: 40,
    width: 40,
    borderRadius: radius.md,
    backgroundColor: alpha(colors.primary, 0.1),
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitTitle: { fontSize: 14, fontFamily: fonts.semibold, color: colors.foreground },
  benefitDesc: { fontSize: 12, color: colors.mutedForeground, fontFamily: fonts.regular, marginTop: 2 },
  footer: { paddingHorizontal: 24, gap: 12 },
  allowBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radius.lg,
    alignItems: 'center',
    shadowColor: '#0b2010',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  allowText: {
    color: colors.primaryForeground,
    fontSize: 16,
    fontFamily: fonts.semibold,
  },
  skipBtn: { alignItems: 'center', paddingVertical: 8 },
  skipText: { color: colors.mutedForeground, fontSize: 14, fontFamily: fonts.medium },
});
