// app/community/sos.jsx — SOS Emergency
// (matches silverbacksentry.lovable.app "/community/sos")
// Press-and-hold (1.5s) SOS button with pulsing halos, live GPS location card,
// haptic dispatch confirmation, and UWA / 999 quick-dial tiles.

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
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { GeoPoint, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { Check, MapPin, OctagonAlert, Phone, Shield } from 'lucide-react-native';

import { useAuth } from '../contexts/AuthContext';
import { db } from '../../firebaseConfig';
import { colors, gradients, radius, fonts, alpha, shadowCard } from '../../components/ui/theme';
import { AppBar, Card } from '../../components/ui/Primitives';
import { useUserPrefs } from '../../components/ui/userPrefs';

const HOLD_DURATION_MS = 1500;

export default function SosEmergency() {
  const prefs = useUserPrefs();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [pressed, setPressed] = useState(false);
  const [position, setPosition] = useState(null);
  const [place, setPlace] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Slow pulse on the outer halo, echoing the web animate-pulse.
  const pulse = useRef(new Animated.Value(0)).current;
  // Pop animation confirming dispatch the moment the hold threshold is hit.
  const confirmScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ]),
    ).start();
  }, [pulse]);

  // Continuous tracking: bind the device's precise GPS fix on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (!cancelled) setLocationError(t('sos.locationDenied'));
        return;
      }
      try {
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        if (cancelled) return;
        setPosition(current);
        try {
          const [geo] = await Location.reverseGeocodeAsync(current.coords);
          if (!cancelled && geo) {
            setPlace(
              [geo.city || geo.subregion || geo.district, geo.region]
                .filter(Boolean)
                .join(', '),
            );
          }
        } catch {
          // Reverse geocoding is cosmetic; coordinates alone are enough.
        }
      } catch (error) {
        if (!cancelled) setLocationError(error.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const dispatchSos = async () => {
    if (sending || sent) return;
    setSending(true);

    // Instant physical confirmation the moment the hold threshold is reached.
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Animated.sequence([
      Animated.spring(confirmScale, { toValue: 1.15, useNativeDriver: true }),
      Animated.spring(confirmScale, { toValue: 1, useNativeDriver: true }),
    ]).start();

    try {
      // Refresh the fix at dispatch time so the payload carries the precise
      // current position, falling back to the mount-time fix.
      let coords = position?.coords ?? null;
      try {
        const fresh = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        coords = fresh.coords;
        setPosition(fresh);
      } catch {
        // keep the previous fix
      }

      await addDoc(collection(db, 'reports'), {
        reporterId: user?.uid ?? 'anonymous',
        type: 'dangerous_sighting',
        severity: 'critical',
        sos: true,
        park: prefs.park,
        coordinate: coords ? new GeoPoint(coords.latitude, coords.longitude) : null,
        accuracy: coords?.accuracy ?? null,
        timestamp: serverTimestamp(),
        isArchived: false,
        status: 'pending',
      });

      setSent(true);
      Alert.alert(t('sos.sent'), t('sos.sentBody'));
    } catch (error) {
      Alert.alert('SOS', `Could not send the alert: ${error.message}`);
    } finally {
      setSending(false);
    }
  };

  const coords = position?.coords;

  return (
    <View style={styles.root}>
      <AppBar title={t('sos.title')} subtitle={t('sos.subtitle')} back="/community" />
      <ScrollView contentContainerStyle={styles.list}>
        <Text style={styles.intro}>{t('sos.intro', { park: prefs.park })}</Text>

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
            onLongPress={dispatchSos}
            delayLongPress={HOLD_DURATION_MS}
          >
            <Animated.View
              style={{ transform: [{ scale: pressed ? 0.95 : 1 }, { scale: confirmScale }] }}
            >
              <LinearGradient
                colors={sent ? gradients.primaryTile : gradients.sos}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sosButton}
              >
                {sent ? (
                  <Check size={40} color={colors.white} />
                ) : (
                  <OctagonAlert size={40} color={colors.white} />
                )}
                <Text style={styles.sosText}>
                  {sent ? t('sos.sent') : sending ? t('sos.sending') : 'SOS'}
                </Text>
              </LinearGradient>
            </Animated.View>
          </Pressable>
        </View>

        {/* ---------- Live location card ---------- */}
        <Card style={styles.locationCard}>
          <View style={styles.locationHead}>
            <MapPin size={14} color={colors.primary} />
            <Text style={styles.locationLabel}>{t('sos.liveLocation')}</Text>
          </View>
          {coords ? (
            <>
              <Text style={styles.locationPlace}>{place ?? prefs.park}</Text>
              <Text style={styles.locationCoords}>
                Lat {coords.latitude.toFixed(4)}° · Lon {coords.longitude.toFixed(4)}°
                {coords.accuracy != null ? ` · ±${Math.round(coords.accuracy)}m` : ''}
              </Text>
            </>
          ) : (
            <Text style={styles.locationPlace}>{locationError ?? t('sos.locating')}</Text>
          )}
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
