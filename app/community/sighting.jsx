// app/community/sighting.jsx — Wildlife Sighting report form
// (matches silverbacksentry.lovable.app "/community/sighting")
// Species/behavior selects, photo evidence grid (expo-image-picker camera +
// gallery), voice-note recorder (expo-audio), and a real Firestore submission
// tagged with the device's GPS position.

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Directory, File, Paths } from 'expo-file-system';
import {
  AudioModule,
  RecordingPresets,
  createAudioPlayer,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { GeoPoint, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import {
  Camera,
  Check,
  ChevronDown,
  Image as ImageIcon,
  Mic,
  Play,
  Square,
} from 'lucide-react-native';

import { useAuth } from '../contexts/AuthContext';
import { db, storage } from '../../firebaseConfig';
import { colors, gradients, radius, fonts, alpha } from '../../components/ui/theme';
import { AppBar, Badge, Card, FieldLabel } from '../../components/ui/Primitives';
import { useUserPrefs } from '../../components/ui/userPrefs';

const SPECIES = [
  'African Elephant',
  'Mountain Gorilla',
  'Buffalo',
  'Bushpig',
  'Monkey',
  'Antelope',
  'Grey Crowned Crane',
  'Other',
];
const BEHAVIORS = ['Foraging', 'Resting', 'Moving', 'Aggressive', 'With young', 'Injured'];

const MAX_RECORDING_MS = 60_000;

// Picker/recorder output lives in the OS cache, which can be purged before
// the report is ever viewed again. Copy every attachment into an app-owned
// documents directory so local URIs stay valid.
const mediaDirectory = new Directory(Paths.document, 'report-media');

function persistLocalCopy(uri, extensionFallback) {
  try {
    if (!mediaDirectory.exists) mediaDirectory.create({ intermediates: true });
    const rawExt = uri.split('.').pop() ?? '';
    const ext = rawExt.length > 0 && rawExt.length <= 5 ? rawExt : extensionFallback;
    const dest = new File(
      mediaDirectory,
      `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`,
    );
    new File(uri).copy(dest);
    return dest.uri;
  } catch (error) {
    console.warn('[sighting] could not persist media copy:', error.message);
    return uri;
  }
}

/** 83250ms → "01:23" for the recorder timer. */
function formatMillis(ms) {
  const total = Math.floor((ms ?? 0) / 1000);
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/** Best-effort Storage upload; returns the download URL or null on failure. */
async function uploadMediaAsync(localUri, storagePath, contentType) {
  try {
    const response = await fetch(localUri);
    const blob = await response.blob();
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, blob, { contentType });
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.warn('[sighting] media upload failed, keeping local URI:', error.message);
    return null;
  }
}

export default function WildlifeSighting() {
  const router = useRouter();
  const { user } = useAuth();
  const prefs = useUserPrefs();
  const { t } = useTranslation();

  const [species, setSpecies] = useState('African Elephant');
  const [behavior, setBehavior] = useState('Foraging');
  const [count, setCount] = useState('');
  const [when, setWhen] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState([]);
  const [voiceUri, setVoiceUri] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  /* ---------- Voice recording (expo-audio) ---------- */

  // LOW_QUALITY preset = compressed AAC — small files for forest bandwidth.
  const recorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const recording = recorderState.isRecording;
  const playerRef = useRef(null);

  useEffect(() => {
    return () => {
      playerRef.current?.remove();
    };
  }, []);

  // Cap voice notes at 60 seconds.
  useEffect(() => {
    if (recording && recorderState.durationMillis >= MAX_RECORDING_MS) {
      stopRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, recorderState.durationMillis]);

  const startRecording = async () => {
    const permission = await AudioModule.requestRecordingPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Microphone', 'Microphone access is required to record a voice note.');
      return;
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (error) {
      Alert.alert('Recording failed', error.message);
    }
  };

  const stopRecording = async () => {
    try {
      await recorder.stop();
      // Depending on platform/timing the finalized path surfaces on the
      // recorder or on its state — check both, then copy the file out of the
      // recorder cache so it survives (and can be replayed) reliably.
      const uri = recorder.uri ?? recorderState.url ?? null;
      if (uri) {
        setVoiceUri(persistLocalCopy(uri, 'm4a'));
      } else {
        Alert.alert('Voice note', 'The recording could not be saved — please try again.');
      }
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    } catch (error) {
      Alert.alert('Recording failed', error.message);
    }
  };

  const playVoiceNote = () => {
    if (!voiceUri) return;
    playerRef.current?.remove();
    playerRef.current = createAudioPlayer({ uri: voiceUri });
    playerRef.current.play();
  };

  /* ---------- Photo evidence (expo-image-picker) ---------- */

  const addPhoto = (uri) => {
    if (uri) {
      const durable = persistLocalCopy(uri, 'jpg');
      setPhotos((existing) => [...existing, durable]);
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Camera', 'Camera access is required to capture evidence photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
    });
    if (!result.canceled) addPhoto(result.assets?.[0]?.uri);
  };

  const pickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Photos', 'Photo library access is required to upload evidence.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
    });
    if (!result.canceled) addPhoto(result.assets?.[0]?.uri);
  };

  const promptAddPhoto = () => {
    Alert.alert('Add photo', 'How would you like to add evidence?', [
      { text: 'Take photo', onPress: takePhoto },
      { text: 'Choose from library', onPress: pickFromLibrary },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const removePhoto = (uri) => {
    setPhotos((existing) => existing.filter((p) => p !== uri));
  };

  /* ---------- Submission ---------- */

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert('Not signed in', 'Please sign in again to submit a report.');
      return;
    }
    if (recording) await stopRecording();
    setSubmitting(true);
    try {
      // Best-effort GPS tag; the report still goes through without a fix.
      let coordinate = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          coordinate = new GeoPoint(position.coords.latitude, position.coords.longitude);
        }
      } catch (locationError) {
        console.warn('[sighting] location unavailable:', locationError.message);
      }

      const stamp = Date.now();
      const images = [];
      for (let i = 0; i < photos.length; i += 1) {
        const url = await uploadMediaAsync(
          photos[i],
          `sightings/${user.uid}/${stamp}-photo-${i}.jpg`,
          'image/jpeg',
        );
        images.push(url ?? photos[i]);
      }
      let voiceNoteUrl = null;
      if (voiceUri) {
        voiceNoteUrl =
          (await uploadMediaAsync(
            voiceUri,
            `sightings/${user.uid}/${stamp}-voice.m4a`,
            'audio/m4a',
          )) ?? voiceUri;
      }

      await addDoc(collection(db, 'sightings'), {
        reporterId: user.uid,
        type: 'sighting',
        species: species.toLowerCase().replace(/\s+/g, '_'),
        speciesLabel: species,
        behavior,
        count: count.trim(),
        whenText: when.trim(),
        notes: description.trim(),
        park: prefs.park,
        coordinate,
        images,
        voiceNoteUrl,
        status: 'pending',
        timestamp: serverTimestamp(),
        syncedAt: null,
      });

      Alert.alert('Sighting submitted', 'Thank you for helping protect wildlife!');
      // The dashboard's onSnapshot listener picks the new document up
      // instantly, so the landing page already shows this report.
      router.replace('/community');
    } catch (error) {
      Alert.alert('Submission failed', error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <AppBar title={t('sighting.title')} subtitle={t('sighting.subtitle')} back="/community" />
      <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        {/* ---------- Details card ---------- */}
        <Card style={styles.formCard}>
          <FieldLabel>{t('sighting.species')}</FieldLabel>
          <SelectRow value={species} options={SPECIES} label={t('sighting.species')} onChange={setSpecies} />

          <FieldLabel>{t('sighting.numberObserved')}</FieldLabel>
          <TextInput
            placeholder="e.g. 5"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="number-pad"
            value={count}
            onChangeText={setCount}
            style={styles.input}
          />

          <FieldLabel>{t('sighting.behavior')}</FieldLabel>
          <SelectRow value={behavior} options={BEHAVIORS} label={t('sighting.behavior')} onChange={setBehavior} />

          <FieldLabel>{t('sighting.dateTime')}</FieldLabel>
          <TextInput
            placeholder="Today · 14:32"
            placeholderTextColor={colors.mutedForeground}
            value={when}
            onChangeText={setWhen}
            style={styles.input}
          />

          <FieldLabel>{t('sighting.description')}</FieldLabel>
          <TextInput
            placeholder={t('sighting.descPlaceholder')}
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={3}
            value={description}
            onChangeText={setDescription}
            style={[styles.input, styles.textarea]}
          />
        </Card>

        {/* ---------- Photo evidence ---------- */}
        <Card style={styles.formCard}>
          <FieldLabel>{t('sighting.photoEvidence')}</FieldLabel>
          {/* Unlimited photos: every picked/captured shot gets a tile, and the
              dashed add tile is always available for the next one. */}
          <View style={styles.photoGrid}>
            {photos.map((uri) => (
              <PhotoSlot key={uri} uri={uri} onRemove={() => removePhoto(uri)} />
            ))}
            {photos.length === 0 && <PhotoSlot onAdd={pickFromLibrary} />}
            {photos.length === 0 && <PhotoSlot onAdd={takePhoto} />}
            <TouchableOpacity style={styles.addPhoto} onPress={promptAddPhoto}>
              <Camera size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        </Card>

        {/* ---------- Voice note ---------- */}
        <Card style={styles.formCard}>
          <View style={styles.voiceHead}>
            <FieldLabel>{t('sighting.voiceNote')}</FieldLabel>
            <Badge tone={recording ? 'danger' : 'default'}>
              {recording ? t('sighting.recording') : t('common.optional')}
            </Badge>
          </View>
          <View style={styles.voiceBar}>
            <TouchableOpacity
              onPress={() => (recording ? stopRecording() : startRecording())}
              style={[
                styles.recordBtn,
                { backgroundColor: recording ? colors.destructive : colors.primary },
              ]}
            >
              {recording ? (
                <Square size={18} color={colors.destructiveForeground} />
              ) : (
                <Mic size={18} color={colors.primaryForeground} />
              )}
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <View style={styles.waveform}>
                {Array.from({ length: 28 }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.waveBar,
                      {
                        height: `${20 + Math.abs(Math.sin(i)) * 80}%`,
                        backgroundColor: recording
                          ? colors.destructive
                          : voiceUri
                            ? colors.primary
                            : alpha(colors.primary, 0.4),
                      },
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.voiceHint}>
                {recording
                  ? formatMillis(recorderState.durationMillis)
                  : voiceUri
                    ? formatMillis(recorderState.durationMillis)
                    : t('sighting.tapToRecord')}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.playBtn, !voiceUri && { opacity: 0.4 }]}
              disabled={!voiceUri}
              onPress={playVoiceNote}
            >
              <Play size={14} color={colors.foreground} />
            </TouchableOpacity>
          </View>
        </Card>

        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
          disabled={submitting}
          onPress={handleSubmit}
        >
          {submitting ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={styles.submitText}>{t('sighting.submit')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

/* ---------- Secondary-surface select with bottom sheet ---------- */

function SelectRow({ value, options, label, onChange }) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  return (
    <>
      <TouchableOpacity style={styles.selectRow} onPress={() => setOpen(true)}>
        <Text style={styles.selectValue}>{value}</Text>
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
    </>
  );
}

/* ---------- Photo tile: picked image, or forest-gradient placeholder ---------- */

function PhotoSlot({ uri, onRemove, onAdd }) {
  if (uri) {
    return (
      <TouchableOpacity
        style={styles.photoSlot}
        onLongPress={() =>
          Alert.alert('Remove photo', 'Remove this photo from the report?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: onRemove },
          ])
        }
      >
        <Image source={{ uri }} style={styles.photoImage} contentFit="cover" />
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity style={styles.photoSlot} onPress={onAdd}>
      <LinearGradient
        colors={gradients.forest}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.photoFill}
      >
        <ImageIcon size={20} color="rgba(255,255,255,0.7)" />
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  list: { paddingHorizontal: 20, paddingBottom: 24, gap: 16 },
  formCard: { padding: 16, gap: 12 },
  input: {
    backgroundColor: colors.secondary,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.foreground,
    fontFamily: fonts.regular,
  },
  textarea: { minHeight: 76, textAlignVertical: 'top' },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.secondary,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  selectValue: { fontSize: 14, color: colors.foreground, fontFamily: fonts.regular },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoSlot: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoFill: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoImage: { width: '100%', height: '100%', borderRadius: radius.md },
  addPhoto: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: radius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  voiceHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  voiceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.secondary,
    borderRadius: radius.md,
    padding: 12,
  },
  recordBtn: {
    height: 48,
    width: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0b2010',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 32,
  },
  waveBar: { flex: 1, borderRadius: 999 },
  voiceHint: {
    fontSize: 11,
    color: colors.mutedForeground,
    fontFamily: fonts.regular,
    marginTop: 4,
  },
  playBtn: {
    height: 36,
    width: 36,
    borderRadius: 999,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  submitText: { color: colors.primaryForeground, fontSize: 16, fontFamily: fonts.semibold },
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
});
