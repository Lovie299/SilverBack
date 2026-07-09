// components/ui/userPrefs.js
// Lightweight user preferences (name, language, park) mirroring the web
// prototype's localStorage store, backed by AsyncStorage on device.

import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'wildwatch.prefs';

export const DEFAULT_PREFS = {
  fullName: 'Friend',
  language: 'English',
  park: 'Bwindi Impenetrable',
};

const listeners = new Set();
let cached = { ...DEFAULT_PREFS };
let loaded = false;

async function load() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) cached = { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    cached = { ...DEFAULT_PREFS };
  }
  loaded = true;
  listeners.forEach((l) => l(cached));
}

export async function savePrefs(partial) {
  cached = { ...cached, ...partial };
  listeners.forEach((l) => l(cached));
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(cached));
  } catch {
    // Non-fatal: prefs simply won't persist this session.
  }
}

/** Live prefs hook — updates everywhere when savePrefs() is called. */
export function useUserPrefs() {
  const [prefs, setPrefs] = useState(cached);
  useEffect(() => {
    listeners.add(setPrefs);
    if (!loaded) load();
    else setPrefs(cached);
    return () => listeners.delete(setPrefs);
  }, []);
  return prefs;
}

/** "Amara Nakato" → "AN" for avatar bubbles. */
export function initials(name) {
  return (
    (name || '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('') || 'U'
  );
}
