// app/_layout.jsx
// Root layout: Stack navigation matching the Wildwatch prototype flow
// (Landing → Auth → GPS permission → Community section with bottom nav).

import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import {
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

import { AuthProvider } from './contexts/AuthContext';
import { BiometricProvider } from './contexts/BiometricContext';
import { ObservationProvider } from './contexts/ObservationContext';
import { registerBackgroundSync } from './backgroundSync';
import PerformanceMonitor from './utils/performanceMonitor';
import { colors } from '../components/ui/theme';
import '../firebaseConfig';
import '../lib/i18n';

function AppContent() {
  useEffect(() => {
    registerBackgroundSync().catch(console.error);
    PerformanceMonitor.initialize().catch(console.error);
  }, []);

  return (
    <>
      {/* expo-status-bar instead of the react-native-screens statusBar*
          screen options — those hit native iOS status-bar APIs and log
          "UIViewControllerBasedStatusBarAppearance … to YES" warnings. */}
      <StatusBar style="dark" translucent />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <BiometricProvider>
          <ObservationProvider>
            <AppContent />
          </ObservationProvider>
        </BiometricProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
