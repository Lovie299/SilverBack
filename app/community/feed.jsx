// app/community/feed.jsx — Community Feed (placeholder in the prototype's
// design language; reachable from the bottom navigation).

import { View, Text, StyleSheet } from 'react-native';
import { Newspaper } from 'lucide-react-native';

import { colors, radius, fonts, alpha } from '../../components/ui/theme';
import { AppBar } from '../../components/ui/Primitives';

export default function CommunityFeed() {
  return (
    <View style={styles.root}>
      <AppBar title="Community Feed" subtitle="Updates from your park" back="/community" />
      <View style={styles.empty}>
        <View style={styles.emptyIcon}>
          <Newspaper size={28} color={colors.primary} />
        </View>
        <Text style={styles.emptyTitle}>No posts yet</Text>
        <Text style={styles.emptyBody}>
          Community stories and ranger updates will appear here.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
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
