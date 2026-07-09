// app/community/conflict.jsx — Human–Wildlife Conflict report (placeholder
// in the prototype's design language; linked from the dashboard quick tiles).

import { View, Text, StyleSheet } from 'react-native';
import { TriangleAlert } from 'lucide-react-native';

import { colors, radius, fonts, alpha } from '../../components/ui/theme';
import { AppBar } from '../../components/ui/Primitives';

export default function ConflictReport() {
  return (
    <View style={styles.root}>
      <AppBar title="Report Conflict" subtitle="Human–wildlife incident" back="/community" />
      <View style={styles.empty}>
        <View style={styles.emptyIcon}>
          <TriangleAlert size={28} color={colors.destructive} />
        </View>
        <Text style={styles.emptyTitle}>Conflict reporting</Text>
        <Text style={styles.emptyBody}>
          The full conflict report form is coming soon. For emergencies, use SOS.
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
    backgroundColor: alpha(colors.destructive, 0.1),
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
