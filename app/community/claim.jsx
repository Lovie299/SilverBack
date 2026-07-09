// app/community/claim.jsx — Compensation Claim (placeholder in the
// prototype's design language; linked from the dashboard quick tiles).

import { View, Text, StyleSheet } from 'react-native';
import { Receipt } from 'lucide-react-native';

import { colors, radius, fonts, alpha } from '../../components/ui/theme';
import { AppBar } from '../../components/ui/Primitives';

export default function CompensationClaim() {
  return (
    <View style={styles.root}>
      <AppBar title="Compensation Claim" subtitle="Crop & livestock damage" back="/community" />
      <View style={styles.empty}>
        <View style={styles.emptyIcon}>
          <Receipt size={28} color={colors.accent} />
        </View>
        <Text style={styles.emptyTitle}>Claims portal</Text>
        <Text style={styles.emptyBody}>
          Compensation claim filing is coming soon.
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
    backgroundColor: alpha(colors.accent, 0.15),
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
