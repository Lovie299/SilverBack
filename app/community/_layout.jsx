// app/community/_layout.jsx — Community section shell.
// Every community screen renders inside this layout with the shared
// Home / Feed / SOS bottom navigation pinned below.

import { View } from 'react-native';
import { Stack } from 'expo-router';

import { BottomNav } from '../../components/ui/Primitives';
import { colors } from '../../components/ui/theme';

export default function CommunityLayout() {
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
