// app/community/profile.jsx — Profile & account management (linked from the
// dashboard avatar). Lets the user edit their name, park, and language,
// change their password, toggle biometric sign-in (grayed out when the
// device has no biometric hardware/enrolment), delete the account, and
// sign out. Language changes re-render every translated screen immediately.

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { updateProfile } from 'firebase/auth';
import {
  Camera,
  Check,
  ChevronRight,
  Fingerprint,
  Globe,
  KeyRound,
  LogOut,
  Trash2,
  Trees,
  User as UserIcon,
} from 'lucide-react-native';

import { auth, storage } from '../../firebaseConfig';

import { useAuth } from '../contexts/AuthContext';
import { setAppLanguage, LANGUAGES } from '../../lib/i18n';
import { colors, radius, fonts, shadowCard, alpha } from '../../components/ui/theme';
import { AppBar, Card, FieldLabel } from '../../components/ui/Primitives';
import { useUserPrefs, initials, savePrefs } from '../../components/ui/userPrefs';

const PARKS = [
  'Bwindi Impenetrable',
  'Mgahinga Gorilla',
  'Murchison Falls',
  'Queen Elizabeth',
  'Kibale',
  'Other / future parks',
];

// Copy picker output out of the purgeable OS cache into app documents.
const avatarDirectory = new Directory(Paths.document, 'avatar');

function persistAvatarCopy(uri) {
  try {
    if (!avatarDirectory.exists) avatarDirectory.create({ intermediates: true });
    const dest = new File(avatarDirectory, `avatar-${Date.now()}.jpg`);
    new File(uri).copy(dest);
    return dest.uri;
  } catch (error) {
    console.warn('[profile] could not persist avatar copy:', error.message);
    return uri;
  }
}

