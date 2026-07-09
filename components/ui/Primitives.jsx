// components/ui/Primitives.jsx
// Shared UI building blocks ported from the Wildwatch web prototype:
// AppBar, Badge, BottomNav, Card, FieldLabel.

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Home, Map as MapIcon, MessageCircle, Newspaper, OctagonAlert } from 'lucide-react-native';

import { colors, gradients, radius, shadowCard, fonts, alpha } from './theme';

/* ============================== Card ==================================== */

export function Card({ style, children }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/* ============================== Badge =================================== */

const badgeTones = {
  default: { bg: colors.secondary, fg: colors.secondaryForeground },
  success: { bg: alpha(colors.success, 0.15), fg: colors.success },
  warning: { bg: alpha(colors.warning, 0.2), fg: colors.foreground },
  danger: { bg: alpha(colors.destructive, 0.15), fg: colors.destructive },
  info: { bg: alpha(colors.info, 0.15), fg: colors.info },
};

export function Badge({ tone = 'default', children }) {
  const t = badgeTones[tone] ?? badgeTones.default;
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text style={[styles.badgeText, { color: t.fg }]}>{children}</Text>
    </View>
  );
}

/* ============================== AppBar ================================== */

/**
 * Page header: back chip + title + subtitle.
 * `dark` renders on the forest gradient (used by dashboard-style headers).
 */
export function AppBar({ title, subtitle, back, dark = false, right = null }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const fg = dark ? colors.white : colors.foreground;
  const sub = dark ? 'rgba(255,255,255,0.7)' : colors.mutedForeground;

  return (
    <View style={{ paddingTop: insets.top + 8 }}>
      <View style={styles.appBarRow}>
        <View style={styles.appBarLeft}>
          {back ? (
            <TouchableOpacity
              onPress={() => (router.canGoBack() ? router.back() : router.replace(back))}
              style={[
                styles.backChip,
                { backgroundColor: dark ? 'rgba(255,255,255,0.15)' : colors.secondary },
              ]}
            >
              <ChevronLeft size={18} color={fg} />
            </TouchableOpacity>
          ) : null}
          <View style={{ flexShrink: 1 }}>
            <Text numberOfLines={1} style={[styles.appBarTitle, { color: fg }]}>
              {title}
            </Text>
            {subtitle ? (
              <Text numberOfLines={1} style={[styles.appBarSubtitle, { color: sub }]}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
        {right}
      </View>
    </View>
  );
}

/* ============================= BottomNav ================================ */

const NAV_ITEMS = [
  { to: '/community', icon: Home, labelKey: 'nav.home' },
  { to: '/community/feed', icon: Newspaper, labelKey: 'nav.feed' },
  { to: '/community/map', icon: MapIcon, labelKey: 'nav.map' },
  { to: '/community/chat', icon: MessageCircle, labelKey: 'nav.chat' },
  { to: '/community/sos', icon: OctagonAlert, labelKey: 'nav.sos' },
];

export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  return (
    <View style={[styles.navBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.to;
        const isSos = item.labelKey === 'nav.sos';
        const Icon = item.icon;
        const iconBg = isSos
          ? colors.destructive
          : active
            ? colors.primary
            : 'transparent';
        const iconFg = isSos
          ? colors.destructiveForeground
          : active
            ? colors.primaryForeground
            : colors.mutedForeground;
        return (
          <Pressable
            key={item.to}
            onPress={() => router.navigate(item.to)}
            style={styles.navItem}
          >
            <View style={[styles.navIconWrap, { backgroundColor: iconBg }, isSos && shadowCard]}>
              <Icon size={20} color={iconFg} />
            </View>
            <Text
              style={[
                styles.navLabel,
                { color: active ? colors.primary : colors.mutedForeground },
              ]}
            >
              {t(item.labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ============================ FieldLabel ================================ */

export function FieldLabel({ children, style }) {
  return <Text style={[styles.fieldLabel, style]}>{children}</Text>;
}

/* ========================= GradientHeader =============================== */

/** Forest-gradient header block with the big rounded bottom corners. */
export function ForestHeader({ children, style, roundness = 32 }) {
  return (
    <LinearGradient
      colors={gradients.forest}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        { borderBottomLeftRadius: roundness, borderBottomRightRadius: roundness },
        style,
      ]}
    >
      {children}
    </LinearGradient>
  );
}

/* ============================== styles ================================== */

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    ...shadowCard,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: fonts.semibold,
  },
  appBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  appBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 1,
  },
  backChip: {
    height: 36,
    width: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appBarTitle: {
    fontSize: 20,
    fontFamily: fonts.displayBold,
  },
  appBarSubtitle: {
    fontSize: 12,
    fontFamily: fonts.regular,
    marginTop: 2,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  navIconWrap: {
    height: 44,
    width: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLabel: {
    fontSize: 10,
    fontFamily: fonts.semibold,
  },
  fieldLabel: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
