// app/index.jsx — Landing page (matches silverbacksentry.lovable.app "/")
// Forest gradient hero with app mark, tagline, and auth CTAs.

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Leaf, ArrowRight } from 'lucide-react-native';

import { colors, gradients, radius, fonts, alpha } from '../components/ui/theme';

export default function Landing() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={gradients.forest}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.root}
    >
      <Stack.Screen options={{ statusBarStyle: 'light' }} />
      {/* Soft glow blobs echoing the web page's blurred circles */}
      <View style={[styles.blob, styles.blobBottomRight]} />
      <View style={[styles.blob, styles.blobTopLeft]} />

      <View style={styles.hero}>
        <View style={styles.logoBox}>
          <Leaf size={48} color={colors.accent} />
        </View>
        <Text style={styles.title}>Wildwatch</Text>
        <Text style={styles.tagline}>
          Protecting wildlife through community-powered reporting and ranger
          response.
        </Text>
      </View>

      <View style={[styles.ctaBlock, { paddingBottom: insets.bottom + 48 }]}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push('/auth')}
          style={styles.primaryCta}
        >
          <Text style={styles.primaryCtaText}>Get Started</Text>
          <ArrowRight size={18} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/auth')} style={styles.secondaryCta}>
          <Text style={styles.secondaryCtaText}>I already have an account</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
  },
  blobBottomRight: {
    bottom: -128,
    right: -80,
    height: 384,
    width: 384,
    backgroundColor: alpha(colors.accent, 0.18),
  },
  blobTopLeft: {
    top: -80,
    left: -80,
    height: 288,
    width: 288,
    backgroundColor: alpha(colors.primaryGlow, 0.28),
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logoBox: {
    height: 96,
    width: 96,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
  },
  title: {
    fontSize: 36,
    color: colors.white,
    fontFamily: fonts.display,
    letterSpacing: -0.5,
  },
  tagline: {
    color: 'rgba(255,255,255,0.8)',
    marginTop: 12,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 260,
    fontFamily: fonts.regular,
  },
  ctaBlock: {
    paddingHorizontal: 24,
    gap: 12,
  },
  primaryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.white,
    paddingVertical: 16,
    borderRadius: radius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  primaryCtaText: {
    color: colors.primary,
    fontSize: 16,
    fontFamily: fonts.semibold,
  },
  secondaryCta: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  secondaryCtaText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontFamily: fonts.medium,
  },
});
