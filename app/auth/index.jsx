// app/auth/index.jsx — Authentication (matches silverbacksentry.lovable.app "/auth")
// Forest header with rounded base, Sign in / Register segmented card,
// email/phone method toggle, and register-only language & park selectors.
// Email auth is wired to the real Firebase AuthContext; success → /gps.

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Leaf,
  Mail,
  Phone,
  Lock,
  User,
  Globe,
  Trees,
  ChevronDown,
  Check,
} from 'lucide-react-native';

import { useAuth } from '../contexts/AuthContext';
import { colors, radius, fonts, shadowCard } from '../../components/ui/theme';
import { ForestHeader } from '../../components/ui/Primitives';
import { savePrefs } from '../../components/ui/userPrefs';

const LANGUAGES = ['English', 'Luganda', 'Runyankole', 'Rukiga', 'Lugbara', 'Swahili'];
const PARKS = [
  'Bwindi Impenetrable',
  'Mgahinga Gorilla',
  'Murchison Falls',
  'Queen Elizabeth',
  'Kibale',
  'Other / future parks',
];

export default function AuthScreen() {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [method, setMethod] = useState('email'); // 'email' | 'phone'
  const [fullName, setFullName] = useState('');
  const [identifier, setIdentifier] = useState(''); // email or phone
  const [password, setPassword] = useState('');
  const [language, setLanguage] = useState('English');
  const [park, setPark] = useState('Bwindi Impenetrable');
  const [loading, setLoading] = useState(false);

  const { signIn, signUp } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleSubmit = async () => {
    if (method === 'phone') {
      Alert.alert('Phone sign-in', 'Phone authentication is coming soon — please use email for now.');
      return;
    }
    if (!identifier || !password) {
      Alert.alert('Missing details', 'Please fill in your email and password.');
      return;
    }
    if (mode === 'register' && !fullName.trim()) {
      Alert.alert('Missing details', 'Please enter your full name.');
      return;
    }

    setLoading(true);
    const result =
      mode === 'login'
        ? await signIn(identifier.trim(), password)
        : await signUp(identifier.trim(), password, fullName.trim());
    setLoading(false);

    if (!result.success) {
      Alert.alert('Authentication failed', result.error ?? 'Please try again.');
      return;
    }
    if (mode === 'register') {
      await savePrefs({ fullName: fullName.trim() || 'Friend', language, park });
    }
    router.replace('/gps');
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ statusBarStyle: 'light' }} />
      <ScrollView bounces={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
        {/* ---------- Forest gradient header ---------- */}
        <ForestHeader roundness={radius.header} style={{ paddingBottom: 32 }}>
          <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 24 }}>
            <View style={styles.brandRow}>
              <View style={styles.brandMark}>
                <Leaf size={20} color={colors.accent} />
              </View>
              <Text style={styles.brandName}>Wildwatch</Text>
            </View>
            <Text style={styles.headline}>
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </Text>
            <Text style={styles.subline}>
              {mode === 'login'
                ? 'Sign in to continue protecting wildlife.'
                : 'Join the conservation community.'}
            </Text>
          </View>
        </ForestHeader>

        {/* ---------- Sign in / Register segmented card ---------- */}
        <View style={styles.segmentWrap}>
          <View style={styles.segmentCard}>
            {['login', 'register'].map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => setMode(m)}
                style={[styles.segmentBtn, mode === m && styles.segmentBtnActive]}
              >
                <Text style={[styles.segmentText, mode === m && styles.segmentTextActive]}>
                  {m === 'login' ? 'Sign in' : 'Register'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.form}>
          {/* Email / Phone method toggle */}
          <View style={styles.methodToggle}>
            {['email', 'phone'].map((m) => {
              const Icon = m === 'email' ? Mail : Phone;
              const active = method === m;
              return (
                <TouchableOpacity
                  key={m}
                  onPress={() => setMethod(m)}
                  style={[styles.methodBtn, active && styles.methodBtnActive]}
                >
                  <Icon size={14} color={active ? colors.foreground : colors.mutedForeground} />
                  <Text style={[styles.methodText, active && styles.methodTextActive]}>
                    {m}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {mode === 'register' && (
            <Field icon={User} placeholder="Full name" value={fullName} onChangeText={setFullName} />
          )}

          <Field
            icon={method === 'email' ? Mail : Phone}
            placeholder={method === 'email' ? 'you@example.com' : '+256 700 000 000'}
            keyboardType={method === 'email' ? 'email-address' : 'phone-pad'}
            autoCapitalize="none"
            value={identifier}
            onChangeText={setIdentifier}
          />
          <Field
            icon={Lock}
            placeholder="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {mode === 'register' && (
            <>
              <SelectField
                icon={Globe}
                label="Preferred language"
                value={language}
                options={LANGUAGES}
                onChange={setLanguage}
              />
              <SelectField
                icon={Trees}
                label="National park"
                value={park}
                options={PARKS}
                onChange={setPark}
              />
            </>
          )}

          {mode === 'login' && (
            <TouchableOpacity style={styles.forgotWrap}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
            style={[styles.submitBtn, loading && { opacity: 0.7 }]}
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={styles.submitText}>
                {mode === 'login' ? 'Sign in' : 'Create account'}
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.socialRow}>
            {['Google', 'Apple'].map((provider) => (
              <TouchableOpacity
                key={provider}
                style={styles.socialBtn}
                onPress={() => Alert.alert(provider, `${provider} sign-in is coming soon.`)}
              >
                <Text style={styles.socialText}>{provider}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.terms}>
            By continuing you agree to our <Text style={styles.termsLink}>Terms</Text> and{' '}
            <Text style={styles.termsLink}>Privacy Policy</Text>.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ---------- Icon input row ---------- */

function Field({ icon: Icon, ...inputProps }) {
  return (
    <View style={styles.field}>
      <Icon size={18} color={colors.mutedForeground} />
      <TextInput
        placeholderTextColor={colors.mutedForeground}
        style={styles.fieldInput}
        {...inputProps}
      />
    </View>
  );
}

/* ---------- Labelled select opening a bottom-sheet picker ---------- */

function SelectField({ icon: Icon, label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  return (
    <View>
      <Text style={styles.selectLabel}>{label}</Text>
      <TouchableOpacity style={styles.field} onPress={() => setOpen(true)}>
        <Icon size={18} color={colors.mutedForeground} />
        <Text style={[styles.fieldInput, { paddingVertical: 0 }]}>{value}</Text>
        <ChevronDown size={16} color={colors.mutedForeground} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.sheetTitle}>{label}</Text>
            {options.map((option) => (
              <TouchableOpacity
                key={option}
                style={styles.sheetOption}
                onPress={() => {
                  onChange(option);
                  setOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.sheetOptionText,
                    option === value && { color: colors.primary, fontFamily: fonts.bold },
                  ]}
                >
                  {option}
                </Text>
                {option === value && <Check size={16} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandMark: {
    height: 40,
    width: 40,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    color: colors.white,
    fontSize: 18,
    fontFamily: fonts.displayBold,
  },
  headline: {
    color: colors.white,
    fontSize: 24,
    fontFamily: fonts.display,
    marginTop: 24,
  },
  subline: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    marginTop: 4,
    fontFamily: fonts.regular,
  },
  segmentWrap: { paddingHorizontal: 20, marginTop: -20 },
  segmentCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 4,
    flexDirection: 'row',
    ...shadowCard,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  segmentBtnActive: { backgroundColor: colors.primary },
  segmentText: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.mutedForeground,
  },
  segmentTextActive: { color: colors.primaryForeground },
  form: { paddingHorizontal: 20, marginTop: 20, gap: 16 },
  methodToggle: {
    backgroundColor: colors.secondary,
    borderRadius: radius.md,
    padding: 4,
    flexDirection: 'row',
  },
  methodBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  methodBtnActive: {
    backgroundColor: colors.card,
    shadowColor: '#0b2010',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  methodText: {
    fontSize: 12,
    fontFamily: fonts.semibold,
    color: colors.mutedForeground,
    textTransform: 'capitalize',
  },
  methodTextActive: { color: colors.foreground },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  fieldInput: {
    flex: 1,
    fontSize: 14,
    color: colors.foreground,
    fontFamily: fonts.regular,
    padding: 0,
  },
  selectLabel: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  forgotWrap: { alignSelf: 'flex-end', marginTop: -8 },
  forgotText: { fontSize: 12, fontFamily: fonts.semibold, color: colors.primary },
  submitBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radius.lg,
    alignItems: 'center',
    shadowColor: '#0b2010',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  submitText: {
    color: colors.primaryForeground,
    fontSize: 16,
    fontFamily: fonts.semibold,
  },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontSize: 11, color: colors.mutedForeground, fontFamily: fonts.regular },
  socialRow: { flexDirection: 'row', gap: 8 },
  socialBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
  },
  socialText: { fontSize: 14, fontFamily: fonts.semibold, color: colors.foreground },
  terms: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.mutedForeground,
    fontFamily: fonts.regular,
    paddingTop: 8,
    paddingBottom: 24,
    lineHeight: 18,
  },
  termsLink: { color: colors.primary, fontFamily: fonts.semibold },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11,32,16,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sheetTitle: {
    fontSize: 14,
    fontFamily: fonts.displayBold,
    color: colors.foreground,
    marginBottom: 8,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.muted,
  },
  sheetOptionText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.foreground,
  },
});
