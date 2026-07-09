// app/community/profile.jsx — Profile (minimal, design-consistent; linked
// from the dashboard avatar). Shows account info and sign-out.

import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { LogOut } from 'lucide-react-native';

import { useAuth } from '../contexts/AuthContext';
import { colors, radius, fonts, shadowCard } from '../../components/ui/theme';
import { AppBar, Card } from '../../components/ui/Primitives';
import { useUserPrefs, initials } from '../../components/ui/userPrefs';

export default function Profile() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const prefs = useUserPrefs();

  const fullName = user?.displayName || prefs.fullName;

  const handleLogout = async () => {
    const result = await logout();
    if (result?.success) router.replace('/');
    else Alert.alert('Sign out failed', result?.error ?? 'Please try again.');
  };

  return (
    <View style={styles.root}>
      <AppBar title="Profile" subtitle="Your account" back="/community" />
      <View style={styles.content}>
        <Card style={styles.card}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(fullName)}</Text>
          </View>
          <Text style={styles.name}>{fullName}</Text>
          {user?.email ? <Text style={styles.meta}>{user.email}</Text> : null}
          <Text style={styles.meta}>
            {prefs.park} · {prefs.language}
          </Text>
        </Card>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <LogOut size={16} color={colors.destructive} />
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, gap: 16 },
  card: { padding: 24, alignItems: 'center' },
  avatar: {
    height: 72,
    width: 72,
    borderRadius: 999,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { color: colors.primaryForeground, fontSize: 24, fontFamily: fonts.bold },
  name: { fontSize: 18, fontFamily: fonts.displayBold, color: colors.foreground },
  meta: { fontSize: 12, color: colors.mutedForeground, fontFamily: fonts.regular, marginTop: 4 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingVertical: 14,
    ...shadowCard,
  },
  logoutText: { fontSize: 14, fontFamily: fonts.semibold, color: colors.destructive },
});