export default function Profile() {
  const router = useRouter();
  const { t } = useTranslation();
  const {
    user,
    logout,
    updateDisplayName,
    changePassword,
    deleteAccount,
    biometricEnabled,
    biometricSupported,
    setBiometricAuth,
    getBiometricName,
  } = useAuth();
  const prefs = useUserPrefs();

  // Which bottom sheet / modal is open: 'language' | 'park' | 'name' |
  // 'password' | 'delete' | null.
  const [sheet, setSheet] = useState(null);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);

  const fullName = user?.displayName || prefs.fullName;
  const avatarUri = prefs.avatar || user?.photoURL || null;

  const applyPickedAvatar = async (pickedUri) => {
    setAvatarBusy(true);
    // Durable local copy first — the picture shows immediately and survives
    // even if the Storage upload below cannot complete offline.
    let finalUri = persistAvatarCopy(pickedUri);
    try {
      const response = await fetch(finalUri);
      const blob = await response.blob();
      const fileRef = storageRef(storage, `avatars/${user.uid}`);
      await uploadBytes(fileRef, blob, { contentType: 'image/jpeg' });
      finalUri = await getDownloadURL(fileRef);
      // photoURL must be an http(s) URL — only set after a successful upload.
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { photoURL: finalUri }).catch(() => {});
      }
    } catch (error) {
      console.warn('[profile] avatar upload failed, keeping local copy:', error.message);
    }
    await savePrefs({ avatar: finalUri });
    setAvatarBusy(false);
  };

  const changeAvatar = () => {
    Alert.alert('Profile picture', 'How would you like to set your picture?', [
      {
        text: 'Take photo',
        onPress: async () => {
          const permission = await ImagePicker.requestCameraPermissionsAsync();
          if (permission.status !== 'granted') return;
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.7,
            allowsEditing: true,
            aspect: [1, 1],
          });
          if (!result.canceled && result.assets?.[0]?.uri) applyPickedAvatar(result.assets[0].uri);
        },
      },
      {
        text: 'Choose from library',
        onPress: async () => {
          const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (permission.status !== 'granted') return;
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.7,
            allowsEditing: true,
            aspect: [1, 1],
          });
          if (!result.canceled && result.assets?.[0]?.uri) applyPickedAvatar(result.assets[0].uri);
        },
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const handleLogout = async () => {
    const result = await logout();
    if (result?.success) router.replace('/');
    else Alert.alert('Sign out failed', result?.error ?? 'Please try again.');
  };

  const handleLanguage = async (label) => {
    setSheet(null);
    await savePrefs({ language: label });
    await setAppLanguage(label); // live re-render, no restart needed
  };

  const handlePark = async (park) => {
    setSheet(null);
    await savePrefs({ park });
  };

  const handleBiometricToggle = async (enabled) => {
    setBiometricBusy(true);
    const result = await setBiometricAuth(enabled);
    setBiometricBusy(false);
    if (!result.success) {
      Alert.alert(t('account.biometricLogin'), result.error ?? 'Please try again.');
    }
  };

  return (
    <View style={styles.root}>
      <AppBar title={t('profile.title')} subtitle={t('profile.subtitle')} back="/community" />
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.card}>
          <TouchableOpacity onPress={changeAvatar} disabled={avatarBusy}>
            <View style={styles.avatar}>
              {avatarBusy ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} contentFit="cover" />
              ) : (
                <Text style={styles.avatarText}>{initials(fullName)}</Text>
              )}
            </View>
            <View style={styles.avatarBadge}>
              <Camera size={12} color={colors.primaryForeground} />
            </View>
          </TouchableOpacity>
          <Text style={styles.name}>{fullName}</Text>
          {user?.email ? <Text style={styles.meta}>{user.email}</Text> : null}
          <Text style={styles.meta}>
            {prefs.park} · {prefs.language}
          </Text>
        </Card>

        {/* ---------- Account settings ---------- */}
        <Card style={styles.settingsCard}>
          <FieldLabel>{t('account.section')}</FieldLabel>

          <SettingRow
            icon={UserIcon}
            label={t('account.editName')}
            value={fullName}
            onPress={() => setSheet('name')}
          />
          <SettingRow
            icon={Trees}
            label={t('account.park')}
            value={prefs.park}
            onPress={() => setSheet('park')}
          />
          <SettingRow
            icon={Globe}
            label={t('profile.language')}
            value={prefs.language}
            onPress={() => setSheet('language')}
          />
          <SettingRow
            icon={KeyRound}
            label={t('account.changePassword')}
            value="••••••••"
            onPress={() => setSheet('password')}
          />

          {/* Biometric sign-in: grayed out when unsupported */}
          <View style={[styles.settingRow, !biometricSupported && { opacity: 0.45 }]}>
            <View style={styles.settingIcon}>
              <Fingerprint size={16} color={colors.primary} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.settingLabel}>
                {t('account.biometricLogin')}
                {biometricSupported ? ` (${getBiometricName()})` : ''}
              </Text>
              <Text numberOfLines={2} style={styles.settingValue}>
                {biometricSupported ? t('account.biometricHint') : t('account.biometricUnsupported')}
              </Text>
            </View>
            {biometricBusy ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Switch
                value={biometricEnabled}
                onValueChange={handleBiometricToggle}
                disabled={!biometricSupported}
                trackColor={{ false: colors.border, true: alpha(colors.primary, 0.5) }}
                thumbColor={biometricEnabled ? colors.primary : colors.card}
              />
            )}
          </View>
        </Card>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <LogOut size={16} color={colors.destructive} />
          <Text style={styles.logoutText}>{t('common.signOut')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteBtn} onPress={() => setSheet('delete')}>
          <Trash2 size={14} color={colors.destructive} />
          <Text style={styles.deleteText}>{t('account.deleteAccount')}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ---------- Pickers & modals ---------- */}
      <OptionSheet
        visible={sheet === 'language'}
        title={t('profile.language')}
        options={LANGUAGES.map((l) => l.label)}
        selected={prefs.language}
        onSelect={handleLanguage}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === 'park'}
        title={t('account.park')}
        options={PARKS}
        selected={prefs.park}
        onSelect={handlePark}
        onClose={() => setSheet(null)}
      />
      <EditNameModal
        visible={sheet === 'name'}
        initial={fullName}
        onClose={() => setSheet(null)}
        onSave={async (name) => {
          setSheet(null);
          const result = await updateDisplayName(name);
          if (result.success) {
            await savePrefs({ fullName: name });
            Alert.alert(t('profile.title'), t('account.nameUpdated'));
          } else {
            Alert.alert(t('profile.title'), result.error ?? 'Please try again.');
          }
        }}
      />
      <ChangePasswordModal
        visible={sheet === 'password'}
        onClose={() => setSheet(null)}
        onSave={async (current, next) => {
          const result = await changePassword(current, next);
          if (result.success) {
            setSheet(null);
            Alert.alert(t('account.changePassword'), t('account.passwordChanged'));
          } else {
            Alert.alert(t('account.changePassword'), result.error ?? 'Please try again.');
          }
        }}
      />
      <DeleteAccountModal
        visible={sheet === 'delete'}
        onClose={() => setSheet(null)}
        onConfirm={async (password) => {
          const result = await deleteAccount(password);
          if (result.success) {
            setSheet(null);
            router.replace('/');
          } else {
            Alert.alert(t('account.deleteAccount'), result.error ?? 'Please try again.');
          }
        }}
      />
    </View>
  );
}

