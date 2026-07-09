// app/community/sighting.jsx — Wildlife Sighting report form
// (matches silverbacksentry.lovable.app "/community/sighting")
// Species/behavior selects, photo evidence grid, voice-note recorder bar.

import React, { useState } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  Check,
  ChevronDown,
  Image as ImageIcon,
  Mic,
  Play,
  Square,
} from 'lucide-react-native';

import { colors, gradients, radius, fonts, alpha } from '../../components/ui/theme';
import { AppBar, Badge, Card, FieldLabel } from '../../components/ui/Primitives';

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

export default function WildlifeSighting() {
  const router = useRouter();
  const [species, setSpecies] = useState('African Elephant');
  const [behavior, setBehavior] = useState('Foraging');
  const [count, setCount] = useState('');
  const [when, setWhen] = useState('');
  const [description, setDescription] = useState('');
  const [recording, setRecording] = useState(false);

  return (
    <View style={styles.root}>
      <AppBar title="Wildlife Sighting" subtitle="Report what you saw" back="/community" />
      <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        {/* ---------- Details card ---------- */}
        <Card style={styles.formCard}>
          <FieldLabel>Species</FieldLabel>
          <SelectRow value={species} options={SPECIES} label="Species" onChange={setSpecies} />

          <FieldLabel>Number observed</FieldLabel>
          <TextInput
            placeholder="e.g. 5"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="number-pad"
            value={count}
            onChangeText={setCount}
            style={styles.input}
          />

          <FieldLabel>Behavior</FieldLabel>
          <SelectRow value={behavior} options={BEHAVIORS} label="Behavior" onChange={setBehavior} />

          <FieldLabel>Date & time</FieldLabel>
          <TextInput
            placeholder="Today · 14:32"
            placeholderTextColor={colors.mutedForeground}
            value={when}
            onChangeText={setWhen}
            style={styles.input}
          />

          <FieldLabel>Description</FieldLabel>
          <TextInput
            placeholder="What did you observe?"
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
          <FieldLabel>Photo evidence</FieldLabel>
          <View style={styles.photoGrid}>
            <PhotoSlot />
            <PhotoSlot />
            <TouchableOpacity
              style={styles.addPhoto}
              onPress={() => Alert.alert('Add photo', 'Photo capture will open the camera here.')}
            >
              <Camera size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        </Card>

        {/* ---------- Voice note ---------- */}
        <Card style={styles.formCard}>
          <View style={styles.voiceHead}>
            <FieldLabel>Voice note</FieldLabel>
            <Badge tone={recording ? 'danger' : 'default'}>
              {recording ? '● Recording' : 'Optional'}
            </Badge>
          </View>
          <View style={styles.voiceBar}>
            <TouchableOpacity
              onPress={() => setRecording((r) => !r)}
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
                          : alpha(colors.primary, 0.4),
                      },
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.voiceHint}>
                {recording ? '00:12' : 'Tap to record up to 60s'}
              </Text>
            </View>
            <TouchableOpacity style={styles.playBtn}>
              <Play size={14} color={colors.foreground} />
            </TouchableOpacity>
          </View>
        </Card>

        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.submitBtn}
          onPress={() => {
            Alert.alert('Sighting submitted', 'Thank you for helping protect wildlife!');
            router.replace('/community');
          }}
        >
          <Text style={styles.submitText}>Submit sighting</Text>
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

/* ---------- Placeholder photo tile (forest gradient) ---------- */

function PhotoSlot() {
  return (
    <LinearGradient
      colors={gradients.forest}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.photoSlot}
    >
      <ImageIcon size={20} color="rgba(255,255,255,0.7)" />
    </LinearGradient>
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
  photoGrid: { flexDirection: 'row', gap: 8 },
  photoSlot: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhoto: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
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
