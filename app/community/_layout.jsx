// app/community/_layout.jsx — Community section shell.
// Every community screen renders inside this layout with the shared
// Home / Chat / Map / SOS bottom navigation pinned below.

import { View, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';

import { useAuth } from '../contexts/AuthContext';
import { BottomNav } from '../../components/ui/Primitives';
import { colors } from '../../components/ui/theme';

export default function CommunityLayout() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1 }}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            animation: 'slide_from_right',
          }}
        />
      </View>
      <BottomNav />
    </View>
  );
}