/* ---------- Tappable setting row ---------- */

function SettingRow({ icon: Icon, label, value, onPress }) {
  return (
    <TouchableOpacity style={styles.settingRow} onPress={onPress}>
      <View style={styles.settingIcon}>
        <Icon size={16} color={colors.primary} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text numberOfLines={1} style={styles.settingValue}>
          {value}
        </Text>
      </View>
      <ChevronRight size={16} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

/* ---------- Bottom-sheet option picker (shared design language) ---------- */

function OptionSheet({ visible, title, options, selected, onSelect, onClose }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.sheetTitle}>{title}</Text>
          {options.map((option) => (
            <TouchableOpacity
              key={option}
              style={styles.sheetOption}
              onPress={() => onSelect(option)}
            >
              <Text
                style={[
                  styles.sheetOptionText,
                  option === selected && { color: colors.primary, fontFamily: fonts.bold },
                ]}
              >
                {option}
              </Text>
              {option === selected && <Check size={16} color={colors.primary} />}
            </TouchableOpacity>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ---------- Edit name ---------- */

function EditNameModal({ visible, initial, onClose, onSave }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(initial);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.sheetTitle}>{t('account.editName')}</Text>
          <TextInput
            defaultValue={initial}
            onChangeText={setName}
            placeholder={t('account.editName')}
            placeholderTextColor={colors.mutedForeground}
            style={styles.modalInput}
          />
          <ModalActions
            onCancel={onClose}
            onConfirm={() => name.trim() && onSave(name.trim())}
            confirmLabel={t('common.save')}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ---------- Change password ---------- */

function ChangePasswordModal({ visible, onClose, onSave }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!current || !next) return;
    if (next !== confirm) {
      Alert.alert(t('account.changePassword'), t('account.passwordMismatch'));
      return;
    }
    setBusy(true);
    await onSave(current, next);
    setBusy(false);
    setCurrent('');
    setNext('');
    setConfirm('');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.sheetTitle}>{t('account.changePassword')}</Text>
          <TextInput
            placeholder={t('account.currentPassword')}
            placeholderTextColor={colors.mutedForeground}
            secureTextEntry
            autoCapitalize="none"
            value={current}
            onChangeText={setCurrent}
            style={styles.modalInput}
          />
          <TextInput
            placeholder={t('account.newPassword')}
            placeholderTextColor={colors.mutedForeground}
            secureTextEntry
            autoCapitalize="none"
            value={next}
            onChangeText={setNext}
            style={styles.modalInput}
          />
          <TextInput
            placeholder={t('account.confirmPassword')}
            placeholderTextColor={colors.mutedForeground}
            secureTextEntry
            autoCapitalize="none"
            value={confirm}
            onChangeText={setConfirm}
            style={styles.modalInput}
          />
          <ModalActions
            onCancel={onClose}
            onConfirm={submit}
            confirmLabel={t('common.save')}
            busy={busy}
            disabled={!current || !next}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ---------- Delete account ---------- */

function DeleteAccountModal({ visible, onClose, onConfirm }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!password) return;
    setBusy(true);
    await onConfirm(password);
    setBusy(false);
    setPassword('');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={[styles.sheetTitle, { color: colors.destructive }]}>
            {t('account.deleteAccount')}
          </Text>
          <Text style={styles.deleteWarning}>{t('account.deleteWarning')}</Text>
          <TextInput
            placeholder={t('account.currentPassword')}
            placeholderTextColor={colors.mutedForeground}
            secureTextEntry
            autoCapitalize="none"
            value={password}
            onChangeText={setPassword}
            style={styles.modalInput}
          />
          <ModalActions
            onCancel={onClose}
            onConfirm={submit}
            confirmLabel={t('account.deleteAccount')}
            destructive
            busy={busy}
            disabled={!password}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ---------- Shared modal footer ---------- */

function ModalActions({ onCancel, onConfirm, confirmLabel, destructive = false, busy = false, disabled = false }) {
  const { t } = useTranslation();
  return (
    <View style={styles.modalActions}>
      <TouchableOpacity style={styles.modalCancel} onPress={onCancel}>
        <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.modalConfirm,
          destructive && { backgroundColor: colors.destructive },
          (busy || disabled) && { opacity: 0.6 },
        ]}
        disabled={busy || disabled}
        onPress={onConfirm}
      >
        {busy ? (
          <ActivityIndicator size="small" color={colors.primaryForeground} />
        ) : (
          <Text style={styles.modalConfirmText}>{confirmLabel}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingBottom: 24, gap: 16 },
  card: { padding: 24, alignItems: 'center' },
  avatar: {
    height: 72,
    width: 72,
    borderRadius: 999,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  avatarImage: { height: '100%', width: '100%' },
  avatarBadge: {
    position: 'absolute',
    bottom: 8,
    right: -2,
    height: 24,
    width: 24,
    borderRadius: 999,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.primaryForeground, fontSize: 24, fontFamily: fonts.bold },
  name: { fontSize: 18, fontFamily: fonts.displayBold, color: colors.foreground },
  meta: { fontSize: 12, color: colors.mutedForeground, fontFamily: fonts.regular, marginTop: 4 },
  settingsCard: { padding: 16, gap: 4 },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  settingIcon: {
    height: 32,
    width: 32,
    borderRadius: radius.sm,
    backgroundColor: alpha(colors.primary, 0.1),
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingLabel: { fontSize: 13, fontFamily: fonts.semibold, color: colors.foreground },
  settingValue: { fontSize: 11, color: colors.mutedForeground, fontFamily: fonts.regular, marginTop: 1 },
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
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  deleteText: { fontSize: 12, fontFamily: fonts.semibold, color: colors.destructive },
  deleteWarning: {
    fontSize: 13,
    color: colors.mutedForeground,
    fontFamily: fonts.regular,
    lineHeight: 19,
    marginBottom: 12,
  },
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
  sheetOptionText: { fontSize: 14, fontFamily: fonts.regular, color: colors.foreground },
  modalInput: {
    backgroundColor: colors.secondary,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.foreground,
    fontFamily: fonts.regular,
    marginBottom: 10,
  },
  modalActions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  modalCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  modalCancelText: { fontSize: 14, fontFamily: fonts.semibold, color: colors.foreground },
  modalConfirm: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmText: { fontSize: 14, fontFamily: fonts.semibold, color: colors.primaryForeground },
});
