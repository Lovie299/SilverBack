// components/ui/ChatLockGate.jsx
// Privacy gate wrapped around the chat screens: content stays hidden until
// the user unlocks with biometrics (when enabled on this device) or their
// account password. One successful unlock covers all chats for the session.

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Fingerprint, Lock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../../app/contexts/AuthContext';
import { colors, radius, fonts, alpha, shadowCard } from './theme';

// Session-scoped: cleared when the app process restarts.
let unlockedThisSession = false;

export function resetChatLock() {
  unlockedThisSession = false;
}

export default function ChatLockGate({ children }) {
  const { t } = useTranslation();
  const { biometricEnabled, biometricSupported, authenticateWithBiometrics, verifyPassword } =
    useAuth();
  const [unlocked, setUnlocked] = useState(unlockedThisSession);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const promptedRef = useRef(false);

  const useBiometrics = biometricEnabled && biometricSupported;

  const unlock = () => {
    unlockedThisSession = true;
    setUnlocked(true);
  };

  const tryBiometrics = async () => {
    setBusy(true);
    setError(null);
    const result = await authenticateWithBiometrics('open your chats');
    setBusy(false);
    if (result.success && !result.skipped) unlock();
    else if (!result.success) setError(t('chat.lockFailed'));
  };

  const tryPassword = async () => {
    if (!password) return;
    setBusy(true);
    setError(null);
    const result = await verifyPassword(password);
    setBusy(false);
    if (result.success) unlock();
    else setError(t('chat.wrongPassword'));
  };

  // Biometric users get prompted immediately on entry.
  useEffect(() => {
    if (!unlocked && useBiometrics && !promptedRef.current) {
      promptedRef.current = true;
      tryBiometrics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked, useBiometrics]);

  if (unlocked) return children;

  return (
    <View style={styles.center}>
      <View style={styles.iconWrap}>
        <Lock size={28} color={colors.primary} />
      </View>
      <Text style={styles.title}>{t('chat.locked')}</Text>
      <Text style={styles.body}>{t('chat.lockedBody')}</Text>

      {useBiometrics ? (
        <TouchableOpacity
          onPress={tryBiometrics}
          disabled={busy}
          style={[styles.bioBtn, busy && { opacity: 0.7 }]}
        >
          <Fingerprint size={18} color={colors.primaryForeground} />
          <Text style={styles.bioText}>{t('chat.useBiometrics')}</Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.passwordRow}>
        <TextInput
          placeholder={t('chat.passwordPlaceholder')}
          placeholderTextColor={colors.mutedForeground}
          secureTextEntry
          autoCapitalize="none"
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={tryPassword}
          style={styles.passwordInput}
        />
        <TouchableOpacity
          onPress={tryPassword}
          disabled={busy || !password}
          style={[styles.unlockBtn, (busy || !password) && { opacity: 0.6 }]}
        >
          {busy ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <Text style={styles.unlockText}>{t('chat.unlock')}</Text>
          )}
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
    backgroundColor: colors.background,
  },
  iconWrap: {
    height: 64,
    width: 64,
    borderRadius: radius.lg,
    backgroundColor: alpha(colors.primary, 0.1),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: { fontSize: 18, fontFamily: fonts.displayBold, color: colors.foreground },
  body: {
    fontSize: 13,
    color: colors.mutedForeground,
    fontFamily: fonts.regular,
    textAlign: 'center',
    lineHeight: 19,
  },
  bioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: radius.lg,
    marginTop: 8,
    ...shadowCard,
  },
  bioText: { color: colors.primaryForeground, fontSize: 14, fontFamily: fonts.semibold },
  passwordRow: { flexDirection: 'row', gap: 8, marginTop: 8, width: '100%' },
  passwordInput: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.foreground,
    fontFamily: fonts.regular,
  },
  unlockBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlockText: { color: colors.primaryForeground, fontSize: 14, fontFamily: fonts.semibold },
  error: { fontSize: 12, color: colors.destructive, fontFamily: fonts.regular, marginTop: 4 },
});
